<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { FileEntry } from '../bridge'

const props = defineProps<{
  entries: FileEntry[]
  activePath?: string
}>()

const emit = defineEmits<{
  select: [path: string]
  createFile: [dirPath: string]
  createFolder: [dirPath: string]
  renameEntry: [payload: { path: string; newName: string }]
  delete: [path: string]
  movePicker: [path: string]
  copyTitle: [title: string]
  expand: [dirPath: string]
}>()

const expanded = ref<Set<string>>(new Set())

const filteredEntries = computed(() => props.entries)

// ---- inline rename ----
const editingPath = ref<string | null>(null)
const editValue = ref('')

function startRename(entry: FileEntry) {
  closeMenu()
  editingPath.value = entry.path
  editValue.value = entry.type === 'file' ? entry.name.replace(/\.md$/i, '') : entry.name
}

function confirmRename(entry: FileEntry) {
  const newName = editValue.value.trim()
  editingPath.value = null
  if (!newName) return
  const oldDisplay = entry.type === 'file' ? entry.name.replace(/\.md$/i, '') : entry.name
  if (newName === oldDisplay) return
  emit('renameEntry', { path: entry.path, newName })
}

function cancelRename() {
  editingPath.value = null
}

function toggleFolder(entry: FileEntry, e: MouseEvent) {
  e.stopPropagation()
  // Always toggle the expanded state first so the chevron rotates immediately.
  if (expanded.value.has(entry.path)) {
    expanded.value.delete(entry.path)
  } else {
    expanded.value.add(entry.path)
    // If no children yet, request lazy-load from the parent.
    if (!entry.children?.length) {
      emit('expand', entry.path)
    }
  }
}

function isExpanded(entry: FileEntry) {
  return expanded.value.has(entry.path)
}

function onSelect(path: string) {
  emit('select', path)
}

function onCreateFile(entry: FileEntry, e: MouseEvent) {
  e.stopPropagation()
  emit('createFile', entry.path)
}

function onCreateFolder(entry: FileEntry, e: MouseEvent) {
  e.stopPropagation()
  emit('createFolder', entry.path)
}

// ---- context menu ----
interface MenuState {
  visible: boolean
  x: number
  y: number
  entry: FileEntry | null
}

const menu = ref<MenuState>({
  visible: false,
  x: 0,
  y: 0,
  entry: null,
})

function onContextMenu(entry: FileEntry, e: MouseEvent) {
  e.preventDefault()
  e.stopPropagation()
  menu.value = {
    visible: true,
    x: e.clientX,
    y: e.clientY,
    entry,
  }
}

function closeMenu() {
  menu.value.visible = false
  menu.value.entry = null
}

function handleMenuAction(action: 'copyTitle' | 'rename' | 'move' | 'delete') {
  const entry = menu.value.entry
  if (!entry) return
  closeMenu()

  if (action === 'copyTitle') {
    const title = entry.name.replace(/\.md$/i, '')
    emit('copyTitle', title)
    return
  }

  if (action === 'rename') {
    startRename(entry)
    return
  }

  if (action === 'move') {
    emit('movePicker', entry.path)
    return
  }

  if (action === 'delete') {
    emit('delete', entry.path)
    return
  }
}

function getBaseName(path: string) {
  return path.split('/').filter(Boolean).pop() || path
}

// Close context menu on clicks outside
function onDocumentClick(e: MouseEvent) {
  const target = e.target as HTMLElement | null
  if (!target?.closest('.file-tree-context-menu')) {
    closeMenu()
  }
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick)
})

onUnmounted(() => {
  document.removeEventListener('click', onDocumentClick)
})
</script>

<template>
  <ul class="file-tree">
    <li
      v-for="entry in filteredEntries"
      :key="entry.path"
      :class="{ 'dir-row': entry.type === 'dir' }"
    >
      <div
        v-if="entry.type === 'file'"
        class="file-item"
        :class="{ active: activePath === entry.path }"
        @click="onSelect(entry.path)"
        @contextmenu="onContextMenu(entry, $event)"
      >
        <div class="file-row">
          <svg
            class="file-doc-icon"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          <input
            v-if="editingPath === entry.path"
            ref="renameInput"
            v-model="editValue"
            class="file-rename-input"
            @keyup.enter="confirmRename(entry)"
            @keyup.escape="cancelRename"
            @blur="confirmRename(entry)"
          />
          <span v-else class="file-title">{{ entry.name.replace(/\.md$/, '') }}</span>
          <span class="file-more" @click.stop="onContextMenu(entry, $event)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="5" r="1" />
              <circle cx="12" cy="12" r="1" />
              <circle cx="12" cy="19" r="1" />
            </svg>
          </span>
        </div>
        <div class="file-meta">
          <span class="file-time">{{ entry.updatedAt || '' }}</span>
          <span v-if="entry.updatedAt && entry.themeName" class="file-meta-sep">·</span>
          <span class="file-theme">{{ entry.themeName || '默认主题' }}</span>
        </div>
      </div>
      <div
        v-else
        class="dir-item"
        :class="{ expanded: isExpanded(entry) }"
        @click="toggleFolder(entry, $event)"
        @contextmenu="onContextMenu(entry, $event)"
      >
        <svg
          class="folder-chevron"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <svg
          class="folder-icon"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
        <input
          v-if="editingPath === entry.path"
          v-model="editValue"
          class="folder-rename-input"
          @keyup.enter="confirmRename(entry)"
          @keyup.escape="cancelRename"
          @blur="confirmRename(entry)"
        />
        <span v-else class="folder-name">{{ entry.name }}</span>
        <span v-if="entry.fileCount !== undefined" class="folder-count">{{ entry.fileCount }}</span>
        <div class="dir-actions">
          <button class="dir-action-btn" title="新建文件" @click.stop="onCreateFile(entry, $event)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <button class="dir-action-btn" title="新建文件夹" @click.stop="onCreateFolder(entry, $event)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              <line x1="12" y1="11" x2="12" y2="17" />
              <line x1="9" y1="14" x2="15" y2="14" />
            </svg>
          </button>
        </div>
      </div>
      <FileTree
        v-if="entry.type === 'dir' && entry.children?.length && isExpanded(entry)"
        :entries="entry.children"
        :active-path="activePath"
        @select="onSelect($event)"
        @create-file="emit('createFile', $event)"
        @create-folder="emit('createFolder', $event)"
        @rename-entry="emit('renameEntry', $event)"
        @delete="emit('delete', $event)"
        @move-picker="emit('movePicker', $event)"
        @copy-title="emit('copyTitle', $event)"
        @expand="emit('expand', $event)"
      />
    </li>
  </ul>

  <Teleport to="body">
    <div
      v-if="menu.visible"
      class="file-tree-context-menu"
      :style="{ left: `${menu.x}px`, top: `${menu.y}px` }"
      @click.stop
    >
      <button v-if="menu.entry?.type === 'file'" class="ctx-item" @click="handleMenuAction('copyTitle')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
        <span>复制标题</span>
      </button>
      <button class="ctx-item" @click="handleMenuAction('rename')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
        <span>重命名</span>
      </button>
      <button class="ctx-item" @click="handleMenuAction('move')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
        <span>移动到...</span>
      </button>
      <button class="ctx-item ctx-item--danger" @click="handleMenuAction('delete')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
        <span>删除</span>
      </button>
    </div>
  </Teleport>
</template>

<style scoped>
.file-tree {
  list-style: none;
  font-size: 13px;
  padding-left: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.file-item,
.dir-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 12px;
  border-radius: 0;
  cursor: pointer;
  transition: all 0.15s ease;
  border: 1px solid transparent;
}

.file-item {
  flex-direction: column;
  align-items: stretch;
  gap: 4px;
  background: color-mix(in srgb, var(--bg-primary) 80%, transparent);
  position: relative;
}

.file-item:hover {
  background: var(--bg-primary);
  box-shadow: var(--shadow-sm);
}

.file-item.active {
  background: var(--bg-primary);
  border: var(--border-width) solid color-mix(in srgb, var(--accent-primary) 35%, transparent);
  box-shadow: var(--shadow-md);
}

.file-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.file-title {
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.file-rename-input {
  flex: 1;
  min-width: 0;
  border: var(--border-width) solid var(--accent-primary);
  border-radius: 0;
  padding: 2px 6px;
  font-size: 13px;
  font-weight: 600;
  background: var(--bg-primary);
  color: var(--text-primary);
  outline: none;
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent-primary) 20%, transparent);
}

.file-doc-icon {
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.file-more {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
  padding: 2px;
  border-radius: 0;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.file-item:hover .file-more {
  opacity: 1;
}

.file-more:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}

.file-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-tertiary);
}

.file-meta-sep {
  color: var(--text-tertiary);
}

.file-theme {
  color: var(--accent-primary);
}

.dir-item {
  color: var(--text-secondary);
  font-weight: 600;
  position: relative;
}

.dir-item:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.dir-item.expanded .folder-chevron {
  transform: rotate(90deg);
}

.folder-chevron {
  transition: transform 0.2s ease;
  flex-shrink: 0;
}

.folder-icon {
  color: var(--accent-primary);
  flex-shrink: 0;
}

.folder-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.folder-rename-input {
  flex: 1;
  min-width: 0;
  border: var(--border-width) solid var(--accent-primary);
  border-radius: 0;
  padding: 2px 6px;
  font-size: 13px;
  font-weight: 600;
  background: var(--bg-primary);
  color: var(--text-primary);
  outline: none;
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent-primary) 20%, transparent);
}

.folder-count {
  font-size: 11px;
  color: var(--text-tertiary);
  background: var(--bg-tertiary);
  padding: 2px 6px;
  border-radius: var(--radius-pill);
}

.dir-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.dir-item:hover .dir-actions {
  opacity: 1;
}

.dir-action-btn {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  border-radius: 0;
  padding: 0;
  transition: all 0.15s ease;
}

.dir-action-btn:hover {
  background: var(--bg-primary);
  color: var(--text-primary);
}

.dir-row .file-tree {
  padding-left: 24px;
  padding-top: 6px;
  position: relative;
}

.dir-row .file-tree::before {
  content: "";
  position: absolute;
  left: 10px;
  top: 6px;
  bottom: 6px;
  width: 1px;
  background: linear-gradient(
    to bottom,
    transparent,
    var(--border-light) 10px,
    var(--border-light) calc(100% - 10px),
    transparent
  );
  border-radius: 999px;
}

.dir-row .file-tree .file-item::before,
.dir-row .file-tree .dir-item::before {
  content: "";
  position: absolute;
  left: calc(10px - 24px);
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background-color: var(--border-light);
  transform: translate(-50%, 50%);
}

.dir-row .file-item,
.dir-row .dir-item {
  position: relative;
}

.file-tree-context-menu {
  position: fixed;
  z-index: 2000;
  min-width: 150px;
  background: var(--bg-primary);
  border: var(--border-width) solid var(--border-light);
  border-radius: 0;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  padding: 4px;
  display: flex;
  flex-direction: column;
}

.ctx-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;
}

.ctx-item:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.ctx-item--danger {
  color: #ef4444;
}

</style>
