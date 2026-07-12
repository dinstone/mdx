<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'

export interface RecentWorkspace {
  path: string
  name: string
  isTemp: boolean
}

const props = defineProps<{
  open: boolean
  currentPath?: string
  recentWorkspaces: RecentWorkspace[]
  isDesktop: boolean
}>()

const emit = defineEmits<{
  close: []
  select: [path: string]
  openFolder: []
}>()

function onSelect(path: string) {
  emit('select', path)
}

function onOpenFolder() {
  emit('openFolder')
}

function onBackdropClick(e: MouseEvent) {
  if (e.target === e.currentTarget) emit('close')
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="workspace-picker-backdrop" @click="onBackdropClick">
      <div class="workspace-picker">
        <div class="workspace-picker-header">
          <h3>选择工作区</h3>
          <button class="workspace-picker-close" aria-label="关闭" @click="$emit('close')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <ul class="workspace-picker-list">
          <li
            v-for="ws in recentWorkspaces"
            :key="ws.path"
            :class="['workspace-picker-item', { active: ws.path === currentPath }]"
            @click="onSelect(ws.path)"
          >
            <svg
              v-if="ws.isTemp"
              class="workspace-picker-icon"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            <svg
              v-else
              class="workspace-picker-icon"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            <span class="workspace-picker-name">{{ ws.name }}</span>
            <svg
              v-if="ws.path === currentPath"
              class="workspace-picker-check"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </li>
        </ul>
        <div v-if="isDesktop" class="workspace-picker-footer">
          <button class="workspace-picker-open-btn" @click="onOpenFolder">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            <span>打开文件夹</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.workspace-picker-backdrop {
  position: fixed;
  inset: 0;
  z-index: 2500;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.35);
}

.workspace-picker {
  min-width: 260px;
  max-width: 360px;
  max-height: 420px;
  background: var(--bg-primary);
  border: var(--border-width) solid var(--border-light);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-xl);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.workspace-picker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: var(--border-width) solid var(--border-light);
}

.workspace-picker-header h3 {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.workspace-picker-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.workspace-picker-close:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.workspace-picker-list {
  list-style: none;
  margin: 0;
  padding: 6px;
  overflow-y: auto;
  flex: 1;
}

.workspace-picker-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  font-size: 14px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
  border-radius: var(--radius-sm);
}

.workspace-picker-item:hover,
.workspace-picker-item.active {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.workspace-picker-icon {
  color: var(--accent-primary);
  flex-shrink: 0;
}

.workspace-picker-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workspace-picker-check {
  color: var(--accent-primary);
  flex-shrink: 0;
}

.workspace-picker-footer {
  padding: 12px 16px;
  border-top: var(--border-width) solid var(--border-light);
}

.workspace-picker-open-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 14px;
  font-size: 13px;
  font-weight: 500;
  border: var(--border-width) solid var(--border-light);
  border-radius: var(--radius-sm);
  background: var(--bg-secondary);
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.workspace-picker-open-btn:hover {
  background: var(--bg-hover);
  border-color: var(--accent-primary);
}
</style>
