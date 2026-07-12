/**
 * Workspace store — manages the workspace lifecycle and file tree.
 * All I/O goes through the platform bridge, so this store works
 * identically in Wails desktop and browser-only mode.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getBridge, type WorkspaceState, type FileEntry } from '../bridge'

export interface RecentWorkspace {
  path: string
  name: string
  isTemp: boolean
}

const RECENT_WORKSPACES_KEY = 'mdx-recent-workspaces'
const MAX_RECENT_WORKSPACES = 10

export const useWorkspaceStore = defineStore('workspace', () => {
  const bridge = getBridge()

  // ---- state ----
  const rootPath = ref('')
  const title = ref('')
  const entries = ref<FileEntry[]>([])
  const activeFileId = ref('')
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Recently opened workspaces, persisted to localStorage.
  const recentWorkspaces = ref<RecentWorkspace[]>([])

  // ---- getters ----
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

  // ---- recent workspaces ----
  function loadRecentWorkspaces() {
    try {
      const raw = localStorage.getItem(RECENT_WORKSPACES_KEY)
      if (raw) {
        recentWorkspaces.value = JSON.parse(raw)
      }
    } catch {
      /* non-critical */
    }
  }

  function addRecentWorkspace(state: WorkspaceState) {
    const isTemp = !bridge.isDesktop
    const name = state.title || state.rootPath.split('/').pop() || state.rootPath
    const item: RecentWorkspace = { path: state.rootPath, name, isTemp }
    const existing = recentWorkspaces.value.findIndex((w) => w.path === item.path)
    if (existing >= 0) {
      recentWorkspaces.value.splice(existing, 1)
    }
    recentWorkspaces.value.unshift(item)
    if (recentWorkspaces.value.length > MAX_RECENT_WORKSPACES) {
      recentWorkspaces.value = recentWorkspaces.value.slice(0, MAX_RECENT_WORKSPACES)
    }
    try {
      localStorage.setItem(RECENT_WORKSPACES_KEY, JSON.stringify(recentWorkspaces.value))
    } catch {
      /* non-critical */
    }
  }

  // ---- actions ----
  async function open(dirPath: string) {
    loading.value = true
    error.value = null
    try {
      const state: WorkspaceState = await bridge.openWorkspace(dirPath)
      rootPath.value = state.rootPath
      title.value = state.title
      entries.value = state.entries
      activeFileId.value = state.activeFileId
      addRecentWorkspace(state)
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Failed to open workspace'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function close() {
    await bridge.closeWorkspace()
    rootPath.value = ''
    title.value = ''
    entries.value = []
    activeFileId.value = ''
    error.value = null
  }

  async function refresh() {
    if (!rootPath.value) return
    loading.value = true
    try {
      entries.value = await bridge.listFolder(rootPath.value)
    } finally {
      loading.value = false
    }
  }

  function setActiveFile(fileId: string) {
    activeFileId.value = fileId
    bridge.setActiveFile(fileId).catch(() => {
      /* non-critical */
    })
  }

  // ---- folder / file mutations (refresh after) ----
  async function createFile(dirPath: string, name: string): Promise<string> {
    const path = await bridge.createFile(dirPath, name)
    await refresh()
    return path
  }

  async function deleteFile(absPath: string) {
    await bridge.deleteFile(absPath)
    if (activeFileId.value === absPath) activeFileId.value = ''
    await refresh()
  }

  async function renameFile(oldPath: string, newName: string) {
    const newPath = await bridge.renameFile(oldPath, newName)
    if (activeFileId.value === oldPath) activeFileId.value = newPath
    await refresh()
    return newPath
  }

  async function moveFile(sourcePath: string, targetDir: string) {
    const newPath = await bridge.moveFile(sourcePath, targetDir)
    if (activeFileId.value === sourcePath) activeFileId.value = newPath
    await refresh()
    return newPath
  }

  async function createFolder(parentDir: string, name: string) {
    const path = await bridge.createFolder(parentDir, name)
    await refresh()
    return path
  }

  async function deleteFolder(absPath: string) {
    await bridge.deleteFolder(absPath)
    await refresh()
  }

  async function renameFolder(oldPath: string, newName: string) {
    const newPath = await bridge.renameFolder(oldPath, newName)
    await refresh()
    return newPath
  }

  async function moveFolder(sourcePath: string, targetPath: string) {
    const newPath = await bridge.moveFolder(sourcePath, targetPath)
    await refresh()
    return newPath
  }

  // Apply a workspace state snapshot (e.g. from a menu-driven open).
  function applyState(state: WorkspaceState) {
    rootPath.value = state.rootPath
    title.value = state.title
    entries.value = state.entries
    activeFileId.value = state.activeFileId
    error.value = null
    addRecentWorkspace(state)
  }

  // Auto-load persisted workspace on startup if available
  loadRecentWorkspaces()
  bridge.getWorkspaceState().then((state) => {
    if (state.rootPath) applyState(state)
  }).catch(() => {
    /* non-critical */
  })

  return {
    // state
    rootPath,
    title,
    entries,
    activeFileId,
    loading,
    error,
    recentWorkspaces,
    // getters
    isOpen,
    hasActiveFile,
    mdFiles,
    // actions
    open,
    close,
    refresh,
    applyState,
    setActiveFile,
    createFile,
    deleteFile,
    renameFile,
    moveFile,
    createFolder,
    deleteFolder,
    renameFolder,
    moveFolder,
    addRecentWorkspace,
    loadRecentWorkspaces,
  }
})
