/**
 * 可视化主题设计器 - 额外规则（脚注、callout、imageflow）
 */
import type { DesignerVariables } from "../types";

interface ExtraPresets {
  headingExtras: string;
  quoteExtras: string;
}

export function generateExtras(
  v: DesignerVariables,
  presets: ExtraPresets,
): string {
  const footnoteAccent = v.linkColor || v.primaryColor;

  return `/* === 额外规则（脚注/提示块/图片流） === */

${presets.headingExtras}
${presets.quoteExtras}

#wemd .footnote-word {
  color: ${footnoteAccent};
  font-weight: bold;
}

#wemd .footnote-ref {
  color: ${footnoteAccent};
  font-weight: bold;
}

#wemd .footnote-ref a {
  color: ${footnoteAccent} !important;
  text-decoration: none;
  border-bottom: none !important;
}

#wemd .footnote-item {
  display: flex;
}

#wemd .footnote-num {
  display: inline;
  width: 32px;
  flex-shrink: 0;
  background: none;
  font-size: 80%;
  line-height: 26px;
  color: ${footnoteAccent};
  font-family: Optima-Regular, Optima, PingFangSC-light, PingFangTC-light, 'PingFang SC', Cambria, Cochin, Georgia, Times, 'Times New Roman', serif;
}

#wemd .footnote-num a,
#wemd .footnote-item a.footnote-backref {
  color: ${footnoteAccent} !important;
  text-decoration: none;
  border-bottom: none !important;
}

#wemd .footnote-item p {
  display: inline;
  font-size: 12px;
  flex: 1;
  padding: 0;
  margin: 0;
  line-height: 26px;
  word-break: break-all;
  color: #666;
}

#wemd .footnotes-sep:before {
  content: "参考资料";
  display: block;
  font-weight: bold;
  font-size: 18px;
  color: ${footnoteAccent};
  border-left: 4px solid ${footnoteAccent};
  padding-left: 10px;
  margin: 24px 0 12px;
}

#wemd .callout {
  border-left-width: 4px;
  border-left-style: solid;
  border-radius: 4px;
  margin: var(--mdx-paragraph-margin) 0;
  padding: 12px 16px;
}

#wemd .callout-title {
  font-weight: 600;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 0;
  letter-spacing: 0.05em;
}

#wemd .callout-icon { font-size: 18px; margin-right: 8px; }
#wemd .callout p { margin: 0 !important; }

#wemd .callout-note { border-left: 4px solid #6366f1; background: #f5f5ff; }
#wemd .callout-tip { border-left: 4px solid #10b981; background: #ecfdf5; }
#wemd .callout-important { border-left: 4px solid #8b5cf6; background: #f5f3ff; }
#wemd .callout-warning { border-left: 4px solid #f59e0b; background: #fffbeb; }
#wemd .callout-caution { border-left: 4px solid #ef4444; background: #fff5f5; }

/* 横向滑动图片 */
#wemd .imageflow-layer1 {
  margin-top: 1em; margin-bottom: 0.5em;
  white-space: normal; border: 0 none; padding: 0; overflow: hidden;
}
#wemd .imageflow-layer2 {
  white-space: nowrap; width: 100%; overflow-x: scroll;
}
#wemd .imageflow-layer3 {
  display: inline-block; word-wrap: break-word;
  white-space: normal; vertical-align: top;
  width: 80%; margin-right: 10px; flex-shrink: 0;
}
#wemd .imageflow-img {
  display: block; width: 100%; height: auto;
  max-height: 300px; object-fit: contain;
  border-radius: var(--mdx-image-border-radius);
}
#wemd .imageflow-caption {
  text-align: center; margin-top: 0; padding-top: 0;
  color: var(--mdx-image-caption-color);
  font-size: var(--mdx-image-caption-font-size);
}`;
}
