// 把 HTML 中的 KaTeX 公式栅格化为 PNG 图片（data URI），
// 以兼容微信公众号等会过滤 <style> / 外部字体的环境——纯 CSS 公式在这些环境里无法渲染。
//
// 做法：把 HTML 放进离屏容器，注入 KaTeX 样式（字体走 jsDelivr CDN，web 与 Wails 都可用），
// 等网络字体就绪后，对每个 .katex 节点用 html-to-image 截图为 PNG，替换原节点为 <img>。
// 单行公式 → 行内 <img>；块级公式 → 居中 <img>。
// 任一次截图失败都会降级保留原公式，不阻塞导出。

import { toPng } from 'html-to-image'
import { katexCssWithCdnFonts } from './katexStyle'

export async function rasterizeMathToImages(html: string): Promise<string> {
  if (
    !html ||
    (!html.includes('inline-equation') && !html.includes('block-equation'))
  ) {
    return html
  }

  const container = document.createElement('div')
  container.setAttribute('data-math-raster', '')
  // 离屏但真实渲染：白底黑字，保证截出的字形是深色的（适配公众号白底）
  container.style.cssText =
    'position:fixed;left:-100000px;top:0;width:760px;background:#ffffff;color:#000000;' +
    'font-size:16px;line-height:1.6;padding:0;margin:0;'

  const styleEl = document.createElement('style')
  styleEl.setAttribute('data-katex-cdn', '')
  styleEl.textContent = katexCssWithCdnFonts
  container.appendChild(styleEl)

  const content = document.createElement('div')
  content.innerHTML = html
  container.appendChild(content)
  document.body.appendChild(container)

  try {
    // 等网络字体加载完，避免截到空白/豆腐字形
    if (document.fonts?.ready) {
      try {
        await document.fonts.ready
      } catch {
        /* 忽略字体就绪异常，继续尝试 */
      }
    }
    // 多等一帧 + 一小段缓冲，确保布局与字形绘制完成
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    )
    await new Promise<void>((resolve) => setTimeout(resolve, 120))

    const katexNodes = Array.from(
      container.querySelectorAll<HTMLElement>(
        '.inline-equation > .katex, .block-equation > .katex',
      ),
    )

    for (const katexEl of katexNodes) {
      const parent = katexEl.parentElement
      if (!parent) continue
      const isBlock = parent.classList.contains('block-equation')
      try {
        const rect = katexEl.getBoundingClientRect()
        const width = Math.ceil(rect.width) + 4
        const height = Math.ceil(rect.height) + 4
        const dataUrl = await toPng(katexEl, {
          pixelRatio: 2,
          cacheBust: false,
          width,
          height,
          backgroundColor: 'transparent',
          style: {
            margin: '0',
            padding: '0',
            transform: 'none',
          },
        })
        const img = document.createElement('img')
        img.src = dataUrl
        const latex = (parent.getAttribute('data-latex') || '').replace(/[<>]/g, '')
        if (latex) img.alt = latex
        // 关键：显式把显示宽度限制为公式原始像素宽（width 已含 2x 之上的 +4 留白），
        // 否则浏览器按 PNG 固有像素(=原始宽×pixelRatio)显示，图片会被放大 pixelRatio 倍。
        // 保留 pixelRatio=2 仅影响清晰度，配合这里 width 约束即可高清且不大。
        img.setAttribute(
          'style',
          isBlock
            ? `display:block;margin:0 auto;width:${width}px;max-width:100%;height:auto;`
            : `display:inline-block;vertical-align:middle;width:${width}px;max-width:100%;height:auto;`,
        )
        parent.replaceChild(img, katexEl)
      } catch (e) {
        console.warn('[mathToImage] 单个公式截图失败，保留原公式:', e)
        // 降级：保留原 KaTeX 节点
      }
    }

    return content.innerHTML
  } finally {
    document.body.removeChild(container)
  }
}
