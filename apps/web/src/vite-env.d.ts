/// <reference types="vite/client" />

/** Injected by vite.config.ts transformIndexHtml. True in Wails desktop mode. */
interface Window {
  readonly __WAILS_MODE__?: boolean;
}

/** File System Access API — showDirectoryPicker */
interface Window {
  showDirectoryPicker(options?: { mode?: 'read' | 'readwrite' }): Promise<FileSystemDirectoryHandle>;
}

interface FileSystemDirectoryHandle {
  readonly name: string;
}
