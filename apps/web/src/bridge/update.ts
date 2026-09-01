/**
 * Auto-update — desktop-only capability.
 *
 * Deliberately kept OUT of `IServiceBridge`. IServiceBridge is the
 * file/workspace/system contract that BOTH DesktopBridge and BrowserBridge
 * must satisfy; auto-update only exists in the Wails desktop build, so putting
 * it there forced BrowserBridge to implement four no-op stubs and muddied the
 * contract's meaning.
 *
 * The hard constraint is unchanged though: the generated Wails bindings import
 * `@wailsio/runtime`, which must never land in a browser bundle. So the
 * bindings are pulled in through a dynamic import() that is only triggered
 * after we've confirmed the desktop bridge is live. In browser mode we never
 * even request the chunk.
 *
 * Every function degrades gracefully when the desktop backend is absent:
 *   startAutoUpdateCheck() → no-op
 *   installUpdate()        → throws (the UI surfaces it as an error)
 *   getLastUpdate()        → null
 *   checkUpdate()          → null
 */

import { getDesktopBridge } from './index'

/** Result of an update availability check, mirrored from the Go UpdateService. */
export interface CheckUpdateResult {
  hasUpdate: boolean
  version: string
  name: string
  notes: string
  url: string
  /** Non-empty when the check itself failed (network/parse). */
  error?: string
}

type UpdateModule = typeof import('../../bindings/mdx/internal/service/updateservice')

let pending: Promise<UpdateModule | null> | null = null

/**
 * Loads the generated bindings on demand. Resolves to null whenever the Wails
 * backend is unavailable (browser build, or desktop bridge not initialised
 * yet), so callers never touch `@wailsio/runtime` outside the desktop app.
 */
function loadUpdateService(): Promise<UpdateModule | null> {
  if (!getDesktopBridge()) return Promise.resolve(null)
  if (!pending) {
    pending = import('../../bindings/mdx/internal/service/updateservice').catch((e) => {
      console.warn('[update] bindings unavailable:', e)
      return null
    })
  }
  return pending
}

/** Whether auto-update is usable in the current runtime. */
export function isUpdateSupported(): boolean {
  return getDesktopBridge() !== null
}

/** Kicks off the one-shot background update check (idempotent on the Go side). */
export async function startAutoUpdateCheck(): Promise<void> {
  const svc = await loadUpdateService()
  if (!svc) return
  await svc.StartAutoCheck()
}

/** Runs a full check + download + install of any available update. */
export async function installUpdate(): Promise<void> {
  const svc = await loadUpdateService()
  if (!svc) throw new Error('自动更新仅桌面端可用')
  await svc.InstallUpdate()
}

/** Returns the cached (or freshly checked) update availability result. */
export async function getLastUpdate(): Promise<CheckUpdateResult | null> {
  const svc = await loadUpdateService()
  if (!svc) return null
  const result = await svc.GetLastUpdate()
  return (result ?? null) as CheckUpdateResult | null
}

/** Performs a fresh on-demand check and returns the result directly. */
export async function checkUpdate(): Promise<CheckUpdateResult | null> {
  const svc = await loadUpdateService()
  if (!svc) return null
  const result = await svc.CheckUpdate()
  return (result ?? null) as CheckUpdateResult | null
}
