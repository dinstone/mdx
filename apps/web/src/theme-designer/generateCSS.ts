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

/**
 * 从 DesignerVariables 生成完整 CSS 字符串
 */
export function generateCSS(v: DesignerVariables): string {
  const h1Preset = getHeadingPresetCSS(v.h1.preset || "simple", v.primaryColor, "h1");
  const h2Preset = getHeadingPresetCSS(v.h2.preset || "simple", v.primaryColor, "h2");
  const h3Preset = getHeadingPresetCSS(v.h3.preset || "simple", v.primaryColor, "h3");
  const h4Preset = getHeadingPresetCSS(v.h4.preset || "simple", v.primaryColor, "h4");
  const quotePreset = getQuotePresetCSS(v.quotePreset);

  const headingExtras = [
    h1Preset.extra, h2Preset.extra, h3Preset.extra, h4Preset.extra,
  ].filter(Boolean).join("\n");

  const safeFontFamily = (v.fontFamily || fontFamilyOptions[0].value).replace(/"/g, "'");

  return [
    "/* 可视化设计器生成 */",
    generateVariables(v, safeFontFamily),
    generateGlobal(v),
    generateTypography(v, safeFontFamily, { h1Preset, h2Preset, h3Preset, h4Preset }),
    generateComponents(v, { quotePreset }),
    generateExtras(v, { headingExtras, quoteExtras: quotePreset.extra }),
  ].join("\n\n");
}
