<script setup lang="ts">
const emit = defineEmits<{
  bold: []
  italic: []
  underline: []
  strikethrough: []
  heading: []
  unorderedList: []
  orderedList: []
  code: []
  quote: []
  link: []
  image: []
  table: []
  help: []
}>()

interface ToolItem {
  key: string
  title: string
  handler: () => void
}

const tools: ToolItem[] = [
  { key: 'bold', title: '粗体', handler: () => emit('bold') },
  { key: 'italic', title: '斜体', handler: () => emit('italic') },
  { key: 'underline', title: '下划线', handler: () => emit('underline') },
  { key: 'strikethrough', title: '删除线', handler: () => emit('strikethrough') },
  { key: 'heading', title: '标题', handler: () => emit('heading') },
  { key: 'unorderedList', title: '无序列表', handler: () => emit('unorderedList') },
  { key: 'orderedList', title: '有序列表', handler: () => emit('orderedList') },
  { key: 'code', title: '行内代码', handler: () => emit('code') },
  { key: 'quote', title: '引用', handler: () => emit('quote') },
  { key: 'link', title: '链接', handler: () => emit('link') },
  { key: 'image', title: '图片', handler: () => emit('image') },
  { key: 'table', title: '表格', handler: () => emit('table') },
]
</script>

<template>
  <div class="md-toolbar">
    <button
      v-for="tool in tools"
      :key="tool.key"
      class="toolbar-btn"
      :title="tool.title"
      @click="tool.handler"
    >
      <b v-if="tool.key === 'bold'">B</b>
      <i v-else-if="tool.key === 'italic'">I</i>
      <u v-else-if="tool.key === 'underline'">U</u>
      <s v-else-if="tool.key === 'strikethrough'">S</s>
      <span v-else-if="tool.key === 'heading'" class="tool-icon">H</span>
      <span v-else-if="tool.key === 'unorderedList'" class="tool-icon">•≡</span>
      <span v-else-if="tool.key === 'orderedList'" class="tool-icon">1≡</span>
      <span v-else-if="tool.key === 'code'" class="tool-icon">&lt;/&gt;</span>
      <span v-else-if="tool.key === 'quote'" class="tool-icon">❝</span>
      <span v-else-if="tool.key === 'link'" class="tool-icon">🔗</span>
      <span v-else-if="tool.key === 'image'" class="tool-icon">🖼</span>
      <span v-else-if="tool.key === 'table'" class="tool-icon">▦</span>
    </button>
    <button class="toolbar-btn" title="帮助" @click="$emit('help')">
      <span class="tool-icon">?</span>
    </button>
  </div>
</template>

<style scoped>
.md-toolbar {
  height: 50px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 24px;
  border-bottom: 1px solid var(--border-light);
  background: var(--bg-primary);
  flex-wrap: wrap;
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

.toolbar-btn:active {
  background: var(--bg-tertiary);
  transform: translateY(1px);
}

.tool-icon {
  font-weight: 500;
  font-size: 12px;
}

.md-toolbar b,
.md-toolbar i,
.md-toolbar u,
.md-toolbar s {
  font-size: 13px;
  font-weight: 700;
}
</style>
