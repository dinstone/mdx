/**
 * 可视化主题设计器 - 全局规则生成器
 */
import type { DesignerVariables } from "../types";

export function generateGlobal(v: DesignerVariables): string {
  return `/* === 全局规则 === */

#wemd figcaption {
  color: var(--mdx-image-caption-color);
  font-size: var(--mdx-image-caption-font-size);
  text-align: var(--mdx-image-caption-align);
  margin-top: 8px;
  line-height: var(--mdx-line-height);
}

#wemd strong {
  font-weight: bold;
  ${
    v.strongColor && v.strongColor !== "inherit"
      ? `color: ${v.strongColor};`
      : v.strongStyle === "none"
        ? "color: inherit;"
        : "color: var(--mdx-primary-color);"
  }
  ${v.strongStyle === "highlighter" ? "background: var(--mdx-primary-color-20); padding: 0 2px; border-radius: 2px;" : ""}
  ${v.strongStyle === "highlighter-bottom" ? "background: linear-gradient(to bottom, transparent 60%, var(--mdx-primary-color-30) 60%); padding: 0 2px;" : ""}
  ${v.strongStyle === "underline" ? "border-bottom: 2px solid var(--mdx-primary-color); padding-bottom: 1px;" : ""}
  ${v.strongStyle === "dot" ? "-webkit-text-emphasis: dot; -webkit-text-emphasis-position: under; text-emphasis: dot; text-emphasis-position: under;" : ""}
}`;
}
