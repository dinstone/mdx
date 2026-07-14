/**
 * DesktopImageStorage — 桌面端图片存储（Go ImageService 代理）
 *
 * 图片序列化为 base64 后通过 Wails bridge 存入 {workspace}/.mdx-images/。
 */

import type { ImageStorage, ImageMeta } from '../imageStorage'

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

export class DesktopImageStorage implements ImageStorage {
  // Dynamically imported to avoid importing Wails bindings in browser builds.
  private _svc: any = null

  private async _service(): Promise<any> {
    if (this._svc) return this._svc
    const mod = await import('../../../bindings/mdx/internal/service/imageservice')
    this._svc = mod
    return this._svc
  }

  async save(
    hash: string,
    blob: Blob,
    meta: Omit<ImageMeta, 'createdAt'>,
  ): Promise<string> {
    // Desktop 端：由 ImagePipeline 调用 processImage 时，先将 blob 压缩并
    // 生成 hash，然后调用此 save。Go 端需要幂等：相同 hash 不重复写。
    const b64 = await blobToBase64(blob)
    const svc = await this._service()
    // 使用 Go ImageService.Save 返回的哈希值作为权威哈希，
    // 确保前后端使用同一哈希，避免 save/load 不匹配。
    const goHash: string = await svc.Save(b64)
    if (goHash && goHash !== hash) {
      console.warn(`[DesktopStorage] hash mismatch: frontend=${hash} go=${goHash}, using Go hash`)
    }
    return goHash || hash
  }

  async load(hash: string): Promise<Blob | null> {
    try {
      const svc = await this._service()
      const b64: string = await svc.Load(hash)
      if (!b64) {
        console.warn(`[DesktopStorage] Load returned empty for hash=${hash}`)
        return null
      }
      return base64ToBlob(b64)
    } catch (e) {
      console.error(`[DesktopStorage] Load failed for hash=${hash}:`, e)
      return null
    }
  }

  async loadBase64(hash: string): Promise<string | null> {
    try {
      const svc = await this._service()
      return svc.LoadBase64(hash)
    } catch {
      return null
    }
  }

  async delete(hash: string): Promise<void> {
    try {
      const svc = await this._service()
      await svc.Delete(hash)
    } catch {
      // ignore
    }
  }

  async list(): Promise<ImageMeta[]> {
    try {
      const svc = await this._service()
      const hashes: string[] = (await svc.List()) ?? []
      return hashes.map((h) => ({
        hash: h,
        mime: 'image/png', // 从文件系统读取时不跟踪 mime，保持兼容
        width: 0,
        height: 0,
        originalSize: 0,
        createdAt: 0,
      }))
    } catch {
      return []
    }
  }

  async vacuum(activeHashes: Set<string>): Promise<void> {
    try {
      const svc = await this._service()
      await svc.Vacuum(Array.from(activeHashes))
    } catch {
      // ignore
    }
  }
}
