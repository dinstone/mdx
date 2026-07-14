/**
 * Workspace store — manages workspace lifecycle only.
 *
 * Responsibilities:
 *   - current: which IWorkspace is active
 *   - recentWorkspaces: persisted recently-opened list
 *   - open() / close() + serialisation
 *
 * Everything else (file-tree state, CRUD, refresh) is owned by the IWorkspace
 * object itself.  The store exposes thin delegation computed / methods for
 * template convenience so consumers can write `workspace.entries` instead of
 * `workspace.current?.entries`.
 */

import { defineStore } from 'pinia'
import { shallowRef, computed, triggerRef } from 'vue'
import type { WorkspaceState, FileEntry } from '../bridge'
import {
  type IWorkspace,
  type RecentEntry,
  VirtualWorkspace,
  createWorkspace,
  workspaceForPath,
} from './workspace-types'

const RECENT_WORKSPACES_KEY = 'mdx-recent-workspaces'
const MAX_RECENT_WORKSPACES = 10

export const useWorkspaceStore = defineStore('workspace', () => {
  // ---- state ----

  /** The currently-open workspace object.
   *  shallowRef — prevents Vue from deep-reactively wrapping the IWorkspace
   *  class instance, which would auto-unwrap its internal Ref properties and
   *  break getters like `get rootPath() { return this._rootPath.value }`. */
  const current = shallowRef<IWorkspace | null>(null)

  /** Persisted recently-opened workspaces.
   *  shallowRef — same reason as current: prevents Vue from auto-unwrapping
   *  internal Ref properties on IWorkspace instances, which would break
   *  saveRecentWorkspaces() and produce garbage localStorage data. */
  const recentWorkspaces = shallowRef<IWorkspace[]>([])

  /** Monotonic counter to discard stale open() results. */
  let openSeq = 0

  // ---- computed (delegate to current) ----

  const rootPath = computed(() => current.value?.rootPath ?? '')
  const title = computed(() => current.value?.title ?? '')
  const entries = computed(() => [...(current.value?.entries ?? [])])
  const activeFileId = computed(() => current.value?.activeFileId ?? '')
  const loading = computed(() => current.value?.loading ?? false)
  const error = computed(() => current.value?.error ?? null)
  const isOpen = computed(() => rootPath.value !== '')
  const hasActiveFile = computed(() => activeFileId.value !== '')

  /** Flattened list of .md files from the tree (for quick navigation). */
  const mdFiles = computed<string[]>(() => {
    const result: string[] = []
    const walk = (list: FileEntry[]) => {
      for (const e of list) {
        if (e.type === 'file' && e.name.endsWith('.md')) result.push(e.path)
        if (e.children) walk(e.children)
      }
    }
    walk(entries.value)
    return result
  })

  // ---- serialisation ----

  function loadRecentWorkspaces() {
    try {
      const raw = localStorage.getItem(RECENT_WORKSPACES_KEY)
      if (raw) {
        const data: RecentEntry[] = JSON.parse(raw)
        recentWorkspaces.value = data.map((e) => createWorkspace(e))
      }
    } catch {
      /* non-critical */
    }
  }

  function saveRecentWorkspaces() {
    try {
      const data: RecentEntry[] = recentWorkspaces.value.map((w) => ({
        path: w.path,
        name: w.name,
        isTemp: w.kind === 'virtual',
      }))
      localStorage.setItem(RECENT_WORKSPACES_KEY, JSON.stringify(data))
    } catch {
      /* non-critical */
    }
  }

  function addRecentWorkspace(ws: IWorkspace) {
    // Build a new array (immutable) so shallowRef detects the change.
    const filtered = recentWorkspaces.value.filter((w) => w.path !== ws.path)
    recentWorkspaces.value = [ws, ...filtered].slice(0, MAX_RECENT_WORKSPACES)
    saveRecentWorkspaces()
  }

  /** 从最近工作区列表中移除，仅清理记录，不删除实际文件夹 */
  function removeRecentWorkspace(ws: IWorkspace) {
    recentWorkspaces.value = recentWorkspaces.value.filter((w) => w.path !== ws.path)
    saveRecentWorkspaces()
  }

  /** Find a workspace by path in recents, or create a new one. */
  function resolveWorkspace(dirPath: string): IWorkspace {
    return (
      recentWorkspaces.value.find((w) => w.path === dirPath) ??
      workspaceForPath(dirPath)
    )
  }

  // ---- actions (lifecycle) ----

  /**
   * Startup entry point.  Loads recently-opened workspaces from
   * localStorage, picks the most recent one, and opens it.
   *
   * Falls back to a temp VirtualWorkspace when no recents exist.
   *
   * Safe to call multiple times (e.g. browser-mode init followed by
   * DesktopBridge re-open in Wails) — openSeq handles race protection.
   */
  async function open() {
    loadRecentWorkspaces()
    if (recentWorkspaces.value.length > 0) {
      await openWorkspace(recentWorkspaces.value[0])
    } else {
      await openWorkspace(new VirtualWorkspace('/Temp', 'Temp'))
    }
  }

  /**
   * Open a specific workspace explicitly (e.g. picked from the
   * WorkspacePicker or re-opened after DesktopBridge init).
   *
   * Sets current immediately so that loading state is visible; the openSeq
   * counter discards stale results when overlapping calls occur.
   */
  async function openWorkspace(ws: IWorkspace) {
    const seq = ++openSeq
    current.value = ws
    try {
      await ws.open()
      if (seq !== openSeq) return
      addRecentWorkspace(ws)
    } catch (e: unknown) {
      if (seq !== openSeq) return
      current.value = null
      throw e
    }
  }

  async function close() {
    if (current.value) await current.value.close()
    current.value = null
  }

  /** Apply a pre-fetched state snapshot (e.g. from desktop pickFolder). */
  function applyState(state: WorkspaceState) {
    const ws = resolveWorkspace(state.rootPath)
    ws.applyState(state)
    current.value = ws
    addRecentWorkspace(ws)
  }

  // ---- helpers ----

  /** Forces all shallowRef-based computeds (entries, rootPath, title, etc.)
   *  to re-evaluate after a mutation on the workspace instance.  Without this,
   *  in-place mutations on deeply-nested properties inside the class's internal
   *  refs are invisible to the Pinia computed chain.
   *
   *  For async mutations the triggerRef fires AFTER the promise settles so
   *  the internal refs have already been updated. */
  function mutate<T>(fn: () => T): T {
    const result = fn()
    if (result instanceof Promise) {
      return result.then((value) => {
        triggerRef(current)
        return value
      }) as unknown as T
    }
    triggerRef(current)
    return result
  }

  // ---- actions (thin delegation to current) ----

  function expandDirectory(dirPath: string) {
    return mutate(() => current.value?.expandDirectory(dirPath))
  }

  function refresh() {
    return mutate(() => current.value?.refresh())
  }

  function setActiveFile(fileId: string) {
    return mutate(() => current.value?.setActiveFile(fileId))
  }

  function createFile(dirPath: string, name: string): Promise<string> {
    if (!current.value) throw new Error('No workspace')
    return mutate(() => current.value!.createFile(dirPath, name))
  }

  function deleteFile(absPath: string): Promise<void> {
    if (!current.value) throw new Error('No workspace')
    return mutate(() => current.value!.deleteFile(absPath))
  }

  function renameFile(oldPath: string, newName: string): Promise<string> {
    if (!current.value) throw new Error('No workspace')
    return mutate(() => current.value!.renameFile(oldPath, newName))
  }

  function moveFile(sourcePath: string, targetDir: string): Promise<string> {
    if (!current.value) throw new Error('No workspace')
    return mutate(() => current.value!.moveFile(sourcePath, targetDir))
  }

  function createFolder(parentDir: string, name: string): Promise<string> {
    if (!current.value) throw new Error('No workspace')
    return mutate(() => current.value!.createFolder(parentDir, name))
  }

  function deleteFolder(absPath: string): Promise<void> {
    if (!current.value) throw new Error('No workspace')
    return mutate(() => current.value!.deleteFolder(absPath))
  }

  function renameFolder(oldPath: string, newName: string): Promise<string> {
    if (!current.value) throw new Error('No workspace')
    return mutate(() => current.value!.renameFolder(oldPath, newName))
  }

  function moveFolder(sourcePath: string, targetPath: string): Promise<string> {
    if (!current.value) throw new Error('No workspace')
    return mutate(() => current.value!.moveFolder(sourcePath, targetPath))
  }

  return {
    // state
    current,
    recentWorkspaces,
    loading,
    error,
    // computed (delegation)
    rootPath,
    title,
    entries,
    activeFileId,
    isOpen,
    hasActiveFile,
    mdFiles,
    // lifecycle
    open,
    openWorkspace,
    close,
    applyState,
    // delegation
    expandDirectory,
    refresh,
    setActiveFile,
    createFile,
    deleteFile,
    renameFile,
    moveFile,
    createFolder,
    deleteFolder,
    renameFolder,
    moveFolder,
    // utility
    resolveWorkspace,
    addRecentWorkspace,
    removeRecentWorkspace,
    loadRecentWorkspaces,
  }
})
