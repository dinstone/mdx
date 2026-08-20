/**
 * DesktopAttachmentStorage — 桌面端附件存储（Go AttachmentService 代理）
 *
 * 附件序列化为 base64 后通过 Wails bridge 存入 {workspace}/.mdx-assets/att/。
 */

import type { AttachmentStorage, AttachmentMeta } from '../attachmentStorage'

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

async function base64ToBlob(b64: string): Promise<Blob | null> {
  if (!b64) return null
  const resp = await fetch(b64)
  return resp.blob()
}

export class DesktopAttachmentStorage implements AttachmentStorage {
  // Dynamically imported to avoid importing Wails bindings in browser builds.
  private _svc: any = null

  private async _service(): Promise<any> {
    if (this._svc) return this._svc
    const mod = await import('../../../bindings/mdx/internal/service/attachmentservice')
    this._svc = mod
    return this._svc
  }

  async save(blob: Blob, _name: string): Promise<string> {
    const b64 = await blobToBase64(blob)
    const svc = await this._service()
    const key: string = await svc.Save(b64)
    return key || _name
  }

  async load(key: string): Promise<Blob | null> {
    try {
      const svc = await this._service()
      const b64: string = await svc.Load(key)
      if (!b64) return null
      return base64ToBlob(b64)
    } catch {
      return null
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const svc = await this._service()
      await svc.Delete(key)
    } catch {
      // ignore
    }
  }

  async list(): Promise<AttachmentMeta[]> {
    try {
      const svc = await this._service()
      const metas: any[] = (await svc.ListMeta()) ?? []
      return metas.map((m) => ({
        key: m.key,
        mime: m.mime || 'application/octet-stream',
        size: m.size || 0,
        createdAt: m.createdAt || 0,
      }))
    } catch {
      return []
    }
  }

  async vacuum(activeKeys: Set<string>): Promise<void> {
    try {
      const svc = await this._service()
      await svc.Vacuum(Array.from(activeKeys))
    } catch {
      // ignore
    }
  }
}
