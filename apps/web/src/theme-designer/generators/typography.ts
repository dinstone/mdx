/**
 * 可视化主题设计器 - 排版规则生成器
 */
import type { DesignerVariables } from "../types";

interface TypographyPresets {
  h1Preset: { content: string; extra: string };
  h2Preset: { content: string; extra: string };
  h3Preset: { content: string; extra: string };
  h4Preset: { content: string; extra: string };
}

export function generateTypography(
  v: DesignerVariables,
  safeFontFamily: string,
  presets: TypographyPresets,
): string {
  const { h1Preset, h2Preset, h3Preset, h4Preset } = presets;

  return `/* === 排版 === */

#wemd p {
  font-family: ${safeFontFamily};
  font-size: var(--mdx-font-size);
  line-height: var(--mdx-line-height);
  margin: var(--mdx-paragraph-margin) 0;
  padding: var(--mdx-paragraph-padding) 0;
  letter-spacing: var(--mdx-letter-spacing);
  ${v.textIndent ? "text-indent: 2em;" : ""}
  ${v.textJustify ? "text-align: justify;" : ""}
}

#wemd li {
  font-family: ${safeFontFamily};
  margin: var(--mdx-list-spacing) 0;
  line-height: var(--mdx-line-height);
  letter-spacing: var(--mdx-letter-spacing);
}

#wemd h1 .content {
  font-size: var(--mdx-h1-font-size);
  color: var(--mdx-h1-color);
  font-weight: ${v.h1.fontWeight || "bold"};
  letter-spacing: ${v.h1.letterSpacing || 0}px;
  ${h1Preset.content}
}
#wemd h1 { margin: var(--mdx-h1-margin-top) 0 var(--mdx-h1-margin-bottom); ${v.h1.centered ? "text-align: center;" : ""} }

#wemd h2 .content {
  font-size: var(--mdx-h2-font-size);
  color: var(--mdx-h2-color);
  font-weight: ${v.h2.fontWeight || "bold"};
  letter-spacing: ${v.h2.letterSpacing || 0}px;
  ${h2Preset.content}
}
#wemd h2 { margin: var(--mdx-h2-margin-top) 0 var(--mdx-h2-margin-bottom); ${v.h2.centered ? "text-align: center;" : ""} }

#wemd h3 .content {
  font-size: var(--mdx-h3-font-size);
  color: var(--mdx-h3-color);
  font-weight: ${v.h3.fontWeight || "bold"};
  letter-spacing: ${v.h3.letterSpacing || 0}px;
  ${h3Preset.content}
}
#wemd h3 { margin: var(--mdx-h3-margin-top) 0 var(--mdx-h3-margin-bottom); ${v.h3.centered ? "text-align: center;" : ""} }

#wemd h4 .content {
  font-size: var(--mdx-h4-font-size);
  color: var(--mdx-h4-color);
  font-weight: ${v.h4.fontWeight || "bold"};
  letter-spacing: ${v.h4.letterSpacing || 0}px;
  ${h4Preset.content}
}
#wemd h4 { margin: var(--mdx-h4-margin-top) 0 var(--mdx-h4-margin-bottom); ${v.h4.centered ? "text-align: center;" : ""} }

#wemd ul { list-style-type: ${v.ulStyle}; padding-left: 20px; margin: var(--mdx-paragraph-margin) 0; font-size: ${!v.ulFontSize || v.ulFontSize === "inherit" ? "var(--mdx-font-size)" : v.ulFontSize}; }
#wemd ul ul { list-style-type: ${v.ulStyleL2}; margin: 4px 0; }
#wemd ol { list-style-type: ${v.olStyle}; padding-left: 20px; margin: var(--mdx-paragraph-margin) 0; font-size: ${!v.olFontSize || v.olFontSize === "inherit" ? "var(--mdx-font-size)" : v.olFontSize}; }
#wemd ol ol { list-style-type: ${v.olStyleL2}; margin: 4px 0; }

#wemd ul li::marker,
#wemd ol li::marker {
  color: var(--mdx-list-marker-color);
}
#wemd ul ul li::marker,
#wemd ol ol li::marker,
#wemd ul ol li::marker,
#wemd ol ul li::marker {
  color: var(--mdx-list-marker-color-l2);
}`;
}
