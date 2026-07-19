/**
 * Editor store — manages the currently active document's content and its
 * rendered preview HTML using @mdx/core.
 *
 * Frontmatter (theme info) is stored separately from the editor body so the
 * user never sees the --- block in the textarea. It is re-combined on save.
 */

import { defineStore } from 'pinia'
import { ref, computed, watch, nextTick } from 'vue'
import { createMarkdownParser, processHtml } from '@mdx/core'
import { withKatexStyle } from '../utils/katexStyle'
import { getBridge, getBrowserBridge, type IServiceBridge, type ReadResult, type FrontmatterMeta } from '../bridge'
import { useWorkspaceStore } from './workspace'
import { useThemeStore } from './themes'

const parser = createMarkdownParser()

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
  /** 根据当前工作区类型选择正确的桥接层：
   *   - 虚拟工作区（/Temp）→ BrowserBridge（IndexedDB）
   *   - 真实目录工作区 → DesktopBridge（Go 后端，桌面模式）或 BrowserBridge（浏览器模式） */
  function bridge(): IServiceBridge {
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
  const fileName = computed(() => filePath.value.split('/').pop() || 'Untitled.md')
  const currentThemeName = computed(() => theme.currentTheme.name)

  /** Renders raw markdown → themed HTML. */
  const renderedHtml = computed(() => {
    if (!rawContent.value) return ''
    const mdHtml = parser.render(rawContent.value)
    return processHtml(mdHtml, theme.currentCSS)
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
    },
  )

  return {
    // state
    filePath,
    rawContent,
    meta,
    isModified,
    loading,
    error,
    // getters
    isEmpty,
    fileName,
    renderedHtml,
    wechatHtml,
    exportHtml,
    currentThemeName,
    // actions
    loadFile,
    saveFile,
    updateContent,
    setTheme,
    setThemeByName,
    reset,
    startAutoSave,
    stopAutoSave,
  }
})
