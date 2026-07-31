/**
 * 可视化主题设计器 - CSS 变量生成器
 *
 * 两块输出：
 * 1) 始终保留的「变量定义块」：把所有 --mdx-* 自定义属性一次性定义出来。
 *    该块不携带 @mdx-group 注释，因此"增量覆盖"绝不会剔除它。生成规则
 *    （标题/引用/代码/链接…）都依赖这些变量；仅"定义变量"不会给 baseCss
 *    的实测字面量样式造成任何覆盖（自定义属性本身不参与渲染）。
 *    这样复制内置主题后，即便某组被跳过，其余已改动组生成的规则引用到的
 *    跨组变量（如 --mdx-primary-color、--mdx-paragraph-margin）依然有值。
 *
 * 2) 可跳过的「全局组」：直接作用于 #wemd 的 font-family/padding/color。
 *    仅当用户改动全局字段时才生成，否则由 baseCss 的内置字面量兜底。
 *
 * （历史版本中每个属性组各发一块 #wemd 变量块，现已合并到上面的始终保留块，
 * 避免被按组剔除后导致变量缺失。）
 */
import type { DesignerVariables } from "../types";

const toAlphaColor = (color: string, alpha: number): string => {
  const trimmed = color.trim();
  if (!trimmed) return color;

  if (trimmed.startsWith("#")) {
    const hex = trimmed.slice(1);
    const toByte = (v: string) =>
      parseInt(v.length === 1 ? v + v : v, 16);
    if (hex.length === 3 || hex.length === 4) {
      const r = toByte(hex[0]), g = toByte(hex[1]), b = toByte(hex[2]);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    if (hex.length >= 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
  }

  const rgbMatch =
    trimmed.match(/^rgb\s*\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^,]+)\s*\)$/i) ||
    trimmed.match(/^rgba\s*\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^,]+)\s*,\s*[^)]+\)$/i);
  if (rgbMatch) {
    const [, r, g, b] = rgbMatch;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  return color;
};

export function generateVariables(
  v: DesignerVariables,
  safeFontFamily: string,
): string {
  const primaryColor20 = toAlphaColor(v.primaryColor, 0.12);
  const primaryColor30 = toAlphaColor(v.primaryColor, 0.18);
  const primaryColor50 = toAlphaColor(v.primaryColor, 0.5);
  const underlineStyle = v.underlineStyle || "solid";
  const underlineColor = v.underlineColor || "currentColor";

  // ---- 始终保留的变量定义块（无 @mdx-group 注释，永不被剔除）----
  const varDefs = `#wemd {
  --mdx-page-padding: ${v.pagePadding ?? 8}px;
  --mdx-font-size: ${v.fontSize};
  --mdx-line-height: ${v.lineHeight};
  --mdx-paragraph-margin: ${v.paragraphMargin}px;
  --mdx-paragraph-padding: ${v.paragraphPadding ?? 0}px;
  --mdx-text-color: ${v.paragraphColor};
  --mdx-primary-color: ${v.primaryColor};
  --mdx-primary-color-20: ${primaryColor20};
  --mdx-primary-color-30: ${primaryColor30};
  --mdx-primary-color-50: ${primaryColor50};
  --mdx-letter-spacing: ${v.baseLetterSpacing || 0}px;
  --mdx-underline-style: ${underlineStyle};
  --mdx-underline-color: ${underlineColor};

  --mdx-h1-font-size: ${v.h1.fontSize}px;
  --mdx-h1-color: ${v.h1.color};
  --mdx-h1-margin-top: ${v.h1.marginTop}px;
  --mdx-h1-margin-bottom: ${v.h1.marginBottom}px;
  --mdx-h2-font-size: ${v.h2.fontSize}px;
  --mdx-h2-color: ${v.h2.color};
  --mdx-h2-margin-top: ${v.h2.marginTop}px;
  --mdx-h2-margin-bottom: ${v.h2.marginBottom}px;
  --mdx-h3-font-size: ${v.h3.fontSize}px;
  --mdx-h3-color: ${v.h3.color};
  --mdx-h3-margin-top: ${v.h3.marginTop}px;
  --mdx-h3-margin-bottom: ${v.h3.marginBottom}px;
  --mdx-h4-font-size: ${v.h4.fontSize}px;
  --mdx-h4-color: ${v.h4.color};
  --mdx-h4-margin-top: ${v.h4.marginTop}px;
  --mdx-h4-margin-bottom: ${v.h4.marginBottom}px;

  --mdx-code-background: ${v.codeBackground};
  --mdx-code-font-size: ${v.codeFontSize}px;
  --mdx-inline-code-color: ${v.inlineCodeColor};
  --mdx-inline-code-background: ${v.inlineCodeBackground};

  --mdx-quote-background: ${v.quoteBackground};
  --mdx-quote-border-color: ${v.quoteBorderColor};
  --mdx-quote-border-width: ${v.quoteBorderWidth}px;
  --mdx-quote-border-style: ${v.quoteBorderStyle};
  --mdx-quote-text-color: ${v.quoteTextColor};
  --mdx-quote-font-size: ${v.quoteFontSize}px;
  --mdx-quote-line-height: ${v.quoteLineHeight};
  --mdx-quote-padding-x: ${v.quotePaddingX}px;
  --mdx-quote-padding-y: ${v.quotePaddingY}px;

  --mdx-image-margin: ${v.imageMargin}px;
  --mdx-image-border-radius: ${v.imageBorderRadius}px;
  --mdx-image-shadow: ${v.imageShadow ? "0 4px 12px rgba(0,0,0,0.12)" : "none"};
  --mdx-image-caption-color: ${v.imageCaptionColor};
  --mdx-image-caption-font-size: ${v.imageCaptionFontSize}px;
  --mdx-image-caption-align: ${v.imageCaptionTextAlign};

  --mdx-link-color: ${v.linkColor || v.primaryColor};
  --mdx-italic-color: ${v.italicColor};
  --mdx-del-color: ${v.delColor};
  --mdx-mark-background: ${v.markBackground};
  --mdx-mark-color: ${v.markColor};

  --mdx-table-header-background: ${v.tableHeaderBackground};
  --mdx-table-header-color: ${v.tableHeaderColor};
  --mdx-table-border-color: ${v.tableBorderColor};

  --mdx-hr-color: ${v.hrColor};
  --mdx-hr-height: ${v.hrHeight}px;
  --mdx-hr-margin: ${v.hrMargin}px;

  --mdx-list-spacing: ${v.listSpacing}px;
  --mdx-list-marker-color: ${v.listMarkerColor};
  --mdx-list-marker-color-l2: ${v.listMarkerColorL2};
}`;

  // ---- 可跳过的全局组：直接作用于 #wemd 的实测属性 ----
  const globalBlock = `/* @mdx-group:global */
#wemd {
  font-family: ${safeFontFamily};
  padding: 0 var(--mdx-page-padding);
  color: var(--mdx-text-color);
  overflow-wrap: break-word;
}`;

  return varDefs + "\n\n" + globalBlock;
}
