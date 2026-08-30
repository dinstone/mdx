<script setup lang="ts">
defineProps<{
  fileName?: string
  saved?: boolean
  viewMode: 'split' | 'editor' | 'preview'
  isExternal?: boolean
}>()

const emit = defineEmits<{
  setViewMode: [mode: 'split' | 'editor' | 'preview']
  revealInFinder: []
  toggleToc: []
}>()
</script>

<template>
  <header class="content-header">
    <div class="ch-left">
      <svg class="file-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="8" y1="13" x2="16" y2="13" />
        <line x1="8" y1="17" x2="16" y2="17" />
      </svg>
      <span class="file-name">{{ fileName || '未命名' }}</span>
      <button
        v-if="isExternal"
        class="ch-reveal"
        title="在 Finder 中显示"
        @click="emit('revealInFinder')"
      >📂</button>
    </div>

    <div class="ch-right">
      <button class="ch-toc" title="目录" @click="emit('toggleToc')">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <circle cx="3.5" cy="6" r="1" />
          <circle cx="3.5" cy="12" r="1" />
          <circle cx="3.5" cy="18" r="1" />
        </svg>
      </button>

      <div class="vm-group" role="group" aria-label="视图模式">
        <button class="vm-btn" :class="{ active: viewMode === 'editor' }" title="仅编辑" @click="emit('setViewMode', 'editor')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
        </button>
        <button class="vm-btn" :class="{ active: viewMode === 'split' }" title="分栏" @click="emit('setViewMode', 'split')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <line x1="12" y1="4" x2="12" y2="20" />
          </svg>
        </button>
        <button class="vm-btn" :class="{ active: viewMode === 'preview' }" title="仅预览" @click="emit('setViewMode', 'preview')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
      </div>
    </div>
  </header>
</template>

<style scoped>
.content-header {
  height: 52px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px;
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border-bottom: var(--border-width) solid var(--glass-border);
  box-shadow: var(--glass-shadow);
  gap: 12px;
}

.ch-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.file-icon {
  flex: none;
  color: var(--text-secondary);
}

.file-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ch-reveal {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  line-height: 1;
  padding: 0;
  transition: background 0.15s;
}

.ch-reveal:hover {
  background: var(--border-light);
}

.ch-right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: none;
}

.ch-toc {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: var(--border-width) solid var(--border-light);
  border-radius: var(--radius-pill);
  background: var(--bg-primary);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.ch-toc:hover {
  background: var(--bg-hover);
  color: var(--accent-primary);
  border-color: var(--accent-primary);
}

/* 视图模式分段控件 */
.vm-group {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 3px;
  border-radius: var(--radius-pill);
  background: var(--bg-secondary);
  border: var(--border-width) solid var(--border-light);
}

.vm-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.vm-btn:hover {
  color: var(--text-primary);
  background: var(--bg-primary);
}

.vm-btn.active {
  background: var(--bg-primary);
  color: var(--accent-primary, #07c160);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}
</style>
