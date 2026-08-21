<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import MarkdownEditor from './MarkdownEditor.vue'
import PreviewPanel from './PreviewPanel.vue'
import ContentHeader from './ContentHeader.vue'
import EditorStatusbar from './EditorStatusbar.vue'
import PreviewToc from './PreviewToc.vue'
import type { TocItem } from './PreviewToc.vue'
import { parseEditorHeadings, editorToPreviewTop, previewToEditorLine } from '../scrollSync'

const props = defineProps<{
  modelValue: string
  fileName?: string
  saved?: boolean
  isExternal?: boolean
  externalFilePath?: string
  renderedHtml: string
  isDark?: boolean
  viewMode: 'split' | 'editor' | 'preview'
  hasActiveFile: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  save: []
  'setViewMode': [mode: 'split' | 'editor' | 'preview']
  copyWechat: []
  copyHtml: []
  revealInFinder: []
  openWorkspaceFolder: []
}>()

const editorRef = ref<InstanceType<typeof MarkdownEditor> | null>(null)
const previewRef = ref<InstanceType<typeof PreviewPanel> | null>(null)
const bodyRef = ref<HTMLElement | null>(null)

// ---- 视口比例 + 分隔条拖拽 ----
const editorRatio = ref(0.55)
const isDraggingDivider = ref(false)

function onDividerMouseDown(e: MouseEvent) {
  e.preventDefault()
  document.addEventListener('mousemove', onDividerMouseMove)
  document.addEventListener('mouseup', onDividerMouseUp)
}

function onDividerMouseMove(e: MouseEvent) {
  if (!isDraggingDivider.value && Math.abs(e.movementX) < 1 && e.buttons === 0) return
  isDraggingDivider.value = true
  const el = bodyRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const x = e.clientX - rect.left
  editorRatio.value = Math.max(0.4, Math.min(0.6, x / rect.width))
}

function onDividerMouseUp() {
  isDraggingDivider.value = false
  document.removeEventListener('mousemove', onDividerMouseMove)
  document.removeEventListener('mouseup', onDividerMouseUp)
}

const bodyColumns = computed(() => {
  if (props.viewMode === 'editor' || props.viewMode === 'preview') return '1fr'
  const ed = editorRatio.value * 100
  const pv = (1 - editorRatio.value) * 100
  return `${ed}% 6px ${pv}%`
})

// ---- 字数 / 行数 ----
const lineCount = computed(() => {
  if (!props.modelValue) return 0
  return props.modelValue.split('\n').length
})
const wordCount = computed(() => {
  const text = props.modelValue.trim()
  if (!text) return 0
  const cn = (text.match(/[\u4e00-\u9fa5]/g) || []).length
  const en = (text.match(/[a-zA-Z0-9_]+/g) || []).length
  return cn + en
})

// ---- 光标 ----
const cursorLine = ref(0)
const cursorCol = ref(0)
function onCursor(line: number, col: number) {
  cursorLine.value = line
  cursorCol.value = col
}

// ---- 字体缩放（代理到编辑器）----
const fontSize = ref(16)
function syncFontSize() {
  fontSize.value = editorRef.value?.getFontSize() ?? 16
}
function onZoomIn() {
  editorRef.value?.zoomIn()
  syncFontSize()
}
function onZoomOut() {
  editorRef.value?.zoomOut()
  syncFontSize()
}
function onResetFont() {
  editorRef.value?.resetFontSize()
  syncFontSize()
}

// ---- 复制闪现 ----
const flashText = ref('')
let flashTimer: ReturnType<typeof setTimeout> | null = null
function onCopyWechat() {
  emit('copyWechat')
  flashText.value = '已复制到公众号'
  if (flashTimer) clearTimeout(flashTimer)
  flashTimer = setTimeout(() => (flashText.value = ''), 1600)
}

// ---- 滚动同步：基于标题锚点的分块对齐 ----
const editorHeadings = computed(() => parseEditorHeadings(props.modelValue))
const SYNC_EPS = 2

// 编辑模式目录高亮：根据编辑器顶部行号推算当前章节文本
const editorActiveText = ref('')
function updateEditorActiveText(topLine: number) {
  const heads = editorHeadings.value
  let text = ''
  for (const h of heads) {
    if (h.line <= topLine) text = h.text
    else break
  }
  editorActiveText.value = text
}

function onEditorScroll(topLine: number) {
  updateEditorActiveText(topLine)
  const preview = previewRef.value
  if (!preview) return
  const metrics = preview.getScrollMetrics()
  if (metrics.clientHeight <= 0) return
  const maxScroll = Math.max(0, metrics.scrollHeight - metrics.clientHeight)
  const totalLines = editorRef.value?.getLineCount() ?? props.modelValue.split('\n').length
  const target = editorToPreviewTop(
    topLine,
    editorHeadings.value,
    preview.getHeadingTops(),
    maxScroll,
    totalLines,
  )
  if (Math.abs(metrics.scrollTop - target) <= SYNC_EPS) return
  preview.scrollToTop(target)
}

function onPreviewScroll(scrollTop: number) {
  const editor = editorRef.value
  const preview = previewRef.value
  if (!editor || !preview) return
  const totalLines = editor.getLineCount()
  if (totalLines <= 0) return
  const metrics = preview.getScrollMetrics()
  const maxScroll = Math.max(0, metrics.scrollHeight - metrics.clientHeight)
  const targetLine = previewToEditorLine(
    scrollTop,
    preview.getHeadingTops(),
    editorHeadings.value,
    maxScroll,
    totalLines,
  )
  if (Math.abs(editor.getTopLine() - targetLine) <= 1) return
  editor.scrollToLine(targetLine)
}

// 进入分栏/预览时，让预览跟上编辑器当前位置
watch(
  () => props.viewMode,
  (mode) => {
    if (mode === 'editor') return
    nextTick(() => {
      const editor = editorRef.value
      if (editor) onEditorScroll(editor.getTopLine())
    })
  },
)

function onToggleToc() {
  showToc.value = !showToc.value
  // 编辑模式下打开目录时，立即按当前编辑器位置高亮当前章节
  if (showToc.value && props.viewMode === 'editor') {
    updateEditorActiveText(editorRef.value?.getTopLine() ?? 0)
  }
}

// 目录浮层提升到内容区级别：编辑/分栏/预览下均可用
const showToc = ref(false)
// 预览滚动容器与内容容器（供目录浮层做高亮跟踪），随组件挂载自动可用
const previewScrollEl = computed(() => previewRef.value?.getScrollContainer() ?? null)
const previewContentEl = computed(() => previewRef.value?.getContainer() ?? null)

// 目录导航：按视图模式分流到预览或编辑器
function onTocNavigate(item: TocItem) {
  const previewVisible = props.viewMode === 'preview' || props.viewMode === 'split'
  if (previewVisible) {
    previewRef.value?.scrollToHeading(item.id)
  } else {
    editorRef.value?.scrollToHeading(item.text)
  }
}

// 点击目录浮层以外区域自动收起
function onContentBodyClick(e: MouseEvent) {
  if (!showToc.value) return
  const target = e.target as HTMLElement | null
  if (target && target.closest('.preview-toc')) return
  showToc.value = false
}
</script>

<template>
  <section class="content-area">
    <ContentHeader
      :file-name="fileName"
      :saved="saved"
      :view-mode="viewMode"
      :is-external="isExternal"
      @set-view-mode="emit('setViewMode', $event)"
      @copy-wechat="onCopyWechat"
      @copy-html="emit('copyHtml')"
      @reveal-in-finder="emit('revealInFinder')"
      @toggle-toc="onToggleToc"
    />

    <div v-if="hasActiveFile" class="content-body" ref="bodyRef" :style="{ gridTemplateColumns: bodyColumns }" @click="onContentBodyClick">
      <div v-show="viewMode !== 'preview'" class="pane pane-editor">
        <MarkdownEditor
          ref="editorRef"
          :model-value="modelValue"
          :file-name="fileName"
          :saved="saved"
          :is-external="isExternal"
          :external-file-path="externalFilePath"
          :is-dark="isDark"
          @update:model-value="emit('update:modelValue', $event)"
          @save="emit('save')"
          @scroll-sync="onEditorScroll"
          @cursor="onCursor"
          @reveal-in-finder="emit('revealInFinder')"
        />
      </div>

      <div
        v-show="viewMode === 'split'"
        class="pane-divider"
        :class="{ 'pane-divider--dragging': isDraggingDivider }"
        @mousedown="onDividerMouseDown"
      ></div>

      <div v-show="viewMode !== 'editor'" class="pane pane-preview">
        <PreviewPanel ref="previewRef" :html="renderedHtml" @scroll-sync="onPreviewScroll" />
      </div>

      <PreviewToc
        :html="renderedHtml"
        :container="previewContentEl"
        :scroll-container="previewScrollEl"
        :visible="showToc"
        :active-text="props.viewMode === 'editor' ? editorActiveText : undefined"
        @navigate="onTocNavigate"
      />
    </div>

    <div v-else class="content-placeholder">
      <div class="placeholder-card">
        <h3>打开或新建文章</h3>
        <p>在左侧工作空间选择一个文件，或点击新建按钮开始编辑。</p>
        <button class="btn-primary" @click="emit('openWorkspaceFolder')">选择工作空间</button>
      </div>
    </div>

    <EditorStatusbar
      :saved="saved"
      :words="wordCount"
      :lines="lineCount"
      :cursor-line="cursorLine"
      :cursor-col="cursorCol"
      :font-size="fontSize"
      :flash="flashText"
      @zoom-in="onZoomIn"
      @zoom-out="onZoomOut"
      @reset-font="onResetFont"
    />
  </section>
</template>

<style scoped>
.content-area {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: var(--border-width) solid var(--glass-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.content-body {
  flex: 1;
  min-height: 0;
  display: grid;
  gap: 0;
  position: relative;
}

.pane {
  min-height: 0;
  min-width: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.pane-editor {
  background: var(--bg-primary);
}

.pane-preview {
  background: var(--bg-secondary);
}

.pane-divider {
  width: 6px;
  cursor: col-resize;
  position: relative;
  z-index: 2;
  flex-shrink: 0;
}

.pane-divider::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--border-light);
  transform: translateX(-50%);
}

.pane-divider:hover::after,
.pane-divider--dragging::after {
  background: var(--accent-primary, #07c160);
  opacity: 0.8;
}

.content-placeholder {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--bg-secondary);
}

.placeholder-card {
  background: var(--bg-primary);
  border-radius: var(--radius-lg);
  padding: 28px 40px;
  text-align: center;
  max-width: 540px;
  box-shadow: var(--shadow-md);
  border: 1px solid var(--border-light);
}

.placeholder-card h3 {
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 8px;
  color: var(--text-primary);
}

.placeholder-card p {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 16px;
  line-height: 1.6;
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 24px;
  background: var(--accent-gradient) !important;
  color: #ffffff !important;
  border: none;
  border-radius: var(--radius-pill);
  font-size: 14px;
  font-weight: 600;
  box-shadow: var(--shadow-md);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
}

.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-lg);
}
</style>
