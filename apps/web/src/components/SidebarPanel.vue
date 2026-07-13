<script setup lang="ts">
import { ref, computed } from 'vue'
import type { FileEntry } from '../bridge'
import FileTree from './FileTree.vue'

const props = defineProps<{
  title: string
  rootPath?: string
  entries: FileEntry[]
  activePath?: string
  workspaceOpen?: boolean
}>()

const emit = defineEmits<{
  select: [path: string]
  refresh: []
  createFile: [dirPath: string]
  createFolder: [dirPath: string]
  selectWorkspace: []
  rename: [path: string]
  delete: [path: string]
  movePicker: [path: string]
  copyTitle: [title: string]
  expandDir: [dirPath: string]
}>()

const filter = ref('')
const showSortMenu = ref(false)
const sortMode = ref<'recent' | 'name-asc'>('recent')

function getBaseName(path: string) {
  return path.split('/').filter(Boolean).pop() || path
}

function filterEntries(entries: FileEntry[]): FileEntry[] {
  if (!filter.value.trim()) return entries
  const term = filter.value.toLowerCase()
  const result: FileEntry[] = []
  for (const e of entries) {
    if (e.type === 'file') {
      if (e.name.toLowerCase().includes(term)) result.push(e)
    } else if (e.children) {
      const children = filterEntries(e.children)
      if (children.length || e.name.toLowerCase().includes(term)) {
        result.push({ ...e, children })
      }
    }
  }
  return result
}

const sortedEntries = computed(() => {
  const list = filterEntries(props.entries)
  if (sortMode.value === 'name-asc') {
    return [...list].sort((a, b) => a.name.localeCompare(b.name))
  }
  return list
})

function setSort(mode: 'recent' | 'name-asc') {
  sortMode.value = mode
  showSortMenu.value = false
}
</script>

<template>
  <aside class="file-sidebar">
    <div class="fs-header">
        <div
        class="fs-workspace-info"
        :title="rootPath || '切换工作区'"
        @click="$emit('selectWorkspace')"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="12 2 2 7 12 12 22 7 12 2" />
          <polyline points="2 17 12 22 22 17" />
          <polyline points="2 12 12 17 22 12" />
        </svg>
        <span>{{ rootPath ? getBaseName(rootPath) : '切换工作区' }}</span>
      </div>
      <div class="fs-actions">
        <button
          class="fs-btn-icon"
          title="刷新文件列表"
          :disabled="!workspaceOpen"
          @click="$emit('refresh')"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
        </button>
        <button
          class="fs-btn-icon"
          title="新建文件夹"
          :disabled="!workspaceOpen"
          @click="$emit('createFolder', rootPath || '')"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            <line x1="12" y1="11" x2="12" y2="17" />
            <line x1="9" y1="14" x2="15" y2="14" />
          </svg>
        </button>
        <button
          class="fs-btn-icon"
          title="新建文章"
          :disabled="!workspaceOpen"
          @click="$emit('createFile', rootPath || '')"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>
    </div>

    <div class="fs-search">
      <div class="fs-search-wrapper">
        <svg class="fs-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          v-model="filter"
          type="text"
          placeholder="搜索文件..."
        />
      </div>
      <div class="fs-sort-wrapper">
        <button class="fs-btn-icon fs-sort-btn" title="排序方式" @click="showSortMenu = !showSortMenu">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 11h4" />
            <path d="M11 17h7" />
            <path d="M11 5h10" />
            <path d="M3 13h.01" />
            <path d="M3 19h.01" />
            <path d="M3 7h.01" />
          </svg>
        </button>
        <div v-if="showSortMenu" class="fs-sort-dropdown">
          <button :class="{ active: sortMode === 'recent' }" @click="setSort('recent')">
            <span>最近编辑</span>
            <svg v-if="sortMode === 'recent'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </button>
          <button :class="{ active: sortMode === 'name-asc' }" @click="setSort('name-asc')">
            <span>名称升序</span>
            <svg v-if="sortMode === 'name-asc'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <div class="fs-body">
      <div v-if="sortedEntries.length === 0" class="fs-empty">
        暂无文件
      </div>
      <FileTree
        v-else
        :entries="sortedEntries"
        :active-path="activePath"
        @select="$emit('select', $event)"
        @create-file="$emit('createFile', $event)"
        @create-folder="$emit('createFolder', $event)"
        @rename="$emit('rename', $event)"
        @delete="$emit('delete', $event)"
        @move-picker="$emit('movePicker', $event)"
        @copy-title="$emit('copyTitle', $event)"
        @expand="$emit('expandDir', $event)"
      />
    </div>

    <div class="fs-footer">
      <div class="fs-brand">
        <svg width="20" height="20" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path
            d="M40 20 H160 C171 20 180 29 180 40 V140 C180 151 171 160 160 160 H140 L140 185 L110 160 H40 C29 160 20 151 20 140 V40 C20 29 29 20 40 20 Z"
            fill="currentColor"
          />
          <rect x="50" y="50" width="100" height="12" rx="6" fill="#07C160" />
          <path
            d="M60 85 L60 130 H80 L80 110 L100 130 L120 110 L120 130 H140 L140 85 L120 85 L100 105 L80 85 Z"
            fill="#FFFFFF"
          />
        </svg>
        <span class="fs-brand-text">MDX</span>
      </div>
      <span class="fs-version">v0.0.1</span>
    </div>
  </aside>
</template>

<style scoped>
.file-sidebar {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  user-select: none;
}

.fs-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
  box-sizing: border-box;
  padding: 0 24px;
  border-bottom: var(--border-width) solid var(--border-light);
}

.fs-workspace-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
  cursor: pointer;
  padding: 6px 10px;
  border-radius: var(--radius-pill);
  transition: all 0.2s ease;
  max-width: 180px;
  background-color: transparent;
  opacity: 0.9;
}

.fs-workspace-info:hover {
  background-color: var(--bg-hover);
  opacity: 1;
}

.fs-workspace-info span {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.fs-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.fs-btn-icon {
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 0;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.fs-btn-icon:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.fs-btn-icon:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.fs-search {
  padding: 12px 24px 4px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.fs-search-wrapper {
  position: relative;
  flex: 1;
  min-width: 0;
}

.fs-search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-tertiary);
  pointer-events: none;
}

.fs-search-wrapper input {
  width: 100%;
  border: var(--border-width) solid var(--border-light);
  border-radius: 0;
  padding: 10px 16px 10px 36px;
  font-size: 13px;
  background: color-mix(in srgb, var(--bg-primary) 85%, transparent);
  transition: all 0.2s ease;
  outline: none;
  color: var(--text-primary);
}

.fs-search-wrapper input:focus {
  background: var(--bg-primary);
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-primary) 25%, transparent);
}

.fs-sort-wrapper {
  position: relative;
  flex-shrink: 0;
}

.fs-sort-btn {
  color: var(--text-tertiary);
}

.fs-sort-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  min-width: 130px;
  background: var(--bg-primary);
  border: var(--border-width) solid var(--border-light);
  border-radius: 0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  z-index: 100;
  padding: 4px;
  display: flex;
  flex-direction: column;
}

.fs-sort-dropdown button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 12px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  border-radius: 0;
  transition: all 0.15s ease;
  text-align: left;
  width: 100%;
}

.fs-sort-dropdown button:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.fs-sort-dropdown button.active {
  color: var(--accent-primary);
  font-weight: 500;
}

.fs-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px 16px 16px;
}

.fs-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: var(--text-secondary);
  padding: 24px;
  text-align: center;
}

.fs-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 45px;
  box-sizing: border-box;
  padding: 0 24px;
  border-top: var(--border-width) solid var(--border-light);
  color: var(--text-tertiary);
  font-size: 12px;
}

.fs-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-secondary);
}

.fs-brand-text {
  font-weight: 700;
  color: var(--text-primary);
}

.fs-version {
  font-weight: 500;
}
</style>
