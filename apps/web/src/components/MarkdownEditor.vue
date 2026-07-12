<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import MarkdownToolbar from './MarkdownToolbar.vue'

const props = defineProps<{
  modelValue: string
  fileName?: string
  saved?: boolean
  syncScrollPercent?: number | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  save: []
  'scroll-sync': [percent: number]
}>()

const textareaRef = ref<HTMLTextAreaElement>()
const isProgrammaticScroll = ref(false)

function getScrollPercent(): number {
  const el = textareaRef.value
  if (!el) return 0
  const maxScroll = el.scrollHeight - el.clientHeight
  if (maxScroll <= 0) return 0
  return el.scrollTop / maxScroll
}

function onEditorScroll() {
  if (isProgrammaticScroll.value) {
    isProgrammaticScroll.value = false
    return
  }
  emit('scroll-sync', getScrollPercent())
}

watch(
  () => props.syncScrollPercent,
  (percent) => {
    if (percent == null) return
    const el = textareaRef.value
    if (!el) return
    const maxScroll = el.scrollHeight - el.clientHeight
    if (maxScroll <= 0) return
    isProgrammaticScroll.value = true
    el.scrollTop = maxScroll * percent
  },
)

onMounted(() => {
  textareaRef.value?.addEventListener('scroll', onEditorScroll)
})

onBeforeUnmount(() => {
  textareaRef.value?.removeEventListener('scroll', onEditorScroll)
})

const content = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const lineCount = computed(() => {
  if (!content.value) return 0
  return content.value.split('\n').length
})

const wordCount = computed(() => {
  const text = content.value.trim()
  if (!text) return 0
  const cn = (text.match(/[\u4e00-\u9fa5]/g) || []).length
  const en = (text.match(/[a-zA-Z0-9_]+/g) || []).length
  return cn + en
})

const saveStatusText = computed(() => {
  if (props.saved === undefined) return '就绪'
  return props.saved ? '已保存' : '未保存'
})

function insertSnippet(before: string, after: string = '', placeholder = '') {
  const el = textareaRef.value
  if (!el) return
  const start = el.selectionStart ?? 0
  const end = el.selectionEnd ?? 0
  const selected = content.value.slice(start, end) || placeholder
  const replacement = `${before}${selected}${after}`
  const newContent = content.value.slice(0, start) + replacement + content.value.slice(end)
  emit('update:modelValue', newContent)
  requestAnimationFrame(() => {
    el.focus()
    const caret = start + before.length
    el.setSelectionRange(caret, caret + selected.length)
  })
}

function onKeydown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === 's') {
    e.preventDefault()
    emit('save')
  }
}
</script>

<template>
  <div class="markdown-editor">
    <div class="editor-header">
      <span class="editor-title">Markdown 编辑器</span>
      <span v-if="fileName" class="editor-filename">{{ fileName }}</span>
    </div>

    <MarkdownToolbar
      @bold="insertSnippet('**', '**')"
      @italic="insertSnippet('*', '*')"
      @underline="insertSnippet('<u>', '</u>')"
      @strikethrough="insertSnippet('~~', '~~')"
      @heading="insertSnippet('## ', '')"
      @unordered-list="insertSnippet('- ', '')"
      @ordered-list="insertSnippet('1. ', '')"
      @code="insertSnippet('`', '`')"
      @quote="insertSnippet('> ', '')"
      @link="insertSnippet('[', '](url)')"
      @image="insertSnippet('![', '](url)')"
      @table="insertSnippet('\n|  |  |\n|---|---|\n|  |  |\n', '')"
      @help="() => {}"
    />

    <div class="editor-body-wrapper">
      <textarea
        ref="textareaRef"
        v-model="content"
        placeholder="开始编写 Markdown..."
        @keydown="onKeydown"
      />
    </div>

    <div class="editor-footer">
      <div class="editor-stats">
        <span class="editor-stat">行数: {{ lineCount }}</span>
        <span class="editor-stat">字数: {{ wordCount }}</span>
      </div>
      <div class="save-indicator" :class="saved ? 'saved' : 'unsaved'">
        {{ saveStatusText }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.markdown-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-primary);
  border-radius: 0;
  overflow: hidden;
}

.editor-header {
  padding: 16px 24px;
  border-bottom: 1px solid var(--border-light);
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.editor-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 1px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.editor-title::before {
  content: "";
  display: block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent-primary);
  box-shadow: 0 0 0 2px rgba(7, 193, 96, 0.2);
}

.editor-filename {
  font-size: 12px;
  color: var(--text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 220px;
}

.editor-body-wrapper {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.editor-body-wrapper textarea {
  width: 100%;
  height: 100%;
  border: none;
  resize: none;
  padding: 24px 32px;
  font-family: var(--font-mono);
  font-size: 14px;
  line-height: 1.75;
  outline: none;
  background: var(--bg-primary);
  color: var(--text-primary);
  -webkit-text-fill-color: var(--text-primary);
  caret-color: var(--text-primary);
}

.editor-body-wrapper textarea::placeholder {
  color: var(--text-tertiary);
}

.editor-footer {
  padding: 8px 24px;
  border-top: 1px solid var(--border-light);
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.editor-stats {
  display: flex;
  align-items: center;
  gap: 16px;
}

.editor-stat {
  font-size: 11px;
  color: var(--text-secondary);
  font-weight: 500;
  letter-spacing: 0.3px;
}

.save-indicator {
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.3px;
  padding: 4px 10px;
  border-radius: var(--radius-pill);
  transition: all 0.2s ease;
}

.save-indicator.saved {
  color: var(--text-tertiary);
}

.save-indicator.unsaved {
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.1);
}
</style>
