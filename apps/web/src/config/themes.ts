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

export interface ThemeOption {
  name: string;
  value: string;
  css: string;
}

export const themeOptions: ThemeOption[] = [
  { name: "默认主题", value: "customDefault", css: customDefaultTheme },
  { name: "基础主题", value: "basic", css: basicTheme },
  { name: "学术论文", value: "academicPaper", css: academicPaperTheme },
  { name: "极光玻璃", value: "auroraGlass", css: auroraGlassTheme },
  { name: "包豪斯", value: "bauhaus", css: bauhausTheme },
  { name: "赛博朋克", value: "cyberpunkNeon", css: cyberpunkNeonTheme },
  { name: "知识库", value: "knowledgeBase", css: knowledgeBaseTheme },
  { name: "黑金奢华", value: "luxuryGold", css: luxuryGoldTheme },
  { name: "莫兰迪森林", value: "morandiForest", css: morandiForestTheme },
  { name: "新粗野主义", value: "neoBrutalism", css: neoBrutalismTheme },
  { name: "购物小票", value: "receipt", css: receiptTheme },
  { name: "落日胶片", value: "sunsetFilm", css: sunsetFilmTheme },
  { name: "模板", value: "template", css: templateTheme },
];

export const defaultTheme = themeOptions[0];

export function findThemeByName(name: string): ThemeOption {
  return themeOptions.find((t) => t.name === name) ?? defaultTheme;
}

export function findThemeByValue(value: string): ThemeOption {
  return themeOptions.find((t) => t.value === value) ?? defaultTheme;
}
