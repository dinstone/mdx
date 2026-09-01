<script setup lang="ts">
import { ref } from 'vue'
import SettingsMenu from './SettingsMenu.vue'

defineProps<{
  isDark: boolean
  workspaceOpen: boolean
}>()

const emit = defineEmits<{
  toggleWorkspace: []
  openTheme: []
  openImageHost: []
  toggleDark: []
}>()

const appVersion = __APP_VERSION__

const showSettings = ref(false)
const settingsAnchor = ref<DOMRect | null>(null)
const settingsBtn = ref<HTMLButtonElement | null>(null)

function toggleSettings() {
  if (showSettings.value) {
    showSettings.value = false
    return
  }
  settingsAnchor.value = settingsBtn.value?.getBoundingClientRect() ?? null
  showSettings.value = true
}
</script>

<template>
  <aside class="system-rail">
    <img class="sys-logo" src="/logo.png" alt="MDX" />
    <span class="sys-version">v{{ appVersion }}</span>

    <nav class="sys-nav">
      <button
        class="sys-item"
        :class="{ active: workspaceOpen }"
        data-tip="工作空间"
        @click="emit('toggleWorkspace')"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
          <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" />
          <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
        </svg>
        <span class="tip">工作空间</span>
      </button>

      <button class="sys-item" data-tip="主题管理" @click="emit('openTheme')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z" />
          <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
          <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
          <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
          <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
        </svg>
        <span class="tip">主题管理</span>
      </button>

      <button class="sys-item" data-tip="媒体管理" @click="emit('openImageHost')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
        </svg>
        <span class="tip">媒体管理</span>
      </button>
    </nav>

    <div class="sys-bottom">
      <button class="sys-item" :data-tip="isDark ? '切换到亮色' : '切换到暗色'" @click="emit('toggleDark')">
        <svg v-if="isDark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="5" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
        <span class="tip">{{ isDark ? '亮色模式' : '暗色模式' }}</span>
      </button>

      <button
        ref="settingsBtn"
        class="sys-item"
        :class="{ active: showSettings }"
        data-tip="设置"
        @click="toggleSettings"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
        <span class="tip">设置</span>
      </button>
    </div>

    <SettingsMenu
      v-if="showSettings"
      :current-version="appVersion"
      :anchor-rect="settingsAnchor"
      @close="showSettings = false"
    />
  </aside>
</template>

<style scoped>
.system-rail {
  width: 56px;
  flex: 0 0 56px;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 26px 0 14px;
  gap: 6px;
}

.sys-logo {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  object-fit: cover;
  display: block;
  margin-bottom: 4px;
  user-select: none;
}

.sys-version {
  font-size: 10px;
  line-height: 1.2;
  color: var(--text-secondary);
  opacity: 0.65;
  font-weight: 500;
  letter-spacing: 0.02em;
  margin-bottom: 14px;
  user-select: none;
}

.sys-nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
  align-items: center;
  flex: 1;
}

.sys-item {
  position: relative;
  box-sizing: border-box;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.18s ease;
}

.sys-item svg {
  width: 18px;
  height: 18px;
}

.sys-item:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.sys-item.active,
.sys-item.active:hover {
  color: var(--accent-primary, #07c160);
}

.sys-bottom {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: center;
}

/* 悬停提示 */
.sys-item .tip {
  position: absolute;
  left: calc(100% + 10px);
  top: 50%;
  transform: translateY(-50%);
  white-space: nowrap;
  background: var(--text-primary);
  color: var(--bg-primary);
  font-size: 12px;
  font-weight: 500;
  padding: 5px 10px;
  border-radius: var(--radius-sm);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease;
  z-index: 200;
}

.sys-item:hover .tip {
  opacity: 1;
}
</style>
