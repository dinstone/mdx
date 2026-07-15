import {
  academicPaperTheme,
  auroraGlassTheme,
  basicTheme,
  bauhausTheme,
  cyberpunkNeonTheme,
  customDefaultTheme,
  knowledgeBaseTheme,
  luxuryGoldTheme,
  morandiForestTheme,
  neoBrutalismTheme,
  receiptTheme,
  sunsetFilmTheme,
  templateTheme,
} from "@mdx/core";

/** @deprecated 保留向后兼容，新代码应使用 CustomTheme + themeStore */
export interface ThemeOption {
  name: string;
  value: string;
  css: string;
}

/** 与 themeStore 中的 CustomTheme 对齐的数据结构 */
export interface ThemeEntry {
  id: string;
  name: string;
  css: string;
  isBuiltIn: boolean;
  createdAt: string;
  updatedAt: string;
}

export const builtInThemes: ThemeEntry[] = [
  { id: "customDefault", name: "默认主题", css: customDefaultTheme, isBuiltIn: true, createdAt: "2025-01-01", updatedAt: "2025-01-01" },
  { id: "basic",          name: "基础主题",   css: basicTheme,          isBuiltIn: true, createdAt: "2025-01-01", updatedAt: "2025-01-01" },
  { id: "academicPaper",  name: "学术论文",   css: academicPaperTheme,  isBuiltIn: true, createdAt: "2025-01-01", updatedAt: "2025-01-01" },
  { id: "auroraGlass",    name: "极光玻璃",   css: auroraGlassTheme,    isBuiltIn: true, createdAt: "2025-01-01", updatedAt: "2025-01-01" },
  { id: "bauhaus",        name: "包豪斯",     css: bauhausTheme,        isBuiltIn: true, createdAt: "2025-01-01", updatedAt: "2025-01-01" },
  { id: "cyberpunkNeon",  name: "赛博朋克",   css: cyberpunkNeonTheme,  isBuiltIn: true, createdAt: "2025-01-01", updatedAt: "2025-01-01" },
  { id: "knowledgeBase",  name: "知识库",     css: knowledgeBaseTheme,  isBuiltIn: true, createdAt: "2025-01-01", updatedAt: "2025-01-01" },
  { id: "luxuryGold",     name: "黑金奢华",   css: luxuryGoldTheme,     isBuiltIn: true, createdAt: "2025-01-01", updatedAt: "2025-01-01" },
  { id: "morandiForest",  name: "莫兰迪森林", css: morandiForestTheme,  isBuiltIn: true, createdAt: "2025-01-01", updatedAt: "2025-01-01" },
  { id: "neoBrutalism",   name: "新粗野主义", css: neoBrutalismTheme,   isBuiltIn: true, createdAt: "2025-01-01", updatedAt: "2025-01-01" },
  { id: "receipt",        name: "购物小票",   css: receiptTheme,        isBuiltIn: true, createdAt: "2025-01-01", updatedAt: "2025-01-01" },
  { id: "sunsetFilm",     name: "落日胶片",   css: sunsetFilmTheme,     isBuiltIn: true, createdAt: "2025-01-01", updatedAt: "2025-01-01" },
  { id: "template",       name: "模板",       css: templateTheme,       isBuiltIn: true, createdAt: "2025-01-01", updatedAt: "2025-01-01" },
];

export const defaultThemeEntry = builtInThemes[0];

// @deprecated — keep backward compat exports
export const themeOptions: ThemeOption[] = builtInThemes.map((t) => ({ name: t.name, value: t.id, css: t.css }));
export const defaultTheme = themeOptions[0];
export function findThemeByName(name: string): ThemeOption {
  return themeOptions.find((t) => t.name === name) ?? defaultTheme;
}
export function findThemeByValue(value: string): ThemeOption {
  return themeOptions.find((t) => t.value === value) ?? defaultTheme;
}
