import { Events } from "@wailsio/runtime";
export { Events };

/**
 * DesktopBridge — delegates all operations to the Go backend via auto-generated
 * Wails 3 TypeScript bindings.
 */

import type {
  IServiceBridge,
  ReadResult,
  FileEntry,
  WorkspaceState,
  PlatformInfo,
} from './types'
import * as FileService from '../../bindings/mdx/internal/service/fileservice'
import * as FolderService from '../../bindings/mdx/internal/service/folderservice'
import * as WorkspaceService from '../../bindings/mdx/internal/service/workspaceservice'
import * as SystemService from '../../bindings/mdx/internal/service/systemservice'

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class DesktopBridge implements IServiceBridge {
  readonly isDesktop = true

  // -- File ----------------------------------------------------------------

  async readFile(absPath: string): Promise<ReadResult> {
    const result = await FileService.ReadFile(absPath)
    if (!result) throw new Error(`Failed to read: ${absPath}`)
    return result as ReadResult
  }

  async writeFile(absPath: string, content: string): Promise<void> {
    await FileService.WriteFile(absPath, content)
  }

  async createFile(dirPath: string, name: string): Promise<string> {
    return FileService.CreateFile(dirPath, name)
  }

  async deleteFile(absPath: string): Promise<void> {
    await FileService.DeleteFile(absPath)
  }

  async renameFile(oldPath: string, newName: string): Promise<string> {
    return FileService.RenameFile(oldPath, newName)
  }

  async moveFile(sourcePath: string, targetDir: string): Promise<string> {
    return FileService.MoveFile(sourcePath, targetDir)
  }

  async exists(absPath: string): Promise<boolean> {
    return FileService.Exists(absPath)
  }

  async saveFileDialog(defaultName: string): Promise<string> {
    return FileService.SaveFileDialog(defaultName)
  }

  // -- Folder --------------------------------------------------------------

  async listFolder(absPath: string): Promise<FileEntry[]> {
    const entries = await FolderService.ListFolder(absPath)
    return (entries ?? []) as FileEntry[]
  }

  async createFolder(parentDir: string, name: string): Promise<string> {
    return FolderService.CreateFolder(parentDir, name)
  }

  async deleteFolder(absPath: string): Promise<void> {
    await FolderService.DeleteFolder(absPath)
  }

  async renameFolder(oldPath: string, newName: string): Promise<string> {
    return FolderService.RenameFolder(oldPath, newName)
  }

  async moveFolder(sourcePath: string, targetPath: string): Promise<string> {
    return FolderService.MoveFolder(sourcePath, targetPath)
  }

  async walkFolder(root: string): Promise<string[]> {
    const paths = await FolderService.WalkFolder(root)
    return paths ?? []
  }

  // -- Workspace -----------------------------------------------------------

  async openWorkspace(dirPath: string): Promise<WorkspaceState> {
    const state = await WorkspaceService.Open(dirPath)
    if (!state) throw new Error(`Failed to open workspace: ${dirPath}`)
    return state as WorkspaceState
  }

  async closeWorkspace(): Promise<void> {
    await WorkspaceService.Close()
  }

  async getWorkspaceState(): Promise<WorkspaceState> {
    const state = await WorkspaceService.GetState()
    return (state ?? { rootPath: '', title: '', entries: [], activeFileId: '' }) as WorkspaceState
  }

  async setActiveFile(absPath: string): Promise<void> {
    await WorkspaceService.SetActiveFile(absPath)
  }

  async resolvePath(relative: string): Promise<string> {
    return WorkspaceService.ResolvePath(relative)
  }

  async pickFolder(): Promise<WorkspaceState> {
    const state = await WorkspaceService.PickAndOpen()
    if (!state) throw new Error('No folder selected')
    return state as WorkspaceState
  }

  /** Returns the file path from a cold-launch file association, or empty string. */
  async getPendingOpenFile(): Promise<string> {
    const path = await WorkspaceService.GetPendingOpenFile()
    return path ?? ''
  }

  // -- System --------------------------------------------------------------

  async getPlatform(): Promise<PlatformInfo> {
    const info = await SystemService.GetPlatform()
    return (info ?? { os: 'unknown', arch: 'unknown', version: '0.0.0' }) as PlatformInfo
  }

  async getAppVersion(): Promise<string> {
    return SystemService.GetAppVersion()
  }

  async openExternal(url: string): Promise<void> {
    await SystemService.OpenExternal(url)
  }

  async showItemInFolder(absPath: string): Promise<void> {
    await SystemService.ShowItemInFolder(absPath)
  }
}
