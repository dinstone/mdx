/**
 * useMedia — 工作空间媒体（图片 + 附件）管理 composable
 *
 * 职责：
 *   - scan()            扫描工作空间全部 .md，提取 img:// 与 att:// 引用，
 *                      结合已存储图片/附件计算「正常引用 / 孤立」分组
 *   - deleteMedia()    删除单条媒体（图片走 ImageStorage；附件走 AttachmentStorage）
 *   - cleanupOrphans() 批量清理孤立图片与孤立附件（各自的 vacuum）
 *
 * 设计说明：
 *   - 图片采用内容寻址（hash8）存储，URL 形如 img://<hash8>，原始文件名保留在
 *     Markdown 的 alt 文本中，故可从引用处还原展示名。
 *   - 附件 URL 形如 att://<hash8>.<ext>，存储文件名为 <hash8>.<ext>，
 *     原始文件名保留在 Markdown 的链接文本中。
 */

import { ref, shallowRef } from 'vue'
import { getBridge } from '../bridge'
import { useWorkspaceStore } from '../stores/workspace'
import { getImageStorage } from '../services/imageStorage'
import { getAttachmentStorage } from '../services/attachmentStorage'

export interface MediaItem {
  hash: string
  /** 原始文件名（来自 Markdown 的 alt / 链接文本），无法还原时回退为 hash */
  name: string
  kind: 'image' | 'attachment'
  mime: string
  /** 字节数；后端未跟踪时为 0 */
  size: number
  /** 创建时间（Unix ms）；后端未跟踪时为 0 */
  createdAt: number
  /** 引用该媒体的文档绝对路径列表 */
  referencedBy: string[]
  /** 是否存在于存储中但没有任何文档引用 */
  isOrphan: boolean
  /** 图片缩略图 blob URL；附件或断链图片为 '' */
  blobUrl: string
  /** 引用存在但存储文件缺失（图片/附件断链） */
  storageUnknown?: boolean
}

/** 图片引用：![alt](img://<hash8>[.ext]?) */
const IMG_RE = /!\[([^\]]*)\]\(img:\/\/([a-f0-9]{8})(\.[a-zA-Z0-9]+)?\)/g
/** 附件引用：[text](att://<hash8>.<ext>) */
const ATT_RE = /\[([^\]]*)\]\(att:\/\/([a-f0-9]{8}\.[a-zA-Z0-9]+)\)/g

/** 附件上传/存储后端已就绪 */
export const ATTACHMENT_BACKEND_READY = true

// 模块级缩略图缓存，避免重复 createObjectURL
const thumbCache = new Map<string, string>()

function basename(p: string): string {
  const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'))
  return i >= 0 ? p.slice(i + 1) : p
}

/** 去掉链接文本里可能的前导 📎 标记 */
function cleanName(text: string): string {
  return (text || '').replace(/^📎\s*/, '').trim()
}

async function resolveThumb(hash: string): Promise<string> {
  const cached = thumbCache.get(hash)
  if (cached) return cached
  try {
    const storage = await getImageStorage()
    const blob = await storage.load(hash)
    if (!blob) return ''
    const url = URL.createObjectURL(blob)
    thumbCache.set(hash, url)
    return url
  } catch {
    return ''
  }
}

export function useMedia() {
  const items = shallowRef<MediaItem[]>([])
  const loading = ref(false)
  const error = ref('')
  const lastScanMs = ref(0)

  async function scan(): Promise<void> {
    loading.value = true
    error.value = ''
    const t0 = performance.now()
    try {
      const ws = useWorkspaceStore()
      // 读取 .md 内容必须用「当前工作空间自己的 bridge」：
      // Temp 等虚拟工作空间文件存在 IndexedDB（BrowserBridge），而全局
      // getBridge() 在桌面模式下返回 Go/DesktopBridge，读不到 /Temp 下的文件，
      // 会导致引用扫描为空、所有图片被误判为孤立。
      const readBridge = ws.current?.bridge ?? getBridge()
      const imageStorage = await getImageStorage()
      const attachmentStorage = await getAttachmentStorage()

      const imgStored = await imageStorage.list()
      const attStored = await attachmentStorage.list()
      const imgStoredHashes = new Set(imgStored.map((m) => m.hash))
      const attStoredKeys = new Set(attStored.map((m) => m.key))

      const imgRefs = new Map<string, { name: string; docs: Set<string> }>()
      const attRefs = new Map<string, { name: string; docs: Set<string> }>()

      for (const mdPath of ws.mdFiles) {
        let content = ''
        try {
          const r = await readBridge.readFile(mdPath)
          content = r.content
        } catch {
          continue
        }
        let m: RegExpExecArray | null
        IMG_RE.lastIndex = 0
        while ((m = IMG_RE.exec(content)) !== null) {
          const hash = m[2]
          const name = cleanName(m[1]) || hash
          if (!imgRefs.has(hash)) imgRefs.set(hash, { name, docs: new Set() })
          imgRefs.get(hash)!.docs.add(mdPath)
        }
        ATT_RE.lastIndex = 0
        while ((m = ATT_RE.exec(content)) !== null) {
          const key = m[2]
          const name = cleanName(m[1]) || key
          if (!attRefs.has(key)) attRefs.set(key, { name, docs: new Set() })
          attRefs.get(key)!.docs.add(mdPath)
        }
      }

      const result: MediaItem[] = []

      // 图片：以存储为准
      for (const meta of imgStored) {
        const ref = imgRefs.get(meta.hash)
        result.push({
          hash: meta.hash,
          name: ref?.name || meta.hash,
          kind: 'image',
          mime: meta.mime || 'image/png',
          size: meta.originalSize,
          createdAt: meta.createdAt,
          referencedBy: ref ? [...ref.docs] : [],
          isOrphan: !ref,
          blobUrl: '',
        })
      }
      // 文档引用了但存储里没有的图片（断链），也列出来
      for (const [hash, ref] of imgRefs) {
        if (!imgStoredHashes.has(hash)) {
          result.push({
            hash,
            name: ref.name,
            kind: 'image',
            mime: 'image/png',
            size: 0,
            createdAt: 0,
            referencedBy: [...ref.docs],
            isOrphan: false,
            blobUrl: '',
            storageUnknown: true,
          })
        }
      }

      // 附件：以存储为准
      for (const meta of attStored) {
        const ref = attRefs.get(meta.key)
        result.push({
          hash: meta.key,
          name: ref?.name || meta.key,
          kind: 'attachment',
          mime: meta.mime || 'application/octet-stream',
          size: meta.size,
          createdAt: meta.createdAt,
          referencedBy: ref ? [...ref.docs] : [],
          isOrphan: !ref,
          blobUrl: '',
        })
      }
      // 文档引用了但存储里没有的附件（断链），也列出来
      for (const [key, ref] of attRefs) {
        if (!attStoredKeys.has(key)) {
          result.push({
            hash: key,
            name: ref.name,
            kind: 'attachment',
            mime: 'application/octet-stream',
            size: 0,
            createdAt: 0,
            referencedBy: [...ref.docs],
            isOrphan: false,
            blobUrl: '',
            storageUnknown: true,
          })
        }
      }

      // 解析图片缩略图
      await Promise.all(
        result
          .filter((it) => it.kind === 'image' && !it.storageUnknown)
          .map(async (it) => {
            it.blobUrl = await resolveThumb(it.hash)
          }),
      )

      items.value = result
      lastScanMs.value = Math.round(performance.now() - t0)
    } catch (e: any) {
      error.value = e?.message || String(e)
    } finally {
      loading.value = false
    }
  }

  async function deleteMedia(item: MediaItem): Promise<void> {
    if (item.kind === 'attachment') {
      const attachmentStorage = await getAttachmentStorage()
      await attachmentStorage.delete(item.hash)
    } else {
      const imageStorage = await getImageStorage()
      await imageStorage.delete(item.hash)
      const url = thumbCache.get(item.hash)
      if (url) {
        URL.revokeObjectURL(url)
        thumbCache.delete(item.hash)
      }
    }
    await scan()
  }

  async function cleanupOrphans(): Promise<void> {
    const imageStorage = await getImageStorage()
    const activeImages = new Set(
      items.value.filter((it) => it.kind === 'image' && !it.isOrphan).map((it) => it.hash),
    )
    await imageStorage.vacuum(activeImages)

    const attachmentStorage = await getAttachmentStorage()
    const activeAttachments = new Set(
      items.value.filter((it) => it.kind === 'attachment' && !it.isOrphan).map((it) => it.hash),
    )
    await attachmentStorage.vacuum(activeAttachments)

    await scan()
  }

  return {
    items,
    loading,
    error,
    lastScanMs,
    basename,
    scan,
    deleteMedia,
    cleanupOrphans,
  }
}
