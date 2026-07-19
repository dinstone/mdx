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

// ---------------------------------------------------------------------------
// 同源本地字体版本（供主题预览 iframe 使用）
//
// 主题预览用 iframe 沙箱隔离渲染，iframe 不继承父页面注入的全局 KaTeX 样式。
// 此前这里沿用 CDN 字体：一旦环境无网络、或 WebView 拦截跨域字体，公式就会
// 渲染失败（而主预览区因使用本地打包字体一直正常）。改为引用 Vite 打包的
// 同源本地字体后，预览不再依赖外网，行为与主预览区一致。
// ---------------------------------------------------------------------------
// ?inline 让 Vite 把字体文件作为 base64 data URI 返回。
// 主题预览用 iframe 沙箱渲染，其 document base 是 about:srcdoc，无法可靠解析
// 相对/同源字体 URL（尤其在 Wails 的 file:// 生产环境），因此必须把字体以
// data URI 形式内联进 CSS，做到完全自包含、零网络依赖、离线可用。
import amsRegular from "katex/dist/fonts/KaTeX_AMS-Regular.woff2?inline";
import caligraphicBold from "katex/dist/fonts/KaTeX_Caligraphic-Bold.woff2?inline";
import caligraphicRegular from "katex/dist/fonts/KaTeX_Caligraphic-Regular.woff2?inline";
import frakturBold from "katex/dist/fonts/KaTeX_Fraktur-Bold.woff2?inline";
import frakturRegular from "katex/dist/fonts/KaTeX_Fraktur-Regular.woff2?inline";
import mainBold from "katex/dist/fonts/KaTeX_Main-Bold.woff2?inline";
import mainBoldItalic from "katex/dist/fonts/KaTeX_Main-BoldItalic.woff2?inline";
import mainItalic from "katex/dist/fonts/KaTeX_Main-Italic.woff2?inline";
import mainRegular from "katex/dist/fonts/KaTeX_Main-Regular.woff2?inline";
import mathBoldItalic from "katex/dist/fonts/KaTeX_Math-BoldItalic.woff2?inline";
import mathItalic from "katex/dist/fonts/KaTeX_Math-Italic.woff2?inline";
import sansSerifBold from "katex/dist/fonts/KaTeX_SansSerif-Bold.woff2?inline";
import sansSerifItalic from "katex/dist/fonts/KaTeX_SansSerif-Italic.woff2?inline";
import sansSerifRegular from "katex/dist/fonts/KaTeX_SansSerif-Regular.woff2?inline";
import scriptRegular from "katex/dist/fonts/KaTeX_Script-Regular.woff2?inline";
import size1Regular from "katex/dist/fonts/KaTeX_Size1-Regular.woff2?inline";
import size2Regular from "katex/dist/fonts/KaTeX_Size2-Regular.woff2?inline";
import size3Regular from "katex/dist/fonts/KaTeX_Size3-Regular.woff2?inline";
import size4Regular from "katex/dist/fonts/KaTeX_Size4-Regular.woff2?inline";
import typewriterRegular from "katex/dist/fonts/KaTeX_Typewriter-Regular.woff2?inline";

const katexFontUrlMap: Record<string, string> = {
  "KaTeX_AMS-Regular": amsRegular,
  "KaTeX_Caligraphic-Bold": caligraphicBold,
  "KaTeX_Caligraphic-Regular": caligraphicRegular,
  "KaTeX_Fraktur-Bold": frakturBold,
  "KaTeX_Fraktur-Regular": frakturRegular,
  "KaTeX_Main-Bold": mainBold,
  "KaTeX_Main-BoldItalic": mainBoldItalic,
  "KaTeX_Main-Italic": mainItalic,
  "KaTeX_Main-Regular": mainRegular,
  "KaTeX_Math-BoldItalic": mathBoldItalic,
  "KaTeX_Math-Italic": mathItalic,
  "KaTeX_SansSerif-Bold": sansSerifBold,
  "KaTeX_SansSerif-Italic": sansSerifItalic,
  "KaTeX_SansSerif-Regular": sansSerifRegular,
  "KaTeX_Script-Regular": scriptRegular,
  "KaTeX_Size1-Regular": size1Regular,
  "KaTeX_Size2-Regular": size2Regular,
  "KaTeX_Size3-Regular": size3Regular,
  "KaTeX_Size4-Regular": size4Regular,
  "KaTeX_Typewriter-Regular": typewriterRegular,
};

/**
 * 完全自包含的 KaTeX CSS（字体以 base64 data URI 内联）：供 iframe 预览使用。
 * 不依赖外网 CDN，也不依赖同源字体文件 URL，离线 / file:// 环境下都能正常渲染公式。
 */
export const katexCssLocalFonts = (() => {
  let css = String(katexRawCss);
  // 用内联的 data URI 字体替换 woff2 引用
  css = css.replace(
    /url\(\s*['"]?fonts\/(KaTeX_[A-Za-z0-9-]+)\.woff2['"]?\)/g,
    (_full, name: string) => {
      const local = katexFontUrlMap[name];
      return local ? `url(${local})` : _full;
    },
  );
  // 移除 woff / ttf 回退引用（现代浏览器均支持 woff2，data URI 已内联）
  css = css.replace(
    /,\s*url\(\s*['"]?fonts\/KaTeX_[A-Za-z0-9-]+\.(?:woff|ttf)['"]?\)\s*format\(['"][^'"]*['"]\)/g,
    "",
  );
  return css;
})();

const KATEX_STYLE = `<style data-katex-css>${katexCssWithCdnFonts}</style>`;

/** 在 HTML 片段顶部嵌入 KaTeX 样式，使其独立打开时公式可正常渲染。 */
export function withKatexStyle(html: string): string {
  if (!html) return html;
  return `${KATEX_STYLE}${html}`;
}
