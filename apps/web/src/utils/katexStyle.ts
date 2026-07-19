// KaTeX 样式内联：让「复制 HTML / 导出 HTML」得到的片段也能正确渲染数学公式。
//
// 实时预览通过 apps/web/src/main.ts 全局引入 katex.min.css 解决样式问题；
// 但「复制 HTML」导出的是一段独立 HTML 片段，目标页面未必加载 KaTeX，
// 因此这里把 KaTeX 的完整 CSS（含 @font-face）以 <style> 形式嵌入片段，
// 并把字体 url 改写为 jsDelivr CDN，保证公式字形在独立 HTML 中也能加载。
//
// 注意：微信公众号会过滤 <style> 与外部字体，KaTeX 公式在公众号内无法靠
// CSS 渲染（需改用图片方案），本文件仅服务于通用 HTML 导出/复制。

// ?inline 让 Vite 把 CSS 作为字符串返回（不自动注入 <style>、不抽取字体资源）
import katexRawCss from "katex/dist/katex.min.css?inline";

// 与 lockfile 解析版本一致（katex@0.16.47），用于拼接字体 CDN 地址
const KATEX_VERSION = "0.16.47";
const KATEX_FONT_BASE = `https://cdn.jsdelivr.net/npm/katex@${KATEX_VERSION}/dist/fonts/`;

// 将相对字体路径改写为 CDN，使独立 HTML 也能加载 KaTeX 字体
export const katexCssWithCdnFonts = String(katexRawCss).replace(
  /url\(\s*['"]?fonts\//g,
  `url(${KATEX_FONT_BASE}`,
);

const KATEX_STYLE = `<style data-katex-css>${katexCssWithCdnFonts}</style>`;

/** 在 HTML 片段顶部嵌入 KaTeX 样式，使其独立打开时公式可正常渲染。 */
export function withKatexStyle(html: string): string {
  if (!html) return html;
  return `${KATEX_STYLE}${html}`;
}
