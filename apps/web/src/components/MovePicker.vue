<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import type { FileEntry } from '../bridge'

const props = defineProps<{
  sourcePath: string
  rootPath: string
  entries: FileEntry[]
}>()

const emit = defineEmits<{
  close: []
  select: [targetDir: string]
}>()

function collectDirs(list: FileEntry[], result: FileEntry[]) {
  for (const e of list) {
    if (e.type === 'dir') {
      result.push(e)
      if (e.children) collectDirs(e.children, result)
    }
  }
}

const dirs = computed(() => {
  const list: FileEntry[] = []
  collectDirs(props.entries, list)
  return list.filter((d) => {
    // Cannot move into itself or its own descendants
    if (d.path === props.sourcePath) return false
    if (d.path.startsWith(`${props.sourcePath}/`)) return false
    return true
  })
})

function onSelect(targetDir: string) {
  emit('select', targetDir)
}

function onBackdropClick(e: MouseEvent) {
  if (e.target === e.currentTarget) emit('close')
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <div class="move-picker-backdrop" @click="onBackdropClick">
      <div class="move-picker">
        <div class="move-picker-title">移动到</div>
        <ul class="move-picker-list">
          <li
            class="move-picker-item"
            @click="onSelect(rootPath)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            <span>根目录</span>
          </li>
          <li
            v-for="dir in dirs"
            :key="dir.path"
            class="move-picker-item"
            @click="onSelect(dir.path)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            <span>{{ dir.path.slice(rootPath.length + 1) || dir.name }}</span>
          </li>
        </ul>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.move-picker-backdrop {
  position: fixed;
  inset: 0;
  z-index: 2500;
  background: transparent;
}

.move-picker {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  min-width: 220px;
  max-width: 320px;
  max-height: 360px;
  background: var(--bg-primary);
  border: var(--border-width) solid var(--border-light);
  border-radius: 0;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.move-picker-title {
  padding: 12px 16px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  border-bottom: var(--border-width) solid var(--border-light);
}

.move-picker-list {
  list-style: none;
  margin: 0;
  padding: 4px;
  overflow-y: auto;
}

.move-picker-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.move-picker-item svg {
  color: var(--accent-primary);
  flex-shrink: 0;
}

.move-picker-item span {
  overflow: hidden;
  text-overflow: ellipsis;
}

.move-picker-item:hover,
.move-picker-item.active {
  background: var(--bg-hover);
  color: var(--text-primary);
}
</style>
