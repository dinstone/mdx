<script setup lang="ts">
import { computed } from 'vue'
import { useEditorStore } from '../stores/editor'

const props = defineProps<{
  saved?: boolean
  words: number
  lines: number
  cursorLine: number
  cursorCol: number
  fontSize: number
  flash?: string
}>()

const emit = defineEmits<{
  zoomIn: []
  zoomOut: []
  resetFont: []
}>()

const editor = useEditorStore()
/** 主题取自当前打开文档自身的设置；无文档 / 文档未设置 → “默认主题”。 */
const themeName = computed(() => editor.documentThemeName)
const themeTitle = computed(() =>
  editor.filePath ? `当前文档主题：${themeName.value}` : '未打开文档',
)
</script>

<template>
  <div class="editor-statusbar">
    <div class="sb-group">
      <span
        class="sb-save"
        :class="saved ? 'saved' : 'dirty'"
        :title="saved ? '已保存' : '未保存'"
      ></span>
      <b class="sb-save-text">{{ flash || (saved ? '已保存' : '未保存') }}</b>
      <span class="sb-sep"></span>
      <span class="sb-item">字数 <b>{{ words }}</b></span>
      <span class="sb-item">行 <b>{{ lines }}</b></span>
      <span class="sb-item">Ln {{ cursorLine }} · Col {{ cursorCol }}</span>
      <span class="sb-sep"></span>
      <div class="sb-font">
        <button class="sb-font-btn" title="缩小 (⌘-)" @click="emit('zoomOut')">A−</button>
        <span class="sb-font-val" title="重置 (⌘0)" @click="emit('resetFont')">{{ fontSize }}px</span>
        <button class="sb-font-btn" title="放大 (⌘+)" @click="emit('zoomIn')">A+</button>
      </div>
    </div>

    <div class="sb-group sb-right">
      <span class="sb-item">Markdown</span>
      <span class="sb-sep"></span>
      <span class="sb-item">UTF-8</span>
      <span class="sb-sep"></span>
      <span class="sb-item">自动换行</span>
      <span class="sb-sep"></span>
      <span class="sb-item" :title="themeTitle">主题：{{ themeName }}</span>
    </div>
  </div>
</template>

<style scoped>
.editor-statusbar {
  height: 30px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px;
  background: var(--bg-secondary);
  border-top: var(--border-width) solid var(--border-light);
  user-select: none;
}

.sb-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.sb-item {
  font-size: 12px;
  color: var(--text-tertiary);
  font-weight: 500;
  white-space: nowrap;
}

.sb-item b {
  color: var(--text-secondary);
  font-weight: 600;
}

.sb-sep {
  width: 1px;
  height: 14px;
  background: var(--border-light);
}

.sb-save {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex: none;
}

.sb-save.saved {
  background: var(--accent-primary);
}

.sb-save.dirty {
  background: #f59e0b;
}

.sb-save-text {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
}

.sb-font {
  display: flex;
  align-items: center;
  gap: 2px;
}

.sb-font-btn {
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-tertiary);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.sb-font-btn:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}

.sb-font-val {
  font-size: 11px;
  color: var(--text-secondary);
  font-weight: 600;
  min-width: 34px;
  text-align: center;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: var(--radius-sm);
  transition: all 0.15s ease;
}

.sb-font-val:hover {
  color: var(--accent-primary);
  background: var(--bg-hover);
}
</style>
