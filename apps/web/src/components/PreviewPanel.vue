<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { getImageStorage } from '../services/imageStorage'
import { useWorkspaceStore } from '../stores/workspace'

const props = defineProps<{
  html: string
}>()

const emit = defineEmits<{
  'scroll-sync': [scrollTop: number]
  copyWechat: []
  copyHtml: []
  openTheme: []
}>()

const container = ref<HTMLDivElement>()
const scrollContainer = ref<HTMLDivElement>()
/** 缓存标题元素引用（顺序 = 文档顺序），高度变化时实时读取 offsetTop */
const headingEls = ref<HTMLElement[]>([])

let mermaidReady = false
let mermaidFailed = false

const mermaidError = ref<string | null>(null)

// 图片 blob URL 缓存：key = `${wsId}:${hash}`
// 跨输入复用同一 blob URL，避免每次敲字都重新 load + revoke 造成图片闪烁/刷新。
const _imgBlobCache = new Map<string, string>()
// 防止快速连续输入时同一张图被并发重复 load
const _imgLoading = new Map<string, Promise<string | null>>()

function wsId(): string {
  try {
    const ws = useWorkspaceStore().current
    return ws?.path ?? 'default'
  } catch {
    return 'default'
  }
}

// 组件卸载或切换工作空间时调用，撤销所有缓存的 blob URL
function revokeBlobUrls() {
  for (const url of _imgBlobCache.values()) {
    URL.revokeObjectURL(url)
  }
  _imgBlobCache.clear()
  _imgLoading.clear()
}

async function ensureMermaid(): Promise<boolean> {
  if (mermaidReady) return true
  if (mermaidFailed) return false
  try {
    const mermaid = await import('mermaid')
    mermaid.default.initialize({ startOnLoad: false, securityLevel: 'loose' })
    mermaidReady = true
    mermaidError.value = null
    return true
  } catch (e: any) {
    mermaidFailed = true
    mermaidError.value = e?.message || String(e)
    console.error('Mermaid init failed', e)
    return false
  }
}

/**
 * 解析 HTML 中的 img:// 链接，替换为 blob URL。
 * 关键优化：命中缓存的图直接同步复用 blob URL（零 IO、零闪烁）；
 * 仅首次出现或被清理过的图才走异步 load。
 */
async function resolveImageUrls() {
  if (!container.value) return

  const imgs = Array.from(
    container.value.querySelectorAll<HTMLImageElement>('img[src^="img://"]'),
  )
  if (imgs.length === 0) return

  const ws = wsId()
  const seen = new Set<string>()

  // 第一轮：命中缓存的图同步替换（此时 DOM 刚由 v-html 重建，src 仍是 img://）
  for (const el of imgs) {
    const hash = el.src.replace('img://', '')
    const key = `${ws}:${hash}`
    seen.add(key)
    const cached = _imgBlobCache.get(key)
    if (cached) {
      if (el.src !== cached) el.src = cached
      continue
    }
  }

  // 第二轮：真正缺失的图才异步加载
  const storage = await getImageStorage()
  // getImageStorage 是异步的，期间组件可能已销毁
  if (!container.value) return

  for (const el of imgs) {
    const hash = el.src.replace('img://', '')
    const key = `${ws}:${hash}`
    if (_imgBlobCache.has(key)) continue // 第一轮已同步赋值

    if (_imgLoading.has(key)) {
      const url = await _imgLoading.get(key)
      if (url && container.value) el.src = url
      continue
    }

    const p = (async (): Promise<string | null> => {
      try {
        const blob = await storage.load(hash)
        return blob ? URL.createObjectURL(blob) : null
      } catch {
        return null // 图片不存在，保留 img://（裂图）
      }
    })()
    _imgLoading.set(key, p)
    const url = await p
    _imgLoading.delete(key)
    if (!url) continue
    _imgBlobCache.set(key, url)
    if (container.value) el.src = url
  }

  // 清理本轮不再被引用的 blob URL，避免内存泄漏
  for (const [key, url] of _imgBlobCache) {
    if (!seen.has(key)) {
      URL.revokeObjectURL(url)
      _imgBlobCache.delete(key)
    }
  }
}

// 切换工作空间时，同一 hash 指向不同图片，清空缓存避免串台，并重新解析当前文档
watch(
  () => useWorkspaceStore().current?.path,
  () => {
    revokeBlobUrls()
    nextTick(resolveImageUrls)
  },
)

watch(
  () => props.html,
  async () => {
    await nextTick()
    if (!container.value) return

    // Resolve img:// URLs
    await resolveImageUrls()

    // resolveImageUrls 是异步的，期间组件可能已销毁
    if (!container.value) return

    // 缓存标题元素引用，供滚动同步按标题顺序对齐
    headingEls.value = Array.from(
      container.value.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,h6'),
    )

    // Mermaid rendering（限定在当前容器内）
    const nodes = container.value.querySelectorAll<HTMLElement>('.mermaid:not([data-processed])')
    if (nodes.length === 0) return
    try {
      if (!(await ensureMermaid())) return
      const mermaid = await import('mermaid')
      await mermaid.default.run({ nodes: Array.from(nodes) })
    } catch (e: any) {
      mermaidError.value = e?.message || String(e)
      console.error('Mermaid render failed', e)
    }
  },
  { immediate: true },
)

function onPreviewScroll() {
  const el = scrollContainer.value
  if (!el) return
  emit('scroll-sync', el.scrollTop)
}

/** 各标题相对滚动内容顶部的绝对位置（与 scrollTop 同坐标系） */
function getHeadingTops(): number[] {
  const scroller = scrollContainer.value
  if (!scroller) return []
  const base = scroller.getBoundingClientRect().top
  return headingEls.value.map((el) => {
    const r = el.getBoundingClientRect()
    return r.top - base + scroller.scrollTop
  })
}

function getScrollMetrics() {
  const el = scrollContainer.value
  if (!el) return { scrollTop: 0, scrollHeight: 0, clientHeight: 0 }
  return {
    scrollTop: el.scrollTop,
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
  }
}

function scrollToTop(top: number) {
  scrollContainer.value?.scrollTo({ top })
}

/** 导航到指定标题（按 id 定位预览内渲染的标题元素）。供提升后的目录浮层调用。 */
function scrollToHeading(id: string) {
  const scroller = scrollContainer.value
  if (!scroller || !container.value) return

  const target = container.value.querySelector<HTMLElement>(`#${CSS.escape(id)}`)
  if (!target) return

  // 滚动到标题上方留出一点呼吸空间
  const offset = 16
  const top = target.offsetTop - scroller.offsetTop - offset
  scroller.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
}

onMounted(() => {
  scrollContainer.value?.addEventListener('scroll', onPreviewScroll)
})

onBeforeUnmount(() => {
  scrollContainer.value?.removeEventListener('scroll', onPreviewScroll)
  revokeBlobUrls()
})

defineExpose({
  getHeadingTops,
  getScrollMetrics,
  scrollToTop,
  scrollToHeading,
  getContainer: () => container.value,
  getScrollContainer: () => scrollContainer.value,
})
</script>

<template>
  <div class="markdown-preview">
    <div class="preview-toolbar">
      <div class="pt-actions">
        <button class="pt-btn" title="主题管理" @click="emit('openTheme')">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z" />
            <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
            <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
            <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
            <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
          </svg>
          <span>主题管理</span>
        </button>
        <button class="pt-btn" title="复制 HTML" @click="emit('copyHtml')">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
          <span>复制 HTML</span>
        </button>
        <button class="pt-btn pt-primary" title="复制到公众号" @click="emit('copyWechat')">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
          <span>复制到公众号</span>
        </button>
      </div>
    </div>

    <div class="preview-body">
      <div ref="scrollContainer" class="preview-container">
        <div class="preview-content">
          <div ref="container" v-html="html" />
        </div>
      </div>
      <div v-if="mermaidError" class="mermaid-error">
        Mermaid 渲染失败: {{ mermaidError }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.markdown-preview {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-secondary);
  border-radius: 0;
  overflow: hidden;
}

.preview-toolbar {
  min-height: 50px;
  box-sizing: border-box;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  padding: 0 24px;
  border-bottom: 1px solid var(--border-light);
  background: var(--bg-secondary);
  flex-wrap: wrap;
}

.pt-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: none;
}

.pt-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 10px;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}

.pt-btn svg {
  width: 18px;
  height: 18px;
  flex: none;
}

.pt-btn:hover {
  background: var(--bg-hover);
  color: var(--accent-primary);
  border-color: var(--border-light);
}

.pt-btn:active {
  background: var(--bg-tertiary);
  transform: translateY(1px);
}

.pt-primary {
  color: var(--accent-primary);
}

.pt-primary:hover {
  background: var(--accent-primary);
  color: #ffffff;
  border-color: var(--accent-primary);
}

.preview-body {
  flex: 1;
  display: flex;
  min-height: 0;
  overflow: hidden;
  position: relative;
}

.preview-container {
  flex: 1;
  overflow-y: auto;
  overflow-x: auto;
  padding: 2px 0;
  min-width: 0;
}

.preview-content {
  flex-shrink: 0;
  margin: 0 auto;
  background: var(--bg-primary);
  padding: 2px 20px;
  border-radius: 0;
  box-shadow: var(--shadow-md);
  min-height: 100%
}

.preview-content :deep(img) {
  max-width: 100% !important;
  height: auto !important;
  display: block;
  margin: 10px auto;
}

.preview-content :deep(.table-container) {
  overflow-x: auto;
}

[data-ui-theme="dark"] .preview-container {
  background: var(--bg-primary);
}

[data-ui-theme="dark"] .preview-content {
  box-shadow: none;
}

.mermaid-error {
  position: absolute;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
  padding: 6px 12px;
  border-radius: var(--radius-sm, 4px);
  background: #fee2e2;
  color: #991b1b;
  font-size: 12px;
  border: 1px solid #fecaca;
  z-index: 10;
  pointer-events: none;
  max-width: 90%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

[data-ui-theme="dark"] .mermaid-error {
  background: #450a0a;
  color: #fca5a5;
  border-color: #7f1d1d;
}

@media (max-width: 768px) {
  .preview-container {
    padding: 16px;
  }

  .preview-content {
    width: 100%;

    padding: 24px 20px;
  }
}
</style>
