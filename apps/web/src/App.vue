<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { getBridge } from './bridge'
import type { FileEntry } from './bridge'
import { useWorkspaceStore } from './stores/workspace'
import { VirtualWorkspace, type IWorkspace } from './stores/workspace-types'
import { useEditorStore } from './stores/editor'
import { useThemeStore } from './stores/themes'
import AppHeader from './components/AppHeader.vue'
import SidebarPanel from './components/SidebarPanel.vue'
import MovePicker from './components/MovePicker.vue'
import WorkspacePicker from './components/WorkspacePicker.vue'
import MarkdownEditor from './components/MarkdownEditor.vue'
import PreviewPanel from './components/PreviewPanel.vue'
import RenameDialog from './components/RenameDialog.vue'
import ThemeSelector from './components/ThemeSelector.vue'
import { copyToWechat, buildInlinedWechatHtml } from './services/wechatCopyService'
import { resetImageStorage } from './services/imageStorage'
import { useToast } from './composables/useToast'
import ToastMessage from './components/ToastMessage.vue'

const isDesktop = computed(() => getBridge().isDesktop)
const workspace = useWorkspaceStore()
const editor = useEditorStore()
const themeStore = useThemeStore()
const toast = useToast()

const showWorkspacePicker = ref(false)
const workspacePickerList = computed(() => {
  const list = workspace.recentWorkspaces
  if (!list.some((w) => w.path === '/Temp')) {
    return [new VirtualWorkspace('/Temp', 'Temp'), ...list]
  }
  return list
})

const platformInfo = ref({ os: '', arch: '', version: '' })
const isDark = ref((() => {
  try {
    return localStorage.getItem('mdx-ui-theme') === 'dark'
  } catch {
    return false
  }
})())

onMounted(async () => {
  const info = await getBridge().getPlatform()
  platformInfo.value = info
})

watch(isDark, (value) => {
  localStorage.setItem('mdx-ui-theme', value ? 'dark' : 'default')
  // Apply the theme to <html> so the CSS variables are global and
  // every component (including deeply-nested form controls) follows it.
  if (value) {
    document.documentElement.setAttribute('data-ui-theme', 'dark')
  } else {
    document.documentElement.removeAttribute('data-ui-theme')
  }
}, { immediate: true })

// 预计算图片内联后的微信 HTML，避免复制时异步操作导致 user gesture 过期
const cachedWechatHtml = ref('')
let _wechatBuildSeq = 0
watch(
  () => editor.wechatHtml,
  async (html) => {
    if (!html) {
      cachedWechatHtml.value = ''
      return
    }
    const seq = ++_wechatBuildSeq
    try {
      const inlined = await buildInlinedWechatHtml(html)
      // 防止旧请求覆盖新结果
      if (seq === _wechatBuildSeq) {
        cachedWechatHtml.value = inlined
      }
    } catch (e) {
      console.warn('[App] buildInlinedWechatHtml failed:', e)
      // 降级：没有图片内联也先缓存，复制时 execCommand 仍可工作
      if (seq === _wechatBuildSeq) {
        cachedWechatHtml.value = html
      }
    }
  },
  { immediate: true },
)

// 工作区切换时重置图片存储后端（虚拟 ↔ 真实目录）
watch(
  () => workspace.current,
  () => resetImageStorage(),
)

function toggleDark() {
  isDark.value = !isDark.value
}

async function pickDesktopFolder() {
  try {
    const state = await getBridge().pickFolder()
    workspace.applyState(state)
  } catch (e) {
    console.error('Open folder failed', e)
  }
}

function selectWorkspace() {
  showWorkspacePicker.value = true
}

async function onSelectWorkspace(ws: IWorkspace) {
  showWorkspacePicker.value = false
  if (!ws) return
  try {
    await workspace.openWorkspace(ws)
  } catch (e) {
    console.error('Open workspace failed', e)
  }
}

function onOpenWorkspaceFolder() {
  showWorkspacePicker.value = false
  pickDesktopFolder()
}
function onRemoveWorkspace(ws: IWorkspace) {
  // 仅从最近列表中移除，不删除实际文件夹
  workspace.removeRecentWorkspace(ws)
}async function createFile(dirPath?: string) {
  const targetDir = dirPath || workspace.rootPath
  if (!targetDir) return
  await workspace.createFile(targetDir, `note-${Date.now()}.md`)
}

async function createFolder(dirPath?: string) {
  const targetDir = dirPath || workspace.rootPath
  if (!targetDir) return
  await workspace.createFolder(targetDir, `folder-${Date.now()}`)
}

async function deleteEntry(path: string) {
  const entry = findEntry(path, workspace.entries)
  if (!entry) return
  if (entry.type === 'dir') {
    await workspace.deleteFolder(path)
  } else {
    await workspace.deleteFile(path)
  }
}

const showMovePicker = ref(false)
const moveSourcePath = ref('')

const showRenameDialog = ref(false)
const renamePath = ref('')
const renameName = ref('')
const renameIsFile = ref(false)

function onRenamePicker(path: string) {
  const entry = findEntry(path, workspace.entries)
  if (!entry) return
  renamePath.value = path
  renameName.value = entry.type === 'file' ? entry.name.replace(/\.md$/i, '') : entry.name
  renameIsFile.value = entry.type === 'file'
  showRenameDialog.value = true
}

async function confirmRename(newName: string) {
  showRenameDialog.value = false
  const path = renamePath.value
  const isFile = renameIsFile.value
  renamePath.value = ''
  renameName.value = ''
  if (!path || !newName) return
  if (isFile) {
    await workspace.renameFile(path, `${newName.replace(/\.md$/i, '')}.md`)
  } else {
    await workspace.renameFolder(path, newName)
  }
}

function onMovePicker(path: string) {
  moveSourcePath.value = path
  showMovePicker.value = true
}

async function confirmMove(targetDir: string) {
  showMovePicker.value = false
  const sourcePath = moveSourcePath.value
  moveSourcePath.value = ''
  if (!sourcePath || !targetDir) return
  const entry = findEntry(sourcePath, workspace.entries)
  if (!entry) return
  if (entry.type === 'dir') {
    await workspace.moveFolder(sourcePath, targetDir)
  } else {
    await workspace.moveFile(sourcePath, targetDir)
  }
}

async function copyTitle(title: string) {
  try {
    await navigator.clipboard.writeText(title)
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = title
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
  }
}

function findEntry(path: string, entries: FileEntry[]): FileEntry | null {
  for (const e of entries) {
    if (e.path === path) return e
    if (e.children) {
      const found = findEntry(path, e.children)
      if (found) return found
    }
  }
  return null
}

const editorContent = computed({
  get: () => editor.rawContent,
  set: (value: string) => editor.updateContent(value),
})

async function copyHtml() {
  if (!editor.renderedHtml) return
  try {
    await navigator.clipboard.writeText(editor.renderedHtml)
    toast.success('已复制 HTML')
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = editor.renderedHtml
    document.body.appendChild(textarea)
    textarea.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(textarea)
    if (ok) {
      toast.success('已复制 HTML')
    } else {
      toast.error('复制 HTML 失败')
    }
  }
}

function copyWechat() {
  // 使用预计算的图片内联 HTML，同步复制，避免 user gesture 过期
  if (!cachedWechatHtml.value) return
  try {
    const copied = copyToWechat(cachedWechatHtml.value, { skipImageInline: true })
    if (copied) {
      toast.success('已复制，可以直接粘贴至微信公众号')
    } else {
      toast.error('复制到公众号失败')
    }
  } catch (e: any) {
    toast.error(`复制失败: ${e?.message || '未知错误'}`)
  }
}

function openStorage() {
  selectWorkspace()
}

function openImageHost() {
  // Placeholder: no-op
}

function openTheme() {
  showThemePanel.value = true
}

function closeTheme() {
  showThemePanel.value = false
}

function selectTheme(id: string) {
  editor.setTheme(id)
}

const showThemePanel = ref(false)

function closeDesigner() {}

const showSidebar = ref(true)

// -- Sidebar width drag --
const sidebarWidth = ref(280)
const isDraggingSidebar = ref(false)

let sidebarDragStartX = 0
function onSidebarDividerMouseDown(e: MouseEvent) {
  sidebarDragStartX = e.clientX
  document.addEventListener('mousemove', onSidebarDividerMouseMove)
  document.addEventListener('mouseup', onSidebarDividerMouseUp)
}

function onSidebarDividerMouseMove(e: MouseEvent) {
  if (!isDraggingSidebar.value && Math.abs(e.clientX - sidebarDragStartX) < 3) return
  if (!isDraggingSidebar.value) {
    isDraggingSidebar.value = true
    e.preventDefault()
  }
  const appMain = document.querySelector('.app-main') as HTMLElement | null
  if (!appMain) return
  const rect = appMain.getBoundingClientRect()
  const mouseX = e.clientX - rect.left
  sidebarWidth.value = Math.max(200, Math.min(500, mouseX))
}

function onSidebarDividerMouseUp() {
  isDraggingSidebar.value = false
  document.removeEventListener('mousemove', onSidebarDividerMouseMove)
  document.removeEventListener('mouseup', onSidebarDividerMouseUp)
}

const mainGridColumns = computed(() => {
  if (showSidebar.value) {
    return `${sidebarWidth.value}px 6px minmax(0, 1fr)`
  }
  return `minmax(0, 1fr)`
})

// scroll sync state
const editorScrollPercent = ref<number | null>(null)
const previewScrollPercent = ref<number | null>(null)

function onEditorScroll(p: number) {
  previewScrollPercent.value = p
}

function onPreviewScroll(p: number) {
  editorScrollPercent.value = p
}

function toggleSidebar() {
  showSidebar.value = !showSidebar.value
}

const isSaved = computed(() => !editor.isModified)

// -- Pane divider drag --
const editorRatio = ref(0.55) // editor takes 55% by default
const isDraggingDivider = ref(false)

let dividerDragStartX = 0
function onDividerMouseDown(e: MouseEvent) {
  dividerDragStartX = e.clientX
  document.addEventListener('mousemove', onDividerMouseMove)
  document.addEventListener('mouseup', onDividerMouseUp)
}

function onDividerMouseMove(e: MouseEvent) {
  if (!isDraggingDivider.value && Math.abs(e.clientX - dividerDragStartX) < 3) return
  if (!isDraggingDivider.value) {
    isDraggingDivider.value = true
    e.preventDefault()
  }
  const workspaceEl = document.querySelector('.workspace') as HTMLElement | null
  if (!workspaceEl) return
  const rect = workspaceEl.getBoundingClientRect()
  const gap = 0
  const dividerWidth = 6
  const availableWidth = rect.width - dividerWidth - gap * 2
  const mouseX = e.clientX - rect.left - gap
  editorRatio.value = Math.max(0.4, Math.min(0.6, mouseX / availableWidth))
}

function onDividerMouseUp() {
  isDraggingDivider.value = false
  document.removeEventListener('mousemove', onDividerMouseMove)
  document.removeEventListener('mouseup', onDividerMouseUp)
}

const workspaceGridColumns = computed(() => {
  const ed = editorRatio.value * 100
  const pv = (1 - editorRatio.value) * 100
  return `${ed}% 6px ${pv}%`
})
</script>

<template>
  <div class="app">
    <AppHeader
      :is-dark="isDark"
      :is-desktop="isDesktop"
      :sidebar-visible="showSidebar"
      @toggle-dark="toggleDark"
      @toggle-sidebar="toggleSidebar"
      @open-storage="openStorage"
      @open-theme="openTheme"
      @copy-html="copyHtml"
      @copy-wechat="copyWechat"
    />

    <main class="app-main" :style="{ gridTemplateColumns: mainGridColumns }">
      <div v-show="showSidebar" class="history-pane">
        <div class="history-pane__content">
          <SidebarPanel
            :title="workspace.title || 'Workspace'"
            :root-path="workspace.rootPath"
            :entries="workspace.entries"
            :active-path="workspace.activeFileId"
            :workspace-open="workspace.isOpen"
            @select="workspace.setActiveFile"
            @refresh="workspace.refresh()"
            @create-file="createFile"
            @create-folder="createFolder"
            @select-workspace="selectWorkspace"
            @rename="onRenamePicker"
            @delete="deleteEntry"
            @move-picker="onMovePicker"
            @copy-title="copyTitle"
            @expand-dir="workspace.expandDirectory($event)"
          />
        </div>
      </div>
      <div
        v-show="showSidebar"
        class="sidebar-divider"
        :class="{ 'sidebar-divider--dragging': isDraggingSidebar }"
        @mousedown="onSidebarDividerMouseDown"
      />

      <div class="workspace" :style="{ gridTemplateColumns: workspaceGridColumns }">
        <div class="editor-pane">
          <div v-if="!workspace.hasActiveFile" class="workspace-placeholder">
            <div class="placeholder-card">
              <h3>打开或新建文章</h3>
              <p>在左侧侧边栏选择一个文件，或点击新建按钮开始编辑。</p>
              <button
                v-if="!workspace.isOpen"
                class="btn-primary"
                @click="selectWorkspace"
              >
                切换工作区
              </button>
            </div>
          </div>
          <MarkdownEditor
            v-else
            v-model="editorContent"
            :file-name="editor.fileName"
            :saved="isSaved"
            :sync-scroll-percent="editorScrollPercent"
            @save="editor.saveFile()"
            @scroll-sync="onEditorScroll"
          />
        </div>
        <div
          class="pane-divider"
          :class="{ 'pane-divider--dragging': isDraggingDivider }"
          @mousedown="onDividerMouseDown"
        />
        <div class="preview-pane">
          <div v-if="!workspace.hasActiveFile" class="workspace-placeholder">
            <div class="placeholder-card">
              <h3>实时预览</h3>
              <p>选择文章后将在此处显示微信排版效果。</p>
            </div>
          </div>
          <PreviewPanel v-else :html="editor.renderedHtml" :sync-scroll-percent="previewScrollPercent" @scroll-sync="onPreviewScroll" />
        </div>
      </div>
    </main>
    <ThemeSelector
      :open="showThemePanel"
      :current-id="themeStore.currentThemeId"
      @select="selectTheme"
      @close="closeTheme"
    />
    <MovePicker
      v-if="showMovePicker"
      :source-path="moveSourcePath"
      :root-path="workspace.rootPath"
      :entries="workspace.entries"
      @close="showMovePicker = false"
      @select="confirmMove"
    />
    <WorkspacePicker
      :open="showWorkspacePicker"
      :current-path="workspace.rootPath"
      :recent-workspaces="workspacePickerList"
      :is-desktop="isDesktop"
      @close="showWorkspacePicker = false"
      @select="onSelectWorkspace"
      @open-folder="onOpenWorkspaceFolder"
      @remove="onRemoveWorkspace"
    />
    <RenameDialog
      :open="showRenameDialog"
      :name="renameName"
      :is-file="renameIsFile"
      @close="showRenameDialog = false"
      @confirm="confirmRename"
    />
    <ToastMessage />
  </div>
</template>

<style>
.app {
  height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: var(--bg-page);
}

.app-main {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 280px 6px minmax(0, 1fr);
  gap: 0;
  padding: 10px;
  width: 100%;
  box-sizing: border-box;
  overflow: hidden;
  position: relative;
}

.history-pane {
  position: relative;
  overflow: hidden;
  height: 100%;
  min-height: 0;
  border-radius: 0;
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: var(--border-width) solid var(--glass-border);
  box-shadow: var(--glass-shadow);
}

.history-pane__content {
  height: 100%;
  min-height: 0;
  border-radius: 0;
  overflow: hidden;
  background: transparent;
  border: none;
}

.sidebar-divider {
  width: 6px;
  cursor: col-resize;
  height: 100%;
  border-radius: 0;
  background: transparent;
  transition: background 0.2s ease;
  position: relative;
  z-index: 2;
  flex-shrink: 0;
}

.sidebar-divider::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 0;
  bottom: 0;
  width: 1px;
  border-radius: 1px;
  background: var(--border-light);
  transform: translateX(-50%);
}

.sidebar-divider:hover::after,
.sidebar-divider--dragging::after {
  background: var(--accent-color, #4a6cf7);
  opacity: 0.8;
}

.workspace {
  display: grid;
  gap: 0;
  height: 100%;
  min-height: 0;
}

.pane-divider {
  width: 6px;
  cursor: col-resize;
  height: 100%;
  border-radius: 0;
  background: transparent;
  transition: background 0.2s ease;
  position: relative;
  z-index: 2;
  flex-shrink: 0;
}

.pane-divider::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 0;
  bottom: 0;
  width: 1px;
  border-radius: 1px;
  background: var(--border-light);
  transform: translateX(-50%);
}

.pane-divider:hover::after,
.pane-divider--dragging::after {
  background: var(--accent-color, #4a6cf7);
  opacity: 0.8;
}

.editor-pane,
.preview-pane {
  height: 100%;
  min-height: 0;
  border-radius: 0;
  background: var(--bg-primary);
  border: var(--border-width) solid var(--glass-border);
  box-shadow: var(--glass-shadow);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.workspace-placeholder {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.placeholder-card {
  background: var(--bg-primary);
  border-radius: 0;
  padding: 24px;
  text-align: center;
  max-width: 320px;
  box-shadow: var(--shadow-md);
  border: 1px solid var(--border-light);
}

.placeholder-card h3 {
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 8px;
  color: var(--text-primary);
}

.placeholder-card p {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 16px;
  line-height: 1.6;
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 24px;
  background: var(--accent-gradient) !important;
  color: #ffffff !important;
  border: none;
  border-radius: var(--radius-pill);
  font-size: 14px;
  font-weight: 600;
  box-shadow: var(--shadow-md);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
}

.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-lg);
}

@media (max-width: 1440px) {
  .app-main {
    padding: 10px;
  }
}

@media (max-width: 1280px) {
  .app-main {
    grid-template-columns: 240px 6px minmax(0, 1fr);
    gap: 0;
  }
}

@media (max-width: 960px) {
  .app-main {
    padding: 10px;
  }

  .workspace {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }
}

@media (max-width: 768px) {
  .app {
    height: 100vh;
    height: 100dvh;
  }

  .app-main {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: 1fr;
    padding: 10px;
    gap: 8px;
  }

  .history-pane {
    display: none;
  }

  .sidebar-divider {
    display: none;
  }

  .workspace {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr;
    gap: 0;
  }

  .editor-pane,
  .preview-pane {
    border-radius: 0;
  }
}
</style>
