/**
 * 可视化主题设计器 - 组件规则生成器
 */
import type { DesignerVariables } from "../types";
import { getCodeThemeCSS } from "./codeTheme";

interface ComponentPresets {
  quotePreset: { base: string; extra: string };
}

export function generateComponents(
  v: DesignerVariables,
  presets: ComponentPresets,
): string {
  const { quotePreset } = presets;
  const underlineStyle = "var(--mdx-underline-style)";
  const underlineColor = "var(--mdx-underline-color)";

  return `/* === 组件样式 === */

#wemd blockquote,
#wemd .multiquote-1,
#wemd .multiquote-2,
#wemd .multiquote-3 {
  margin: var(--mdx-paragraph-margin) 0 !important;
  padding: var(--mdx-quote-padding-y) var(--mdx-quote-padding-x);
  ${quotePreset.base}
}
#wemd blockquote p,
#wemd .multiquote-1 p,
#wemd .multiquote-2 p,
#wemd .multiquote-3 p {
  color: var(--mdx-quote-text-color);
  margin: 0 !important;
  font-size: var(--mdx-quote-font-size);
  line-height: var(--mdx-quote-line-height);
  ${v.quoteTextCentered ? "text-align: center !important;" : ""}
}

#wemd pre {
  margin: var(--mdx-paragraph-margin) 0;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

#wemd pre code {
  display: block;
  background: transparent;
  font-size: var(--mdx-code-font-size);
  padding: 16px;
  margin: 0;
  overflow-x: auto;
  white-space: pre;
  border-radius: 0;
  word-wrap: normal;
  word-break: keep-all;
  text-align: left;
  letter-spacing: 0;
  word-spacing: 0;
  min-width: max-content;
}

#wemd pre.custom {
  position: relative;
  margin: var(--mdx-paragraph-margin) 0;
  background: var(--mdx-code-background);
  border-radius: 8px;
  overflow: hidden;
}

#wemd pre.custom > .mac-sign {
  display: ${v.showMacBar ? "block" : "none"};
  line-height: 0;
}

${getCodeThemeCSS(v.codeTheme)}

#wemd code {
  color: var(--mdx-inline-code-color);
  background: var(--mdx-inline-code-background);
  padding: 2px 4px;
  border-radius: ${v.inlineCodeStyle === "rounded" ? "12px" : v.inlineCodeStyle === "github" ? "4px" : "2px"};
  font-size: 0.9em;
  font-family: Menlo, Monaco, Consolas, "Courier New", monospace;
  white-space: normal;
  letter-spacing: 0;
  ${v.inlineCodeStyle === "github" ? "border: 1px solid rgba(0,0,0,0.06);" : ""}
  ${v.inlineCodeStyle === "color-text" ? "background: transparent; font-weight: bold; border-bottom: 2px solid var(--mdx-primary-color-50);" : ""}
}

#wemd pre code,
#wemd pre code.hljs {
  white-space: pre;
  text-align: left;
  letter-spacing: 0;
  word-spacing: 0;
}

#wemd a {
  color: var(--mdx-link-color);
  text-decoration: none;
  border-bottom: ${v.linkUnderline ? "1px solid var(--mdx-link-color)" : "none"};
  word-break: break-all;
}

#wemd em {
  font-style: italic;
  color: var(--mdx-italic-color);
}

#wemd del {
  text-decoration: line-through;
  color: var(--mdx-del-color);
}

#wemd u {
  text-decoration-line: underline;
  text-decoration-style: ${underlineStyle};
  text-underline-offset: 0.18em;
  text-decoration-thickness: 1px;
  text-decoration-color: ${underlineColor};
}

#wemd mark {
  background: var(--mdx-mark-background);
  color: var(--mdx-mark-color);
  padding: 0 2px;
  border-radius: 2px;
}

#wemd hr {
  margin: var(--mdx-hr-margin) 0;
  border: 0;
  ${(() => {
    const style = v.hrStyle || "solid";
    if (style === "pill") {
      return `height: var(--mdx-hr-height); background: var(--mdx-hr-color); width: 20%; margin-left: auto; margin-right: auto; border-radius: 8px;`;
    }
    return `border-top: var(--mdx-hr-height) ${style} var(--mdx-hr-color);`;
  })()}
}

#wemd table {
  width: 100%;
  border-collapse: collapse;
  margin: var(--mdx-paragraph-margin) 0;
}

#wemd th {
  background: var(--mdx-table-header-background);
  color: var(--mdx-table-header-color);
  font-weight: bold;
}

#wemd th, #wemd td {
  border: 1px solid var(--mdx-table-border-color);
  padding: 8px 12px;
  text-align: left;
}

${v.tableZebra ? `#wemd tr:nth-child(even) { background: #fcfcfc; }` : ""}

#wemd img {
  display: block;
  max-width: 100%;
  height: auto;
  margin: var(--mdx-image-margin) auto;
  border-radius: var(--mdx-image-border-radius);
  box-shadow: var(--mdx-image-shadow);
}`;
}
