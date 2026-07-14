<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { minimalSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { markdown } from '@codemirror/lang-markdown'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import MarkdownToolbar from './MarkdownToolbar.vue'
import SearchPanel from './SearchPanel.vue'

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

const editorContainer = ref<HTMLDivElement>()
const viewRef = ref<EditorView | null>(null)
const isProgrammaticScroll = ref(false)
const showSearch = ref(false)
const currentView = computed(() => viewRef.value as EditorView | null)

function getScrollPercent(): number {
  const view = viewRef.value
  if (!view) return 0
  const s = view.scrollDOM
  const max = s.scrollHeight - s.clientHeight
  return max <= 0 ? 0 : s.scrollTop / max
}

// Toolbar insert — operates on CodeMirror's selection
function insertSnippet(before: string, after = '', placeholder = '') {
  const view = viewRef.value
  if (!view) return
  const { from, to } = view.state.selection.main
  const selected = view.state.doc.sliceString(from, to)
  const text = selected || placeholder
  const full = before + text + after
  view.dispatch({
    changes: { from, to, insert: full },
    selection: {
      anchor: from + before.length,
      head: from + before.length + text.length,
    },
  })
  view.focus()
}

// Sync external modelValue → CodeMirror (skip when CM already has the same content)
watch(
  () => props.modelValue,
  (val) => {
    const view = viewRef.value
    if (!view) return
    if (view.state.doc.toString() === val) return
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: val },
    })
  },
)

// Sync scroll position from preview
watch(
  () => props.syncScrollPercent,
  (percent) => {
    const view = viewRef.value
    if (!view || percent == null) return
    const s = view.scrollDOM
    const max = s.scrollHeight - s.clientHeight
    if (max <= 0) return
    isProgrammaticScroll.value = true
    s.scrollTo({ top: max * percent })
  },
)

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

const saveStatusText = computed(() => {
  if (props.saved === undefined) return '就绪'
  return props.saved ? '已保存' : '未保存'
})

onMounted(() => {
  if (!editorContainer.value) return

  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
      e.preventDefault()
      showSearch.value = true
    }
  }
  window.addEventListener('keydown', handleKeyDown)

  const saveKeymap = keymap.of([
    {
      key: 'Mod-s',
      run: () => {
        emit('save')
        return true
      },
    },
  ])

  const headingHighlight = HighlightStyle.define([
    { tag: tags.heading, textDecoration: 'none', fontWeight: 'bold' },
  ])

  const state = EditorState.create({
    doc: props.modelValue,
    extensions: [
      minimalSetup,
      saveKeymap,
      markdown(),
      syntaxHighlighting(headingHighlight),
      EditorView.lineWrapping,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          emit('update:modelValue', update.state.doc.toString())
        }
      }),
      EditorView.theme({
        '&': { height: '100%' },
        '&.cm-focused': { outline: 'none' },
        '.cm-scroller': {
          fontFamily: 'var(--font-mono)',
          fontSize: '14px',
          lineHeight: '1.75',
        },
        '.cm-content': {
          padding: '2px 20px',
        },
        '.cm-gutters': {
          background: 'transparent',
          border: 'none',
          color: 'var(--text-tertiary)',
          paddingRight: '8px',
        },
        '.cm-activeLineGutter': {
          background: 'transparent',
        },
        '.cm-activeLine': {
          background: '#e6f5eb',
        },
        '.cm-cursor': {
          borderLeftColor: 'var(--text-primary)',
        },
        '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
          backgroundColor: '#b3e5cc !important',
        },
        '.cm-selectionMatch': {
          backgroundColor: '#d4f0e0',
        },
      }),
    ],
  })

  const view = new EditorView({
    state,
    parent: editorContainer.value,
  })

  // Scroll sync
  const handleScroll = () => {
    if (isProgrammaticScroll.value) {
      isProgrammaticScroll.value = false
      return
    }
    emit('scroll-sync', getScrollPercent())
  }
  view.scrollDOM.addEventListener('scroll', handleScroll, { passive: true })

  viewRef.value = view

  onBeforeUnmount(() => {
    window.removeEventListener('keydown', handleKeyDown)
    view.scrollDOM.removeEventListener('scroll', handleScroll)
    view.destroy()
    viewRef.value = null
  })
})
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
      @search="showSearch = true"
      @help="() => {}"
    />

    <SearchPanel v-if="showSearch && currentView" :view="currentView" @close="showSearch = false" />

    <div class="editor-body-wrapper">
      <div ref="editorContainer" class="cm-container" />
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
  height: 56px;
  box-sizing: border-box;
  padding: 0 24px;
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
  content: '';
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
  min-height: 0;
}

.cm-container {
  height: 100%;
}

/* CodeMirror overrides via deep selectors — these target elements inside .cm-container
   that are rendered by CodeMirror and are not scoped by Vue's scoped styles */
.cm-container :deep(.cm-editor) {
  height: 100%;
  background: var(--bg-primary);
}

.cm-container :deep(.cm-editor .cm-scroller) {
  overflow: auto;
}

.cm-container :deep(.cm-editor .cm-content) {
  color: var(--text-primary);
}

.cm-container :deep(.cm-editor .cm-placeholder) {
  color: var(--text-tertiary);
}

.cm-container :deep(.cm-editor .cm-gutter) {
  background: transparent;
}

.editor-footer {
  height: 45px;
  box-sizing: border-box;
  padding: 0 24px;
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
