/**
 * Editor store — manages the currently active document's content and its
 * rendered preview HTML using @mdx/core.
 *
 * Frontmatter (theme info) is stored separately from the editor body so the
 * user never sees the --- block in the textarea. It is re-combined on save.
 */

import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { createMarkdownParser, processHtml } from '@mdx/core'
import { getBridge, type IServiceBridge, type ReadResult, type FrontmatterMeta } from '../bridge'
import { useWorkspaceStore } from './workspace'
import { defaultTheme, findThemeByName, findThemeByValue } from '../config/themes'
import type { ThemeOption } from '../config/themes'

const parser = createMarkdownParser()

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
  function bridge(): IServiceBridge {
    return getBridge()
  }
  const workspace = useWorkspaceStore()

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
  const currentTheme = ref<ThemeOption>(defaultTheme)

  // ---- getters ----
  const isEmpty = computed(() => rawContent.value.trim() === '')
  const fileName = computed(() => filePath.value.split('/').pop() || 'Untitled.md')
  const currentThemeName = computed(() => currentTheme.value.name)

  /** Renders raw markdown → themed HTML. */
  const renderedHtml = computed(() => {
    if (!rawContent.value) return ''
    const mdHtml = parser.render(rawContent.value)
    return processHtml(mdHtml, currentTheme.value.css)
  })

  // ---- internal helpers ----

  /** Pick a theme: prefer value-based lookup, then name-based, then default. */
  function resolveTheme(meta: FrontmatterMeta): ThemeOption {
    if (meta.themeType) {
      const t = findThemeByValue(meta.themeType)
      if (t.name !== '默认主题' || meta.themeType === defaultTheme.value) return t
    }
    if (meta.themeName && meta.themeName !== '默认主题') {
      return findThemeByName(meta.themeName)
    }
    const lastTheme = localStorage.getItem('mdx-last-theme')
    if (lastTheme) return findThemeByName(lastTheme)
    return defaultTheme
  }

  // ---- actions ----

  async function loadFile(absPath: string) {
    loading.value = true
    error.value = null
    try {
      const result: ReadResult = await bridge().readFile(absPath)
      filePath.value = result.filePath
      meta.value = result.meta

      // Strip frontmatter from the editor body
      const { body, fmBlock: block } = stripFrontmatter(result.content)
      rawContent.value = body
      fmBlock.value = block

      isModified.value = false
      currentTheme.value = resolveTheme(result.meta)
      workspace.setActiveFile(absPath)
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Failed to load file'
      filePath.value = absPath
      rawContent.value = ''
    } finally {
      loading.value = false
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
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Failed to save file'
      throw e
    }
  }

  function updateContent(content: string) {
    rawContent.value = content
    isModified.value = true
  }

  function setTheme(theme: ThemeOption) {
    currentTheme.value = theme
    meta.value.themeName = theme.name
    meta.value.themeType = theme.value

    // Update the frontmatter block — keep existing fields, only touch themeType/themeName
    const existingFields = parseFmFields(fmBlock.value)
    existingFields['themeType'] = theme.value
    existingFields['themeName'] = theme.name
    fmBlock.value = buildFmBlock(existingFields)

    // Also store as global preference fallback in localStorage
    localStorage.setItem('mdx-last-theme', theme.name)
    isModified.value = true
  }

  function setThemeByName(name: string) {
    const theme = findThemeByName(name)
    setTheme(theme)
  }

  function reset() {
    filePath.value = ''
    rawContent.value = ''
    fmBlock.value = ''
    meta.value = { themeName: defaultTheme.name }
    isModified.value = false
    currentTheme.value = defaultTheme
    error.value = null
  }

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
    currentThemeName,
    // actions
    loadFile,
    saveFile,
    updateContent,
    setTheme,
    setThemeByName,
    reset,
  }
})
