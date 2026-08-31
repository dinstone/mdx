<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

/**
 * Custom title bar — only rendered on the Windows desktop build.
 *
 * The Wails window is created `Frameless` on Windows (main.go), so the native
 * title bar / border is gone.  Window dragging and the min/max/close buttons are
 * wired through Wails 3's non-client region support:
 *
 *   --wails-non-client-region: caption   → drag the window (HTCAPTION)
 *   --wails-non-client-region: minimize   → native minimise
 *   --wails-non-client-region: maximize   → native maximise / restore
 *   --wails-non-client-region: close      → native close
 *
 * The runtime (appregion.ts) scans for these CSS variables and forwards the
 * rectangles to the native side, which performs the real hit-testing.  So the
 * buttons need NO click handlers — Windows does it.  We only keep a resize
 * listener to flip the maximise/restore glyph.
 *
 * NOTE: `@wailsio/runtime` is only imported on demand (and this component is only
 * mounted on Windows desktop), so the web build never pulls in the runtime.
 */

const isMax = ref(false)
let wailsWindow: any = null

async function ensureWindow() {
  if (wailsWindow) return wailsWindow
  try {
    const mod = await import('@wailsio/runtime')
    wailsWindow = (mod as any).Window ?? (mod as any).default
  } catch {
    wailsWindow = null
  }
  return wailsWindow
}

async function syncMaxState() {
  const w = await ensureWindow()
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
      <button class="atb-btn" title="最小化" aria-label="最小化">
        <svg width="12" height="12" viewBox="0 0 12 12"><line x1="2" y1="6" x2="10" y2="6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" /></svg>
      </button>
      <button class="atb-btn" :title="isMax ? '向下还原' : '最大化'" :aria-label="isMax ? '向下还原' : '最大化'">
        <svg v-if="!isMax" width="12" height="12" viewBox="0 0 12 12"><rect x="2.5" y="2.5" width="7" height="7" fill="none" stroke="currentColor" stroke-width="1.2" /></svg>
        <svg v-else width="12" height="12" viewBox="0 0 12 12"><rect x="2.5" y="3.5" width="7" height="6" fill="none" stroke="currentColor" stroke-width="1.2" /><rect x="4" y="2" width="6" height="5" fill="var(--bg-primary)" stroke="currentColor" stroke-width="1.2" /></svg>
      </button>
      <button class="atb-btn atb-btn--close" title="关闭" aria-label="关闭">
        <svg width="12" height="12" viewBox="0 0 12 12"><line x1="3" y1="3" x2="9" y2="9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" /><line x1="9" y1="3" x2="3" y2="9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" /></svg>
      </button>
    </div>
  </header>
</template>

<style scoped>
.app-titlebar {
  /* drag region — Wails routes this to HTCAPTION on Windows */
  --wails-non-client-region: caption;
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
  pointer-events: none;
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

/* Native non-client regions — Windows handles the click, no JS needed. */
.atb-controls > .atb-btn:nth-child(1) {
  --wails-non-client-region: minimize;
}
.atb-controls > .atb-btn:nth-child(2) {
  --wails-non-client-region: maximize;
}
.atb-controls > .atb-btn:nth-child(3) {
  --wails-non-client-region: close;
}

/* Hover feedback is applied by Windows via forwarded mouse input. */
.atb-btn:hover {
  background: var(--bg-hover, rgba(0, 0, 0, 0.06));
  color: var(--text-primary, #111);
}

.atb-btn--close:hover {
  background: #e81123;
  color: #fff;
}
</style>
