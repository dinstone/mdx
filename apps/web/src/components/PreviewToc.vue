<script setup lang="ts">
import { computed, ref, watch } from 'vue'

export interface TocItem {
  level: number
  text: string
  id: string
}

const props = defineProps<{
  /** 预览 HTML 字符串（用于稳定提取目录） */
  html: string
  /** 预览内容容器（点击导航时定位目标元素） */
  container?: HTMLElement | null
  /** 滚动容器（用于高亮当前章节） */
  scrollContainer?: HTMLElement | null
  /** 是否可见 */
  visible?: boolean
}>()

const emit = defineEmits<{
  'navigate': [id: string]
}>()

const activeId = ref<string>('')

/**
 * 从 HTML 字符串中提取 h1-h6 标题和 id。
 * 不依赖 DOM 时序：只要 html 更新了，目录就更新。
 */
const tocItems = computed<TocItem[]>(() => {
  if (!props.visible) return []
  const html = props.html
  if (!html) return []

  const items: TocItem[] = []
  // 匹配 <h1 id="..."> ... </h1>（已含 data-tool 等属性）
  const regex = /<h([1-6])(?:\s+[^>]*)?\s+id="([^"]*)"(?:[^>]*)>([\s\S]*?)<\/h\1>/gi
  let match: RegExpExecArray | null
  while ((match = regex.exec(html)) !== null) {
    const level = Number(match[1])
    const id = match[2]
    // 去掉标题里的 HTML 标签和转义，得到纯文本
    const text = match[3]
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim()
    if (id && text) {
      items.push({ level, text, id })
    }
  }
  return items
})

function onItemClick(item: TocItem) {
  emit('navigate', item.id)
}

function findHeadingElement(id: string): HTMLElement | null {
  const container = props.container
  if (!container) return null
  try {
    return container.querySelector<HTMLElement>(`[id="${id.replace(/"/g, '\\"')}"]`)
  } catch {
    return null
  }
}

/**
 * 滚动时高亮当前最靠近视口顶部的标题。
 */
function updateActiveHeading() {
  const scroller = props.scrollContainer
  if (!scroller || !props.visible) return

  const items = tocItems.value
  if (items.length === 0) {
    activeId.value = ''
    return
  }

  const scrollTop = scroller.scrollTop
  let current = items[0]?.id || ''

  for (const item of items) {
    const el = findHeadingElement(item.id)
    if (!el) continue
    const top = el.offsetTop - scroller.offsetTop
    if (top <= scrollTop + 24) {
      current = item.id
    } else {
      break
    }
  }

  activeId.value = current
}

watch(
  () => props.scrollContainer,
  (el, prevEl) => {
    prevEl?.removeEventListener('scroll', updateActiveHeading)
    if (!el) return
    el.addEventListener('scroll', updateActiveHeading, { passive: true })
    updateActiveHeading()
  },
  { immediate: true },
)

function itemStyle(level: number) {
  return {
    paddingLeft: `${8 + (level - 1) * 12}px`,
  }
}
</script>

<template>
  <div class="preview-toc" :class="{ 'preview-toc--open': visible }">
    <div class="preview-toc__header">
      <span class="preview-toc__title">目录</span>
    </div>
    <ul class="preview-toc__list">
      <li
        v-for="item in tocItems"
        :key="item.id"
        class="preview-toc__item"
        :class="{ 'preview-toc__item--active': activeId === item.id }"
        :style="itemStyle(item.level)"
        :title="item.text"
        @click="onItemClick(item)"
      >
        {{ item.text }}
      </li>
    </ul>
    <div v-if="tocItems.length === 0" class="preview-toc__empty">暂无标题</div>
  </div>
</template>

<style scoped>
.preview-toc {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 220px;
  background: var(--bg-primary);
  border-left: 1px solid var(--border-light);
  box-shadow: -4px 0 16px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transform: translateX(100%);
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 20;
}

.preview-toc--open {
  transform: translateX(0);
}

.preview-toc__header {
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 16px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-light);
  flex-shrink: 0;
}

.preview-toc__list {
  flex: 1;
  overflow-y: auto;
  list-style: none;
  margin: 0;
  padding: 8px 0;
}

.preview-toc__item {
  padding: 6px 12px 6px 8px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-tertiary);
  cursor: pointer;
  border-radius: 0 4px 4px 0;
  margin-right: 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color 0.2s ease, background 0.2s ease;
}

.preview-toc__item:hover {
  color: var(--text-primary);
  background: var(--bg-tertiary);
}

.preview-toc__item--active {
  color: var(--accent-primary, #07c160);
  background: var(--bg-tertiary);
  font-weight: 600;
}

.preview-toc__empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--text-tertiary);
  padding: 24px 16px;
  text-align: center;
}
</style>
