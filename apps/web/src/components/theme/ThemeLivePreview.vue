<script setup lang="ts">
/**
 * 主题实时预览 — iframe 沙箱隔离渲染
 */
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { createMarkdownParser, processHtml } from '@mdx/core'
import { getImageStorage } from '../../services/imageStorage'
import { katexCssLocalFonts } from '../../utils/katexStyle'

const props = defineProps<{
  css: string
  markdown?: string
  isDark?: boolean
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

## 数学公式

行内公式：质能方程 $E = mc^2$

高斯积分：$\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}$

块级公式：

$$
\frac{\partial}{\partial t} u(x,t) = \alpha \frac{\partial^2}{\partial x^2} u(x,t)
$$

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
    :root {
      --bg-page: #f8f9fa;
      --bg-primary: #ffffff;
      --bg-secondary: #f6f8fb;
      --bg-tertiary: #eef2f6;
      --text-primary: #0f172a;
      --text-secondary: #334155;
      --text-tertiary: #64748b;
      --border-light: #e2e8f0;
    }
    [data-ui-theme="dark"] {
      --bg-page: #1e1e1e;
      --bg-primary: #252526;
      --bg-secondary: #2d2d30;
      --bg-tertiary: #333333;
      --text-primary: #d4d4d4;
      --text-secondary: #9d9d9d;
      --text-tertiary: #6a6a6a;
      --border-light: #404040;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 16px;
      font-size: 14px;
      line-height: 1.6;
      background: var(--bg-page);
      color: var(--text-primary);
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

  // 同步外层暗色模式到 iframe 内的 <html>
  const htmlEl = doc.documentElement
  if (props.isDark) {
    htmlEl.setAttribute('data-ui-theme', 'dark')
  } else {
    htmlEl.removeAttribute('data-ui-theme')
  }

  const themeStyle = doc.getElementById('theme-style')
  const root = doc.getElementById('preview-root')
  if (!themeStyle || !root) return

  const gen = ++renderGeneration
  themeStyle.textContent = props.css

  // iframe 沙箱不继承父页面全局 CSS，需独立注入 KaTeX 样式（字体走同源本地打包，
  // 避免依赖外网 CDN —— 无网络或 WebView 拦截跨域字体时公式会渲染失败）
  let katexStyle = doc.getElementById('katex-style') as HTMLStyleElement | null
  if (!katexStyle) {
    katexStyle = doc.createElement('style')
    katexStyle.id = 'katex-style'
    doc.head.appendChild(katexStyle)
  }
  katexStyle.textContent = katexCssLocalFonts

  const mdHtml = parser.render(props.markdown ?? PREVIEW_MARKDOWN)
  // 把 KaTeX 样式一并交给 juice：否则 juice 只内联主题 CSS，KaTeX 元素会继承主题的
  // font-family 并被内联成 inline 样式（优先级高于 <head> 里的 .katex 类规则），
  // 导致公式字体被覆盖、渲染错乱。并入 KaTeX CSS 后，数学字体也会以 inline 形式
  // 内联（类更具体、排在主题之后而胜出）；<head> 的 katex-style 仍提供 @font-face。
  const html = processHtml(mdHtml, `${props.css}\n${katexCssLocalFonts}`, true)
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

watch(() => props.isDark, () => {
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
  background: var(--bg-page);
}

.tlp-iframe {
  flex: 1;
  border: none;
  width: 100%;
  min-height: 0;
}
</style>
