/**
 * Bridge factory — auto-detects the runtime environment and returns the
 * appropriate IServiceBridge implementation.
 *
 * Detection rules:
 *   1. Wails desktop (window.__wails exists) → DesktopBridge (lazy-init via initDesktop())
 *   2. Everything else                       → BrowserBridge (IndexedDB)
 *
 * IMPORTANT: DesktopBridge is loaded via dynamic import() to prevent
 * @wailsio/runtime from being bundled in browser-only dev mode.
 * Static imports would pull in all bindings/*.ts → @wailsio/runtime.
 */

import type { IServiceBridge } from './types'
import { BrowserBridge } from './browserBridge'

declare global {
  interface Window {
    // Wails 3 injects this global at runtime (single underscore)
    _wails?: Record<string, unknown>
  }
}

let _browserBridge: BrowserBridge | null = null
let _desktopBridge: IServiceBridge | null = null

/** Always available — IndexedDB-backed bridge for Temp/virtual workspaces. */
export function getBrowserBridge(): IServiceBridge {
  if (!_browserBridge) _browserBridge = new BrowserBridge()
  return _browserBridge
}

/** Desktop bridge — only available after initDesktop(). Uses Go backend for real filesystem paths. */
export function getDesktopBridge(): IServiceBridge | null {
  return _desktopBridge
}

/**
 * Returns the default bridge for the current environment:
 *   - Desktop mode (initDesktop called) → DesktopBridge
 *   - Browser-only mode                   → BrowserBridge
 */
export function getBridge(): IServiceBridge {
  return _desktopBridge ?? getBrowserBridge()
}

/**
 * Initialize DesktopBridge. Must be called AFTER @wailsio/runtime sets up
 * window._wails (via static import in desktopBridge.ts).
 */
export async function initDesktop(): Promise<{ Events: typeof import('@wailsio/runtime').Events }> {
  const { DesktopBridge, Events } = await import('./desktopBridge')
  _desktopBridge = new DesktopBridge()
  return { Events }
}

// Re-export types so consumers only import from '@/bridge'
export type {
  IServiceBridge,
  ReadResult,
  FileEntry,
  WorkspaceState,
  PlatformInfo,
  FrontmatterMeta,
  FileType,
} from './types'
