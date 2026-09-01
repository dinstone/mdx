<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { getBridge } from '../bridge'
// Auto-update is desktop-only and deliberately NOT part of IServiceBridge —
// it lives in its own lazily-loaded module. Aliased because the local handlers
// below are named checkUpdate()/installUpdate().
import {
  checkUpdate as fetchUpdateInfo,
  installUpdate as runInstallUpdate,
  isUpdateSupported,
} from '../bridge/update'
import type { CheckUpdateResult } from '../bridge/update'

const props = defineProps<{
  currentVersion: string
  /** Bounding rect of the settings trigger button, used to anchor the popover. */
  anchorRect: DOMRect | null
}>()

const emit = defineEmits<{ close: [] }>()

type Status = 'idle' | 'checking' | 'up-to-date' | 'available' | 'error' | 'installing'

// Evaluated lazily on every render: the Wails runtime (and therefore the
// desktop bridge) is initialised asynchronously *after* app.mount(), so a
// setup-time snapshot could be false forever if the user opens this menu
// before bootstrap finishes.
const isDesktop = computed(() => isUpdateSupported())
const status = ref<Status>('idle')
const result = ref<CheckUpdateResult | null>(null)
const installError = ref('')

const canCheck = computed(() => isDesktop.value && status.value !== 'checking' && status.value !== 'installing')

const menuStyle = computed(() => {
  if (!props.anchorRect) return {}
  return {
    left: `${props.anchorRect.right + 8}px`,
    // Anchor the menu's bottom edge to the button's bottom so it grows upward
    // (the settings button lives at the bottom of the rail).
    bottom: `${window.innerHeight - props.anchorRect.bottom}px`,
  }
})

async function checkUpdate() {
  if (!canCheck.value) return
  status.value = 'checking'
  result.value = null
  installError.value = ''
  try {
    const info = await fetchUpdateInfo()
    if (!info) {
      status.value = 'error'
      result.value = { hasUpdate: false, version: '', name: '', notes: '', url: '', error: '未获取到更新信息' }
      return
    }
    if (info.error) {
      status.value = 'error'
      result.value = info
      return
    }
    result.value = info
    status.value = info.hasUpdate ? 'available' : 'up-to-date'
  } catch (e) {
    status.value = 'error'
    result.value = { hasUpdate: false, version: '', name: '', notes: '', url: '', error: e instanceof Error ? e.message : String(e) }
  }
}

async function installUpdate() {
  if (status.value !== 'available') return
  status.value = 'installing'
  installError.value = ''
  try {
    await runInstallUpdate()
    // CheckAndInstall relaunches the app; if we reach here, install was cancelled/failed.
  } catch (e) {
    status.value = 'available'
    installError.value = e instanceof Error ? e.message : String(e)
  }
}

function openRelease() {
  const url = result.value?.url
  if (url) getBridge().openExternal(url).catch(() => {})
}

function close() {
  emit('close')
}

// Close on Escape.
function onKeyEsc(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}

onMounted(() => {
  document.addEventListener('keydown', onKeyEsc)
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeyEsc)
})
watch(
  () => props.anchorRect,
  (rect) => {
    if (rect) {
      status.value = 'idle'
      result.value = null
      installError.value = ''
    }
  },
)
</script>

<template>
  <div class="settings-backdrop" @click="close" />
  <div class="settings-menu" :style="menuStyle" role="dialog" aria-label="设置">
    <header class="sm-header">
      <span class="sm-title">设置</span>
      <button class="sm-close" title="关闭" @click="close">✕</button>
    </header>

    <div class="sm-section">
      <div class="sm-version">
        <span class="sm-label">当前版本</span>
        <span class="sm-value">v{{ currentVersion }}</span>
      </div>

      <button class="sm-check-btn" :disabled="!canCheck" @click="checkUpdate">
        <span v-if="status === 'checking'" class="sm-spinner" />
        {{ status === 'checking' ? '检查中…' : '检查更新' }}
      </button>

      <!-- Result area -->
      <div v-if="status === 'up-to-date'" class="sm-result sm-ok">
        已是最新版本
      </div>

      <div v-else-if="(status === 'available' || status === 'installing') && result" class="sm-result sm-update">
        <div class="sm-update-head">
          发现新版本
          <strong>v{{ result.version }}</strong>
          <span v-if="result.name" class="sm-update-name">{{ result.name }}</span>
        </div>
        <p v-if="result.notes" class="sm-notes">{{ result.notes }}</p>
        <div class="sm-actions">
          <button class="sm-primary" :disabled="status === 'installing'" @click="installUpdate">
            <span v-if="status === 'installing'" class="sm-spinner" />
            {{ status === 'installing' ? '正在下载并安装…' : '立即更新' }}
          </button>
          <button v-if="result.url" class="sm-link" @click="openRelease">查看详情</button>
        </div>
        <p v-if="installError" class="sm-error">更新失败：{{ installError }}</p>
      </div>

      <div v-else-if="status === 'error'" class="sm-result sm-err">
        检查失败：{{ result?.error || '未知错误' }}
      </div>

      <div v-else-if="status === 'installing'" class="sm-result sm-ok">
        <span class="sm-spinner" /> 正在下载并安装更新，完成后将自动重启…
      </div>

      <div v-if="!isDesktop" class="sm-result sm-hint">
        自动更新仅桌面端可用
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-backdrop {
  position: fixed;
  inset: 0;
  z-index: 300;
  background: transparent;
}

.settings-menu {
  position: fixed;
  z-index: 301;
  width: 280px;
  max-height: 360px;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  border: var(--border-width) solid var(--border-light);
  border-radius: var(--radius-lg);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.18);
  overflow: hidden;
  user-select: none;
}

.sm-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-light);
}

.sm-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.sm-close {
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: var(--radius-sm);
  font-size: 13px;
  line-height: 1;
}

.sm-close:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.sm-section {
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sm-version {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
}

.sm-label {
  color: var(--text-secondary);
}

.sm-value {
  color: var(--text-primary);
  font-weight: 500;
}

.sm-check-btn {
  width: 100%;
  height: 36px;
  border: 1px solid var(--accent-primary, #07c160);
  background: transparent;
  color: var(--accent-primary, #07c160);
  border-radius: var(--radius-md);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all 0.15s ease;
}

.sm-check-btn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--accent-primary, #07c160) 10%, transparent);
}

.sm-check-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.sm-result {
  font-size: 13px;
  line-height: 1.5;
  padding: 10px 12px;
  border-radius: var(--radius-md);
}

.sm-ok {
  color: var(--text-secondary);
  background: var(--bg-hover);
}

.sm-err {
  color: #d4380d;
  background: rgba(212, 56, 13, 0.08);
}

.sm-hint {
  color: var(--text-tertiary, #999);
  background: transparent;
  padding: 0;
}

.sm-update {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: color-mix(in srgb, var(--accent-primary, #07c160) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent-primary, #07c160) 30%, transparent);
}

.sm-update-head {
  font-size: 13px;
  color: var(--text-primary);
}

.sm-update-name {
  color: var(--text-secondary);
  font-weight: 400;
  margin-left: 4px;
}

.sm-notes {
  margin: 0;
  font-size: 12px;
  color: var(--text-secondary);
  white-space: pre-wrap;
  max-height: 80px;
  overflow-y: auto;
}

.sm-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.sm-primary {
  flex: 1;
  height: 32px;
  border: none;
  background: var(--accent-primary, #07c160);
  color: #fff;
  border-radius: var(--radius-md);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.sm-primary:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.sm-link {
  border: none;
  background: transparent;
  color: var(--accent-primary, #07c160);
  font-size: 13px;
  cursor: pointer;
  text-decoration: underline;
  padding: 0;
}

.sm-error {
  margin: 0;
  color: #d4380d;
  font-size: 12px;
}

.sm-spinner {
  width: 13px;
  height: 13px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  display: inline-block;
  animation: sm-spin 0.7s linear infinite;
}

@keyframes sm-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
