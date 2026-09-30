<script setup lang="ts">
import { ref } from 'vue'
import AboutSponsorDialog from './AboutSponsorDialog.vue'

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

const showAbout = ref(false)

function toggleAbout() {
  showAbout.value = !showAbout.value
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
        class="sys-item sponsor"
        :class="{ active: showAbout }"
        data-tip="关于 / 赞助"
        @click="toggleAbout"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
          <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
        </svg>
        <span class="tip">关于 / 赞助</span>
      </button>
    </div>

    <AboutSponsorDialog
      v-if="showAbout"
      :current-version="appVersion"
      @close="showAbout = false"
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
  padding: 20px 0 14px;
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
  width: 42px;
  height: 40px;
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

/* 赞助入口：实心红底白心，经典「喜欢/赞助」语义色，醒目且与绿色导航项区分 */
.sys-item.sponsor {
  background: #e0404f;
  color: #fff;
  box-shadow: 0 0 0 1px rgba(224, 64, 79, 0.35);
}
.sys-item.sponsor:hover {
  background: #c83342;
  box-shadow: 0 0 0 1px rgba(224, 64, 79, 0.55);
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
