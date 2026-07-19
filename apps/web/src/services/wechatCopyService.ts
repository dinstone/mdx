/**
 * WeChat 公众号复制服务
 * 将 Markdown 渲染后的 HTML 以 text/html 形式写入剪贴板，确保粘贴到公众号编辑器时保留样式。
 *
 * 图片处理：自动识别 img:// 短链接，从 IndexedDB 加载后转为 Base64 内嵌，
 * 粘贴到公众号时图片直接显示，无需二次上传。
 */

import { getImageStorage } from './imageStorage'
import { blobToPortableBase64 } from './imagePipeline'
import { rasterizeMathToImages } from '../utils/mathToImage'

/**
 * 将 HTML 中的 img:// 短链接替换为 Base64 data-URI
 * 大图（> 500KB）自动二次压缩
 */
async function inlineImageBase64(html: string): Promise<string> {
  // 快速检测：没有 img:// 则跳过 DOM 解析
  if (!html.includes('img://')) return html

  const container = document.createElement('div')
  container.innerHTML = html

  const imgs = container.querySelectorAll<HTMLImageElement>('img[src^="img://"]')
  if (imgs.length === 0) return html

  const storage = await getImageStorage()
  let succeeded = 0
  let failed = 0
  for (const img of Array.from(imgs)) {
    const hash = img.src.replace('img://', '')
    try {
      const blob = await storage.load(hash)
      if (!blob) {
        console.warn(`[WechatCopy] No blob for hash=${hash}`)
        failed++
        continue
      }

      // 查找 meta 以获取 mime 类型
      const list = await storage.list()
      const meta = list.find((m) => m.hash === hash)

      const base64 = await blobToPortableBase64(blob, meta?.mime ?? 'image/png')
      img.src = base64
      succeeded++
    } catch (e) {
      console.warn(`[WechatCopy] Failed to inline image ${hash}:`, e)
      failed++
    }
  }
  if (succeeded > 0 || failed > 0) {
    console.log(`[WechatCopy] Inlined ${succeeded} images, ${failed} failed`)
  }

  return container.innerHTML
}

/**
 * 将 HTML 中的 checkbox 替换为 emoji
 * 微信会过滤 <input type="checkbox">，导致任务列表显示为空
 */
function convertCheckboxesToEmoji(html: string): string {
  // 先替换已选中
  let result = html.replace(/<input[^>]*checked[^>]*>/gi, '✅&nbsp;')
  // 再替换未选中
  result = result.replace(/<input[^>]*type=["']checkbox["'][^>]*>/gi, '⬜&nbsp;')
  return result
}

/**
 * 从容器获取纯文本回退内容
 */
function getPlainText(container: HTMLElement): string {
  return container.innerText || container.textContent || ''
}

/**
 * 使用原生 execCommand('copy') 复制富文本
 * 这是写入 text/html 最可靠的方式之一
 */
function copyViaExecCommand(container: HTMLElement): boolean {
  const selection = window.getSelection()
  const range = document.createRange()
  range.selectNodeContents(container)
  selection?.removeAllRanges()
  selection?.addRange(range)
  try {
    return document.execCommand('copy')
  } finally {
    selection?.removeAllRanges()
  }
}

/**
 * 使用现代 Clipboard API 写入 text/html + text/plain
 */
async function copyViaClipboardApi(container: HTMLElement): Promise<boolean> {
  if (!navigator.clipboard || !window.ClipboardItem) return false
  try {
    const htmlBlob = new Blob([container.innerHTML], { type: 'text/html' })
    const textBlob = new Blob([getPlainText(container)], { type: 'text/plain' })
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html': htmlBlob,
        'text/plain': textBlob,
      }),
    ])
    return true
  } catch (e) {
    console.warn('[WechatCopy] Clipboard API 失败:', e)
    return false
  }
}

export interface CopyToWechatOptions {
  /** 复制容器宽度，默认 760px */
  width?: number
  /** 是否跳过图片 Base64 内联（预计算时设为 true，用预计算好的 HTML） */
  skipImageInline?: boolean
}

/**
 * 预计算图片内联后的微信 HTML（异步，不含按钮交互，可在内容变化时调用）。
 * 结果缓存起来，供 copyToWechat 使用，避免复制时异步操作导致 user gesture 过期。
 */
export async function buildInlinedWechatHtml(html: string): Promise<string> {
  if (!html) return html
  const inlined = await inlineImageBase64(html)
  const withEmoji = convertCheckboxesToEmoji(inlined)
  // 公式转图片，兼容公众号（会过滤 <style> / 外部字体，纯 CSS 公式无法渲染）
  try {
    return await rasterizeMathToImages(withEmoji)
  } catch (e) {
    console.warn('[WechatCopy] 公式转图片失败，降级为未转图 HTML:', e)
    return withEmoji
  }
}

/**
 * 将一个 DOM 容器中的 HTML 写入剪贴板（text/html + text/plain）。
 * 必须在用户点击事件中同步调用，否则浏览器会拒绝。
 */
export function syncCopyContainer(container: HTMLElement): boolean {
  // 先尝试 execCommand（兼容性更好，且对用户手势要求稍宽松）
  if (copyViaExecCommand(container)) return true

  // 回退：Clipboard API 也要求同步调用，这里直接用 writeText 兜底
  try {
    const text = getPlainText(container)
    // writeText 在无 user gesture 时更可能成功
    navigator.clipboard?.writeText(text)
    return true
  } catch {
    return false
  }
}

/**
 * 复制到微信公众号
 * @param html 已经 processHtml + inlineImageBase64 处理过的 HTML（样式已内联、图片已 base64）
 * @param options
 * @returns 是否复制成功
 */
export function copyToWechat(
  html: string,
  options: CopyToWechatOptions = {},
): boolean {
  if (!html) return false

  const width = options.width ?? 760
  const container = document.createElement('div')
  container.style.position = 'fixed'
  container.style.top = '0'
  container.style.left = '0'
  container.style.width = `${width}px`
  container.style.opacity = '0'
  container.style.pointerEvents = 'none'
  container.style.zIndex = '-1'
  container.style.contain = 'layout style paint'
  // 强制亮色模式，避免暗色 UI 下复制出亮色文字
  container.style.colorScheme = 'light'
  container.style.color = '#000000'
  container.style.background = '#ffffff'

  document.body.appendChild(container)

  try {
    // 如果已经预内联（skipImageInline=true），直接设置 HTML
    const preparedHtml = options.skipImageInline
      ? html
      : convertCheckboxesToEmoji(html)
    container.innerHTML = preparedHtml

    return syncCopyContainer(container)
  } finally {
    document.body.removeChild(container)
  }
}

/**
 * 生成用于微信复制的 HTML
 * 与预览 HTML 的区别：inlinePseudoElements=true，确保 ::before/::after 内容被内联
 */
export function prepareWechatHtml(html: string): string {
  return convertCheckboxesToEmoji(html)
}
