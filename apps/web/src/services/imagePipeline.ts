/**
 * ImagePipeline — 图片处理管道
 *
 * 流程: File → 格式判断 → Canvas 压缩 → SHA-256 哈希 → 存入 ImageStorage
 *
 * 压缩策略:
 *   - GIF / SVG / SVG+XML → 原样保留，不压缩
 *   - 其他格式 → Canvas 等比缩放至最大宽 1920px，toBlob(quality=0.85)
 */

import { getImageStorage, type ImageMeta } from './imageStorage'

/** 压缩参数 */
const MAX_WIDTH = 1920
const OUTPUT_QUALITY = 0.85

const SKIP_COMPRESS = new Set([
  'image/gif',
  'image/svg+xml',
  'image/svg',
])

/** 图片处理结果 */
export interface ImageEntry {
  hash: string
  blob: Blob
  mime: string
  width: number
  height: number
  originalSize: number
}

/**
 * 将 File 转为 Image 对象
 */
function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(blob)
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = (e) => {
      URL.revokeObjectURL(url)
      reject(e instanceof Error ? e : new Error('Failed to load image'))
    }
    img.src = url
  })
}

/**
 * Canvas 压缩
 * - 等比缩放到 maxWidth=1920
 * - 输出 quality=0.85
 * - 保持原始格式（PNG → PNG, JPEG → JPEG, WebP → WebP）
 * - 如果原图 ≤ 目标尺寸，不降分辨率，只调整 quality
 */
async function compressViaCanvas(
  blob: Blob,
  mime: string,
): Promise<{ blob: Blob; width: number; height: number }> {
  const img = await loadImage(blob)
  const srcW = img.naturalWidth
  const srcH = img.naturalHeight

  let dstW = srcW
  let dstH = srcH
  if (srcW > MAX_WIDTH) {
    dstW = MAX_WIDTH
    dstH = Math.round((srcH / srcW) * MAX_WIDTH)
  }

  const canvas = document.createElement('canvas')
  canvas.width = dstW
  canvas.height = dstH
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, dstW, dstH)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (!result) {
          reject(new Error('Canvas toBlob returned null'))
          return
        }
        resolve({ blob: result, width: dstW, height: dstH })
      },
      // 统一输出格式；toBlob 第二个参数对 PNG 无效（无损），对 JPEG/WebP 有效
      SKIP_COMPRESS.has(mime) ? mime : mime === 'image/png' ? 'image/png' : 'image/jpeg',
      mime === 'image/png' ? undefined : OUTPUT_QUALITY,
    )
  })
}

/**
 * 生成内容哈希（SHA-256 前 8 位 hex）
 */
async function hashBlob(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', buf)
  const hex = [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return hex.slice(0, 8)
}

/**
 * 处理单张图片：压缩 → 哈希 → 存储 → 返回元数据
 */
export async function processImage(file: File): Promise<ImageEntry> {
  const originalSize = file.size
  const mime = file.type || 'image/png'

  // GIF / SVG 跳过压缩
  const shouldCompress = !SKIP_COMPRESS.has(mime)

  let blob: Blob
  let width: number
  let height: number

  if (shouldCompress) {
    const compressed = await compressViaCanvas(file, mime)
    blob = compressed.blob
    width = compressed.width
    height = compressed.height
  } else {
    // 原样保留，但 GIF 也需要读尺寸
    const img = await loadImage(file)
    blob = file
    width = img.naturalWidth
    height = img.naturalHeight
  }

  const hash = await hashBlob(blob)
  const storage = await getImageStorage()

  // 用 storage.save 返回的哈希作为权威值（桌面端可能由 Go 后端计算）
  const actualHash = await storage.save(hash, blob, {
    hash,
    mime,
    width,
    height,
    originalSize,
  })

  return { hash: actualHash, blob, mime, width, height, originalSize }
}

/**
 * 批量处理多张图片
 */
export async function processImages(files: File[]): Promise<ImageEntry[]> {
  // 逐个顺序处理，避免多张图同时 Canvas → toBlob 撑爆内存
  const results: ImageEntry[] = []
  for (const file of files) {
    results.push(await processImage(file))
  }
  return results
}

/**
 * 将 Blob 转为 Base64 data-URI（复制到公众号时使用）
 * 对大图做二次压缩：> 500KB → quality 50%, maxWidth 1200
 */
export async function blobToPortableBase64(
  blob: Blob,
  mime: string,
): Promise<string> {
  const MAX_BYTES = 500 * 1024 // 500KB

  if (blob.size <= MAX_BYTES || SKIP_COMPRESS.has(mime)) {
    // 小图或 GIF/SVG — 直接转 base64，不做二次压缩
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(blob)
    })
  }

  // 大图二次压缩
  const img = await loadImage(blob)
  const dstW = img.naturalWidth > 1200 ? 1200 : img.naturalWidth
  const dstH = img.naturalWidth > 1200
    ? Math.round((img.naturalHeight / img.naturalWidth) * 1200)
    : img.naturalHeight

  const canvas = document.createElement('canvas')
  canvas.width = dstW
  canvas.height = dstH
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, dstW, dstH)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (compressed) => {
        if (!compressed) {
          reject(new Error('Canvas toBlob returned null'))
          return
        }
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(compressed)
      },
      'image/jpeg',
      0.5,
    )
  })
}
