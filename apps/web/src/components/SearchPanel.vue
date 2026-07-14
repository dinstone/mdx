<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { EditorView } from '@codemirror/view'
import { Compartment, EditorSelection, StateEffect } from '@codemirror/state'
import { findMatches } from '../utils/findMatches'

interface Props {
  view: EditorView
}

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
}>()

interface Match {
  from: number
  to: number
}

const searchText = ref('')
const replaceText = ref('')
const caseSensitive = ref(false)
const useRegexp = ref(false)
const matches = ref<Match[]>([])
const currentIndex = ref(0)
const showReplace = ref(false)
const searchInputRef = ref<HTMLInputElement>()

const searchCompartment = new Compartment()
let searchTimer: ReturnType<typeof setTimeout> | null = null
let skipNextDocChange = false
let lastSearchedText = ''

// 聚焦搜索输入框
onMounted(() => {
  searchInputRef.value?.focus()

  // 注入文档变化监听器，便于文档变化时刷新匹配
  const listener = EditorView.updateListener.of((update) => {
    if (update.docChanged) {
      onDocChange()
    }
  })
  props.view.dispatch({
    effects: StateEffect.appendConfig.of(searchCompartment.of(listener)),
  })
})

onUnmounted(() => {
  if (searchTimer) clearTimeout(searchTimer)
  try {
    props.view.dispatch({ effects: searchCompartment.reconfigure([]) })
  } catch {
    // view 可能已被销毁
  }
})

function onDocChange() {
  if (skipNextDocChange) {
    skipNextDocChange = false
    return
  }
  if (!searchText.value) return
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    refreshMatches(props.view.state.selection.main.from)
  }, 200)
}

function refreshMatches(preservePosition?: number) {
  if (!searchText.value) {
    matches.value = []
    currentIndex.value = 0
    return
  }
  const doc = props.view.state.doc.toString()
  const found = findMatches(doc, searchText.value, caseSensitive.value, useRegexp.value)
  matches.value = found

  if (found.length === 0) {
    currentIndex.value = 0
    return
  }

  if (preservePosition !== undefined) {
    let idx = found.findIndex((m) => m.from >= preservePosition)
    if (idx === -1) idx = 0
    currentIndex.value = idx
  }
}

function doSearch() {
  if (!searchText.value) {
    matches.value = []
    currentIndex.value = 0
    lastSearchedText = ''
    return
  }

  const doc = props.view.state.doc.toString()
  const found = findMatches(doc, searchText.value, caseSensitive.value, useRegexp.value)
  matches.value = found
  lastSearchedText = searchText.value

  if (found.length === 0) {
    currentIndex.value = 0
    return
  }

  const cursor = props.view.state.selection.main.from
  let idx = found.findIndex((m) => m.from >= cursor)
  if (idx === -1) idx = 0
  currentIndex.value = idx

  props.view.dispatch({
    selection: EditorSelection.single(found[idx].from, found[idx].to),
    scrollIntoView: true,
  })
}

// 切换选项后重新搜索
watch([caseSensitive, useRegexp], () => {
  if (searchText.value) doSearch()
})

// 当前匹配项变化时滚动到视图
watch(currentIndex, () => {
  if (matches.value.length > 0) {
    const clamped = Math.min(currentIndex.value, matches.value.length - 1)
    if (clamped !== currentIndex.value) {
      currentIndex.value = clamped
      return
    }
    const match = matches.value[clamped]
    props.view.dispatch({
      selection: EditorSelection.single(match.from, match.to),
      scrollIntoView: true,
    })
  }
})

function handleFindNext() {
  if (matches.value.length === 0) return
  currentIndex.value = (currentIndex.value + 1) % matches.value.length
}

function handleFindPrevious() {
  if (matches.value.length === 0) return
  currentIndex.value = (currentIndex.value - 1 + matches.value.length) % matches.value.length
}

function handleReplace() {
  if (matches.value.length === 0 || currentIndex.value < 0 || currentIndex.value >= matches.value.length) return
  const match = matches.value[currentIndex.value]
  const positionAfterReplace = match.from

  skipNextDocChange = true
  props.view.dispatch({
    changes: { from: match.from, to: match.to, insert: replaceText.value },
  })

  if (searchTimer) clearTimeout(searchTimer)
  setTimeout(() => {
    refreshMatches(positionAfterReplace)
  }, 0)
}

function handleReplaceAll() {
  if (matches.value.length === 0) return

  const changes = [...matches.value].reverse().map((match) => ({
    from: match.from,
    to: match.to,
    insert: replaceText.value,
  }))

  skipNextDocChange = true
  props.view.dispatch({ changes })

  if (searchTimer) clearTimeout(searchTimer)
  setTimeout(() => {
    doSearch()
  }, 0)
}

function handleClose() {
  emit('close')
  props.view.focus()
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    handleClose()
  } else if (e.key === 'Enter') {
    e.preventDefault()
    if (searchTimer) clearTimeout(searchTimer)
    if (searchText.value && searchText.value !== lastSearchedText) {
      doSearch()
      return
    }
    if (e.shiftKey) {
      handleFindPrevious()
    } else {
      handleFindNext()
    }
  }
}

function handleInputChange(e: Event) {
  const value = (e.target as HTMLInputElement).value
  searchText.value = value
  matches.value = []
  currentIndex.value = 0

  if (searchTimer) clearTimeout(searchTimer)
  if (!value) {
    lastSearchedText = ''
    return
  }
  searchTimer = setTimeout(() => {
    doSearch()
  }, 150)
}

function matchCountText() {
  if (!searchText.value) return ''
  if (searchText.value !== lastSearchedText) return ''
  if (matches.value.length === 0) return '无匹配'
  return `${Math.min(currentIndex.value, matches.value.length - 1) + 1}/${matches.value.length}`
}
</script>

<template>
  <div class="search-panel" @keydown="handleKeyDown">
    <div class="search-row">
      <div class="search-input-wrapper">
        <input
          ref="searchInputRef"
          type="text"
          class="search-input"
          placeholder="查找..."
          :value="searchText"
          @input="handleInputChange"
        />
        <span v-if="searchText" class="match-count">{{ matchCountText() }}</span>
      </div>

      <div class="search-buttons">
        <button
          class="search-option-btn"
          :class="{ active: caseSensitive }"
          title="区分大小写"
          @click="caseSensitive = !caseSensitive"
        >
          Aa
        </button>
        <button
          class="search-option-btn"
          :class="{ active: useRegexp }"
          title="使用正则表达式"
          @click="useRegexp = !useRegexp"
        >
          .*
        </button>
        <div class="search-divider" />
        <button class="search-nav-btn" title="上一个 (Shift+Enter)" @click="handleFindPrevious">↑</button>
        <button class="search-nav-btn" title="下一个 (Enter)" @click="handleFindNext">↓</button>
        <div class="search-divider" />
        <button
          class="search-option-btn"
          :class="{ active: showReplace }"
          title="显示替换"
          @click="showReplace = !showReplace"
        >
          ⇅
        </button>
        <button class="search-close-btn" title="关闭 (Esc)" @click="handleClose">×</button>
      </div>
    </div>

    <div v-if="showReplace" class="replace-row">
      <input
        v-model="replaceText"
        type="text"
        class="search-input replace-input"
        placeholder="替换为..."
      />
      <div class="search-buttons">
        <button class="replace-btn" :disabled="matches.length === 0" @click="handleReplace">替换</button>
        <button class="replace-btn" :disabled="matches.length === 0" @click="handleReplaceAll">全部替换</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.search-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 16px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-light);
  animation: slideDown 0.15s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.search-row,
.replace-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.search-input-wrapper {
  position: relative;
  flex: 1;
}

.search-input {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 12px;
  padding-right: 80px;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  font-size: 13px;
  background: var(--bg-primary);
  color: var(--text-primary);
  transition: all 0.2s;
}

.search-input:focus {
  outline: none;
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 2px rgba(7, 193, 96, 0.15);
}

.search-input::placeholder {
  color: var(--text-tertiary);
}

.match-count {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 11px;
  color: var(--text-tertiary);
  pointer-events: none;
}

.search-buttons {
  display: flex;
  align-items: center;
  gap: 4px;
}

.search-divider {
  width: 1px;
  height: 20px;
  background: var(--border-light);
  margin: 0 4px;
}

.search-option-btn,
.search-nav-btn,
.search-close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s;
  font-size: 13px;
  font-weight: 500;
  line-height: 1;
}

.search-option-btn:hover,
.search-nav-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.search-option-btn.active {
  background: var(--accent-primary);
  color: white;
}

.search-close-btn:hover {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.replace-btn {
  padding: 6px 12px;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  background: var(--bg-primary);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.replace-btn:hover:not(:disabled) {
  background: var(--bg-hover);
  border-color: var(--accent-primary);
  color: var(--accent-primary);
}

.replace-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.replace-row .search-input {
  padding-right: 12px;
}
</style>
