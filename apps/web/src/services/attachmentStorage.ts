/**
 * AttachmentStorage — 附件持久化抽象层
 *
 * 浏览器模式 → IndexedDB
 * 桌面模式   → Go AttachmentService（操作 {workspace}/.mdx-assets/att/）
 *
 * 附件协议：Markdown 中形如 [文件名.ext](att://<hash8>.<ext>)，
 * 存储文件名为 <hash8>.<ext>，与 URL 一一对应。
 */

import { getBridge } from '../bridge'
import { useWorkspaceStore } from '../stores/workspace'

/** 附件记录（用于 list 接口） */
export interface AttachmentMeta {
  /** 存储键，形如 "hash8.ext" */
  key: string
  mime: string
  /** 字节数 */
  size: number
  /** 创建时间（Unix ms） */
  createdAt: number
}

export interface AttachmentStorage {
  /** 保存附件 Blob，返回实际存储用的 key（hash8.ext） */
  save(blob: Blob, name: string): Promise<string>

  /** 按 key 读取 Blob */
  load(key: string): Promise<Blob | null>

  /** 删除单条附件 */
  delete(key: string): Promise<void>

  /** 列出所有已存储的附件元数据 */
  list(): Promise<AttachmentMeta[]>

  /** 清理孤立附件：保留 activeKeys 中的，其余删除 */
  vacuum(activeKeys: Set<string>): Promise<void>
}

let _storage: AttachmentStorage | null = null

/** 判断当前是否为虚拟工作空间（/Temp 等），是则强制走 IndexedDB */
function isCurrentWorkspaceVirtual(): boolean {
  try {
    return useWorkspaceStore().current?.kind === 'virtual'
  } catch {
    return !getBridge().isDesktop
  }
}

/** 获取当前环境的 AttachmentStorage 单例 */
export async function getAttachmentStorage(): Promise<AttachmentStorage> {
  // 缓存命中但工作空间类型变了 → 重建
  if (_storage && isCurrentWorkspaceVirtual() !== _storage.constructor.name.startsWith('Idb')) {
    _storage = null
  }
  if (_storage) return _storage

  // 桌面模式 + 真实文件系统工作空间 → Go AttachmentService
  if (getBridge().isDesktop && !isCurrentWorkspaceVirtual()) {
    const { DesktopAttachmentStorage } = await import('./attachmentStorage/desktop')
    _storage = new DesktopAttachmentStorage()
    return _storage
  }
  // 浏览器模式 或 虚拟工作空间（/Temp）→ IndexedDB
  const { IdbAttachmentStorage } = await import('./attachmentStorage/idb')
  _storage = new IdbAttachmentStorage()
  return _storage
}
