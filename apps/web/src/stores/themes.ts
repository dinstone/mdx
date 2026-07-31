/**
 * 主题状态管理 — 内置主题 + 自定义主题的 CRUD、导入导出、localStorage 持久化。
 *
 * 与 WeMD themeStore 对齐的核心能力：
 * - 内置主题不可编辑/删除（只读）
 * - 自定义主题支持 创建/编辑/删除/复制/导入/导出
 * - 选中主题持久化到 localStorage
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { builtInThemes, type ThemeEntry } from '../config/themes'
import type { DesignerVariables } from '../theme-designer/types'
import { defaultVariables } from '../theme-designer/defaults'
import { generateCSS } from '../theme-designer/generateCSS'
import { getBridge } from '../bridge'

// ---------------------------------------------------------------------------
// Data types
// ---------------------------------------------------------------------------

export interface CustomTheme extends ThemeEntry {
  /** 编辑模式：创建时确定，不可更改 */
  editorMode?: 'visual' | 'css'
  /** 可视化设计器变量，仅 visual 模式存在 */
  designerVariables?: DesignerVariables
  /** 分层底：复制内置/CSS 主题进入可视化设计器时，保留的原始全量 CSS。
   *  未改动的属性组由底 CSS 兜底，只有用户实际改动的组才以设计器规则覆盖。 */
  baseCss?: string
  /** 复制时的初始解析变量（parseThemeCssToVariables 的结果）。
   *  用于"增量覆盖"判定哪些组未改动、可跳过，从而由 baseCss 兜底。 */
  baseVars?: DesignerVariables
}

/**
 * 合成最终 CSS：分层可视化主题 = baseCss（原始全量）+ overlay（仅改动组）。
 * 其余主题直接返回存储的 css（内置/纯 CSS/无底的纯可视化主题即全量生成 CSS）。
 */
function composeThemeCss(theme: CustomTheme): string {
  if (theme.baseCss) {
    return (theme.baseCss || '') + '\n' + (theme.css ?? '')
  }
  return theme.css ?? ''
}

// ---------------------------------------------------------------------------
// local-storage helpers
// ---------------------------------------------------------------------------

const CUSTOM_THEMES_KEY = 'mdx-custom-themes'
const SELECTED_THEME_KEY = 'mdx-selected-theme-id'

function loadCustomThemes(): CustomTheme[] {
  try {
    const raw = localStorage.getItem(CUSTOM_THEMES_KEY)
    if (!raw) return []
    return JSON.parse(raw) as CustomTheme[]
  } catch {
    return []
  }
}

function saveCustomThemes(themes: CustomTheme[]) {
  try {
    localStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(themes))
  } catch { /* quota exceeded — silently ignore */ }
}

function saveSelectedTheme(id: string) {
  try {
    localStorage.setItem(SELECTED_THEME_KEY, id)
  } catch { /* ignore */ }
}

/** 校验持久化的选中 ID 是否仍然存在 */
function resolveInitialThemeId(customThemes: CustomTheme[]): string {
  try {
    const savedId = localStorage.getItem(SELECTED_THEME_KEY)
    if (savedId) {
      const allIds = new Set([...builtInThemes, ...customThemes].map((t) => t.id))
      if (allIds.has(savedId)) return savedId
    }
  } catch { /* ignore */ }
  return builtInThemes[0].id // fallback to default
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useThemeStore = defineStore('themes', () => {
  // ---- state ----
  const customThemes = ref<CustomTheme[]>(loadCustomThemes())
  const currentThemeId = ref<string>(resolveInitialThemeId(customThemes.value))

  // ---- getters ----

  /** 内置 + 自定义 全部主题列表 */
  const allThemes = computed<CustomTheme[]>(() => [
    ...builtInThemes,
    ...customThemes.value,
  ])

  /** 当前选中的完整主题对象 */
  const currentTheme = computed<CustomTheme>(() => {
    const found = allThemes.value.find((t) => t.id === currentThemeId.value)
    return found ?? builtInThemes[0]
  })

  /** 当前主题的 CSS 字符串（分层主题已合成 baseCss + overlay） */
  const currentCSS = computed(() => composeThemeCss(currentTheme.value))

  // ---- actions ----

  /** 选中一个主题（内置或自定义） */
  function selectTheme(id: string) {
    const exists = allThemes.value.some((t) => t.id === id)
    if (!exists) {
      console.warn(`[themeStore] 主题 "${id}" 不存在，回退到默认主题`)
      currentThemeId.value = builtInThemes[0].id
    } else {
      currentThemeId.value = id
    }
    saveSelectedTheme(currentThemeId.value)
  }

  /** 按 ID 获取主题 CSS（可用于深色模式转换等场景）。分层主题返回合成后的全量 CSS */
  function getThemeCSS(id: string): string {
    const found = allThemes.value.find((t) => t.id === id)
    return found ? composeThemeCss(found) : builtInThemes[0].css
  }

  /** 创建自定义主题。id 自动生成，即时持久化。 */
  function createTheme(
    name: string,
    css: string,
    options?: {
      basedOnId?: string
      editorMode?: 'visual' | 'css'
      designerVariables?: DesignerVariables
      baseCss?: string
      baseVars?: DesignerVariables
    },
  ): CustomTheme {
    const trimmedName = name.trim() || '未命名主题'
    const themeCss = css || getThemeCSS(options?.basedOnId || currentThemeId.value)

    const theme: CustomTheme = {
      id: `custom-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      name: trimmedName,
      css: themeCss,
      isBuiltIn: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      editorMode: options?.editorMode || 'css',
      designerVariables: options?.designerVariables,
      baseCss: options?.baseCss,
      baseVars: options?.baseVars,
    }

    customThemes.value = [...customThemes.value, theme]
    saveCustomThemes(customThemes.value)

    return theme
  }

  /**
   * 创建可视化主题：提供名称和变量，自动生成 CSS。
   * options.baseCss / baseVars：分层底。传入时只生成与 baseVars 不同的组，
   * 其余由 baseCss 兜底，实现"保留内置样式 + 可视化微调"。
   */
  function createVisualTheme(
    name: string,
    variables?: DesignerVariables,
    options?: { baseCss?: string; baseVars?: DesignerVariables; basedOnId?: string },
  ): CustomTheme {
    const dv = variables || { ...defaultVariables }
    const css = options?.baseCss
      ? generateCSS(dv, options.baseVars ? { skipBase: options.baseVars } : undefined)
      : generateCSS(dv)
    return createTheme(name, css, {
      editorMode: 'visual',
      designerVariables: dv,
      baseCss: options?.baseCss,
      baseVars: options?.baseVars,
    })
  }

  /** 基于当前可视化变量的最新值，重新生成 CSS 并持久化（保留分层底） */
  function regenerateVisualCSS(id: string): boolean {
    const idx = customThemes.value.findIndex((t) => t.id === id)
    if (idx === -1) return false

    const theme = customThemes.value[idx]
    if (theme.editorMode !== 'visual' || !theme.designerVariables) return false

    const newCSS = generateCSS(
      theme.designerVariables,
      theme.baseVars ? { skipBase: theme.baseVars } : undefined,
    )
    const updated: CustomTheme = {
      ...theme,
      css: newCSS,
      updatedAt: new Date().toISOString(),
    }

    const next = [...customThemes.value]
    next[idx] = updated
    customThemes.value = next
    saveCustomThemes(next)
    return true
  }

  /** 更新自定义主题（内置主题不可编辑） */
  function updateTheme(
    id: string,
    updates: Partial<Pick<CustomTheme, 'name' | 'css' | 'designerVariables'>>,
  ) {
    const idx = customThemes.value.findIndex((t) => t.id === id)
    if (idx === -1) {
      console.warn(`[themeStore] 无法更新 — "${id}" 不存在或为内置主题`)
      return
    }

    const updated: CustomTheme = {
      ...customThemes.value[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    }

    // 可视化主题：designerVariables 变化时，用 baseVars 重生成"仅改动组"的覆盖层，
    // 保留 baseCss 兜底；若显式传了 css（如 CSS 模式）则尊重传入值。
    if (
      updated.editorMode === 'visual' &&
      updated.designerVariables &&
      !updates.css
    ) {
      updated.css = generateCSS(
        updated.designerVariables,
        updated.baseVars ? { skipBase: updated.baseVars } : undefined,
      )
    }

    const next = [...customThemes.value]
    next[idx] = updated
    customThemes.value = next
    saveCustomThemes(next)
  }

  /** 删除自定义主题。若删除的是当前主题，自动切回默认。 */
  function deleteTheme(id: string) {
    const idx = customThemes.value.findIndex((t) => t.id === id)
    if (idx === -1) {
      console.warn(`[themeStore] 无法删除 — "${id}" 不存在或为内置主题`)
      return
    }

    const next = customThemes.value.filter((t) => t.id !== id)
    customThemes.value = next
    saveCustomThemes(next)

    if (currentThemeId.value === id) {
      selectTheme(builtInThemes[0].id)
    }
  }

  /** 复制主题（内置或自定义均可复制） */
  function duplicateTheme(id: string, newName?: string): CustomTheme {
    const source = allThemes.value.find((t) => t.id === id)
    if (!source) throw new Error(`[themeStore] 主题 "${id}" 不存在`)
    // 分层可视化主题：连同 baseCss/baseVars 一起复制，保留"底 + 改动"结构
    if (source.editorMode === 'visual' && source.designerVariables) {
      return createVisualTheme(
        newName || `${source.name} (副本)`,
        JSON.parse(JSON.stringify(source.designerVariables)),
        { baseCss: source.baseCss, baseVars: source.baseVars },
      )
    }
    return createTheme(newName || `${source.name} (副本)`, source.css)
  }

  /** 触发浏览器端 Blob 下载（仅非桌面模式使用） */
  function downloadBlob(content: string, mimeType: string, filename: string) {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  /** 导出主题为 .json 文件（桌面端走原生"另存为"，浏览器走 Blob 下载） */
  async function exportTheme(id: string) {
    const theme = allThemes.value.find((t) => t.id === id)
    if (!theme) return

    const data: Record<string, unknown> = {
      name: theme.name,
      editorMode: theme.editorMode || 'css',
      exportedAt: new Date().toISOString(),
    }
    if (theme.designerVariables) {
      data.designerVariables = theme.designerVariables
    }
    // 分层主题导出底信息，导入时可还原"底 + 改动"结构，避免样式丢失
    if (theme.baseCss) data.baseCss = theme.baseCss
    if (theme.baseVars) data.baseVars = theme.baseVars
    const content = JSON.stringify(data, null, 2)
    const defaultName = `${theme.name}.mdx-theme.json`

    if (getBridge().isDesktop) {
      const path = await getBridge().saveFileDialog(defaultName)
      if (!path) return // 用户取消
      await getBridge().writeFile(path, content)
    } else {
      downloadBlob(content, 'application/json', defaultName)
    }
  }

  /** 导出主题为纯 .css 文件（分层主题导出合成后的全量 CSS） */
  async function exportThemeCSS(id: string) {
    const theme = allThemes.value.find((t) => t.id === id)
    if (!theme) return

    const content = composeThemeCss(theme)
    const defaultName = `${theme.name}.css`

    if (getBridge().isDesktop) {
      const path = await getBridge().saveFileDialog(defaultName)
      if (!path) return // 用户取消
      await getBridge().writeFile(path, content)
    } else {
      downloadBlob(content, 'text/css', defaultName)
    }
  }

  /** 从 .json 文件导入主题 */
  async function importTheme(file: File): Promise<boolean> {
    try {
      const text = await file.text()
      const data = JSON.parse(text)

      if (!data.name || (!data.css && !data.designerVariables)) {
        console.error('[themeStore] 无效的主题文件：缺少 name，且同时缺少 css 与 designerVariables')
        return false
      }

      // 处理重名
      const existingNames = new Set(customThemes.value.map((t) => t.name))
      let finalName = data.name
      if (existingNames.has(finalName)) {
        let suffix = 1
        while (existingNames.has(`${data.name} (${suffix})`)) suffix++
        finalName = `${data.name} (${suffix})`
      }

      // 可视化主题可能只导出了 designerVariables（无 css），按需由变量重新生成 CSS
      // 分层主题（含 baseCss/baseVars）按增量覆盖重新生成 overlay
      const css =
        data.css ||
        (data.designerVariables
          ? generateCSS(
              data.designerVariables,
              data.baseVars ? { skipBase: data.baseVars } : undefined,
            )
          : '')

      createTheme(finalName, css, {
        editorMode: data.editorMode || (data.designerVariables ? 'visual' : 'css'),
        designerVariables: data.designerVariables,
        baseCss: data.baseCss,
        baseVars: data.baseVars,
      })
      return true
    } catch {
      console.error('[themeStore] 导入主题失败：文件解析错误')
      return false
    }
  }

  return {
    // state
    currentThemeId,
    customThemes,
    // getters
    allThemes,
    currentTheme,
    currentCSS,
    // actions
    selectTheme,
    getThemeCSS,
    createTheme,
    createVisualTheme,
    regenerateVisualCSS,
    updateTheme,
    deleteTheme,
    duplicateTheme,
    exportTheme,
    exportThemeCSS,
    importTheme,
  }
})
