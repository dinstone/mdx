<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { getImageStorage } from '../services/imageStorage'
import PreviewToc from './PreviewToc.vue'

const props = defineProps<{
  html: string
  syncScrollPercent?: number | null
}>()

const emit = defineEmits<{
  'scroll-sync': [percent: number]
}>()

const container = ref<HTMLDivElement>()
const scrollContainer = ref<HTMLDivElement>()
const isProgrammaticScroll = ref(false)
const showToc = ref(false)

let mermaidReady = false

// blob URL 追踪，组件卸载时 revoke
const _blobUrls: string[] = []

function revokeBlobUrls() {
  for (const url of _blobUrls) {
    URL.revokeObjectURL(url)
  }
  _blobUrls.length = 0
}

async function ensureMermaid() {
  if (mermaidReady) return
  const mermaid = await import('mermaid')
  mermaid.default.initialize({ startOnLoad: false, securityLevel: 'loose' })
  mermaidReady = true
}

/** 解析 HTML 中的 img:// 链接，替换为 blob URL */
async function resolveImageUrls() {
  if (!container.value) return
  revokeBlobUrls()

  const imgs = container.value.querySelectorAll('img[src^="img://"]')
  if (imgs.length === 0) return

  const storage = await getImageStorage()
  // getImageStorage 是异步的，期间组件可能已销毁
  if (!container.value) return

  const imgArray = Array.from(imgs) as HTMLImageElement[]
  for (const img of imgArray) {
    const hash = img.src.replace('img://', '')
    try {
      const blob = await storage.load(hash)
      if (blob) {
        const url = URL.createObjectURL(blob)
        _blobUrls.push(url)
        img.src = url
      }
    } catch {
      // 图片不存在，保留原始 img:// URL（会显示为裂图）
    }
  }
}

watch(
  () => props.html,
  async () => {
    await nextTick()
    if (!container.value) return

    // Resolve img:// URLs
    await resolveImageUrls()

    // resolveImageUrls 是异步的，期间组件可能已销毁
    if (!container.value) return

    // Mermaid rendering
    const nodes = container.value.querySelectorAll('.mermaid')
    if (nodes.length === 0) return
    try {
      await ensureMermaid()
      const mermaid = await import('mermaid')
      await mermaid.default.run({ querySelector: '.mermaid' })
    } catch (e) {
      console.error('Mermaid render failed', e)
    }
  },
  { immediate: true },
)

function getScrollPercent(): number {
  const el = scrollContainer.value
  if (!el) return 0
  const maxScroll = el.scrollHeight - el.clientHeight
  if (maxScroll <= 0) return 0
  return el.scrollTop / maxScroll
}

function onPreviewScroll() {
  if (isProgrammaticScroll.value) {
    isProgrammaticScroll.value = false
    return
  }
  emit('scroll-sync', getScrollPercent())
}

function toggleToc() {
  showToc.value = !showToc.value
}

// 点击目录浮层以外的区域时自动收起
function onPreviewBodyClick(e: MouseEvent) {
  if (!showToc.value) return
  const target = e.target as HTMLElement | null
  if (target && target.closest('.preview-toc')) return
  showToc.value = false
}

function navigateToHeading(id: string) {
  const scroller = scrollContainer.value
  if (!scroller || !container.value) return

  const target = container.value.querySelector<HTMLElement>(`#${CSS.escape(id)}`)
  if (!target) return

  // 滚动到标题上方留出一点呼吸空间
  const offset = 16
  const top = target.offsetTop - scroller.offsetTop - offset
  isProgrammaticScroll.value = true
  scroller.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
}

watch(
  () => props.syncScrollPercent,
  (percent) => {
    if (percent == null) return
    const el = scrollContainer.value
    if (!el) return
    const maxScroll = el.scrollHeight - el.clientHeight
    if (maxScroll <= 0) return
    isProgrammaticScroll.value = true
    el.scrollTop = maxScroll * percent
  },
)

onMounted(() => {
  scrollContainer.value?.addEventListener('scroll', onPreviewScroll)
})

onBeforeUnmount(() => {
  scrollContainer.value?.removeEventListener('scroll', onPreviewScroll)
  revokeBlobUrls()
})
</script>

<template>
  <div class="markdown-preview">
    <div class="preview-header">
      <div class="preview-header__left">
        <span class="preview-title">实时预览</span>
        <span class="preview-subtitle">微信排版效果</span>
      </div>
      <button
        class="preview-header__toc-btn"
        :class="{ 'preview-header__toc-btn--active': showToc }"
        title="目录"
        aria-label="目录"
        @click="toggleToc"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <circle cx="3.5" cy="6" r="1" />
          <circle cx="3.5" cy="12" r="1" />
          <circle cx="3.5" cy="18" r="1" />
        </svg>
      </button>
    </div>
    <div class="preview-body" @click="onPreviewBodyClick">
      <div ref="scrollContainer" class="preview-container" :class="{ 'preview-container--with-toc': showToc }">
        <div class="preview-content">
          <div ref="container" v-html="html" />
        </div>
      </div>
      <PreviewToc
        :html="html"
        :container="container"
        :scroll-container="scrollContainer"
        :visible="showToc"
        @navigate="navigateToHeading"
        @close="toggleToc"
      />
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

.preview-header {
  height: 56px;
  box-sizing: border-box;
  padding: 0 24px;
  border-bottom: 1px solid var(--border-light);
  background: var(--bg-primary);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.preview-header__left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.preview-header__toc-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border-radius: var(--radius-sm, 4px);
  border: 1px solid var(--border-light);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.preview-header__toc-btn svg {
  width: 18px;
  height: 18px;
  display: block;
}

.preview-header__toc-btn:hover {
  border-color: var(--accent-primary, #07c160);
  color: var(--accent-primary, #07c160);
}

.preview-header__toc-btn--active {
  background: var(--accent-primary, #07c160);
  color: #ffffff;
  border-color: var(--accent-primary, #07c160);
}

.preview-header__toc-btn--active:hover {
  color: #ffffff;
  opacity: 0.9;
}

.preview-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.preview-subtitle {
  font-size: 12px;
  color: var(--text-tertiary);
  padding: 2px 8px;
  background: var(--bg-tertiary);
  border-radius: var(--radius-sm);
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

[data-ui-theme="dark"] .preview-header,
[data-ui-theme="dark"] .preview-container {
  background: var(--bg-primary);
}

[data-ui-theme="dark"] .preview-content {
  box-shadow: none;
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
