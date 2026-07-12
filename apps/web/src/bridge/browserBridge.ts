/**
 * BrowserBridge — a pure in-browser implementation backed by IndexedDB.
 * No native backend is needed; all files live inside the browser's
 * IndexedDB under a virtual file-system model.
 */

import type {
  IServiceBridge,
  ReadResult,
  FileEntry,
  WorkspaceState,
  PlatformInfo,
} from './types'

// ---------------------------------------------------------------------------
// IndexedDB wrapper — single DB "mdx-local" with object stores:
//   files:      keyPath = path, value = { path, content, updatedAt }
//   workspace:  keyPath = key,  value = { key, rootPath }
// ---------------------------------------------------------------------------

const DB_NAME = 'mdx-local'
const DB_VERSION = 1

interface FileRecord {
  path: string
  content: string
  updatedAt: number
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('files'))
        db.createObjectStore('files', { keyPath: 'path' })
      if (!db.objectStoreNames.contains('workspace'))
        db.createObjectStore('workspace', { keyPath: 'key' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function dbTx(
  store: 'files' | 'workspace',
  mode: IDBTransactionMode,
): IDBObjectStore {
  const db = _dbCache
  if (!db) throw new Error('IndexedDB not opened')
  return db.transaction(store, mode).objectStore(store)
}

function promisify<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

let _dbCache: IDBDatabase | null = null

// ---------------------------------------------------------------------------
// Helper — build FileEntries from a flat list of FileRecord paths
// ---------------------------------------------------------------------------

function buildTree(root: string, records: FileRecord[]): FileEntry[] {
  const dirMap = new Map<string, FileEntry>()
  const result: FileEntry[] = []

  // Ensure root itself exists as a dir entry
  const ensureParent = (dirPath: string) => {
    if (dirPath === root) return
    if (!dirMap.has(dirPath)) {
      const entry: FileEntry = {
        id: dirPath,
        name: dirPath.split('/').pop() || dirPath,
        path: dirPath,
        type: 'dir',
        children: [],
      }
      dirMap.set(dirPath, entry)
      const parent = dirPath.substring(0, dirPath.lastIndexOf('/')) || root
      ensureParent(parent)
      const parentEntry = dirMap.get(parent)
      if (parentEntry) {
        parentEntry.children = parentEntry.children ?? []
        if (!parentEntry.children.find((c) => c.id === entry.id))
          parentEntry.children.push(entry)
      } else {
        result.push(entry)
      }
    }
  }

  for (const rec of records) {
    const parts = rec.path.slice(root.length + 1).split('/')
    let currentPath = root
    for (let i = 0; i < parts.length; i++) {
      const seg = parts[i]
      currentPath = currentPath ? `${currentPath}/${seg}` : seg
      const isFile = i === parts.length - 1 && rec.content !== undefined
      if (isFile) {
        if (!dirMap.has(currentPath)) {
          const entry: FileEntry = {
            id: currentPath,
            name: seg,
            path: currentPath,
            type: 'file',
          }
          dirMap.set(currentPath, entry)
          const parent = currentPath.substring(0, currentPath.lastIndexOf('/')) || root
          ensureParent(parent)
          const parentEntry = dirMap.get(parent)
          if (parentEntry) {
            parentEntry.children = parentEntry.children ?? []
            parentEntry.children.push(entry)
          } else {
            result.push(entry)
          }
        }
      } else {
        ensureParent(currentPath)
      }
    }
  }

  // Sort: dirs first, then alpha
  const sortEntries = (entries: FileEntry[]) => {
    entries.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    entries.forEach((e) => {
      if (e.children) sortEntries(e.children)
    })
  }
  sortEntries(result)
  return result
}

// ---------------------------------------------------------------------------
// Frontmatter parser (simple, same logic as Go side)
// ---------------------------------------------------------------------------

function extractFrontmatterMeta(content: string): { themeType?: string; themeName: string; title?: string } {
  const m = content.match(/^(?:\uFEFF)?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
  if (!m) return { themeName: '默认主题' }
  const fm = m[1]
  const extract = (key: string): string => {
    const re = new RegExp(`^${key}:\\s*(.+)$`, 'm')
    const sub = re.exec(fm)
    if (!sub) return ''
    let raw = sub[1].trim()
    if (raw.length >= 2) {
      const [f, l] = [raw[0], raw[raw.length - 1]]
      if ((f === '"' && l === '"') || (f === "'" && l === "'"))
        raw = raw.slice(1, -1)
    }
    return raw
  }
  const themeType = extract('themeType')
  const themeName = extract('themeName') || '默认主题'
  const title = extract('title')
  return { themeType, themeName, title }
}

// ---------------------------------------------------------------------------
// BrowserBridge implementation
// ---------------------------------------------------------------------------

const ROOT_KEY = 'workspace_root'

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class BrowserBridge implements IServiceBridge {
  readonly isDesktop = false

  private _wsRoot: string | null = null
  private _activeFile: string | null = null
  private _ready: Promise<void>

  constructor() {
    this._ready = openDB().then((db) => {
      _dbCache = db
      // Restore saved workspace root
      return promisify<{ key: string; rootPath: string } | undefined>(
        dbTx('workspace', 'readonly').get(ROOT_KEY),
      ).then((row) => {
        if (row) this._wsRoot = row.rootPath
      })
    })
  }

  private async _db(): Promise<IDBDatabase> {
    await this._ready
    if (!_dbCache) throw new Error('DB not available')
    return _dbCache
  }

  // -- File ----------------------------------------------------------------

  async readFile(absPath: string): Promise<ReadResult> {
    await this._ready
    const store = dbTx('files', 'readonly')
    const rec = await promisify<FileRecord | undefined>(store.get(absPath))
    if (!rec) throw new Error(`File not found: ${absPath}`)
    return {
      content: rec.content,
      meta: extractFrontmatterMeta(rec.content),
      filePath: absPath,
    }
  }

  async writeFile(absPath: string, content: string): Promise<void> {
    await this._ready
    const store = dbTx('files', 'readwrite')
    await promisify(store.put({ path: absPath, content, updatedAt: Date.now() }))
  }

  async createFile(dirPath: string, name: string): Promise<string> {
    await this._ready
    const fname = name.endsWith('.md') ? name : `${name}.md`
    const path = `${dirPath}/${fname}`
    const store = dbTx('files', 'readonly')
    const existing = await promisify<FileRecord | undefined>(store.get(path))
    if (existing) throw new Error(`File already exists: ${fname}`)
    return this.writeFile(path, '').then(() => path)
  }

  async deleteFile(absPath: string): Promise<void> {
    await this._ready
    await promisify(dbTx('files', 'readwrite').delete(absPath))
  }

  async renameFile(oldPath: string, newName: string): Promise<string> {
    await this._ready
    const store = dbTx('files', 'readonly')
    const rec = await promisify<FileRecord | undefined>(store.get(oldPath))
    if (!rec) throw new Error(`File not found: ${oldPath}`)
    const dir = oldPath.substring(0, oldPath.lastIndexOf('/'))
    const newPath = `${dir}/${newName}`
    const rw = dbTx('files', 'readwrite')
    await promisify(rw.delete(oldPath))
    await promisify(rw.put({ path: newPath, content: rec.content, updatedAt: Date.now() }))
    return newPath
  }

  async moveFile(sourcePath: string, targetDir: string): Promise<string> {
    await this._ready
    const store = dbTx('files', 'readonly')
    const rec = await promisify<FileRecord | undefined>(store.get(sourcePath))
    if (!rec) throw new Error(`File not found: ${sourcePath}`)
    const name = sourcePath.split('/').pop()!
    const newPath = `${targetDir}/${name}`
    const rw = dbTx('files', 'readwrite')
    await promisify(rw.delete(sourcePath))
    await promisify(rw.put({ path: newPath, content: rec.content, updatedAt: Date.now() }))
    return newPath
  }

  async exists(absPath: string): Promise<boolean> {
    await this._ready
    const store = dbTx('files', 'readonly')
    const rec = await promisify<FileRecord | undefined>(store.get(absPath))
    return !!rec
  }

  // -- Folder --------------------------------------------------------------

  async listFolder(absPath: string): Promise<FileEntry[]> {
    await this._ready
    const store = dbTx('files', 'readonly')
    const all = await promisify<FileRecord[]>(store.getAll())
    const prefix = absPath === '/' ? '' : `${absPath}/`
    return buildTree(absPath, all.filter((r) => r.path.startsWith(prefix)))
  }

  async createFolder(_parentDir: string, _name: string): Promise<string> {
    await this._ready
    // In browser mode folders are virtual — they exist as soon as a file is
    // created inside them, so this is a no-op that never fails.
    const path = `${_parentDir}/${_name}`
    return path
  }

  async deleteFolder(absPath: string): Promise<void> {
    await this._ready
    const store = dbTx('files', 'readonly')
    const all = await promisify<FileRecord[]>(store.getAll())
    const prefix = `${absPath}/`
    const rw = dbTx('files', 'readwrite')
    const jobs = all
      .filter((r) => r.path.startsWith(prefix))
      .map((r) => promisify(rw.delete(r.path)))
    await Promise.all(jobs)
  }

  async renameFolder(oldPath: string, newName: string): Promise<string> {
    await this._ready
    const store = dbTx('files', 'readonly')
    const all = await promisify<FileRecord[]>(store.getAll())
    const prefix = `${oldPath}/`
    const parent = oldPath.substring(0, oldPath.lastIndexOf('/'))
    const newPath = `${parent}/${newName}`
    const rw = dbTx('files', 'readwrite')
    const jobs = all
      .filter((r) => r.path.startsWith(prefix) || r.path === oldPath)
      .map((r) => {
        const rel = r.path.slice(oldPath.length)
        return promisify(rw.delete(r.path)).then(() =>
          promisify(rw.put({ path: `${newPath}${rel}`, content: r.content, updatedAt: Date.now() })),
        )
      })
    await Promise.all(jobs)
    return newPath
  }

  async moveFolder(sourcePath: string, targetPath: string): Promise<string> {
    await this._ready
    const store = dbTx('files', 'readonly')
    const all = await promisify<FileRecord[]>(store.getAll())
    const prefix = `${sourcePath}/`
    const name = sourcePath.split('/').pop()!
    const dest = `${targetPath}/${name}`
    const rw = dbTx('files', 'readwrite')
    const jobs = all
      .filter((r) => r.path.startsWith(prefix) || r.path === sourcePath)
      .map((r) => {
        const rel = r.path.slice(sourcePath.length)
        return promisify(rw.delete(r.path)).then(() =>
          promisify(rw.put({ path: `${dest}${rel}`, content: r.content, updatedAt: Date.now() })),
        )
      })
    await Promise.all(jobs)
    return dest
  }

  async walkFolder(root: string): Promise<string[]> {
    await this._ready
    const store = dbTx('files', 'readonly')
    const all = await promisify<FileRecord[]>(store.getAll())
    const prefix = root === '/' ? '' : `${root}/`
    return all
      .filter((r) => r.path.startsWith(prefix) && r.path.endsWith('.md'))
      .map((r) => r.path)
      .sort()
  }

  // -- Workspace -----------------------------------------------------------

  async openWorkspace(dirPath: string): Promise<WorkspaceState> {
    this._wsRoot = dirPath
    this._activeFile = null
    // Persist workspace root so it survives page reloads
    const store = dbTx('workspace', 'readwrite')
    await promisify(store.put({ key: ROOT_KEY, rootPath: dirPath }))
    const entries = await this.listFolder(dirPath)
    return {
      rootPath: dirPath,
      title: dirPath.split('/').pop() || dirPath,
      entries,
      activeFileId: '',
    }
  }

  async closeWorkspace(): Promise<void> {
    this._wsRoot = null
    this._activeFile = null
    const store = dbTx('workspace', 'readwrite')
    await promisify(store.delete(ROOT_KEY))
  }

  async getWorkspaceState(): Promise<WorkspaceState> {
    if (!this._wsRoot) return { rootPath: '', title: '', entries: [], activeFileId: '' }
    const entries = await this.listFolder(this._wsRoot)
    return {
      rootPath: this._wsRoot,
      title: this._wsRoot.split('/').pop() || this._wsRoot,
      entries,
      activeFileId: this._activeFile ?? '',
    }
  }

  async setActiveFile(absPath: string): Promise<void> {
    this._activeFile = absPath
  }

  async resolvePath(relative: string): Promise<string> {
    if (!this._wsRoot) throw new Error('No workspace open')
    return `${this._wsRoot}/${relative}`
  }

  async pickFolder(): Promise<WorkspaceState> {
    const name = typeof window !== 'undefined' ? window.prompt('Workspace folder name?') || 'demo' : 'demo'
    return this.openWorkspace(`/${name}`)
  }

  // -- System --------------------------------------------------------------

  async getPlatform(): Promise<PlatformInfo> {
    let os = 'unknown'
    const ua = navigator.userAgent
    if (ua.includes('Win')) os = 'windows'
    else if (ua.includes('Mac')) os = 'darwin'
    else if (ua.includes('Linux')) os = 'linux'
    return { os, arch: 'web', version: '0.0.1' }
  }

  async getAppVersion(): Promise<string> {
    return '0.0.1'
  }

  async openExternal(url: string): Promise<void> {
    window.open(url, '_blank', 'noopener')
  }

  async showItemInFolder(_absPath: string): Promise<void> {
    // No-op in browser — there is no file manager to reveal.
  }
}
