/**
 * Platform-agnostic bridge types.
 * Both Wails desktop mode and browser (IndexedDB) mode implement this contract
 * so Pinia stores never need to know which runtime is underneath.
 */

// ---------------------------------------------------------------------------
// Domain models (mirrors Go side structs for serialisation)
// ---------------------------------------------------------------------------

export type FileType = 'file' | 'dir'

export interface FileEntry {
  id: string
  name: string
  path: string
  type: FileType
  children?: FileEntry[]
  updatedAt?: string
  themeName?: string
  themeType?: string
  fileCount?: number
}

export interface FrontmatterMeta {
  themeType?: string
  themeName: string
  title?: string
}

export interface ReadResult {
  content: string
  meta: FrontmatterMeta
  filePath: string
}

export interface WorkspaceState {
  rootPath: string
  title: string
  entries: FileEntry[]
  activeFileId: string
}

export interface PlatformInfo {
  os: string
  arch: string
  version: string
}

// ---------------------------------------------------------------------------
// Bridge contract — every platform adapter must satisfy this interface
// ---------------------------------------------------------------------------

export interface IServiceBridge {
  // ---- File ----
  readFile(absPath: string): Promise<ReadResult>
  writeFile(absPath: string, content: string): Promise<void>
  createFile(dirPath: string, name: string): Promise<string>
  deleteFile(absPath: string): Promise<void>
  renameFile(oldPath: string, newName: string): Promise<string>
  moveFile(sourcePath: string, targetDir: string): Promise<string>
  exists(absPath: string): Promise<boolean>

  // ---- Folder ----
  listFolder(absPath: string): Promise<FileEntry[]>
  createFolder(parentDir: string, name: string): Promise<string>
  deleteFolder(absPath: string): Promise<void>
  renameFolder(oldPath: string, newName: string): Promise<string>
  moveFolder(sourcePath: string, targetPath: string): Promise<string>
  walkFolder(root: string): Promise<string[]>

  // ---- Workspace ----
  openWorkspace(dirPath: string): Promise<WorkspaceState>
  closeWorkspace(): Promise<void>
  getWorkspaceState(): Promise<WorkspaceState>
  setActiveFile(absPath: string): Promise<void>
  resolvePath(relative: string): Promise<string>
  /** Shows a folder picker (desktop) or prompt (browser) and opens the workspace. */
  pickFolder(): Promise<WorkspaceState>

  // ---- System ----
  getPlatform(): Promise<PlatformInfo>
  getAppVersion(): Promise<string>
  openExternal(url: string): Promise<void>
  showItemInFolder(absPath: string): Promise<void>

  // ---- Runtime detection ----
  /** Whether this bridge is backed by a native Wails backend. */
  readonly isDesktop: boolean
}
