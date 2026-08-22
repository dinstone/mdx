<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { IWorkspace } from '../stores/workspace-types'

const props = defineProps<{
  current: IWorkspace
  workspaces: IWorkspace[]
  isDesktop: boolean
}>()

const emit = defineEmits<{
  select: [ws: IWorkspace]
  openFolder: []
  remove: [ws: IWorkspace]
}>()

const open = ref(false)
const rootEl = ref<HTMLElement | null>(null)

const currentSubtitle = computed(() =>
  props.current.kind === 'virtual' ? '虚拟工作空间' : '本地工作空间',
)

const currentName = computed(() => props.current.title || props.current.name)

function toggle() {
  open.value = !open.value
}

function onSelect(ws: IWorkspace) {
  open.value = false
  emit('select', ws)
}

function onRemove(ws: IWorkspace, e: MouseEvent) {
  e.stopPropagation()
  emit('remove', ws)
}

function onOpenFolder() {
  open.value = false
  emit('openFolder')
}

function onDocClick(e: MouseEvent) {
  if (rootEl.value && !rootEl.value.contains(e.target as Node)) {
    open.value = false
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') open.value = false
}

onMounted(() => {
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div ref="rootEl" class="ws-switcher">
    <!-- 触发条 -->
    <button class="ws-trigger" :class="{ active: open }" @click="toggle">
      <span class="ws-avatar">
        <svg
          v-if="current.kind === 'virtual'"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <ellipse cx="12" cy="5" rx="9" ry="3" />
          <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
          <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
        </svg>
        <svg
          v-else
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
      </span>
      <span class="ws-meta">
        <span class="ws-name" :title="currentName">{{ currentName }}</span>
        <span class="ws-sub">{{ currentSubtitle }}</span>
      </span>
      <svg
        class="ws-chevron"
        :class="{ open }"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <polyline points="18 15 12 9 6 15" />
      </svg>
    </button>

    <!-- 下拉面板 -->
    <div v-if="open" class="ws-dropdown">
      <div class="ws-dropdown-title">工作空间列表</div>
      <ul class="ws-list">
        <li
          v-for="ws in workspaces"
          :key="ws.path"
          :class="['ws-item', { active: ws.path === current.path }]"
          @click="onSelect(ws)"
        >
          <svg
            v-if="ws.kind === 'virtual'"
            class="ws-item-icon"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <ellipse cx="12" cy="5" rx="9" ry="3" />
            <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
            <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
          </svg>
          <svg
            v-else
            class="ws-item-icon"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          <span class="ws-item-name">{{ ws.title || ws.name }}</span>
          <svg
            v-if="ws.path === current.path"
            class="ws-item-check"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <button
            v-if="ws.path !== current.path"
            class="ws-item-remove"
            aria-label="移除工作空间"
            :title="`移除 ${ws.title || ws.name}`"
            @click="onRemove(ws, $event)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </li>
      </ul>
      <div class="ws-dropdown-footer">
        <button class="ws-open-btn" @click="onOpenFolder">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          <span>{{ isDesktop ? '打开文件夹' : '添加工作空间' }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ws-switcher {
  position: relative;
  width: 100%;
}

.ws-trigger {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border: none;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  text-align: left;
  transition: background 0.2s ease;
}

.ws-trigger:hover,
.ws-trigger.active {
  background: var(--bg-hover);
}

.ws-avatar {
  flex: none;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--accent-primary) 15%, transparent);
  color: var(--accent-primary);
}

.ws-meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.ws-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
}

.ws-sub {
  font-size: 11px;
  color: var(--text-tertiary);
  line-height: 1.3;
}

.ws-chevron {
  flex: none;
  color: var(--text-tertiary);
  transition: transform 0.2s ease;
}

.ws-chevron.open {
  transform: rotate(180deg);
}

/* ---- 下拉面板 ---- */
.ws-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  z-index: 1200;
  background: var(--bg-primary);
  border: var(--border-width) solid var(--border-light);
  border-radius: 10px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.18);
  padding: 8px;
}

.ws-dropdown-title {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--text-tertiary);
  padding: 4px 8px 6px;
}

.ws-list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 260px;
  overflow-y: auto;
}

.ws-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.ws-item:hover {
  background: var(--bg-hover);
}

.ws-item.active {
  background: color-mix(in srgb, var(--accent-primary) 12%, transparent);
}

.ws-item-icon {
  flex: none;
  color: var(--text-secondary);
}

.ws-item.active .ws-item-icon {
  color: var(--accent-primary);
}

.ws-item-name {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ws-item-check {
  flex: none;
  color: var(--accent-primary);
}

.ws-item-remove {
  flex: none;
  width: 22px;
  height: 22px;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.15s ease, background 0.15s ease, color 0.15s ease;
}

.ws-item:hover .ws-item-remove {
  opacity: 1;
}

.ws-item-remove:hover {
  background: color-mix(in srgb, #ef4444 15%, transparent);
  color: #ef4444;
}

.ws-dropdown-footer {
  margin-top: 6px;
  padding-top: 6px;
  border-top: var(--border-width) solid var(--border-light);
}

.ws-open-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 9px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.ws-open-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
</style>
