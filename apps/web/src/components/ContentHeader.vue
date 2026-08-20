<script setup lang="ts">
defineProps<{
  fileName?: string
  saved?: boolean
  viewMode: 'split' | 'editor' | 'preview'
  isExternal?: boolean
}>()

const emit = defineEmits<{
  setViewMode: [mode: 'split' | 'editor' | 'preview']
  copyWechat: []
  copyHtml: []
  revealInFinder: []
  toggleToc: []
}>()
</script>

<template>
  <header class="content-header">
    <div class="ch-left">
      <span
        class="save-dot"
        :class="saved ? 'saved' : 'dirty'"
        :title="saved ? '已保存' : '未保存'"
      ></span>
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

      <button class="btn-secondary" @click="emit('copyHtml')">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
        <span>复制 HTML</span>
      </button>

      <button class="btn-primary" @click="emit('copyWechat')">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
        <span>复制到公众号</span>
      </button>
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

.save-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex: none;
}

.save-dot.saved {
  background: var(--accent-primary);
}

.save-dot.dirty {
  background: #f59e0b;
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

.btn-primary {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 18px;
  background: var(--accent-gradient) !important;
  color: #ffffff !important;
  border: none;
  border-radius: var(--radius-pill);
  font-size: 13px;
  font-weight: 600;
  box-shadow: var(--shadow-md);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
}

.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-lg);
}

.btn-secondary {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 16px;
  background: transparent;
  color: var(--text-secondary);
  border: var(--border-width) solid var(--border-light);
  border-radius: var(--radius-pill);
  font-size: 13px;
  font-weight: 500;
  transition: all 0.2s ease;
  cursor: pointer;
}

.btn-secondary:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
  border-color: var(--border-color);
}

.btn-secondary svg,
.btn-primary svg {
  width: 18px;
  height: 18px;
}

@media (max-width: 1100px) {
  .btn-secondary span,
  .btn-primary span {
    display: none;
  }
  .btn-secondary,
  .btn-primary {
    padding: 9px 12px;
  }
}
</style>
