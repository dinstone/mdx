/**
 * 可视化主题设计器 - 从内置主题 CSS 反向解析出 DesignerVariables
 *
 * 用途：复制内置主题进入可视化设计器时，把内置主题的"可表达属性"提取到
 * DesignerVariables，使设计器显示真实当前值，用户可在此基础上微调。
 *
 * 容错原则：提取失败的字段回退 defaultVariables 对应值。未提取的属性会被
 * generateCSS 的"增量覆盖"判定为"未改动"而跳过，由 baseCss 兜底保留，
 * 因此解析不准也安全（基准是解析值自身，不依赖"准"）。
 */
import type { DesignerVariables, HeadingLevel, HeadingStyle } from "./types";
import { defaultVariables } from "./defaults";
import { fontFamilyOptions } from "./styleOptions";

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** 取某选择器块内的声明体（不含嵌套 {}） */
function getBlock(css: string, selector: string): string | null {
  const re = new RegExp(escapeRegex(selector) + "\\s*\\{([^{}]*)\\}", "i");
  const m = css.match(re);
  return m ? m[1] : null;
}

/** 从声明体取某属性值 */
function getProp(block: string | null, prop: string): string | null {
  if (!block) return null;
  const m = block.match(new RegExp("(?:^|;)\\s*" + prop + "\\s*:\\s*([^;]+)", "i"));
  return m ? m[1].trim() : null;
}

function parseMargin(block: string | null, prop = "margin"): { top?: number; bottom?: number } {
  const v = getProp(block, prop);
  if (!v) return {};
  const parts = v.split(/\s+/).map((s) => parseFloat(s));
  if (parts.some((n) => Number.isNaN(n))) return {};
  let top: number, bottom: number;
  if (parts.length >= 3) {
    top = parts[0];
    bottom = parts[2];
  } else if (parts.length === 2) {
    top = parts[0];
    bottom = parts[1];
  } else {
    top = parts[0];
    bottom = parts[0];
  }
  return { top, bottom };
}

function parsePadding(block: string | null): { x: number; y: number } | null {
  const v = getProp(block, "padding");
  if (!v) return null;
  const parts = v.split(/\s+/).map(parseFloat);
  if (parts.some((n) => Number.isNaN(n))) return null;
  let x: number, y: number;
  if (parts.length >= 3) {
    y = parts[0];
    x = parts[1];
  } else if (parts.length === 2) {
    y = parts[0];
    x = parts[1];
  } else {
    x = parts[0];
    y = parts[0];
  }
  return { x, y };
}

function parseBorder(value: string | null): { width?: number; style?: string; color?: string } {
  if (!value) return {};
  const widthM = value.match(/(\d+(?:\.\d+)?)px/);
  const styleM = value.match(/\b(solid|dashed|dotted|double|none)\b/);
  const colorM =
    value.match(/(#[0-9a-fA-F]{3,8})|rgba?\([^)]+\)|var\([^)]+\)/i) ||
    value.match(/\b(?!solid|dashed|dotted|double|none|thin|thick|medium)[a-z]+\b/);
  return {
    width: widthM ? parseFloat(widthM[1]) : undefined,
    style: styleM ? styleM[1] : undefined,
    color: colorM ? colorM[0] : undefined,
  };
}

function mapFontFamily(ff: string | null): string {
  if (!ff) return defaultVariables.fontFamily;
  const lower = ff.toLowerCase();
  if (lower.includes("mono") || lower.includes("courier")) {
    return fontFamilyOptions.find((o) => o.value.toLowerCase().includes("mono"))?.value ?? defaultVariables.fontFamily;
  }
  if (lower.includes("serif") && !lower.includes("sans")) {
    return fontFamilyOptions.find((o) => o.value.toLowerCase().includes("serif"))?.value ?? defaultVariables.fontFamily;
  }
  return defaultVariables.fontFamily;
}

function parseHeading(css: string, lvl: HeadingLevel): HeadingStyle {
  const base: HeadingStyle = JSON.parse(JSON.stringify(defaultVariables[lvl]));
  const contentBlock = getBlock(css, `#wemd ${lvl} .content`);
  const block = getBlock(css, `#wemd ${lvl}`);
  if (contentBlock) {
    const fs = getProp(contentBlock, "font-size");
    if (fs) base.fontSize = parseInt(fs, 10);
    const color = getProp(contentBlock, "color");
    if (color) base.color = color;
  }
  if (block) {
    const { top, bottom } = parseMargin(block);
    if (top !== undefined) base.marginTop = top;
    if (bottom !== undefined) base.marginBottom = bottom;
    if (getProp(block, "text-align") === "center") base.centered = true;
  }
  return base;
}

function parseInlineCodeStyle(radius: string | null, hasBorder: boolean): string {
  if (radius && radius.includes("12px")) return "rounded";
  if (hasBorder) return "github";
  return "simple";
}

/**
 * 从内置主题 CSS 解析出 DesignerVariables（尽力而为）。
 */
export function parseThemeCssToVariables(css: string): DesignerVariables {
  const v: DesignerVariables = JSON.parse(JSON.stringify(defaultVariables));

  // 全局
  const wemdBlock = getBlock(css, "#wemd");
  if (wemdBlock) {
    const ff = getProp(wemdBlock, "font-family");
    if (ff) v.fontFamily = mapFontFamily(ff);
    const color = getProp(wemdBlock, "color");
    if (color) v.paragraphColor = color;
    const pad = getProp(wemdBlock, "padding");
    if (pad) {
      const parts = pad.split(/\s+/).map(parseFloat).filter((n) => !Number.isNaN(n));
      if (parts.length >= 2) v.pagePadding = parts[1];
      else if (parts.length === 1) v.pagePadding = parts[0];
    }
  }
  const pBlock = getBlock(css, "#wemd p");
  if (pBlock) {
    const lh = getProp(pBlock, "line-height");
    if (lh) v.lineHeight = lh;
    const fs = getProp(pBlock, "font-size");
    if (fs) v.fontSize = fs;
    if (getProp(pBlock, "text-align") === "justify") v.textJustify = true;
    const ti = getProp(pBlock, "text-indent");
    if (ti && ti !== "0" && ti !== "0em" && ti !== "0px" && ti !== "none") v.textIndent = true;
  }

  // 标题
  (["h1", "h2", "h3", "h4"] as HeadingLevel[]).forEach((lvl) => {
    v[lvl] = parseHeading(css, lvl);
  });

  // 引用
  const quoteBlock = getBlock(css, "#wemd .multiquote-1") || getBlock(css, "#wemd blockquote");
  if (quoteBlock) {
    const bg = getProp(quoteBlock, "background") || getProp(quoteBlock, "background-color");
    if (bg && bg !== "transparent") v.quoteBackground = bg;
    const border = parseBorder(getProp(quoteBlock, "border-left") || getProp(quoteBlock, "border"));
    if (border.color) v.quoteBorderColor = border.color;
    if (border.width !== undefined) v.quoteBorderWidth = border.width;
    if (border.style) v.quoteBorderStyle = border.style as DesignerVariables["quoteBorderStyle"];
    const pad = parsePadding(quoteBlock);
    if (pad) {
      v.quotePaddingX = pad.x;
      v.quotePaddingY = pad.y;
    }
    const qp = getBlock(css, "#wemd .multiquote-1 p");
    if (qp) {
      const c = getProp(qp, "color");
      if (c) v.quoteTextColor = c;
      const fs = getProp(qp, "font-size");
      if (fs) v.quoteFontSize = parseInt(fs, 10);
      const lh = getProp(qp, "line-height");
      if (lh) v.quoteLineHeight = parseFloat(lh);
    }
  }

  // 代码
  const preCustom = getBlock(css, "#wemd pre.custom");
  if (preCustom) {
    const bg = getProp(preCustom, "background");
    if (bg && bg !== "transparent") v.codeBackground = bg;
  } else {
    const pre = getBlock(css, "#wemd pre");
    const bg = pre && getProp(pre, "background");
    if (bg && bg !== "transparent") v.codeBackground = bg;
  }
  const codeBlock = getBlock(css, "#wemd pre code") || getBlock(css, "#wemd pre code.hljs");
  if (codeBlock) {
    const fs = getProp(codeBlock, "font-size");
    if (fs) v.codeFontSize = parseInt(fs, 10);
  }
  const inlineBlock = getBlock(css, "#wemd p code") || getBlock(css, "#wemd li code") || getBlock(css, "#wemd code");
  if (inlineBlock) {
    const c = getProp(inlineBlock, "color");
    if (c) v.inlineCodeColor = c;
    const bg = getProp(inlineBlock, "background");
    if (bg && bg !== "transparent") v.inlineCodeBackground = bg;
    const br = getProp(inlineBlock, "border-radius");
    const hasBorder = !!getProp(inlineBlock, "border");
    v.inlineCodeStyle = parseInlineCodeStyle(br, hasBorder);
  }

  // 链接 / 文本
  const aBlock = getBlock(css, "#wemd a");
  if (aBlock) {
    const c = getProp(aBlock, "color");
    if (c) v.linkColor = c;
    const deco = getProp(aBlock, "text-decoration");
    v.linkUnderline = !!(
      (deco && deco.includes("underline")) ||
      getProp(aBlock, "border-bottom")
    );
  }
  const strongBlock = getBlock(css, "#wemd strong");
  if (strongBlock) {
    const c = getProp(strongBlock, "color");
    if (c && c !== "inherit" && c !== "currentColor") v.strongColor = c;
  }
  const markBlock = getBlock(css, "#wemd mark");
  if (markBlock) {
    const bg = getProp(markBlock, "background");
    if (bg && bg !== "transparent") v.markBackground = bg;
  }

  // 表格
  const thBlock = getBlock(css, "#wemd th");
  if (thBlock) {
    const bg = getProp(thBlock, "background");
    if (bg && bg !== "transparent" && bg !== "#fff") v.tableHeaderBackground = bg;
    const c = getProp(thBlock, "color");
    if (c && c !== "inherit") v.tableHeaderColor = c;
  }
  const tdBlock = getBlock(css, "#wemd th, #wemd td") || getBlock(css, "#wemd td");
  if (tdBlock) {
    const b = parseBorder(getProp(tdBlock, "border"));
    if (b.color) v.tableBorderColor = b.color;
  }
  if (css.includes("nth-child(even)") || css.includes("nth-child(2n)")) v.tableZebra = true;

  // 分割线
  const hrBlock = getBlock(css, "#wemd hr");
  if (hrBlock) {
    const b = parseBorder(getProp(hrBlock, "border-top") || getProp(hrBlock, "border"));
    if (b.color) v.hrColor = b.color;
    if (b.width !== undefined) v.hrHeight = b.width;
    if (b.style) v.hrStyle = b.style as DesignerVariables["hrStyle"];
  }

  // 列表
  const ulBlock = getBlock(css, "#wemd ul");
  if (ulBlock) {
    const ls = getProp(ulBlock, "list-style-type") || getProp(ulBlock, "list-style");
    if (ls) v.ulStyle = ls;
  }
  const ulUl = getBlock(css, "#wemd ul ul");
  if (ulUl) {
    const ls = getProp(ulUl, "list-style-type") || getProp(ulUl, "list-style");
    if (ls) v.ulStyleL2 = ls;
  }
  const olBlock = getBlock(css, "#wemd ol");
  if (olBlock) {
    const ls = getProp(olBlock, "list-style-type") || getProp(olBlock, "list-style");
    if (ls) v.olStyle = ls;
  }
  const olOl = getBlock(css, "#wemd ol ol");
  if (olOl) {
    const ls = getProp(olOl, "list-style-type") || getProp(olOl, "list-style");
    if (ls) v.olStyleL2 = ls;
  }

  // 图片
  const imgBlock = getBlock(css, "#wemd img");
  if (imgBlock) {
    const br = getProp(imgBlock, "border-radius");
    if (br) v.imageBorderRadius = parseInt(br, 10) || 0;
    const shadow = getProp(imgBlock, "box-shadow");
    if (shadow && shadow !== "none") v.imageShadow = true;
    const m = parseMargin(imgBlock);
    if (m.top !== undefined) v.imageMargin = m.top;
  }
  const cap = getBlock(css, "#wemd figcaption");
  if (cap) {
    const c = getProp(cap, "color");
    if (c) v.imageCaptionColor = c;
    const fs = getProp(cap, "font-size");
    if (fs) v.imageCaptionFontSize = parseInt(fs, 10);
    const ta = getProp(cap, "text-align");
    if (ta) v.imageCaptionTextAlign = ta;
  }

  return v;
}
