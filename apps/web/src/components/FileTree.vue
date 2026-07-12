<script setup lang="ts">
import { ref, computed } from 'vue'
import type { FileEntry } from '../bridge'

const props = defineProps<{
  entries: FileEntry[]
  activePath?: string
}>()

const emit = defineEmits<{
  select: [path: string]
}>()

const expanded = ref<Set<string>>(new Set())

const filteredEntries = computed(() => props.entries)

function toggleFolder(entry: FileEntry) {
  if (!entry.children?.length) return
  if (expanded.value.has(entry.path)) {
    expanded.value.delete(entry.path)
  } else {
    expanded.value.add(entry.path)
  }
}

function isExpanded(entry: FileEntry) {
  return expanded.value.has(entry.path)
}

function onSelect(path: string) {
  emit('select', path)
}
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
      >
        <span class="file-title">{{ entry.name.replace(/\.md$/, '') }}</span>
      </div>
      <div
        v-else
        class="dir-item"
        :class="{ expanded: isExpanded(entry) }"
        @click="toggleFolder(entry)"
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
        <span class="folder-name">{{ entry.name }}</span>
        <span v-if="entry.children?.length" class="folder-count">{{ entry.children.length }}</span>
      </div>
      <FileTree
        v-if="entry.type === 'dir' && entry.children?.length && isExpanded(entry)"
        :entries="entry.children"
        :active-path="activePath"
        @select="onSelect($event)"
      />
    </li>
  </ul>
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
  align-items: flex-start;
  gap: 2px;
  background: color-mix(in srgb, var(--bg-primary) 80%, transparent);
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

.file-title {
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.dir-item {
  color: var(--text-secondary);
  font-weight: 600;
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

.folder-count {
  font-size: 11px;
  color: var(--text-tertiary);
  background: var(--bg-tertiary);
  padding: 2px 6px;
  border-radius: var(--radius-pill);
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
</style>
