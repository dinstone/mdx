/**
 * Editor store — manages the currently active document's content and its
 * rendered preview HTML using @mdx/core.
 *
 * Frontmatter (theme info) is stored separately from the editor body so the
 * user never sees the --- block in the textarea. It is re-combined on save.
 */

import { defineStore } from 'pinia'
import { ref, computed, watch, nextTick } from 'vue'
import { createMarkdownParser, processHtml, convertCssToWeChatDarkMode } from '@mdx/core'
import { withKatexStyle } from '../utils/katexStyle'
import { getBridge, getBrowserBridge, getDesktopBridge, type IServiceBridge, type ReadResult, type FrontmatterMeta } from '../bridge'
import { useWorkspaceStore } from './workspace'
import { useThemeStore } from './themes'
import { isPathInsideWorkspace, basename } from './workspace-types'

const parser = createMarkdownParser()

/**
 * 全局深色模式（UI 主题）。预览在深色模式下需要对主题 CSS 做「微信深色模式」反向
 * 转换（明暗反转），否则浅色主题的深色文字会落在深色预览背景上而看不见。
 * 由 App.vue 的 isDark 同步进来；仅作用于预览（renderedHtml），不改变复制/导出行为。
 */
const isDark = ref(false)
function setDark(v: boolean) {
  isDark.value = v
}

/** 自动保存轮询间隔：每 3 秒检查一次 dirty 状态并写盘。 */
const AUTO_SAVE_INTERVAL_MS = 3000

/** 模块级定时器句柄，避免 HMR / 重复创建 store 时叠加多个 interval。 */
let autoSaveTimer: ReturnType<typeof setInterval> | null = null

// ---------------------------------------------------------------------------
// Frontmatter helpers — kept in-store to avoid exposing complexity
// ---------------------------------------------------------------------------

/** Regex to match a YAML frontmatter block at the very start of a file. */
const FM_BLOCK_RE = /^(?:\uFEFF)?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/

/** Strip the frontmatter block from full content. Returns [body, fmBlock]. */
function stripFrontmatter(fullContent: string): { body: string; fmBlock: string } {
  const m = fullContent.match(FM_BLOCK_RE)
  if (!m) return { body: fullContent, fmBlock: '' }
  return { body: fullContent.slice(m[0].length), fmBlock: m[0] }
}

/** Parse YAML-like frontmatter text (already stripped of --- marks) into a map. */
function parseFmFields(fmInner: string): Record<string, string> {
  const fields: Record<string, string> = {}
  const lineRe = /^(\w+):\s*(.+)$/gm
  let match: RegExpExecArray | null
  while ((match = lineRe.exec(fmInner)) !== null) {
    let val = match[2].trim()
    if (val.length >= 2) {
      const [first, last] = [val[0], val[val.length - 1]]
      if ((first === '"' && last === '"') || (first === "'" && last === "'"))
        val = val.slice(1, -1)
    }
    fields[match[1]] = val
  }
  return fields
}

/** Serialise a key-value map back into a frontmatter block string (with delimiters). */
function buildFmBlock(fields: Record<string, string>): string {
  const lines = Object.entries(fields)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => {
      if (k === 'theme') return `${k}: ${v}`
      return `${k}: "${v}"`
    })
  if (lines.length === 0) return ''
  return `---\n${lines.join('\n')}\n---\n`
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useEditorStore = defineStore('editor', () => {
  /** Resolve bridge on every access — DesktopBridge may not be ready at store-creation time. */
  /** 根据当前工作空间类型选择正确的桥接层：
   *   - 虚拟工作空间（/Temp）→ BrowserBridge（IndexedDB）
   *   - 真实目录工作空间 → DesktopBridge（Go 后端，桌面模式）或 BrowserBridge（浏览器模式） */
  function bridge(): IServiceBridge {
    // 游离（外部）文件始终走真实文件系统（DesktopBridge），
    // 即便当前工作空间是虚拟 /Temp，也只读写磁盘上的真实文件。
    if (isExternal.value) return getDesktopBridge() ?? getBrowserBridge()
    if (workspace.current?.kind === 'virtual') {
      return getBrowserBridge()
    }
    return getBridge()
  }
  const workspace = useWorkspaceStore()
  const theme = useThemeStore()

  // ---- state ----
  const filePath = ref('')
  /** Editor body — frontmatter is stripped, user never sees the --- block. */
  const rawContent = ref('')
  /** The full frontmatter block text (with delimiters). Re-combined on save. */
  const fmBlock = ref('')
  const meta = ref<FrontmatterMeta>({ themeName: '默认主题' })
  const isModified = ref(false)
  const loading = ref(false)
  const error = ref<string | null>(null)

  /**
   * 当前文件是否为「游离文件」——即不属于当前工作空间文件树的外部真实文件
   * （如从 Finder 双击打开的、落在任何工作空间之外的 .md）。
   * 游离文件一律走真实文件系统（DesktopBridge），即使当前工作空间是虚拟 /Temp。
   */
  const isExternal = ref(false)

  /**
   * 抑制程序化同步（loadFile 触发 CM 的 dispatch → updateContent）时
   * 错误地将 isModified 置为 true。loadFile 期间为 true，nextTick 后恢复。
   */
  const _syncSuppress = ref(false)

  /**
   * 未保存编辑缓存：切文件时保存当前编辑内容，切回时恢复，
   * 避免用户未保存的编辑丢失。
   */
  const unsavedCache = new Map<string, {
    content: string
    fmBlock: string
    meta: FrontmatterMeta
  }>()

  // ---- getters ----
  const isEmpty = computed(() => rawContent.value.trim() === '')
  /** 标题栏显示名（始终只显示文件名；外部文件通过旁边的 Finder 按钮区分）。 */
  const fileName = computed(() => basename(filePath.value) || '未打开文档')
  const currentThemeName = computed(() => theme.currentTheme.name)

  /**
   * 状态栏展示的「文档主题」——只反映当前打开文档自身的主题设置（frontmatter），
   * 而非全局选中的主题。规则：
   *   - 未打开文档 → "默认主题"
   *   - 文档已打开但 frontmatter 未设置 themeType/themeName → "默认主题"
   *   - 已设置 → 解析成当前主题列表中的名称（自定义主题改名后可同步显示新名）
   * 注意：文档没设置主题时，预览仍按全局选中主题渲染，但状态栏按需求显示「默认主题」。
   */
  const documentThemeName = computed(() => {
    if (!filePath.value) return '默认主题'
    const fields = parseFmFields(fmBlock.value)
    const idOrName = (fields['themeType'] || fields['themeName'] || '').trim()
    if (!idOrName) return '默认主题'
    const matched =
      theme.allThemes.find((t) => t.id === idOrName) ??
      theme.allThemes.find((t) => t.name === idOrName)
    // 主题已被删除时保留原始值，便于用户发现设置失效
    return matched?.name || idOrName
  })

  /** Renders raw markdown → themed HTML. */
  const renderedHtml = computed(() => {
    if (!rawContent.value) return ''
    const mdHtml = parser.render(rawContent.value)
    // 深色模式：对主题 CSS 做微信深色模式反向转换，保证文字在深色预览背景上可见
    const css = isDark.value ? convertCssToWeChatDarkMode(theme.currentCSS) : theme.currentCSS
    return processHtml(mdHtml, css)
  })

  /** Renders raw markdown → WeChat-compatible HTML with pseudo-elements inlined. */
  const wechatHtml = computed(() => {
    if (!rawContent.value) return ''
    const mdHtml = parser.render(rawContent.value)
    return processHtml(mdHtml, theme.currentCSS, true, true)
  })

  /**
   * 通用 HTML 导出/复制：在 renderedHtml 基础上嵌入 KaTeX 样式，
   * 使复制出的独立 HTML 片段也能正确渲染数学公式（字体走 CDN）。
   * 实时预览走全局 katex.min.css，不需要这段内嵌样式。
   */
  const exportHtml = computed(() => withKatexStyle(renderedHtml.value))

  // ---- internal helpers ----

  /** Pick a theme ID: prefer type-based (id), then name-based, then store current. */
  function resolveThemeId(meta: FrontmatterMeta): string {
    // 1) themeType is the canonical ID (for both built-in and custom themes)
    if (meta.themeType) {
      const byId = theme.allThemes.find((t) => t.id === meta.themeType)
      if (byId) return byId.id
    }
    // 2) fallback to name match (backward compat with old frontmatter)
    if (meta.themeName) {
      const byName = theme.allThemes.find((t) => t.name === meta.themeName)
      if (byName) return byName.id
    }
    // 3) use currently selected theme
    return theme.currentThemeId
  }

  // ---- actions ----

  async function loadFile(absPath: string) {
    // 先判定是否为工作空间树之外的「游离文件」。该标志决定后续 I/O 走哪个桥接层，
    // 必须在读取前设定，否则虚拟工作空间下会错误地用 IndexedDB 去读真实磁盘路径。
    isExternal.value = !isPathInsideWorkspace(absPath, workspace.rootPath)

    // 切文件前，把当前未保存的编辑缓存起来
    if (filePath.value && isModified.value) {
      unsavedCache.set(filePath.value, {
        content: rawContent.value,
        fmBlock: fmBlock.value,
        meta: { ...meta.value },
      })
    }

    // 如果是切回之前已编辑过的文件，从缓存恢复
    const cached = unsavedCache.get(absPath)

    _syncSuppress.value = true
    loading.value = true
    error.value = null
    try {
      if (cached) {
        // 从缓存恢复未保存的编辑
        filePath.value = absPath
        meta.value = { ...cached.meta }
        rawContent.value = cached.content
        fmBlock.value = cached.fmBlock
        isModified.value = true // 保持之前的未保存状态
        theme.selectTheme(resolveThemeId(cached.meta))
        workspace.setActiveFile(absPath)
      } else {
        const result: ReadResult = await bridge().readFile(absPath)
        filePath.value = result.filePath
        meta.value = result.meta

        // Strip frontmatter from the editor body
        const { body, fmBlock: block } = stripFrontmatter(result.content)
        rawContent.value = body
        fmBlock.value = block

        isModified.value = false
        theme.selectTheme(resolveThemeId(result.meta))
        workspace.setActiveFile(absPath)
      }
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Failed to load file'
      filePath.value = absPath
      rawContent.value = ''
      // 读取失败时必须清空 frontmatter 与 meta，否则会残留上一个文档的
      // 主题设置（状态栏显示错）并被自动保存误写到当前路径上。
      fmBlock.value = ''
      meta.value = { themeName: '默认主题' }
      isModified.value = false
    } finally {
      loading.value = false
      // nextTick 后 CM 的 dispatch → updateContent 已完成，解除抑制
      nextTick(() => {
        _syncSuppress.value = false
      })
    }
  }

  async function saveFile() {
    if (!filePath.value) return
    error.value = null
    try {
      // Re-combine frontmatter + body
      const fullContent = fmBlock.value + rawContent.value
      await bridge().writeFile(filePath.value, fullContent)
      isModified.value = false
      // 保存成功后清除该文件的缓存
      unsavedCache.delete(filePath.value)
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Failed to save file'
      throw e
    }
  }

  function updateContent(content: string) {
    rawContent.value = content
    if (!_syncSuppress.value) {
      isModified.value = true
    }
  }

  function setTheme(themeId: string) {
    theme.selectTheme(themeId)
    const t = theme.currentTheme
    meta.value.themeName = t.name
    meta.value.themeType = t.id

    // Update the frontmatter block — keep existing fields, only touch themeType/themeName
    const existingFields = parseFmFields(fmBlock.value)
    existingFields['themeType'] = t.id
    existingFields['themeName'] = t.name
    fmBlock.value = buildFmBlock(existingFields)

    isModified.value = true
  }

  function setThemeByName(name: string) {
    const t = theme.allThemes.find((x) => x.name === name)
    if (t) setTheme(t.id)
  }

  function reset() {
    filePath.value = ''
    rawContent.value = ''
    fmBlock.value = ''
    meta.value = { themeName: theme.currentTheme.name }
    isModified.value = false
    error.value = null
    unsavedCache.clear()
  }

  // ---- auto-save: poll dirty state every 3s and persist ----
  /** 防止 saveFile 还在进行时又触发新一轮保存。 */
  const _saving = ref(false)

  async function autoSaveTick() {
    if (_saving.value) return
    // 仅在存在活动文件且内容被改动（dirty）时才保存
    if (!filePath.value || !isModified.value) return
    _saving.value = true
    try {
      await saveFile()
    } catch {
      // 保存失败保持 isModified=true，下一轮重试
    } finally {
      _saving.value = false
    }
  }

  function startAutoSave() {
    // 先清掉可能存在的旧定时器（HMR / 重复初始化），保证全局仅一个
    if (autoSaveTimer !== null) clearInterval(autoSaveTimer)
    autoSaveTimer = setInterval(autoSaveTick, AUTO_SAVE_INTERVAL_MS)
  }

  function stopAutoSave() {
    if (autoSaveTimer !== null) {
      clearInterval(autoSaveTimer)
      autoSaveTimer = null
    }
  }

  // 启动 3 秒定时自动保存
  startAutoSave()

  // Auto-load when workspace.activeFileId changes
  watch(
    () => workspace.activeFileId,
    (id) => {
      if (id && id !== filePath.value) loadFile(id)
      // activeFileId 被清空（删文件 / 删目录连带 / 切工作空间） → 同步重置编辑器，
      // 让 ContentHeader 的文件名/保存点等不再指向已不存在的文件。
      else if (!id && filePath.value) reset()
    },
  )

  return {
    // state
    filePath,
    isExternal,
    rawContent,
    meta,
    isModified,
    loading,
    error,
    isDark,
    // getters
    isEmpty,
    fileName,
    renderedHtml,
    wechatHtml,
    exportHtml,
    currentThemeName,
    documentThemeName,
    // actions
    loadFile,
    saveFile,
    updateContent,
    setTheme,
    setThemeByName,
    reset,
    startAutoSave,
    stopAutoSave,
    setDark,
  }
})
