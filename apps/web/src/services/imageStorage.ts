/**
 * ImageStorage — 图片持久化抽象层
 *
 * 浏览器模式 → IndexedDB
 * 桌面模式   → Go ImageService（操作 {workspace}/.mdx-images/）
 */

import { getBridge, getBrowserBridge } from '../bridge'
import { useWorkspaceStore } from '../stores/workspace'

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

/** 工作区切换时调用，确保下次 getImageStorage() 返回正确的后端 */
export function resetImageStorage() {
  _storage = null
}

/** 判断当前是否为虚拟工作区（/Temp 等），是则强制走 IndexedDB */
function isCurrentWorkspaceVirtual(): boolean {
  try {
    return useWorkspaceStore().current?.kind === 'virtual'
  } catch {
    // workspace store 暂不可用时退回检查 bridge：浏览器模式下 isDesktop=false
    return !getBridge().isDesktop
  }
}

/** 获取当前环境的 ImageStorage 单例 */
export async function getImageStorage(): Promise<ImageStorage> {
  // 缓存命中但工作区类型变了 → 重建
  if (_storage && isCurrentWorkspaceVirtual() !== _storage.constructor.name.startsWith('Idb')) {
    _storage = null
  }
  if (_storage) return _storage

  // 桌面模式 + 真实文件系统工作区 → Go ImageService
  if (getBridge().isDesktop && !isCurrentWorkspaceVirtual()) {
    const { DesktopImageStorage } = await import('./imageStorage/desktop')
    _storage = new DesktopImageStorage()
    return _storage
  }
  // 浏览器模式 或 虚拟工作区（/Temp）→ IndexedDB
  const { IdbImageStorage } = await import('./imageStorage/idb')
  _storage = new IdbImageStorage()
  return _storage
}
