/**
 * IdbAttachmentStorage — 浏览器端 IndexedDB 附件存储
 *
 * 数据库: mdx-attachments, version 1
 * ObjectStore: attachments, keyPath = key
 */

import type { AttachmentStorage, AttachmentMeta } from '../attachmentStorage'
import { hashBlob } from '../imagePipeline'

const DB_NAME = 'mdx-attachments'
const DB_VERSION = 1
const STORE_NAME = 'attachments'

interface AttachmentRecord {
  key: string
  blob: Blob
  mime: string
  name: string
  size: number
  createdAt: number
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/** 根据 MIME 类型推断扩展名（与 Go AttachmentService 的 extFromMime 保持一致） */
function extFromMime(mime: string): string {
  switch (mime) {
    case 'image/png':
      return '.png'
    case 'image/jpeg':
      return '.jpg'
    case 'image/gif':
      return '.gif'
    case 'image/webp':
      return '.webp'
    case 'image/svg+xml':
      return '.svg'
    case 'application/pdf':
      return '.pdf'
    case 'application/msword':
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return '.doc'
    case 'application/vnd.ms-excel':
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      return '.xls'
    case 'application/vnd.ms-powerpoint':
    case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
      return '.ppt'
    case 'application/zip':
      return '.zip'
    case 'text/plain':
      return '.txt'
    case 'text/markdown':
      return '.md'
    default:
      return ''
  }
}

/** 从原始文件名提取扩展名（含点） */
function extFromName(name: string): string {
  const m = name.trim().match(/\.([a-zA-Z0-9]+)$/)
  return m ? `.${m[1].toLowerCase()}` : ''
}

function promisify<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export class IdbAttachmentStorage implements AttachmentStorage {
  private _dbPromise: Promise<IDBDatabase> | null = null

  private async _db(): Promise<IDBDatabase> {
    if (!this._dbPromise) this._dbPromise = openDB()
    return this._dbPromise
  }

  private _store(mode: IDBTransactionMode = 'readonly'): Promise<IDBObjectStore> {
    return this._db().then((db) => db.transaction(STORE_NAME, mode).objectStore(STORE_NAME))
  }

  async save(blob: Blob, name: string): Promise<string> {
    const hash = await hashBlob(blob)
    const ext = extFromMime(blob.type) || extFromName(name)
    const key = hash + ext
    const store = await this._store('readwrite')
    const record: AttachmentRecord = {
      key,
      blob,
      mime: blob.type || 'application/octet-stream',
      name,
      size: blob.size,
      createdAt: Date.now(),
    }
    await promisify(store.put(record))
    return key
  }

  async load(key: string): Promise<Blob | null> {
    const store = await this._store('readonly')
    const record = await promisify<AttachmentRecord | undefined>(store.get(key))
    return record?.blob ?? null
  }

  async delete(key: string): Promise<void> {
    const store = await this._store('readwrite')
    await promisify(store.delete(key))
  }

  async list(): Promise<AttachmentMeta[]> {
    const store = await this._store('readonly')
    const records = await promisify<AttachmentRecord[]>(store.getAll())
    return records.map((r) => ({
      key: r.key,
      mime: r.mime,
      size: r.size,
      createdAt: r.createdAt,
    }))
  }

  async vacuum(activeKeys: Set<string>): Promise<void> {
    const store = await this._store('readwrite')
    const records = await promisify<AttachmentRecord[]>(store.getAll())
    const jobs = records
      .filter((r) => !activeKeys.has(r.key))
      .map((r) => promisify(store.delete(r.key)))
    await Promise.all(jobs)
  }
}
