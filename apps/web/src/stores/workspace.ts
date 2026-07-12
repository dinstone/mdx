/**
 * Workspace store — manages the workspace lifecycle and file tree.
 * All I/O goes through the platform bridge, so this store works
 * identically in Wails desktop and browser-only mode.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getBridge, type WorkspaceState, type FileEntry } from '../bridge'

export const useWorkspaceStore = defineStore('workspace', () => {
  const bridge = getBridge()

  // ---- state ----
  const rootPath = ref('')
  const title = ref('')
  const entries = ref<FileEntry[]>([])
  const activeFileId = ref('')
  const loading = ref(false)
  const error = ref<string | null>(null)

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
  }

  // Auto-load persisted workspace on startup if available
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
  }
})
