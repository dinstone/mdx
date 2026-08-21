<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { minimalSetup } from 'codemirror'
import { EditorState, Compartment } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { markdown } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { customKeymap } from './editorShortcuts'
import { imageDropPaste } from '../editor/imageDropPaste'
import { processImages } from '../services/imagePipeline'
import { getAttachmentStorage } from '../services/attachmentStorage'
import { useToast } from '../composables/useToast'
import MarkdownToolbar from './MarkdownToolbar.vue'
import SearchPanel from './SearchPanel.vue'
import {
  markdownLightHighlighting,
  markdownDarkHighlighting,
} from '../editor/markdownTheme'

const props = defineProps<{
  modelValue: string
  fileName?: string
  saved?: boolean
  isExternal?: boolean
  externalFilePath?: string
  isDark?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  save: []
  'scroll-sync': [topLine: number]
  'reveal-in-finder': []
  cursor: [line: number, col: number]
}>()

const editorContainer = ref<HTMLDivElement>()
const viewRef = ref<EditorView | null>(null)
const isProgrammaticScroll = ref(false)
const showSearch = ref(false)
const highlightCompartment = new Compartment()
const currentView = computed(() => viewRef.value as EditorView | null)
const toast = useToast()

// -- 字体大小调节 --
const FONT_SIZE_KEY = 'mdx-editor-font-size'
const FONT_MIN = 10
const FONT_MAX = 28

function readFontSize(): number {
  try {
    const v = localStorage.getItem(FONT_SIZE_KEY)
    if (v) {
      const n = parseInt(v, 10)
      if (!isNaN(n) && n >= FONT_MIN && n <= FONT_MAX) return n
    }
  } catch { /* ignore */ }
  return 16
}

const fontSize = ref(readFontSize())

function persistFontSize(v: number) {
  fontSize.value = v
  try { localStorage.setItem(FONT_SIZE_KEY, String(v)) } catch { /* ignore */ }
}

function zoomIn() {
  if (fontSize.value < FONT_MAX) persistFontSize(fontSize.value + 1)
}

function zoomOut() {
  if (fontSize.value > FONT_MIN) persistFontSize(fontSize.value - 1)
}

function resetFontSize() {
  persistFontSize(16)
}

/** 当前视口顶部对应的源码行号（0-based）。供滚动同步使用。 */
function getTopLine(): number {
  const view = viewRef.value
  if (!view) return 0
  const block = view.lineBlockAtHeight(view.scrollDOM.scrollTop)
  return view.state.doc.lineAt(block.from).number - 1
}

/** 编辑器总行数。 */
function getLineCount(): number {
  const view = viewRef.value
  return view ? view.state.doc.lines : 0
}

/** 滚动让指定行（0-based）到视口顶部。供滚动同步使用。 */
function scrollToLine(line: number) {
  const view = viewRef.value
  if (!view) return
  const clamped = Math.max(0, Math.min(line, view.state.doc.lines - 1))
  const block = view.lineBlockAt(view.state.doc.line(clamped + 1).from)
  isProgrammaticScroll.value = true
  view.scrollDOM.scrollTo({ top: Math.max(0, block.top) })
}

/** 按标题文本滚动编辑器到对应行（供目录在编辑模式导航）。 */
function scrollToHeading(text: string) {
  const view = viewRef.value
  if (!view || !text) return
  const doc = view.state.doc
  const target = text.trim()
  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i)
    const m = line.text.match(/^#{1,6}\s+(.+?)\s*$/)
    if (!m) continue
    const plain = m[1]
      .replace(/[*_`~]/g, '')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .trim()
    if (!plain) continue
    if (plain === target || plain.includes(target) || target.includes(plain)) {
      scrollToLine(i - 1)
      view.dispatch({ selection: { anchor: line.from } })
      view.focus()
      return
    }
  }
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

// Reconfigure markdown syntax highlighting when the UI theme changes.
watch(
  () => props.isDark,
  (isDark) => {
    const view = viewRef.value
    if (!view) return
    view.dispatch({
      effects: highlightCompartment.reconfigure(
        isDark ? markdownDarkHighlighting : markdownLightHighlighting,
      ),
    })
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

/** 工具栏图片上传 */
async function onImageUpload(files: File[]) {
  if (!viewRef.value) return
  const view = viewRef.value
  try {
    const entries = await processImages(files)
    const pos = view.state.selection.main.from
    let markdown = ''
    for (const entry of entries) {
      const altText = files.find((f) => f.name)?.name?.replace(/\.[^.]+$/, '') || entry.hash
      markdown += `![${altText}](img://${entry.hash})\n`
    }
    view.dispatch({
      changes: { from: pos, insert: markdown },
      selection: { anchor: pos + markdown.length },
    })
    toast.success(`已插入 ${entries.length} 张图片`)
  } catch (e: any) {
    toast.error(`图片处理失败: ${e?.message || '未知错误'}`)
  }
}

/** 工具栏附件上传：保存到附件存储，并在光标处插入 [文件名](att://<hash8>.<ext>) 链接 */
async function onAttachmentUpload(files: File[]) {
  if (!viewRef.value) return
  const view = viewRef.value
  try {
    const storage = await getAttachmentStorage()
    const pos = view.state.selection.main.from
    let markdown = ''
    for (const file of files) {
      const key = await storage.save(file, file.name)
      markdown += `[${file.name}](att://${key})\n`
    }
    view.dispatch({
      changes: { from: pos, insert: markdown },
      selection: { anchor: pos + markdown.length },
    })
    toast.success(`已上传 ${files.length} 个附件`)
  } catch (e: any) {
    toast.error(`附件上传失败: ${e?.message || '未知错误'}`)
  }
}

onMounted(() => {
  if (!editorContainer.value) return

  const handleKeyDown = (e: KeyboardEvent) => {
    const mod = e.metaKey || e.ctrlKey
    if (mod && e.key === 'f') {
      e.preventDefault()
      showSearch.value = true
    }
    // 字体缩放：Cmd/Ctrl + = (放大)  /  Cmd/Ctrl + - (缩小)  /  Cmd/Ctrl + 0 (重置)
    if (mod && (e.key === '=' || e.key === '+')) {
      e.preventDefault()
      zoomIn()
    }
    if (mod && e.key === '-') {
      e.preventDefault()
      zoomOut()
    }
    if (mod && e.key === '0') {
      e.preventDefault()
      resetFontSize()
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

  const state = EditorState.create({
    doc: props.modelValue,
    extensions: [
      minimalSetup,
      customKeymap,
      saveKeymap,
      markdown({ codeLanguages: languages }),
      highlightCompartment.of(props.isDark ? markdownDarkHighlighting : markdownLightHighlighting),
      imageDropPaste(),
      EditorView.lineWrapping,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          emit('update:modelValue', update.state.doc.toString())
        }
        if (update.selectionSet || update.docChanged) {
          const head = update.state.selection.main.head
          const line = update.state.doc.lineAt(head)
          emit('cursor', line.number, head - line.from + 1)
        }
      }),
      EditorView.theme({
        '&': { height: '100%' },
        '&.cm-focused': { outline: 'none' },
        '.cm-scroller': {
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--editor-font-size)',
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
          background: 'var(--ui-active-line-bg)',
        },
        '.cm-cursor': {
          borderLeftColor: 'var(--text-primary)',
        },
        '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
          backgroundColor: 'var(--ui-selection-bg) !important',
        },
        '.cm-selectionMatch': {
          backgroundColor: 'var(--ui-selection-match-bg)',
        },
      }),
    ],
  })

  const view = new EditorView({
    state,
    parent: editorContainer.value,
  })

  // Scroll sync — emit the top visible line so App.vue can align the preview
  const handleScroll = () => {
    if (isProgrammaticScroll.value) {
      isProgrammaticScroll.value = false
      return
    }
    emit('scroll-sync', getTopLine())
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

defineExpose({
  getTopLine,
  getLineCount,
  scrollToLine,
  scrollToHeading,
  zoomIn,
  zoomOut,
  resetFontSize,
  getFontSize: () => fontSize.value,
})
</script>

<template>
  <div class="markdown-editor" :style="{ '--editor-font-size': fontSize + 'px' }">
    <MarkdownToolbar
      @bold="insertSnippet('**', '**')"
      @italic="insertSnippet('*', '*')"
      @underline="insertSnippet('<u>', '</u>')"
      @strikethrough="insertSnippet('~~', '~~')"
      @heading="(level: number) => insertSnippet('#'.repeat(level) + ' ', '')"
      @unordered-list="insertSnippet('- ', '')"
      @ordered-list="insertSnippet('1. ', '')"
      @code="insertSnippet('`', '`')"
      @quote="insertSnippet('> ', '')"
      @link="insertSnippet('[', '](url)')"
      @image-upload="onImageUpload"
      @attachment-upload="onAttachmentUpload"
      @table="insertSnippet('\n|  |  |\n|---|---|\n|  |  |\n', '')"
      @search="showSearch = true"
    />

    <SearchPanel v-if="showSearch && currentView" :view="currentView" @close="showSearch = false" />

    <div class="editor-body-wrapper">
      <div ref="editorContainer" class="cm-container" />
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

</style>
