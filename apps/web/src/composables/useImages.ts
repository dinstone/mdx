/**
 * useImages — 图片管理 composable
 *
 * 提供：
 *   - processImage / processImages  处理并存储图片
 *   - resolveSrc(hash)              预览时 img:// → blob URL
 *   - toBase64(hash)                复制到公众号时 img:// → base64
 *   - extractHashes(markdown)       从 Markdown 文本中提取所有 img:// hash
 *   - cleanup()                     vacuum 清理孤图
 */

import { ref, shallowRef } from 'vue'
import { processImage as pipelineProcess, processImages as pipelineProcessMany, blobToPortableBase64 } from '../services/imagePipeline'
import { getImageStorage } from '../services/imageStorage'
import type { ImageStorage, ImageMeta } from '../services/imageStorage'
import type { ImageEntry } from '../services/imagePipeline'

/** img:// 协议前缀 */
export const IMG_PROTOCOL = 'img://'

/** 从 Markdown 中提取所有 img:// 协议的 hash */
export function extractHashes(markdown: string): Set<string> {
  const hashes = new Set<string>()
  const re = /!\[.*?\]\(img:\/\/([a-f0-9]{8})\)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(markdown)) !== null) {
    hashes.add(m[1])
  }
  return hashes
}

/** 从 HTML 中提取所有 img:// src */
export function extractHtmlImageHashes(html: string): Set<string> {
  const hashes = new Set<string>()
  const re = /src=["']img:\/\/([a-f0-9]{8})["']/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    hashes.add(m[1])
  }
  return hashes
}

// 全局 blob URL 缓存，避免重复 createObjectURL
const blobUrlCache = new Map<string, string>()

/** 全局 ImageStorage 单例缓存 */
let _storagePromise: Promise<ImageStorage> | null = null

function ensureStorage(): Promise<ImageStorage> {
  if (!_storagePromise) _storagePromise = getImageStorage()
  return _storagePromise
}

export function useImages() {
  const images = shallowRef<ImageMeta[]>([])
  const loading = ref(false)

  async function storage(): Promise<ImageStorage> {
    return ensureStorage()
  }

  /** 处理单张图片并返回插入信息 */
  async function processImage(file: File): Promise<ImageEntry> {
    loading.value = true
    try {
      const entry = await pipelineProcess(file)
      await refresh()
      return entry
    } finally {
      loading.value = false
    }
  }

  /** 处理多张图片 */
  async function processImages(files: File[]): Promise<ImageEntry[]> {
    loading.value = true
    try {
      const entries = await pipelineProcessMany(files)
      await refresh()
      return entries
    } finally {
      loading.value = false
    }
  }

  /** 刷新图片列表 */
  async function refresh(): Promise<void> {
    const s = await storage()
    images.value = await s.list()
  }

  /** 预览用：img://hash → blob URL */
  async function resolveSrc(hash: string): Promise<string> {
    const cached = blobUrlCache.get(hash)
    if (cached) return cached

    const s = await storage()
    const blob = await s.load(hash)
    if (!blob) return ''

    const url = URL.createObjectURL(blob)
    blobUrlCache.set(hash, url)
    return url
  }

  /** 复制到公众号用：img://hash → base64 data-URI */
  async function toBase64(hash: string): Promise<string | null> {
    const s = await storage()
    const blob = await s.load(hash)
    if (!blob) return null

    const meta = (await s.list()).find((m) => m.hash === hash)
    return blobToPortableBase64(blob, meta?.mime ?? 'image/png')
  }

  /** 删除图片 */
  async function removeImage(hash: string): Promise<void> {
    const s = await storage()
    await s.delete(hash)
    const url = blobUrlCache.get(hash)
    if (url) {
      URL.revokeObjectURL(url)
      blobUrlCache.delete(hash)
    }
    await refresh()
  }

  /** 批量转换 img://hash → base64（复制到公众号时使用） */
  async function convertToBase64Map(hashes: Set<string>): Promise<Map<string, string>> {
    const map = new Map<string, string>()
    for (const hash of hashes) {
      const b64 = await toBase64(hash)
      if (b64) map.set(hash, b64)
    }
    return map
  }

  /** 清理孤图：保留 markdown 中引用的，其余删除 */
  async function cleanup(markdown: string): Promise<void> {
    const active = extractHashes(markdown)
    const s = await storage()
    await s.vacuum(active)
    for (const [hash, url] of blobUrlCache) {
      if (!active.has(hash)) {
        URL.revokeObjectURL(url)
        blobUrlCache.delete(hash)
      }
    }
    await refresh()
  }

  return {
    images,
    loading,
    processImage,
    processImages,
    resolveSrc,
    toBase64,
    removeImage,
    convertToBase64Map,
    refresh,
    cleanup,
  }
}
