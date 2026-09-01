<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

/**
 * Custom title bar — only rendered on the Windows desktop build.
 *
 * The Wails window is created `Frameless` on Windows (main.go), so the native
 * title bar / border is gone.  Two independent mechanisms are used:
 *
 *   1. Dragging — the header carries `--wails-draggable: drag` (the Wails-
 *      managed, JS-tracked mechanism that EVERY official template uses; it only
 *      needs `Frameless: true`, no extra Go flag).  The `.atb-title` region
 *      fills the bar and stays draggable; the buttons opt out via
 *      `--wails-draggable: no-drag` so their DOM clicks are not swallowed.
 *
 *   2. Min / Max / Close buttons — driven by explicit JS calls into the Wails
 *      `Window` API (`@wailsio/runtime`).  Independent of the drag machinery.
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
  /* Drag region — Wails-managed `--wails-draggable` (the default cross-platform
     mechanism all official templates use; only needs Frameless:true, no special
     Go flag). Buttons opt out via `--wails-draggable: no-drag` on `.atb-btn`. */
  --wails-draggable: drag;
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
  flex: 1 1 auto; /* fill the bar so the left/centre is the drag handle */
  /* inherits `--wails-draggable: drag` from .app-titlebar */
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
  /* Container stays draggable (inherits drag); only the buttons opt out. */
  display: flex;
  align-items: center;
  gap: 2px;
}

.atb-btn {
  /* Buttons must NOT be a drag region, otherwise their clicks are swallowed. */
  --wails-draggable: no-drag;
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
