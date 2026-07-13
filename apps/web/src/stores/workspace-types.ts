/**
 * Workspace types — each IWorkspace is a self-contained domain object that:
 *   1. Owns its reactive file-tree state (rootPath, title, entries, activeFileId, …)
 *   2. Owns all file/folder CRUD mutations
 *   3. Knows its Bridge (resolved lazily for SystemWorkspace)
 *
 * VirtualWorkspace → BrowserBridge (IndexedDB)
 * SystemWorkspace  → DesktopBridge (Go backend, falls back to BrowserBridge)
 */

import { ref, type Ref } from 'vue'
import type { IServiceBridge, WorkspaceState, FileEntry } from '../bridge'
import { getBrowserBridge, getDesktopBridge } from '../bridge'

// ---- IWorkspace interface ----

export interface IWorkspace {
  readonly path: string
  readonly name: string
  /** 'virtual' = IndexedDB-backed, 'system' = real filesystem folder. */
  readonly kind: 'virtual' | 'system'
  /** The bridge this workspace uses for all file/folder I/O. */
  readonly bridge: IServiceBridge

  // -- reactive state (backed by Vue refs, exposed as plain getters) --

  readonly rootPath: string
  readonly title: string
  readonly entries: FileEntry[]
  readonly activeFileId: string
  readonly loading: boolean
  readonly error: string | null

  // -- lifecycle --

  /** Fetch the workspace state from the backend and apply it internally. */
  open(): Promise<void>

  /** Persist any pending state and release resources. */
  close(): Promise<void>

  /** Directly apply a pre-fetched state snapshot (e.g. from pickFolder). */
  applyState(state: WorkspaceState): void

  // -- file-tree operations --

  /** Lazy-load children for a directory entry that has no children yet. */
  expandDirectory(dirPath: string): Promise<void>

  refresh(): Promise<void>
  setActiveFile(fileId: string): void

  createFile(dirPath: string, name: string): Promise<string>
  deleteFile(absPath: string): Promise<void>
  renameFile(oldPath: string, newName: string): Promise<string>
  moveFile(sourcePath: string, targetDir: string): Promise<string>

  createFolder(parentDir: string, name: string): Promise<string>
  deleteFolder(absPath: string): Promise<void>
  renameFolder(oldPath: string, newName: string): Promise<string>
  moveFolder(sourcePath: string, targetPath: string): Promise<string>
}

// ---- BaseWorkspace — shared reactive state & mutation logic ----

abstract class BaseWorkspace implements IWorkspace {
  abstract readonly path: string
  abstract readonly name: string
  abstract readonly kind: 'virtual' | 'system'
  abstract get bridge(): IServiceBridge

  // Internal reactive state (never exposed directly — consumers use getters)
  protected _rootPath: Ref<string> = ref('')
  protected _title: Ref<string> = ref('')
  protected _entries: Ref<FileEntry[]> = ref([])
  protected _activeFileId: Ref<string> = ref('')
  protected _loading: Ref<boolean> = ref(false)
  protected _error: Ref<string | null> = ref(null)

  // ---- state getters ----

  get rootPath(): string {
    return this._rootPath.value
  }
  get title(): string {
    return this._title.value
  }
  get entries(): FileEntry[] {
    return this._entries.value
  }
  get activeFileId(): string {
    return this._activeFileId.value
  }
  get loading(): boolean {
    return this._loading.value
  }
  get error(): string | null {
    return this._error.value
  }

  // ---- lifecycle ----

  async open(): Promise<void> {
    this._loading.value = true
    this._error.value = null
    try {
      const state = await this.bridge.openWorkspace(this.path)
      this._rootPath.value = state.rootPath
      this._title.value = state.title
      this._entries.value = state.entries
      this._activeFileId.value = state.activeFileId
    } catch (e: unknown) {
      this._error.value = e instanceof Error ? e.message : 'Failed to open workspace'
      throw e
    } finally {
      this._loading.value = false
    }
  }

  async close(): Promise<void> {
    await this.bridge.closeWorkspace()
    this._rootPath.value = ''
    this._title.value = ''
    this._entries.value = []
    this._activeFileId.value = ''
    this._error.value = null
  }

  applyState(state: WorkspaceState): void {
    this._rootPath.value = state.rootPath
    this._title.value = state.title
    this._entries.value = state.entries
    this._activeFileId.value = state.activeFileId
    this._error.value = null
  }

  // ---- file-tree operations ----

  /** Lazy-load children for a directory.  Finds the entry by path in the
   *  current tree, calls bridge.listFolder(), and injects the result. */
  async expandDirectory(dirPath: string): Promise<void> {
    const entry = findEntryByPath(this._entries.value, dirPath)
    if (!entry || entry.type !== 'dir') return
    if (entry.children?.length) return // already loaded
    try {
      entry.children = await this.bridge.listFolder(dirPath)
    } catch {
      entry.children = [] // avoid re-triggering on next click
    }
    // Update fileCount now that children are loaded.
    entry.fileCount = (entry.children || []).filter((c) => c.type === 'file').length
  }

  async refresh(): Promise<void> {
    if (!this._rootPath.value) return
    this._loading.value = true
    try {
      this._entries.value = await this.bridge.listFolder(this._rootPath.value)
    } finally {
      this._loading.value = false
    }
  }

  setActiveFile(fileId: string): void {
    this._activeFileId.value = fileId
    this.bridge.setActiveFile(fileId).catch(() => {
      /* non-critical */
    })
  }

  // -- internal helpers --

  /** If a directory entry's children are already loaded, re-list just that
   *  directory to pick up additions/removals.  No-op for unexpanded dirs. */
  private async reloadDir(dirPath: string): Promise<void> {
    // Root-level re-list must preserve children on already-expanded dirs.
    if (dirPath === this._rootPath.value) {
      const fresh = await this.bridge.listFolder(dirPath)
      // Carry over children from old entries that had them.
      const oldIndex = new Map<string, FileEntry[] | undefined>()
      for (const e of this._entries.value) {
        if (e.children) oldIndex.set(e.path, e.children)
      }
      for (const e of fresh) {
        const oldChildren = oldIndex.get(e.path)
        if (oldChildren) {
          e.children = oldChildren
          // Recompute — children may have changed (file added/deleted inside).
          e.fileCount = oldChildren.filter((c) => c.type === 'file').length
        }
      }
      this._entries.value = fresh
      return
    }

    const entry = findEntryByPath(this._entries.value, dirPath)
    if (!entry || entry.type !== 'dir') return
    if (!entry.children) return // not yet expanded — leave it
    try {
      entry.children = await this.bridge.listFolder(dirPath)
    } catch {
      /* non-critical */
    }
    entry.fileCount = entry.children.filter((c) => c.type === 'file').length
  }

  // -- file mutations --

  async createFile(dirPath: string, name: string): Promise<string> {
    const path = await this.bridge.createFile(dirPath, name)
    await this.reloadDir(dirPath)
    return path
  }

  async deleteFile(absPath: string): Promise<void> {
    await this.bridge.deleteFile(absPath)
    if (this._activeFileId.value === absPath) this._activeFileId.value = ''
    await this.reloadDir(parentPath(absPath) || this._rootPath.value)
  }

  async renameFile(oldPath: string, newName: string): Promise<string> {
    const newPath = await this.bridge.renameFile(oldPath, newName)
    if (this._activeFileId.value === oldPath) this._activeFileId.value = newPath
    await this.reloadDir(parentPath(oldPath) || this._rootPath.value)
    return newPath
  }

  async moveFile(sourcePath: string, targetDir: string): Promise<string> {
    const newPath = await this.bridge.moveFile(sourcePath, targetDir)
    if (this._activeFileId.value === sourcePath) this._activeFileId.value = newPath
    const srcParent = parentPath(sourcePath)
    if (srcParent) await this.reloadDir(srcParent)
    await this.reloadDir(targetDir)
    return newPath
  }

  // -- folder mutations --

  async createFolder(parentDir: string, name: string): Promise<string> {
    const path = await this.bridge.createFolder(parentDir, name)
    await this.reloadDir(parentDir)
    return path
  }

  async deleteFolder(absPath: string): Promise<void> {
    await this.bridge.deleteFolder(absPath)
    await this.reloadDir(parentPath(absPath) || this._rootPath.value)
  }

  async renameFolder(oldPath: string, newName: string): Promise<string> {
    const newPath = await this.bridge.renameFolder(oldPath, newName)
    await this.reloadDir(parentPath(oldPath) || this._rootPath.value)
    return newPath
  }

  async moveFolder(sourcePath: string, targetPath: string): Promise<string> {
    const newPath = await this.bridge.moveFolder(sourcePath, targetPath)
    const srcParent = parentPath(sourcePath)
    if (srcParent) await this.reloadDir(srcParent)
    await this.reloadDir(targetPath)
    return newPath
  }
}

// ---- VirtualWorkspace (IndexedDB-backed) ----

export class VirtualWorkspace extends BaseWorkspace {
  readonly kind = 'virtual' as const
  readonly bridge = getBrowserBridge()

  constructor(
    readonly path: string,
    readonly name: string
  ) {
    super()
  }
}

// ---- SystemWorkspace (real folder on disk) ----

export class SystemWorkspace extends BaseWorkspace {
  readonly kind = 'system' as const

  /**
   * DesktopBridge may not be available at construction time.  The bridge is
   * resolved on every access so that once initDesktop() completes, subsequent
   * calls transparently switch to the real DesktopBridge.
   */
  get bridge(): IServiceBridge {
    return getDesktopBridge() ?? getBrowserBridge()
  }

  constructor(
    readonly path: string,
    readonly name: string
  ) {
    super()
  }
}

// ---- Serialisable recent entry (persisted to localStorage) ----

export interface RecentEntry {
  path: string
  name: string
  isTemp: boolean
}

// ---- Factory functions ----

/** Create the right IWorkspace from a persisted recent entry. */
export function createWorkspace(entry: RecentEntry): IWorkspace {
  if (entry.isTemp) return new VirtualWorkspace(entry.path, entry.name)
  return new SystemWorkspace(entry.path, entry.name)
}

/** Create a workspace for a path not yet in the recent list. */
export function workspaceForPath(path: string, name?: string): IWorkspace {
  const resolvedName = name || path.split('/').pop() || path
  if (getDesktopBridge()) {
    return new SystemWorkspace(path, resolvedName)
  }
  return new VirtualWorkspace(path, resolvedName)
}

// ---- helpers ----

function findEntryByPath(entries: FileEntry[], targetPath: string): FileEntry | null {
  for (const e of entries) {
    if (e.path === targetPath) return e
    if (e.children) {
      const found = findEntryByPath(e.children, targetPath)
      if (found) return found
    }
  }
  return null
}

/** Find the parent directory path for an entry (everything before the last '/'). */
function parentPath(path: string): string | null {
  const idx = path.lastIndexOf('/')
  return idx > 0 ? path.substring(0, idx) : null
}
