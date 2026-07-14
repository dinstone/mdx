<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { getImageStorage } from '../services/imageStorage'

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
      <span class="preview-title">实时预览</span>
      <span class="preview-subtitle">微信排版效果</span>
    </div>
    <div ref="scrollContainer" class="preview-container">
      <div class="preview-content">
        <div ref="container" v-html="html" />
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

.preview-header {
  height: 56px;
  box-sizing: border-box;
  padding: 0 24px;
  border-bottom: 1px solid var(--border-light);
  background: var(--bg-primary);
  display: flex;
  align-items: center;
  gap: 12px;
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

.preview-container {
  flex: 1;
  overflow-y: auto;
  overflow-x: auto;
  padding: 2px 0;
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
