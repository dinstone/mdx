<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import SyntaxHelpPopover from './SyntaxHelpPopover.vue'

const emit = defineEmits<{
  bold: []
  italic: []
  underline: []
  strikethrough: []
  heading: [level: number]
  unorderedList: []
  orderedList: []
  code: []
  quote: []
  link: []
  image: []
  table: []
  search: []
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
  { key: 'unorderedList', title: '无序列表', handler: () => emit('unorderedList') },
  { key: 'orderedList', title: '有序列表', handler: () => emit('orderedList') },
  { key: 'code', title: '行内代码', handler: () => emit('code') },
  { key: 'quote', title: '引用', handler: () => emit('quote') },
  { key: 'link', title: '链接', handler: () => emit('link') },
  { key: 'image', title: '图片', handler: () => emit('image') },
  { key: 'table', title: '表格', handler: () => emit('table') },
  { key: 'search', title: '查找和替换 (Command+F)', handler: () => emit('search') },
]

const showHeadingMenu = ref(false)
const headingMenuRef = ref<HTMLDivElement>()

function toggleHeadingMenu() {
  showHeadingMenu.value = !showHeadingMenu.value
}

function selectHeading(level: number) {
  emit('heading', level)
  showHeadingMenu.value = false
}

function handleClickOutside(e: MouseEvent) {
  if (headingMenuRef.value && !headingMenuRef.value.contains(e.target as Node)) {
    showHeadingMenu.value = false
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
      <span v-else-if="tool.key === 'unorderedList'" class="tool-icon">•≡</span>
      <span v-else-if="tool.key === 'orderedList'" class="tool-icon">1≡</span>
      <span v-else-if="tool.key === 'code'" class="tool-icon">&lt;/&gt;</span>
      <span v-else-if="tool.key === 'quote'" class="tool-icon">❝</span>
      <span v-else-if="tool.key === 'link'" class="tool-icon">🔗</span>
      <span v-else-if="tool.key === 'image'" class="tool-icon">🖼</span>
      <span v-else-if="tool.key === 'table'" class="tool-icon">▦</span>
      <span v-else-if="tool.key === 'search'" class="tool-icon">🔍</span>
    </button>

    <!-- 标题下拉 -->
    <div class="toolbar-dropdown-container" ref="headingMenuRef">
      <button
        class="toolbar-btn"
        :class="{ active: showHeadingMenu }"
        title="标题"
        @click.stop="toggleHeadingMenu"
      >
        <span class="tool-icon">H</span>
      </button>
      <div v-if="showHeadingMenu" class="toolbar-dropdown-menu">
        <button
          class="toolbar-dropdown-item"
          @click.stop="selectHeading(1)"
        >
          <span class="heading-level">H1</span>
          <span class="heading-label">一级标题</span>
        </button>
        <button
          class="toolbar-dropdown-item"
          @click.stop="selectHeading(2)"
        >
          <span class="heading-level">H2</span>
          <span class="heading-label">二级标题</span>
        </button>
        <button
          class="toolbar-dropdown-item"
          @click.stop="selectHeading(3)"
        >
          <span class="heading-level">H3</span>
          <span class="heading-label">三级标题</span>
        </button>
        <button
          class="toolbar-dropdown-item"
          @click.stop="selectHeading(4)"
        >
          <span class="heading-level">H4</span>
          <span class="heading-label">四级标题</span>
        </button>
      </div>
    </div>

    <SyntaxHelpPopover />
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

.toolbar-btn.active {
  background: var(--bg-hover);
  color: var(--accent-primary);
  border-color: var(--border-light);
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

/* 下拉菜单 */
.toolbar-dropdown-container {
  position: relative;
  display: inline-flex;
}

.toolbar-dropdown-menu {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 4px;
  background: var(--bg-primary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-md);
  z-index: 1000;
  min-width: 140px;
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.toolbar-dropdown-item {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 6px 10px;
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all 0.15s;
  gap: 8px;
}

.toolbar-dropdown-item:hover {
  background: var(--bg-hover);
  color: var(--accent-primary);
}

.heading-level {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  color: var(--accent-primary);
  min-width: 22px;
}

.heading-label {
  font-size: 13px;
  color: var(--text-secondary);
}

.toolbar-dropdown-item:hover .heading-label {
  color: var(--accent-primary);
}
</style>
