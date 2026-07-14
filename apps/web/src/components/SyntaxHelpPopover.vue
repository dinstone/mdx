<script setup lang="ts">
import { ref, onBeforeUnmount, onMounted } from 'vue'

const isOpen = ref(false)
const containerRef = ref<HTMLDivElement>()

const syntaxItems = [
  { syntax: '**文字**', desc: '粗体' },
  { syntax: '*文字*', desc: '斜体' },
  { syntax: '++文字++', desc: '下划线' },
  { syntax: '~~文字~~', desc: '删除线' },
  { syntax: '==文字==', desc: '高亮' },
  { syntax: '$公式$', desc: '行内公式' },
  { syntax: '`代码`', desc: '行内代码' },
  { syntax: 'H~2~O', desc: '下标' },
  { syntax: 'X^2^', desc: '上标' },
  { syntax: '> [!NOTE]', desc: '提示块' },
  { syntax: '- [ ] 任务', desc: '任务列表' },
]

function toggle() {
  isOpen.value = !isOpen.value
}

function openDocs() {
  window.open('https://wemd.app/docs/reference/markdown-syntax', '_blank', 'noopener,noreferrer')
  isOpen.value = false
}

function handleClickOutside(e: MouseEvent) {
  if (containerRef.value && !containerRef.value.contains(e.target as Node)) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('mousedown', handleClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', handleClickOutside)
})
</script>

<template>
  <div class="syntax-help-container" ref="containerRef">
    <button
      class="toolbar-btn"
      :class="{ active: isOpen }"
      title="语法帮助"
      @click.stop="toggle"
    >
      <span class="tool-icon">?</span>
    </button>

    <div v-if="isOpen" class="syntax-help-popover">
      <div class="syntax-help-header">Markdown 语法速查</div>
      <div class="syntax-help-list">
        <div v-for="(item, idx) in syntaxItems" :key="idx" class="syntax-help-row">
          <code>{{ item.syntax }}</code>
          <span>{{ item.desc }}</span>
        </div>
      </div>
      <button class="syntax-help-docs-link" @click="openDocs">
        <span>查看完整文档</span>
        <span class="tool-icon">↗</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.syntax-help-container {
  position: relative;
  display: inline-flex;
}

.toolbar-btn {
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
}

.toolbar-btn:hover {
  background: var(--bg-hover);
  color: var(--accent-primary);
  border-color: var(--border-light);
}

.toolbar-btn.active {
  background: var(--bg-hover);
  color: var(--accent-primary);
  border-color: var(--border-light);
}

.syntax-help-popover {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  width: 220px;
  background: var(--bg-primary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-md);
  z-index: 1000;
}

.syntax-help-header {
  padding: 10px 14px;
  font-weight: 600;
  font-size: 13px;
  color: var(--text-primary);
  border-bottom: 1px solid var(--border-light);
}

.syntax-help-list {
  padding: 6px 0;
}

.syntax-help-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 14px;
  font-size: 13px;
}

.syntax-help-row code {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--accent-primary);
  background: transparent;
  padding: 0;
}

.syntax-help-row span {
  color: var(--text-secondary);
  font-size: 12px;
}

.syntax-help-docs-link {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 10px 14px;
  border: none;
  border-top: 1px solid var(--border-light);
  background: transparent;
  color: var(--accent-primary);
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s;
}

.syntax-help-docs-link:hover {
  background: var(--bg-secondary);
}

.tool-icon {
  font-weight: 500;
  font-size: 12px;
}
</style>
