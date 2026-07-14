/**
 * IdbImageStorage — 浏览器端 IndexedDB 图片存储
 *
 * 数据库: mdx-images, version 1
 * ObjectStore: images, keyPath = hash
 * 索引: createdAt
 */

import type { ImageStorage, ImageMeta } from '../imageStorage'

const DB_NAME = 'mdx-images'
const DB_VERSION = 1
const STORE_NAME = 'images'

interface ImageRecord {
  hash: string
  blob: Blob
  mime: string
  width: number
  height: number
  originalSize: number
  createdAt: number
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'hash' })
        store.createIndex('createdAt', 'createdAt', { unique: false })
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

export class IdbImageStorage implements ImageStorage {
  private _dbPromise: Promise<IDBDatabase> | null = null

  private async _db(): Promise<IDBDatabase> {
    if (!this._dbPromise) {
      this._dbPromise = openDB()
    }
    return this._dbPromise
  }

  private _store(mode: IDBTransactionMode = 'readonly'): Promise<IDBObjectStore> {
    return this._db().then((db) => db.transaction(STORE_NAME, mode).objectStore(STORE_NAME))
  }

  async save(
    hash: string,
    blob: Blob,
    meta: Omit<ImageMeta, 'createdAt'>,
  ): Promise<string> {
    const store = await this._store('readwrite')
    const record: ImageRecord = {
      hash,
      blob,
      mime: meta.mime,
      width: meta.width,
      height: meta.height,
      originalSize: meta.originalSize,
      createdAt: Date.now(),
    }
    await promisify(store.put(record))
    return hash
  }

  async load(hash: string): Promise<Blob | null> {
    const store = await this._store('readonly')
    const record = await promisify<ImageRecord | undefined>(store.get(hash))
    return record?.blob ?? null
  }

  async loadBase64(hash: string): Promise<string | null> {
    const blob = await this.load(hash)
    if (!blob) return null
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(blob)
    })
  }

  async delete(hash: string): Promise<void> {
    const store = await this._store('readwrite')
    await promisify(store.delete(hash))
  }

  async list(): Promise<ImageMeta[]> {
    const store = await this._store('readonly')
    const records = await promisify<ImageRecord[]>(store.getAll())
    return records
      .map((r) => ({
        hash: r.hash,
        mime: r.mime,
        width: r.width,
        height: r.height,
        originalSize: r.originalSize,
        createdAt: r.createdAt,
      }))
      .sort((a, b) => b.createdAt - a.createdAt)
  }

  async vacuum(activeHashes: Set<string>): Promise<void> {
    const store = await this._store('readwrite')
    const records = await promisify<ImageRecord[]>(store.getAll())
    const jobs = records
      .filter((r) => !activeHashes.has(r.hash))
      .map((r) => promisify(store.delete(r.hash)))
    await Promise.all(jobs)
  }
}
