<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

/**
 * Custom title bar — only rendered on the Windows desktop build.
 *
 * The Wails window is created `Frameless` on Windows (main.go), so the native
 * title bar / border is gone.  Two independent mechanisms are used:
 *
 *   1. Dragging — the whole header is marked `app-region: drag`.  This is
 *      honoured natively by WebView2 because main.go sets
 *      `Windows.NonClientRegionSupport = true` (which enables the
 *      `GetNonClientRegionAtPoint` hit-test path).  No JS drag handler needed.
 *
 *   2. Min / Max / Close buttons — driven by explicit JS calls into the Wails
 *      `Window` API (`@wailsio/runtime`).  This does NOT depend on the native
 *      non-client region machinery, so the buttons work even if the draggable
 *      region hit-testing is unavailable.  The buttons opt out of the drag
 *      region via `app-region: no-drag` so their DOM clicks are not swallowed.
 *
 * NOTE: `@wailsio/runtime` is only imported on demand (and this component is
 * only mounted on Windows desktop), so the web build never pulls it in.
 */

const isMax = ref(false)
let wailsWindow: any = null

async function getWindow(): Promise<any> {
  if (wailsWindow) return wailsWindow
  try {
    const mod: any = await import('@wailsio/runtime')
    wailsWindow = mod.Window ?? mod.default ?? null
  } catch {
    wailsWindow = null
  }
  return wailsWindow
}

async function minimize() {
  const w = await getWindow()
  if (w) await w.Minimise()
}

async function toggleMax() {
  const w = await getWindow()
  if (!w) return
  if (await w.IsMaximised()) await w.UnMaximise()
  else await w.Maximise()
  syncMaxState()
}

async function closeWindow() {
  const w = await getWindow()
  if (w) await w.Close()
}

async function syncMaxState() {
  const w = await getWindow()
  if (!w) return
  try {
    isMax.value = !!(await w.IsMaximised())
  } catch {
    /* ignore */
  }
}

onMounted(() => {
  syncMaxState()
  window.addEventListener('resize', syncMaxState)
})
onUnmounted(() => window.removeEventListener('resize', syncMaxState))
</script>

<template>
  <header class="app-titlebar">
    <div class="atb-title">
      <img class="atb-logo" src="/logo.png" alt="MDX" />
      <span class="atb-name">MDX</span>
    </div>

    <div class="atb-controls">
      <button class="atb-btn" title="最小化" aria-label="最小化" @click="minimize">
        <svg width="12" height="12" viewBox="0 0 12 12"><line x1="2" y1="6" x2="10" y2="6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" /></svg>
      </button>
      <button class="atb-btn" :title="isMax ? '向下还原' : '最大化'" :aria-label="isMax ? '向下还原' : '最大化'" @click="toggleMax">
        <svg v-if="!isMax" width="12" height="12" viewBox="0 0 12 12"><rect x="2.5" y="2.5" width="7" height="7" fill="none" stroke="currentColor" stroke-width="1.2" /></svg>
        <svg v-else width="12" height="12" viewBox="0 0 12 12"><rect x="2.5" y="3.5" width="7" height="6" fill="none" stroke="currentColor" stroke-width="1.2" /><rect x="4" y="2" width="6" height="5" fill="var(--bg-primary)" stroke="currentColor" stroke-width="1.2" /></svg>
      </button>
      <button class="atb-btn atb-btn--close" title="关闭" aria-label="关闭" @click="closeWindow">
        <svg width="12" height="12" viewBox="0 0 12 12"><line x1="3" y1="3" x2="9" y2="9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" /><line x1="9" y1="3" x2="3" y2="9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" /></svg>
      </button>
    </div>
  </header>
</template>

<style scoped>
.app-titlebar {
  /* Drag region — WebView2 honours `app-region: drag` natively because
     main.go sets Windows.NonClientRegionSupport = true. */
  -webkit-app-region: drag;
  app-region: drag;
  flex: 0 0 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px 0 12px;
  background: var(--glass-bg, rgba(255, 255, 255, 0.7));
  border-bottom: var(--border-width, 1px) solid var(--border-light, rgba(0, 0, 0, 0.08));
  user-select: none;
}

.atb-title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  /* inherits the parent drag region (no no-drag here) */
}

.atb-logo {
  width: 18px;
  height: 18px;
  border-radius: 5px;
  object-fit: cover;
}

.atb-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary, #444);
  letter-spacing: 0.02em;
}

.atb-controls {
  /* Opt out of the drag region so button clicks are delivered normally. */
  -webkit-app-region: no-drag;
  app-region: no-drag;
  display: flex;
  align-items: center;
  gap: 2px;
}

.atb-btn {
  width: 34px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--text-secondary, #444);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: default;
  transition: background 0.15s ease, color 0.15s ease;
}

.atb-btn:hover {
  background: var(--bg-hover, rgba(0, 0, 0, 0.06));
  color: var(--text-primary, #111);
}

.atb-btn--close:hover {
  background: #e81123;
  color: #fff;
}
</style>
