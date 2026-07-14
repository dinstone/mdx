/**
 * ImageStorage — 图片持久化抽象层
 *
 * 浏览器模式 → IndexedDB
 * 桌面模式   → Go ImageService（操作 {workspace}/.mdx-images/）
 */

import { getBridge } from '../bridge'

/** 存储中的图片记录（不含 Blob，用于 list 接口） */
export interface ImageMeta {
  hash: string
  mime: string
  width: number
  height: number
  originalSize: number
  createdAt: number
}

export interface ImageStorage {
  /** 保存图片 Blob，key = hash，返回实际存储用的 hash */
  save(hash: string, blob: Blob, meta: Omit<ImageMeta, 'createdAt'>): Promise<string>

  /** 按 hash 读取 Blob */
  load(hash: string): Promise<Blob | null>

  /** 按 hash 读取 Base64 data-URI 字符串（复制到公众号用） */
  loadBase64(hash: string): Promise<string | null>

  /** 删除单张图片 */
  delete(hash: string): Promise<void>

  /** 列出所有已存储的图片元数据 */
  list(): Promise<ImageMeta[]>

  /** 清理孤图：保留 activeHashes 中的，其余删除 */
  vacuum(activeHashes: Set<string>): Promise<void>
}

let _storage: ImageStorage | null = null

/** 获取当前环境的 ImageStorage 单例 */
export async function getImageStorage(): Promise<ImageStorage> {
  if (_storage) return _storage
  if (getBridge().isDesktop) {
    const { DesktopImageStorage } = await import('./imageStorage/desktop')
    _storage = new DesktopImageStorage()
    return _storage
  }
  // 浏览器模式
  const { IdbImageStorage } = await import('./imageStorage/idb')
  _storage = new IdbImageStorage()
  return _storage
}
