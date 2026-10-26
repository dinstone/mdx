<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import SyntaxHelpPopover from './SyntaxHelpPopover.vue'

const emit = defineEmits<{
  bold: []
  italic: []
  underline: []
  strikethrough: []
  superscript: []
  subscript: []
  heading: [level: number]
  unorderedList: []
  orderedList: []
  taskList: []
  code: []
  quote: []
  link: []
  'image-upload': [files: File[]]
  'attachment-upload': [files: File[]]
  table: []
  clearFormat: []
  callout: [type: string]
  search: []
}>()

interface ToolItem {
  key: string
  title: string
  handler: () => void
  sep?: boolean
}

// 分组顺序；sep 项仅用于渲染分隔线
const tools: ToolItem[] = [
  { key: 'bold', title: '粗体', handler: () => emit('bold') },
  { key: 'italic', title: '斜体', handler: () => emit('italic') },
  { key: 'underline', title: '下划线', handler: () => emit('underline') },
  { key: 'strikethrough', title: '删除线', handler: () => emit('strikethrough') },
  { key: 'sep', title: '', handler: () => {}, sep: true },
  { key: 'unorderedList', title: '无序列表', handler: () => emit('unorderedList') },
  { key: 'orderedList', title: '有序列表', handler: () => emit('orderedList') },
  { key: 'taskList', title: '任务列表', handler: () => emit('taskList') },
  { key: 'sep', title: '', handler: () => {}, sep: true },
  { key: 'code', title: '行内代码', handler: () => emit('code') },
  { key: 'quote', title: '引用', handler: () => emit('quote') },
  { key: 'superscript', title: '上标', handler: () => emit('superscript') },
  { key: 'subscript', title: '下标', handler: () => emit('subscript') },
  { key: 'sep', title: '', handler: () => {}, sep: true },
  { key: 'link', title: '链接', handler: () => emit('link') },
  { key: 'table', title: '表格', handler: () => emit('table') },
]

// 统一描边图标（仅 SVG 内部元素，外层 <svg> 在模板里统一套 viewBox/描边样式）
const icons: Record<string, string> = {
  unorderedList:
    '<line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4.5" cy="6" r="1.2" fill="currentColor" stroke="none"/><circle cx="4.5" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="4.5" cy="18" r="1.2" fill="currentColor" stroke="none"/>',
  orderedList:
    '<line x1="10" y1="6" x2="20" y2="6"/><line x1="10" y1="12" x2="20" y2="12"/><line x1="10" y1="18" x2="20" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/>',
  code: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
  quote:
    '<line x1="4" y1="5" x2="4" y2="19"/><line x1="8" y1="9" x2="20" y2="9"/><line x1="8" y1="15" x2="20" y2="15"/>',
  link:
    '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  table:
    '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/>',
  image:
    '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
  attachment:
    '<path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
  search:
    '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  taskList:
    '<rect x="3" y="3" width="18" height="18" rx="3"/><polyline points="8 12 11 15 16 9"/>',
  clearFormat:
    '<path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/>',
  more:
    '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
}

// 高亮提示块（callout / GitHub Alert）类型，与截图一致
const calloutTypes = [
  { type: 'NOTE', label: '备注', icon: 'ℹ️' },
  { type: 'TIP', label: '提示', icon: '💡' },
  { type: 'IMPORTANT', label: '重要', icon: '📌' },
  { type: 'WARNING', label: '警告', icon: '⚠️' },
  { type: 'CAUTION', label: '注意', icon: '🚨' },
]

const imageInputRef = ref<HTMLInputElement>()

function onImageClick() {
  imageInputRef.value?.click()
}

function onImageChange(e: Event) {
  const input = e.target as HTMLInputElement
  const files = input.files
  if (!files || files.length === 0) return
  emit('image-upload', Array.from(files))
  // 重置 input 以便重复选同一文件
  input.value = ''
}

const attachmentInputRef = ref<HTMLInputElement>()

function onAttachmentClick() {
  attachmentInputRef.value?.click()
}

function onAttachmentChange(e: Event) {
  const input = e.target as HTMLInputElement
  const files = input.files
  if (!files || files.length === 0) return
  emit('attachment-upload', Array.from(files))
  // 重置 input 以便重复选同一文件
  input.value = ''
}

const showHeadingMenu = ref(false)
const headingMenuRef = ref<HTMLDivElement>()

function toggleHeadingMenu() {
  showHeadingMenu.value = !showHeadingMenu.value
}

function selectHeading(level: number) {
  emit('heading', level)
  showHeadingMenu.value = false
}

const showMoreMenu = ref(false)
const moreMenuRef = ref<HTMLDivElement>()

function toggleMoreMenu() {
  showMoreMenu.value = !showMoreMenu.value
}

function selectCallout(type: string) {
  emit('callout', type)
  showMoreMenu.value = false
}

function handleClickOutside(e: MouseEvent) {
  if (headingMenuRef.value && !headingMenuRef.value.contains(e.target as Node)) {
    showHeadingMenu.value = false
  }
  if (moreMenuRef.value && !moreMenuRef.value.contains(e.target as Node)) {
    showMoreMenu.value = false
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
    <!-- 清除格式（橡皮擦） -->
    <button class="toolbar-btn" title="清除格式" @click="emit('clearFormat')">
      <svg class="tool-svg" viewBox="0 0 24 24" v-html="icons.clearFormat" />
    </button>

    <span class="toolbar-sep" />

    <!-- 标题下拉 -->
    <div class="toolbar-dropdown-container" ref="headingMenuRef">
      <button
        class="toolbar-btn"
        :class="{ active: showHeadingMenu }"
        title="标题"
        @click.stop="toggleHeadingMenu"
      >
        <span class="tool-icon h-label">H</span>
        <svg class="tool-chev" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9" /></svg>
      </button>
      <div v-if="showHeadingMenu" class="toolbar-dropdown-menu">
        <button class="toolbar-dropdown-item" @click.stop="selectHeading(1)">
          <span class="heading-level">H1</span>
          <span class="heading-label">一级标题</span>
        </button>
        <button class="toolbar-dropdown-item" @click.stop="selectHeading(2)">
          <span class="heading-level">H2</span>
          <span class="heading-label">二级标题</span>
        </button>
        <button class="toolbar-dropdown-item" @click.stop="selectHeading(3)">
          <span class="heading-level">H3</span>
          <span class="heading-label">三级标题</span>
        </button>
        <button class="toolbar-dropdown-item" @click.stop="selectHeading(4)">
          <span class="heading-level">H4</span>
          <span class="heading-label">四级标题</span>
        </button>
      </div>
    </div>

    <span class="toolbar-sep" />

    <template v-for="tool in tools" :key="tool.key">
      <span v-if="tool.sep" class="toolbar-sep" />
      <button
        v-else
        class="toolbar-btn"
        :title="tool.title"
        @click="tool.handler"
      >
        <b v-if="tool.key === 'bold'">B</b>
        <i v-else-if="tool.key === 'italic'">I</i>
        <u v-else-if="tool.key === 'underline'">U</u>
        <s v-else-if="tool.key === 'strikethrough'">S</s>
        <span v-else-if="tool.key === 'superscript'" class="tool-text">x²</span>
        <span v-else-if="tool.key === 'subscript'" class="tool-text">x₂</span>
        <svg v-else class="tool-svg" viewBox="0 0 24 24" v-html="icons[tool.key]" />
      </button>
    </template>

    <!-- 图片上传按钮 -->
    <button class="toolbar-btn" title="上传图片" @click="onImageClick">
      <svg class="tool-svg" viewBox="0 0 24 24" v-html="icons.image" />
    </button>
    <input
      ref="imageInputRef"
      type="file"
      accept="image/*"
      multiple
      style="display:none"
      @change="onImageChange"
    />

    <!-- 附件上传按钮 -->
    <button class="toolbar-btn" title="上传附件" @click="onAttachmentClick">
      <svg class="tool-svg" viewBox="0 0 24 24" v-html="icons.attachment" />
    </button>
    <input
      ref="attachmentInputRef"
      type="file"
      multiple
      style="display:none"
      @change="onAttachmentChange"
    />

    <span class="toolbar-sep" />

    <!-- 更多：高亮提示块（callout） -->
    <div class="toolbar-dropdown-container" ref="moreMenuRef">
      <button
        class="toolbar-btn"
        :class="{ active: showMoreMenu }"
        title="更多"
        @click.stop="toggleMoreMenu"
      >
        <svg class="tool-svg" viewBox="0 0 24 24" v-html="icons.more" />
      </button>
      <div v-if="showMoreMenu" class="toolbar-dropdown-menu more-menu">
        <div class="toolbar-dropdown-header">高亮提示块</div>
        <button
          v-for="c in calloutTypes"
          :key="c.type"
          class="toolbar-dropdown-item"
          @click.stop="selectCallout(c.type)"
        >
          <span class="callout-emoji">{{ c.icon }}</span>
          <span>{{ c.label }}</span>
        </button>
      </div>
    </div>

    <span class="toolbar-sep" />

    <!-- 查找 -->
    <button class="toolbar-btn" title="查找和替换 (Command+F)" @click="emit('search')">
      <svg class="tool-svg" viewBox="0 0 24 24" v-html="icons.search" />
    </button>

    <SyntaxHelpPopover />
  </div>
</template>

<style scoped>
.md-toolbar {
  min-height: 50px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 0 24px;
  border-bottom: 1px solid var(--border-light);
  background: var(--bg-secondary);
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
}

.toolbar-btn:active {
  background: var(--bg-tertiary);
  transform: translateY(1px);
}

.toolbar-btn.active {
  background: var(--bg-hover);
  color: var(--accent-primary);
}

/* 分组分隔线 */
.toolbar-sep {
  width: 1px;
  height: 18px;
  background: var(--border-light);
  margin: 0 3px;
  flex: none;
}

/* 统一描边图标 */
.tool-svg {
  width: 16px;
  height: 16px;
  stroke: currentColor;
  fill: none;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

/* 上标 / 下标 文字字形 */
.tool-text {
  font-size: 13px;
  font-weight: 700;
}

/* 标题下拉小箭头 */
.tool-chev {
  width: 9px;
  height: 9px;
  stroke: currentColor;
  fill: none;
  stroke-width: 2.4;
  stroke-linecap: round;
  stroke-linejoin: round;
  margin-left: -1px;
}

.tool-icon {
  font-weight: 500;
  font-size: 12px;
}

.h-label {
  font-weight: 700;
  font-size: 13px;
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
  max-height: 320px;
  overflow-y: auto;
}

/* 更多菜单居右，避免溢出右边缘 */
.more-menu {
  left: auto;
  right: 0;
}

.toolbar-dropdown-header {
  padding: 6px 10px 4px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-tertiary);
  letter-spacing: 0.02em;
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

.callout-emoji {
  font-size: 14px;
  line-height: 1;
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
