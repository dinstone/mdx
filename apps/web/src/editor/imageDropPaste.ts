/**
 * imageDropPaste — CodeMirror 6 插件
 *
 * 拦截粘贴 / 拖拽事件中的图片文件，通过 ImagePipeline 处理后插入
 * img://{hash} Markdown 语法。
 *
 * 使用 capture 阶段的原生 DOM 监听器，因为 CM6 的 paste handler
 * 会在冒泡阶段消耗剪贴板数据。
 */

import { ViewPlugin, type EditorView } from '@codemirror/view'
import { processImages } from '../services/imagePipeline'
import type { ImageEntry } from '../services/imagePipeline'
import { useToast } from '../composables/useToast'

/** 图片处理中的 loading 回调（外部注入，用于显示进度） */
export type ImageProgressCallback = (state: 'start' | 'end', count?: number) => void

/** 图片文件类型过滤 */
function isImageFile(file: File): boolean {
  return file.type.startsWith('image/')
}

/** 过滤文件中的图片 */
function filterImages(files: FileList | File[]): File[] {
  return Array.from(files).filter(isImageFile)
}

/** 从 DataTransferItemList 中提取图片文件 */
function extractClipboardImages(items: DataTransferItemList): File[] {
  const files: File[] = []
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const file = item.getAsFile()
      if (file) files.push(file)
    }
  }
  return files
}

/** 在光标位置插入 Markdown 图片语法 */
function insertImageMarkdown(view: EditorView, entry: ImageEntry, alt?: string) {
  const pos = view.state.selection.main.from
  const altText = alt || `image-${entry.hash}`
  const markdown = `![${altText}](img://${entry.hash})\n`
  view.dispatch({
    changes: { from: pos, insert: markdown },
    selection: { anchor: pos + markdown.length },
  })
}

interface ImageDropPasteConfig {
  /** 图片处理开始时回调 */
  onProgress?: ImageProgressCallback
}

/**
 * 创建图片拖拽/粘贴 ViewPlugin
 */
function createImageDropPastePlugin(config: ImageDropPasteConfig = {}) {
  return ViewPlugin.define(
    (view) => {
      const toast = useToast()

      async function handlePaste(e: ClipboardEvent) {
        const items = e.clipboardData?.items
        if (!items) return

        const imageFiles = extractClipboardImages(items)
        if (imageFiles.length === 0) return

        // 有图片文件 → 截获事件，阻止默认粘贴行为
        e.preventDefault()
        e.stopPropagation()

        config.onProgress?.('start', imageFiles.length)
        try {
          const entries = await processImages(imageFiles)
          for (const entry of entries) {
            insertImageMarkdown(view, entry)
          }
          toast.success(`已插入 ${entries.length} 张图片`)
        } catch (err: any) {
          console.error('[ImageDropPaste] paste failed:', err)
          toast.error(`图片处理失败: ${err?.message || '未知错误'}`)
        } finally {
          config.onProgress?.('end')
        }
      }

      async function handleDrop(e: DragEvent) {
        const files = e.dataTransfer?.files
        if (!files) return

        const imageFiles = filterImages(files)
        if (imageFiles.length === 0) return

        // 有图片文件 → 阻止默认行为
        e.preventDefault()
        e.stopPropagation()

        config.onProgress?.('start', imageFiles.length)
        try {
          // 获取拖放位置对应的 CM 文档位置
          const coords = { x: e.clientX, y: e.clientY }
          const pos = view.posAtCoords(coords) ?? view.state.selection.main.from

          const entries = await processImages(imageFiles)
          for (const entry of entries) {
            const altText = imageFiles.find((f) => f.name)?.name?.replace(/\.[^.]+$/, '') || `image-${entry.hash}`
            const markdown = `![${altText}](img://${entry.hash})\n`
            view.dispatch({
              changes: { from: pos, insert: markdown },
            })
          }
          toast.success(`已插入 ${entries.length} 张图片`)
        } catch (err: any) {
          console.error('[ImageDropPaste] drop failed:', err)
          toast.error(`图片处理失败: ${err?.message || '未知错误'}`)
        } finally {
          config.onProgress?.('end')
        }
      }

      // 使用 capture 阶段，在 CM6 内部处理之前拦截
      view.dom.addEventListener('paste', handlePaste, true)
      view.dom.addEventListener('drop', handleDrop, true)

      return {
        destroy() {
          view.dom.removeEventListener('paste', handlePaste, true)
          view.dom.removeEventListener('drop', handleDrop, true)
        },
      }
    },
  )
}

/** 图片粘贴/拖拽 CodeMirror 6 扩展 */
export function imageDropPaste(config?: ImageDropPasteConfig) {
  return createImageDropPastePlugin(config)
}
