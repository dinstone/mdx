/**
 * Workspace store — manages workspace lifecycle only.
 *
 * Responsibilities:
 *   - current: which IWorkspace is active
 *   - recentWorkspaces: persisted recently-opened list
 *   - open() / close() + serialisation
 *
 * Everything else (file-tree state, CRUD, refresh) is owned by the IWorkspace
 * object itself.  The store exposes thin delegation computed / methods for
 * template convenience so consumers can write `workspace.entries` instead of
 * `workspace.current?.entries`.
 */

import { defineStore } from 'pinia'
import { shallowRef, computed, triggerRef } from 'vue'
import type { WorkspaceState, FileEntry } from '../bridge'
import {
  type IWorkspace,
  type RecentEntry,
  VirtualWorkspace,
  createWorkspace,
  workspaceForPath,
} from './workspace-types'

const RECENT_WORKSPACES_KEY = 'mdx-recent-workspaces'
const MAX_RECENT_WORKSPACES = 10

/** Temp 虚拟工作区首次创建时写入的欢迎文档内容。 */
const TEMP_WELCOME_DOC = String.raw`# 欢迎使用 MDX
这是一个现代化的 Markdown 编辑器，专为**微信公众号**排版设计。

## 关于工作区
当前打开的是 **临时工作区（Temp）**，所有文件都保存在浏览器本地（IndexedDB），刷新或重启应用不会丢失。切换到其他工作区可以打开真实文件夹，文件将保存在磁盘上。

## 快速开始
- 在左侧侧边栏点击加号新建 Markdown 文档
- 编辑器支持标准 Markdown 语法
- 顶栏可一键复制 HTML 或 复制到公众号

## 支持的语法
1. 标题、列表、引用
2. 加粗、斜体、删除线
3. 行内代码与代码块
4. 表格与分割线
5. 数学公式（KaTeX 渲染）
6. 图片本地存储，复制会嵌入文档，不用再上传

> 祝你写作愉快！

# 以下为参考示例

## 1. 基础语法
**这是加粗文本**

*这是斜体文本*

***这是加粗斜体文本***

~~这是删除线文本~~

==这是高亮文本==

这是一个 [链接](https://github.com/your-repo)

## 2. 特殊格式
### 上标和下标

水的化学式：H~2~O

爱因斯坦质能方程：E=mc^2^

### Emoji 表情
今天天气真好 :sunny: 

让我们一起学习 :books: 

加油 :rocket:

## 3. 列表展示
### 无序列表
- 列表项 1
- 列表项 2
  - 子列表项 2.1
  - 子列表项 2.2

### 有序列表
1. 第一步
2. 第二步
3. 第三步

## 4. 引用
> 这是一个一级引用
> 
> > 这是一个二级引用
> > 
> > > 这是一个三级引用
> 

> [!TIP]
> 这是一个技巧提示块

> [!NOTE]
> 这是一个备注提示块

> [!IMPORTANT]
> 这是一个重要信息提示块

> [!WARNING]
> 这是一个警告提示块

> [!CAUTION]
> 这是一个危险提示块

## 5. 代码展示
### 行内代码
我们在代码中通常使用 <code>console.log()</code> 来输出信息。

### 代码块
    // JavaScript 示例
    function hello() {
      console.log('Hello, WeMD!');
      const a = 1;
      const b = 2;
      return a + b;
    }

## 6. 数学公式
行内公式: $E=mc^2$

行间公式:
$$
\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}
$$

## 7. 脚注与链接建议
这里演示脚注的使用：[WeChat Markdown](https://github.com/tenngoxars/WeMD "WeMD 是一款专为公众号设计的编辑器") 可以极大提升排版效率。

在 WeMD 中，只需为链接添加“标题”（双引号里的文字），系统就会自动将其转换为文末脚注，这是最符合微信公众号习惯的排法。

## 8. 表格
| 姓名 | 年龄 | 职业 |
| :--- | :---: | ---: |
| 张三 | 18 | 工程师 |
| 李四 | 20 | 设计师 |
| 王五 | 22 | 产品经理 |

## 9. 分割线
---

## 10. 图片
![MDX：专为微信公众号设计的现代化 Markdown 编辑器](https://img.wemd.app/example.jpg)
`

export const useWorkspaceStore = defineStore('workspace', () => {
  // ---- state ----

  /** The currently-open workspace object.
   *  shallowRef — prevents Vue from deep-reactively wrapping the IWorkspace
   *  class instance, which would auto-unwrap its internal Ref properties and
   *  break getters like `get rootPath() { return this._rootPath.value }`. */
  const current = shallowRef<IWorkspace | null>(null)

  /** Persisted recently-opened workspaces.
   *  shallowRef — same reason as current: prevents Vue from auto-unwrapping
   *  internal Ref properties on IWorkspace instances, which would break
   *  saveRecentWorkspaces() and produce garbage localStorage data. */
  const recentWorkspaces = shallowRef<IWorkspace[]>([])

  /** Monotonic counter to discard stale open() results. */
  let openSeq = 0

  // ---- computed (delegate to current) ----

  const rootPath = computed(() => current.value?.rootPath ?? '')
  const title = computed(() => current.value?.title ?? '')
  const entries = computed(() => [...(current.value?.entries ?? [])])
  const activeFileId = computed(() => current.value?.activeFileId ?? '')
  const loading = computed(() => current.value?.loading ?? false)
  const error = computed(() => current.value?.error ?? null)
  const isOpen = computed(() => rootPath.value !== '')
  const hasActiveFile = computed(() => activeFileId.value !== '')

  /** Flattened list of .md files from the tree (for quick navigation). */
  const mdFiles = computed<string[]>(() => {
    const result: string[] = []
    const walk = (list: FileEntry[]) => {
      for (const e of list) {
        if (e.type === 'file' && e.name.endsWith('.md')) result.push(e.path)
        if (e.children) walk(e.children)
      }
    }
    walk(entries.value)
    return result
  })

  // ---- serialisation ----

  function loadRecentWorkspaces() {
    try {
      const raw = localStorage.getItem(RECENT_WORKSPACES_KEY)
      if (raw) {
        const data: RecentEntry[] = JSON.parse(raw)
        recentWorkspaces.value = data.map((e) => createWorkspace(e))
      }
    } catch {
      /* non-critical */
    }
  }

  function saveRecentWorkspaces() {
    try {
      const data: RecentEntry[] = recentWorkspaces.value.map((w) => ({
        path: w.path,
        name: w.name,
        isTemp: w.kind === 'virtual',
      }))
      localStorage.setItem(RECENT_WORKSPACES_KEY, JSON.stringify(data))
    } catch {
      /* non-critical */
    }
  }

  function addRecentWorkspace(ws: IWorkspace) {
    // Build a new array (immutable) so shallowRef detects the change.
    const filtered = recentWorkspaces.value.filter((w) => w.path !== ws.path)
    recentWorkspaces.value = [ws, ...filtered].slice(0, MAX_RECENT_WORKSPACES)
    saveRecentWorkspaces()
  }

  /** 从最近工作区列表中移除，仅清理记录，不删除实际文件夹 */
  function removeRecentWorkspace(ws: IWorkspace) {
    recentWorkspaces.value = recentWorkspaces.value.filter((w) => w.path !== ws.path)
    saveRecentWorkspaces()
  }

  /** Find a workspace by path in recents, or create a new one. */
  function resolveWorkspace(dirPath: string): IWorkspace {
    return (
      recentWorkspaces.value.find((w) => w.path === dirPath) ??
      workspaceForPath(dirPath)
    )
  }

  // ---- actions (lifecycle) ----

  /**
   * Startup entry point.  Loads recently-opened workspaces from
   * localStorage, picks the most recent one, and opens it.
   *
   * Falls back to a temp VirtualWorkspace when no recents exist.
   *
   * Safe to call multiple times (e.g. browser-mode init followed by
   * DesktopBridge re-open in Wails) — openSeq handles race protection.
   */
  async function open() {
    loadRecentWorkspaces()
    if (recentWorkspaces.value.length > 0) {
      await openWorkspace(recentWorkspaces.value[0])
    } else {
      const temp = new VirtualWorkspace('/Temp', 'Temp')
      await openWorkspace(temp)
      await seedTempWorkspace(temp)
    }
  }

  /**
   * 首次创建 Temp 虚拟工作区时，若其中还没有任何 md 文件，
   * 自动写入一份欢迎文档并设为当前活动文件，方便用户上手。
   * 若工作区已包含文件（如用户之前用过 Temp 后清空、或来自真实目录），
   * 则不重复播种。
   */
  async function seedTempWorkspace(ws: IWorkspace) {
    if (ws.kind !== 'virtual') return
    if (mdFiles.value.length > 0) return
    const path = await createFile(ws.rootPath, 'welcome.md')
    await ws.bridge.writeFile(path, TEMP_WELCOME_DOC)
    await setActiveFile(path)
  }

  /**
   * Open a specific workspace explicitly (e.g. picked from the
   * WorkspacePicker or re-opened after DesktopBridge init).
   *
   * Sets current immediately so that loading state is visible; the openSeq
   * counter discards stale results when overlapping calls occur.
   */
  async function openWorkspace(ws: IWorkspace) {
    const seq = ++openSeq
    current.value = ws
    try {
      await ws.open()
      if (seq !== openSeq) return
      addRecentWorkspace(ws)
    } catch (e: unknown) {
      if (seq !== openSeq) return
      current.value = null
      throw e
    }
  }

  async function close() {
    if (current.value) await current.value.close()
    current.value = null
  }

  /** Apply a pre-fetched state snapshot (e.g. from desktop pickFolder). */
  function applyState(state: WorkspaceState) {
    const ws = resolveWorkspace(state.rootPath)
    ws.applyState(state)
    current.value = ws
    addRecentWorkspace(ws)
  }

  // ---- helpers ----

  /** Forces all shallowRef-based computeds (entries, rootPath, title, etc.)
   *  to re-evaluate after a mutation on the workspace instance.  Without this,
   *  in-place mutations on deeply-nested properties inside the class's internal
   *  refs are invisible to the Pinia computed chain.
   *
   *  For async mutations the triggerRef fires AFTER the promise settles so
   *  the internal refs have already been updated. */
  function mutate<T>(fn: () => T): T {
    const result = fn()
    if (result instanceof Promise) {
      return result.then((value) => {
        triggerRef(current)
        return value
      }) as unknown as T
    }
    triggerRef(current)
    return result
  }

  // ---- actions (thin delegation to current) ----

  function expandDirectory(dirPath: string) {
    return mutate(() => current.value?.expandDirectory(dirPath))
  }

  function refresh() {
    return mutate(() => current.value?.refresh())
  }

  function setActiveFile(fileId: string) {
    return mutate(() => current.value?.setActiveFile(fileId))
  }

  function createFile(dirPath: string, name: string): Promise<string> {
    if (!current.value) throw new Error('No workspace')
    return mutate(() => current.value!.createFile(dirPath, name))
  }

  function deleteFile(absPath: string): Promise<void> {
    if (!current.value) throw new Error('No workspace')
    return mutate(() => current.value!.deleteFile(absPath))
  }

  function renameFile(oldPath: string, newName: string): Promise<string> {
    if (!current.value) throw new Error('No workspace')
    return mutate(() => current.value!.renameFile(oldPath, newName))
  }

  function moveFile(sourcePath: string, targetDir: string): Promise<string> {
    if (!current.value) throw new Error('No workspace')
    return mutate(() => current.value!.moveFile(sourcePath, targetDir))
  }

  function createFolder(parentDir: string, name: string): Promise<string> {
    if (!current.value) throw new Error('No workspace')
    return mutate(() => current.value!.createFolder(parentDir, name))
  }

  function deleteFolder(absPath: string): Promise<void> {
    if (!current.value) throw new Error('No workspace')
    return mutate(() => current.value!.deleteFolder(absPath))
  }

  function renameFolder(oldPath: string, newName: string): Promise<string> {
    if (!current.value) throw new Error('No workspace')
    return mutate(() => current.value!.renameFolder(oldPath, newName))
  }

  function moveFolder(sourcePath: string, targetPath: string): Promise<string> {
    if (!current.value) throw new Error('No workspace')
    return mutate(() => current.value!.moveFolder(sourcePath, targetPath))
  }

  return {
    // state
    current,
    recentWorkspaces,
    loading,
    error,
    // computed (delegation)
    rootPath,
    title,
    entries,
    activeFileId,
    isOpen,
    hasActiveFile,
    mdFiles,
    // lifecycle
    open,
    openWorkspace,
    close,
    applyState,
    // delegation
    expandDirectory,
    refresh,
    setActiveFile,
    createFile,
    deleteFile,
    renameFile,
    moveFile,
    createFolder,
    deleteFolder,
    renameFolder,
    moveFolder,
    // utility
    resolveWorkspace,
    addRecentWorkspace,
    removeRecentWorkspace,
    loadRecentWorkspaces,
  }
})
