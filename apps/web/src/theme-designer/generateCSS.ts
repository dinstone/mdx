/**
 * 可视化主题设计器 - CSS 生成主入口
 */
import type { DesignerVariables } from "./types";
import { fontFamilyOptions } from "./styleOptions";
import { getHeadingPresetCSS, getQuotePresetCSS } from "./generators/presets";
import { generateVariables } from "./generators/variables";
import { generateGlobal } from "./generators/global";
import { generateTypography } from "./generators/typography";
import { generateComponents } from "./generators/components";
import { generateExtras } from "./generators/extras";

export { getHeadingPresetCSS, getQuotePresetCSS };
export { getCodeThemeCSS } from "./generators/codeTheme";

/** 属性组：用于"增量覆盖"——复制内置主题时，未改动的组由 baseCss 兜底 */
export type GroupKey =
  | "global"
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "quote"
  | "list"
  | "code"
  | "image"
  | "table"
  | "hr"
  | "other";

/** 每个属性组覆盖的 DesignerVariables 字段（用于判断"该组是否被改动"） */
const GROUP_FIELDS: Record<GroupKey, (keyof DesignerVariables)[]> = {
  global: ["fontFamily", "fontSize", "primaryColor", "lineHeight", "pagePadding", "baseLetterSpacing", "paragraphMargin", "paragraphPadding", "paragraphColor", "textIndent", "textJustify", "strongStyle", "strongColor"],
  h1: ["h1"],
  h2: ["h2"],
  h3: ["h3"],
  h4: ["h4"],
  quote: ["quoteBackground", "quoteBorderColor", "quoteTextColor", "quotePreset", "quoteBorderStyle", "quoteBorderWidth", "quotePaddingX", "quotePaddingY", "quoteFontSize", "quoteLineHeight", "quoteTextCentered"],
  list: ["ulStyle", "ulStyleL2", "olStyle", "olStyleL2", "listSpacing", "listMarkerColor", "listMarkerColorL2", "ulFontSize", "olFontSize"],
  code: ["codeBackground", "codeFontSize", "inlineCodeColor", "inlineCodeBackground", "inlineCodeStyle", "showMacBar", "codeTheme"],
  image: ["imageMargin", "imageBorderRadius", "imageShadow", "imageCaptionColor", "imageCaptionFontSize", "imageCaptionTextAlign"],
  table: ["tableHeaderBackground", "tableHeaderColor", "tableBorderColor", "tableZebra"],
  hr: ["hrColor", "hrHeight", "hrMargin", "hrStyle"],
  other: ["linkColor", "linkUnderline", "italicColor", "delColor", "markBackground", "markColor", "underlineStyle", "underlineColor"],
};

function groupEquals(v: DesignerVariables, base: DesignerVariables, g: GroupKey): boolean {
  const vRec = v as unknown as Record<string, unknown>
  const baseRec = base as unknown as Record<string, unknown>
  return GROUP_FIELDS[g].every((f) => {
    const a = vRec[f]
    const b = baseRec[f]
    return JSON.stringify(a) === JSON.stringify(b);
  });
}

/**
 * 计算需要跳过的属性组：当某组当前值与 skipBase（复制时的初始解析值）一致时，
 * 说明用户未改动该组，其样式由 baseCss 兜底保留，覆盖层无需生成该组。
 * 这样复制内置主题后，未调整的精细样式（三线表/特殊边框/callout 等）完整保留，
 * 只有用户实际改动的组才会以设计器生成规则覆盖 baseCss。
 */
function computeSkip(v: DesignerVariables, base?: DesignerVariables): Set<GroupKey> {
  const skip = new Set<GroupKey>();
  if (!base) return skip;
  (Object.keys(GROUP_FIELDS) as GroupKey[]).forEach((g) => {
    if (groupEquals(v, base, g)) skip.add(g);
  });
  return skip;
}

/**
 * 删除被跳过属性组对应的 CSS 块。各生成器在每个组规则前以
 * `/* @mdx-group:XXX *\/` 注释标记，本函数据此切分并过滤。
 */
function stripSkippedGroups(css: string, skip: Set<GroupKey>): string {
  if (skip.size === 0) return css;
  const parts = css.split(/(?=\/\*\s*@mdx-group:[\w-]+\s*\*\/)/g);
  return parts
    .filter((p) => {
      const m = p.match(/@mdx-group:([\w-]+)/);
      return !m || !skip.has(m[1] as GroupKey);
    })
    .join("");
}

/**
 * 从 DesignerVariables 生成完整 CSS 字符串。
 * opts.skipBase：复制内置主题时的初始解析值；提供时只生成与 skipBase 不同的组，
 * 其余由 baseCss 兜底（用于"保留内置主题样式 + 可视化微调"）。
 */
export function generateCSS(v: DesignerVariables, opts?: { skipBase?: DesignerVariables }): string {
  const skip = computeSkip(v, opts?.skipBase);

  const h1Preset = getHeadingPresetCSS(v.h1.preset || "simple", v.primaryColor, "h1");
  const h2Preset = getHeadingPresetCSS(v.h2.preset || "simple", v.primaryColor, "h2");
  const h3Preset = getHeadingPresetCSS(v.h3.preset || "simple", v.primaryColor, "h3");
  const h4Preset = getHeadingPresetCSS(v.h4.preset || "simple", v.primaryColor, "h4");
  const quotePreset = getQuotePresetCSS(v.quotePreset);

  const safeFontFamily = (v.fontFamily || fontFamilyOptions[0].value).replace(/"/g, "'");

  const parts = [
    "/* 可视化设计器生成 */",
    generateVariables(v, safeFontFamily),
    generateGlobal(v),
    generateTypography(v, safeFontFamily, { h1Preset, h2Preset, h3Preset, h4Preset }),
    generateComponents(v, { quotePreset }),
  ];

  // 带 baseCss 的主题：脚注/提示块/图片流无对应设计器控件，直接沿用 baseCss 版本，
  // 覆盖层不再生成，避免覆盖内置主题的 callout/footnote 配色。
  if (skip.size === 0) {
    const headingExtras = [
      `/* @mdx-group:h1 */\n${h1Preset.extra}`,
      `/* @mdx-group:h2 */\n${h2Preset.extra}`,
      `/* @mdx-group:h3 */\n${h3Preset.extra}`,
      `/* @mdx-group:h4 */\n${h4Preset.extra}`,
    ].join("\n");
    const quoteExtras = `/* @mdx-group:quote */\n${quotePreset.extra}`;
    parts.push(generateExtras(v, { headingExtras, quoteExtras }));
  }

  return stripSkippedGroups(parts.join("\n\n"), skip);
}
