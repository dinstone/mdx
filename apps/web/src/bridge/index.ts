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

let _bridge: IServiceBridge | null = null

/**
 * Returns the singleton bridge instance synchronously.
 * In desktop mode, call initDesktop() first (from main.ts) so the bridge
 * is ready before any store tries to use it.
 */
export function getBridge(): IServiceBridge {
  if (_bridge) return _bridge

  // Default to BrowserBridge. In desktop mode, initDesktop() will replace it.
  _bridge = new BrowserBridge()
  return _bridge
}

/**
 * Replace the bridge with DesktopBridge.  Must be called AFTER
 * @wailsio/runtime has set up window._wails (i.e. after the dynamic
 * import("@wailsio/runtime") resolves).
 *
 * Uses dynamic import so browser mode never touches desktopBridge.ts
 * or any of its binding dependencies.
 */
export async function initDesktop(): Promise<void> {
  const { DesktopBridge } = await import('./desktopBridge')
  _bridge = new DesktopBridge()
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
