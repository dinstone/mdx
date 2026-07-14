/**
 * WeChat 公众号复制服务
 * 将 Markdown 渲染后的 HTML 以 text/html 形式写入剪贴板，确保粘贴到公众号编辑器时保留样式。
 */

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
}

/**
 * 复制到微信公众号
 * @param html 已经 processHtml 处理过的 HTML 字符串（样式已内联）
 * @returns 是否复制成功
 */
export async function copyToWechat(
  html: string,
  options: CopyToWechatOptions = {},
): Promise<boolean> {
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
    const preparedHtml = convertCheckboxesToEmoji(html)
    container.innerHTML = preparedHtml

    let copied = copyViaExecCommand(container)

    if (!copied) {
      copied = await copyViaClipboardApi(container)
    }

    return copied
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
