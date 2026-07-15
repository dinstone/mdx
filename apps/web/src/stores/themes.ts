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

// ---------------------------------------------------------------------------
// Data types
// ---------------------------------------------------------------------------

export interface CustomTheme extends ThemeEntry {
  /** 编辑模式：创建时确定，不可更改 */
  editorMode?: 'visual' | 'css'
  /** 可视化设计器变量，仅 visual 模式存在 */
  designerVariables?: DesignerVariables
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

  /** 当前主题的 CSS 字符串 */
  const currentCSS = computed(() => currentTheme.value.css)

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

  /** 按 ID 获取主题 CSS（可用于深色模式转换等场景） */
  function getThemeCSS(id: string): string {
    const found = allThemes.value.find((t) => t.id === id)
    return found?.css ?? builtInThemes[0].css
  }

  /** 创建自定义主题。id 自动生成，即时持久化。 */
  function createTheme(
    name: string,
    css: string,
    options?: { basedOnId?: string; editorMode?: 'visual' | 'css'; designerVariables?: DesignerVariables },
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
    }

    customThemes.value = [...customThemes.value, theme]
    saveCustomThemes(customThemes.value)

    return theme
  }

  /** 创建可视化主题：提供名称和变量，自动生成 CSS */
  function createVisualTheme(name: string, variables?: DesignerVariables): CustomTheme {
    const dv = variables || { ...defaultVariables }
    const css = generateCSS(dv)
    return createTheme(name, css, { editorMode: 'visual', designerVariables: dv })
  }

  /** 基于当前可视化变量的最新值，重新生成 CSS 并持久化 */
  function regenerateVisualCSS(id: string): boolean {
    const idx = customThemes.value.findIndex((t) => t.id === id)
    if (idx === -1) return false

    const theme = customThemes.value[idx]
    if (theme.editorMode !== 'visual' || !theme.designerVariables) return false

    const newCSS = generateCSS(theme.designerVariables)
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
    return createTheme(newName || `${source.name} (副本)`, source.css)
  }

  /** 导出主题为 .json 文件 */
  function exportTheme(id: string) {
    const theme = allThemes.value.find((t) => t.id === id)
    if (!theme) return

    const data: Record<string, unknown> = {
      name: theme.name,
      css: theme.css,
      editorMode: theme.editorMode || 'css',
      exportedAt: new Date().toISOString(),
    }
    if (theme.designerVariables) {
      data.designerVariables = theme.designerVariables
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${theme.name}.mdx-theme.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  /** 导出主题为纯 .css 文件 */
  function exportThemeCSS(id: string) {
    const theme = allThemes.value.find((t) => t.id === id)
    if (!theme) return

    const blob = new Blob([theme.css], { type: 'text/css' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${theme.name}.css`
    a.click()
    URL.revokeObjectURL(url)
  }

  /** 从 .json 文件导入主题 */
  async function importTheme(file: File): Promise<boolean> {
    try {
      const text = await file.text()
      const data = JSON.parse(text)

      if (!data.name || !data.css) {
        console.error('[themeStore] 无效的主题文件：缺少 name 或 css')
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

      createTheme(finalName, data.css, {
        editorMode: data.editorMode || 'css',
        designerVariables: data.designerVariables,
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
