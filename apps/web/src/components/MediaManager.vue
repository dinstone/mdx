<script setup lang="ts">
/**
 * MediaManager — 工作空间媒体（图片 + 附件）管理器浮层
 *
 * Obsidian 风格：按「正常引用 / 孤立」分组，显示缩略图（图片）或类型图标（附件）、
 * 原始文件名、大小、被哪些文档引用，支持搜索、单条删除、批量清理孤立图片。
 *
 * 图片与附件的清理均已可用：删除单条、批量清理孤立项，均走各自的后端 vacuum。
 */
import { computed, onMounted, ref } from 'vue'
import { useMedia, type MediaItem } from '../composables/useMedia'
import { useToast } from '../composables/useToast'
import { useWorkspaceStore } from '../stores/workspace'
import { getBridge } from '../bridge'

const emit = defineEmits<{ close: [] }>()

const toast = useToast()
const { items, loading, error, lastScanMs, scan, deleteMedia, cleanupOrphans, basename } = useMedia()

const ws = useWorkspaceStore()
/** 桌面端 + 真实文件系统工作空间 → 媒体存于本地 .mdx-assets；其余（虚拟/Temp、浏览器模式）走 IndexedDB */
const isDesktop = getBridge().isDesktop
const onRealFs = computed(
  () => isDesktop && ws.current?.kind !== 'virtual' && !!ws.rootPath,
)
const wsName = computed(() => ws.current?.name || '未命名工作空间')
const rootDir = computed(() => ws.rootPath)
const imgDir = computed(() => (onRealFs.value ? joinPath(rootDir.value, '.mdx-assets/img') : ''))
const attDir = computed(() => (onRealFs.value ? joinPath(rootDir.value, '.mdx-assets/att') : ''))
const storageNote = computed(() =>
  isDesktop ? '浏览器本地数据库 (IndexedDB)' : '浏览器本地数据库 (IndexedDB)',
)

function joinPath(root: string, rel: string): string {
  return root.replace(/\/+$/, '') + '/' + rel
}

async function copyPath(p: string) {
  if (!p) return
  try {
    await navigator.clipboard.writeText(p)
    toast.success('路径已复制')
  } catch {
    toast.error('复制失败')
  }
}

const tab = ref<'image' | 'attachment'>('image')
const search = ref('')

onMounted(() => {
  scan()
})

const q = computed(() => search.value.trim().toLowerCase())
function matchName(it: MediaItem): boolean {
  return !q.value || it.name.toLowerCase().includes(q.value)
}

const imageItems = computed(() =>
  items.value.filter((it) => it.kind === 'image' && !it.storageUnknown && matchName(it)),
)
const referencedImages = computed(() => imageItems.value.filter((it) => !it.isOrphan))
const orphanImages = computed(() => imageItems.value.filter((it) => it.isOrphan))

const attachmentItems = computed(() =>
  items.value.filter((it) => it.kind === 'attachment' && matchName(it)),
)
const referencedAttachments = computed(() => attachmentItems.value.filter((it) => !it.isOrphan))
const orphanAttachments = computed(() => attachmentItems.value.filter((it) => it.isOrphan))

const totalAttachmentSize = computed(() =>
  attachmentItems.value.reduce((s, it) => s + (it.size || 0), 0),
)

const totalImageSize = computed(() =>
  imageItems.value.reduce((s, it) => s + (it.size || 0), 0),
)

function formatSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let n = bytes
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i++
  }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

function formatDate(ms: number): string {
  if (!ms || ms <= 0) return ''
  const d = new Date(ms)
  const p = (x: number) => String(x).padStart(2, '0')
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

async function onDelete(item: MediaItem) {
  try {
    await deleteMedia(item)
    toast.success(`已删除 ${item.name}`)
  } catch (e: any) {
    toast.error(e?.message || '删除失败')
  }
}

async function onCleanup() {
  const n = orphanImages.value.length + orphanAttachments.value.length
  if (n === 0) return
  try {
    await cleanupOrphans()
    toast.success(`已清理 ${n} 个孤立媒体（图片 + 附件）`)
  } catch (e: any) {
    toast.error(e?.message || '清理失败')
  }
}

function refresh() {
  scan()
}
</script>

<template>
  <Teleport to="body">
    <div class="mm-overlay" @click.self="emit('close')">
      <div class="mm-panel">
        <header class="mm-header">
          <div class="mm-header-left">
            <h3>媒体管理</h3>
            <span class="mm-wsname" :title="wsName">
              <span class="mm-wsdot" :class="{ virtual: ws.current?.kind === 'virtual' }"></span>
              {{ wsName }}
              <span v-if="ws.current?.kind === 'virtual'" class="mm-badge">虚拟</span>
            </span>
          </div>
          <div class="mm-header-actions">
            <button class="mm-btn" :disabled="loading" @click="refresh">↻ 刷新</button>
            <button class="mm-btn mm-close" @click="emit('close')">✕</button>
          </div>
        </header>

        <div class="mm-wsinfo">
          <template v-if="onRealFs">
            <div class="mm-path-row">
              <span class="mm-path-label">根目录</span>
              <code class="mm-path" :title="'点击复制：' + rootDir" @click="copyPath(rootDir)">{{ rootDir }}</code>
            </div>
            <div class="mm-path-row">
              <span class="mm-path-label">图片</span>
              <code class="mm-path" :title="'点击复制：' + imgDir" @click="copyPath(imgDir)">{{ imgDir }}</code>
            </div>
            <div class="mm-path-row">
              <span class="mm-path-label">附件</span>
              <code class="mm-path" :title="'点击复制：' + attDir" @click="copyPath(attDir)">{{ attDir }}</code>
            </div>
          </template>
          <div v-else class="mm-path-row">
            <span class="mm-path-label">存储</span>
            <code class="mm-path mm-path--note">{{ storageNote }}</code>
          </div>
        </div>

        <div class="mm-tabs">
          <button :class="{ active: tab === 'image' }" @click="tab = 'image'">
            图片 ({{ imageItems.length }})
          </button>
          <button :class="{ active: tab === 'attachment' }" @click="tab = 'attachment'">
            附件 ({{ attachmentItems.length }})
          </button>
        </div>

        <div class="mm-toolbar">
          <input v-model="search" class="mm-search" type="text" placeholder="搜索文件名…" />
          <span v-if="tab === 'image'" class="mm-summary">
            图片总大小 {{ formatSize(totalImageSize) }} · 扫描完成 ({{ lastScanMs }} ms)
          </span>
          <span v-else class="mm-summary">
            附件总大小 {{ formatSize(totalAttachmentSize) }} · 扫描完成 ({{ lastScanMs }} ms)
          </span>
        </div>

        <div v-if="error" class="mm-error">扫描出错：{{ error }}</div>

        <div class="mm-body">
          <!-- ============ 图片 ============ -->
          <template v-if="tab === 'image'">
            <div v-if="!loading && imageItems.length === 0" class="mm-empty">
              当前工作空间没有已存储的图片。
            </div>

            <section v-if="referencedImages.length" class="mm-group">
              <div class="mm-group-title">
                ✓ 正常引用 ({{ referencedImages.length }}) · {{ referencedImages.length }} 个被文档使用
              </div>
              <div class="mm-grid">
                <div v-for="it in referencedImages" :key="it.hash" class="mm-card">
                  <img v-if="it.blobUrl" :src="it.blobUrl" class="mm-thumb" alt="" />
                  <div v-else class="mm-thumb mm-thumb--broken">?</div>
                  <div class="mm-info">
                    <div class="mm-name" :title="it.name">{{ it.name }}</div>
                    <div class="mm-sub">被 {{ it.referencedBy.length }} 个文档引用</div>
                    <div class="mm-sub">{{ formatSize(it.size) }}<span v-if="formatDate(it.createdAt)"> · {{ formatDate(it.createdAt) }}</span></div>
                    <div v-if="it.referencedBy.length" class="mm-docs">
                      <span v-for="p in it.referencedBy.slice(0, 3)" :key="p" class="mm-doc">{{ basename(p) }}</span>
                      <span v-if="it.referencedBy.length > 3" class="mm-doc">+{{ it.referencedBy.length - 3 }}</span>
                    </div>
                  </div>
                  <button class="mm-del" title="删除" @click="onDelete(it)">🗑</button>
                </div>
              </div>
            </section>

            <section v-if="orphanImages.length" class="mm-group mm-group--warn">
              <div class="mm-group-title">
                ⚠ 孤立图片 ({{ orphanImages.length }}) · 没有任何文档引用
                <button class="mm-btn mm-btn--danger" @click="onCleanup">批量清理</button>
              </div>
              <div class="mm-grid">
                <div v-for="it in orphanImages" :key="it.hash" class="mm-card mm-card--orphan">
                  <img v-if="it.blobUrl" :src="it.blobUrl" class="mm-thumb" alt="" />
                  <div v-else class="mm-thumb mm-thumb--broken">?</div>
                  <div class="mm-info">
                    <div class="mm-name" :title="it.name">{{ it.name }}</div>
                    <div class="mm-sub mm-sub--warn">孤立 · 可安全删除</div>
                    <div class="mm-sub">{{ formatSize(it.size) }}</div>
                  </div>
                  <button class="mm-del" title="删除" @click="onDelete(it)">🗑</button>
                </div>
              </div>
            </section>
          </template>

          <!-- ============ 附件 ============ -->
          <template v-else>
            <div v-if="!loading && attachmentItems.length === 0" class="mm-empty">
              没有发现 <code>att://</code> 附件引用。
            </div>

            <section v-if="referencedAttachments.length" class="mm-group">
              <div class="mm-group-title">
                ✓ 正常引用 ({{ referencedAttachments.length }}) · {{ referencedAttachments.length }} 个被文档使用
              </div>
              <div class="mm-grid">
                <div v-for="it in referencedAttachments" :key="it.hash" class="mm-card">
                  <div class="mm-thumb mm-thumb--file">📎</div>
                  <div class="mm-info">
                    <div class="mm-name" :title="it.name">{{ it.name }}</div>
                    <div class="mm-sub">被 {{ it.referencedBy.length }} 个文档引用</div>
                    <div class="mm-sub">{{ formatSize(it.size) }}<span v-if="formatDate(it.createdAt)"> · {{ formatDate(it.createdAt) }}</span></div>
                    <div v-if="it.referencedBy.length" class="mm-docs">
                      <span v-for="p in it.referencedBy.slice(0, 3)" :key="p" class="mm-doc">{{ basename(p) }}</span>
                      <span v-if="it.referencedBy.length > 3" class="mm-doc">+{{ it.referencedBy.length - 3 }}</span>
                    </div>
                  </div>
                  <button class="mm-del" title="删除" @click="onDelete(it)">🗑</button>
                </div>
              </div>
            </section>

            <section v-if="orphanAttachments.length" class="mm-group mm-group--warn">
              <div class="mm-group-title">
                ⚠ 孤立附件 ({{ orphanAttachments.length }}) · 没有任何文档引用
                <button class="mm-btn mm-btn--danger" @click="onCleanup">批量清理</button>
              </div>
              <div class="mm-grid">
                <div v-for="it in orphanAttachments" :key="it.hash" class="mm-card mm-card--orphan">
                  <div class="mm-thumb mm-thumb--file">📎</div>
                  <div class="mm-info">
                    <div class="mm-name" :title="it.name">{{ it.name }}</div>
                    <div class="mm-sub mm-sub--warn">孤立 · 可安全删除</div>
                    <div class="mm-sub">{{ formatSize(it.size) }}</div>
                  </div>
                  <button class="mm-del" title="删除" @click="onDelete(it)">🗑</button>
                </div>
              </div>
            </section>
          </template>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.mm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 24px;
  box-sizing: border-box;
}

.mm-panel {
  width: 100%;
  max-width: 760px;
  max-height: 84vh;
  display: flex;
  flex-direction: column;
  /* 用不透明主题令牌（与 ThemeSelector 等面板一致），避免 --glass-* 依赖
     color-mix()/backdrop-filter：Wails WebView 不支持时 --glass-bg 会失效
     回退到 #fff，深色模式下面板变成白底。 */
  background: var(--bg-primary);
  border: var(--border-width, 1px) solid var(--border-light, #e5e5e5);
  border-radius: var(--radius-lg, 14px);
  box-shadow: var(--shadow-lg, 0 12px 40px rgba(0, 0, 0, 0.18));
  overflow: hidden;
  color: var(--text-primary, #1a1a1a);
}

.mm-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border-light, #eee);
}

.mm-header h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
}

.mm-header-actions {
  display: flex;
  gap: 8px;
}

.mm-btn {
  border: 1px solid var(--border-light, #ddd);
  background: transparent;
  color: var(--text-primary, #1a1a1a);
  border-radius: var(--radius-md, 8px);
  padding: 5px 12px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.mm-btn:hover {
  background: var(--bg-hover, #f2f2f2);
}

.mm-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.mm-close {
  font-size: 14px;
  line-height: 1;
}

.mm-header-left {
  display: flex;
  align-items: baseline;
  gap: 10px;
  min-width: 0;
}

.mm-wsname {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary, #666);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mm-wsdot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex: none;
  background: var(--accent-primary, #07c160);
}

.mm-wsdot.virtual {
  background: #f59e0b;
}

.mm-badge {
  font-size: 10px;
  font-weight: 700;
  color: #9a6b00;
  background: rgba(255, 179, 0, 0.16);
  border-radius: 4px;
  padding: 1px 5px;
}

.mm-wsinfo {
  padding: 10px 18px;
  border-bottom: 1px solid var(--border-light, #eee);
  background: var(--bg-secondary, #fafafa);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.mm-path-row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.mm-path-label {
  flex: none;
  width: 44px;
  font-size: 11px;
  color: var(--text-secondary, #888);
}

.mm-path {
  flex: 1;
  min-width: 0;
  font-family: var(--font-mono, monospace);
  font-size: 11.5px;
  color: var(--text-primary, #333);
  background: var(--bg-primary, #fff);
  border: 1px solid var(--border-light, #eee);
  border-radius: var(--radius-sm, 6px);
  padding: 3px 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.15s ease;
}

.mm-path:hover {
  border-color: var(--accent-primary, #07c160);
  color: var(--accent-primary, #07c160);
}

.mm-path--note {
  cursor: default;
  color: var(--text-secondary, #888);
}

.mm-path--note:hover {
  border-color: var(--border-light, #eee);
  color: var(--text-secondary, #888);
}

.mm-btn--danger {
  border-color: rgba(214, 69, 69, 0.4);
  color: #d64545;
  margin-left: 12px;
}

.mm-btn--danger:hover {
  background: rgba(214, 69, 69, 0.1);
}

.mm-tabs {
  display: flex;
  gap: 4px;
  padding: 10px 18px 0;
}

.mm-tabs button {
  border: none;
  background: transparent;
  color: var(--text-secondary, #666);
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border-radius: var(--radius-md, 8px) var(--radius-md, 8px) 0 0;
  border-bottom: 2px solid transparent;
}

.mm-tabs button.active {
  color: var(--accent-primary, #07c160);
  border-bottom-color: var(--accent-primary, #07c160);
}

.mm-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 18px;
  border-bottom: 1px solid var(--border-light, #eee);
}

.mm-search {
  flex: 0 0 220px;
  border: 1px solid var(--border-light, #ddd);
  border-radius: var(--radius-md, 8px);
  padding: 6px 10px;
  font-size: 13px;
  background: var(--bg-secondary, #fff);
  color: var(--text-primary, #1a1a1a);
  outline: none;
}

.mm-search:focus {
  border-color: var(--accent-primary, #07c160);
}

.mm-summary {
  font-size: 12px;
  color: var(--text-secondary, #888);
  margin-left: auto;
}

.mm-error {
  margin: 12px 18px 0;
  padding: 8px 12px;
  background: rgba(214, 69, 69, 0.1);
  color: #d64545;
  border-radius: var(--radius-md, 8px);
  font-size: 13px;
}

.mm-banner {
  margin: 14px 18px;
  padding: 10px 14px;
  background: rgba(255, 179, 0, 0.12);
  color: #9a6b00;
  border-radius: var(--radius-md, 8px);
  font-size: 13px;
  line-height: 1.5;
}

.mm-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 14px 18px 20px;
}

.mm-empty {
  text-align: center;
  color: var(--text-secondary, #999);
  font-size: 13px;
  padding: 40px 0;
}

.mm-group {
  margin-bottom: 18px;
}

.mm-group-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary, #555);
  margin-bottom: 10px;
  display: flex;
  align-items: center;
}

.mm-group--warn .mm-group-title {
  color: #d64545;
}

.mm-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 10px;
}

.mm-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border: 1px solid var(--border-light, #eee);
  border-radius: var(--radius-md, 10px);
  background: var(--bg-page, #fff);
  position: relative;
}

.mm-card--orphan {
  border-color: rgba(214, 69, 69, 0.3);
  background: rgba(214, 69, 69, 0.03);
}

.mm-thumb {
  width: 46px;
  height: 46px;
  border-radius: 8px;
  object-fit: cover;
  flex: 0 0 46px;
  background: var(--bg-hover, #f2f2f2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  color: var(--text-secondary, #888);
}

.mm-thumb--broken {
  color: var(--text-tertiary, #bbb);
}

.mm-thumb--file {
  background: rgba(7, 193, 96, 0.1);
}

.mm-info {
  min-width: 0;
  flex: 1;
}

.mm-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary, #1a1a1a);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mm-sub {
  font-size: 11px;
  color: var(--text-secondary, #888);
  margin-top: 2px;
}

.mm-sub--warn {
  color: #d64545;
}

.mm-docs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}

.mm-doc {
  font-size: 10px;
  color: var(--text-secondary, #999);
  background: var(--bg-hover, #f2f2f2);
  border-radius: 4px;
  padding: 1px 5px;
  max-width: 90px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mm-del {
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 14px;
  opacity: 0.5;
  padding: 4px;
  border-radius: 6px;
  transition: all 0.15s ease;
}

.mm-del:hover {
  opacity: 1;
  background: rgba(214, 69, 69, 0.12);
}
</style>
