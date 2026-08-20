/**
 * IdbAttachmentStorage — 浏览器端 IndexedDB 附件存储
 *
 * 数据库: mdx-attachments, version 1
 * ObjectStore: attachments, keyPath = key
 */

import type { AttachmentStorage, AttachmentMeta } from '../attachmentStorage'

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
    const key = `${Date.now()}-${name}`
    const store = await this._store('readwrite')
    const record: AttachmentRecord = {
      key,
      blob,
      mime: blob.type,
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
