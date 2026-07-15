<script setup lang="ts">
/**
 * 主题实时预览 — iframe 沙箱隔离渲染
 */
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { createMarkdownParser, processHtml } from '@mdx/core'
import { getImageStorage } from '../../services/imageStorage'

const props = defineProps<{
  css: string
  markdown?: string
}>()

const iframeRef = ref<HTMLIFrameElement | null>(null)

// 预览用示例 Markdown
const PREVIEW_MARKDOWN = `# 一级标题示例

这是一段**加粗文本**、*斜体文本*、++下划线文本++、~~删除线文本~~、==高亮文本==和 [链接示例](https://github)。

正文段落通常需要设置行高和间距，以保证阅读体验。微信排版对样式的要求较高，一个好的主题能让文章脱颖而出。

---

## 二级标题

> 这是一个引用块示例，通常用于强调重要内容或摘录。好的排版能极大提升阅读体验。

| 平台 | 特点 | 适用程度 |
| :--- | :--- | :--- |
| 微信 | 封闭但流量大 | ★★★★★ |
| 博客 | 自由但流量小 | ★★★ |

### 三级标题

- 无序列表项
  - 嵌套的无序列表 A
  - 嵌套的无序列表 B

1. 有序列表项
   1. 嵌套的有序列表 A
   2. 嵌套的有序列表 B

#### 四级标题

这里有 \`行内代码\` 样式，也可以用来表示 \`npm install mdx\` 等指令。

\`\`\`js
// 代码块示例
function hello() {
  const a = 1;
  const b = 2;
  console.log("Hello, Markdown!");
}
\`\`\`

![示例图片](https://img.wemd.app/example.jpg)
`

// Markdown parser (without Mac bar for preview simplicity)
const parser = createMarkdownParser({ showMacBar: true })

const shellDoc = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style id="base-style">
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 16px;
      font-size: 14px;
      line-height: 1.6;
      background: #fff;
      color: #333;
    }
  </style>
  <style id="theme-style"></style>
</head>
<body><div id="preview-root"></div></body>
</html>
`

// 当前渲染中已使用的 blob URL（组件卸载时释放）
const activeBlobUrls = ref<string[]>([])
const nextBlobUrls = ref<string[]>([])
let renderGeneration = 0

const IMG_HASH_RE = /img:\/\/([a-f0-9]{8})/g

function revokeBlobUrls(urls: string[]) {
  for (const url of urls) {
    URL.revokeObjectURL(url)
  }
}

/** 把 HTML 中的 img://hash 替换为当前存储的 blob URL */
async function resolveImageUrls(html: string): Promise<string> {
  nextBlobUrls.value = []
  const hashes = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = IMG_HASH_RE.exec(html)) !== null) {
    hashes.add(m[1])
  }
  if (hashes.size === 0) return html

  const storage = await getImageStorage()
  const urlMap = new Map<string, string>()
  for (const hash of hashes) {
    try {
      const blob = await storage.load(hash)
      if (blob) {
        const url = URL.createObjectURL(blob)
        nextBlobUrls.value.push(url)
        urlMap.set(hash, url)
      }
    } catch {
      // 图片不存在或读取失败，保留原 img:// URL
    }
  }
  if (urlMap.size === 0) return html

  return html.replace(IMG_HASH_RE, (match, hash) => urlMap.get(hash) ?? match)
}

async function updateIframe() {
  const iframe = iframeRef.value
  if (!iframe) return

  const doc = iframe.contentDocument || iframe.contentWindow?.document
  if (!doc) return

  const themeStyle = doc.getElementById('theme-style')
  const root = doc.getElementById('preview-root')
  if (!themeStyle || !root) return

  const gen = ++renderGeneration
  themeStyle.textContent = props.css
  const mdHtml = parser.render(props.markdown ?? PREVIEW_MARKDOWN)
  const html = processHtml(mdHtml, props.css, true)
  const resolvedHtml = await resolveImageUrls(html)

  // 如果期间触发了新渲染，丢弃旧结果，避免旧 blob URL 覆盖新内容
  if (gen !== renderGeneration) return

  revokeBlobUrls(activeBlobUrls.value)
  activeBlobUrls.value = nextBlobUrls.value
  root.innerHTML = resolvedHtml
}

function safeUpdateIframe() {
  updateIframe().catch((err) => {
    console.error('[ThemeLivePreview] update failed:', err)
  })
}

watch(() => props.css, () => {
  safeUpdateIframe()
})

watch(() => props.markdown, () => {
  safeUpdateIframe()
})

onMounted(() => {
  const iframe = iframeRef.value
  if (!iframe) return
  // Always listen: srcDoc may not have loaded yet (about:blank readyState=complete is NOT our content)
  iframe.addEventListener('load', () => safeUpdateIframe(), { once: true })
  // Edge case: srcDoc already loaded before this hook ran
  const doc = iframe.contentDocument
  if (doc && doc.readyState === 'complete' && doc.getElementById('preview-root')) {
    safeUpdateIframe()
  }
})

onBeforeUnmount(() => {
  revokeBlobUrls(activeBlobUrls.value)
  revokeBlobUrls(nextBlobUrls.value)
})
</script>

<template>
  <div class="tlp-wrap">
    <iframe
      ref="iframeRef"
      class="tlp-iframe"
      :srcDoc="shellDoc"
      title="主题预览"
      sandbox="allow-same-origin"
    />
  </div>
</template>

<style scoped>
.tlp-wrap {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #fff;
}

.tlp-iframe {
  flex: 1;
  border: none;
  width: 100%;
  min-height: 0;
}
</style>
