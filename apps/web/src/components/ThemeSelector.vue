<script setup lang="ts">
import { ref } from 'vue'

export interface ThemeOption {
  name: string
  value: string
}

const props = defineProps<{
  options: ThemeOption[]
  current: string
  open: boolean
}>()

const emit = defineEmits<{
  select: [value: string]
  close: []
}>()

const search = ref('')

function select(value: string) {
  emit('select', value)
  emit('close')
}

function backdropClick() {
  emit('close')
}
</script>

<template>
  <div v-if="open" class="theme-overlay" @click="backdropClick">
    <div class="theme-panel" @click.stop>
      <div class="theme-panel-header">
        <h3>主题管理</h3>
        <button class="close-btn" aria-label="关闭" @click="$emit('close')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <div class="theme-search">
        <svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input v-model="search" type="text" placeholder="搜索主题..." />
      </div>
      <div class="theme-list">
        <button
          v-for="theme in options.filter(t => t.name.toLowerCase().includes(search.toLowerCase()))"
          :key="theme.value"
          class="theme-item"
          :class="{ active: current === theme.name }"
          @click="select(theme.value)"
        >
          <span class="theme-name">{{ theme.name }}</span>
          <svg v-if="current === theme.name" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.theme-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(4px);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeIn 0.2s ease;
}

.theme-panel {
  background: var(--bg-primary);
  border: var(--border-width) solid var(--border-light);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xl);
  width: min(360px, 90vw);
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  animation: slideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.theme-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-light);
}

.theme-panel-header h3 {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.close-btn {
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.theme-search {
  position: relative;
  padding: 12px 20px;
  border-bottom: 1px solid var(--border-light);
}

.theme-search input {
  width: 100%;
  border: var(--border-width) solid var(--border-light);
  border-radius: var(--radius-md);
  padding: 10px 14px 10px 36px;
  font-size: 13px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  outline: none;
  transition: all 0.2s ease;
}

.theme-search input:focus {
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-primary) 25%, transparent);
}

.search-icon {
  position: absolute;
  left: 32px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-tertiary);
  pointer-events: none;
}

.theme-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.theme-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-secondary);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: left;
}

.theme-item:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.theme-item.active {
  color: var(--accent-primary);
  font-weight: 500;
  background: color-mix(in srgb, var(--accent-primary) 8%, transparent);
}

.theme-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
