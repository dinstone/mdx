<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { getBridge } from './bridge'
import type { FileEntry } from './bridge'
import { useWorkspaceStore } from './stores/workspace'
import { VirtualWorkspace, type IWorkspace } from './stores/workspace-types'
import { useEditorStore } from './stores/editor'
import { useThemeStore } from './stores/themes'
import SystemRail from './components/SystemRail.vue'
import SidebarPanel from './components/SidebarPanel.vue'
import ContentArea from './components/ContentArea.vue'
import MovePicker from './components/MovePicker.vue'
import WorkspacePicker from './components/WorkspacePicker.vue'
import RenameDialog from './components/RenameDialog.vue'
import ThemeSelector from './components/ThemeSelector.vue'
import MediaManager from './components/MediaManager.vue'
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
      if (seq === _wechatBuildSeq) {
        cachedWechatHtml.value = inlined
      }
    } catch (e) {
      console.warn('[App] buildInlinedWechatHtml failed:', e)
      if (seq === _wechatBuildSeq) {
        cachedWechatHtml.value = html
      }
    }
  },
  { immediate: true },
)

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
  workspace.removeRecentWorkspace(ws)
}

async function createFile(dirPath?: string) {
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

function copyTitle(title: string) {
  try {
    navigator.clipboard.writeText(title)
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
  if (!editor.exportHtml) return
  try {
    await navigator.clipboard.writeText(editor.exportHtml)
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

const showMediaManager = ref(false)

function openImageHost() {
  showMediaManager.value = true
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

// 工作区栏默认隐藏，由 SystemRail 的"工作区"图标展开/收起
const workspaceOpen = ref(false)

// 视图模式：分栏 / 仅编辑 / 仅预览
type ViewMode = 'split' | 'editor' | 'preview'
const viewMode = ref<ViewMode>('split')

function onOpenSettings() {
  // 设置：预留
}

async function onRevealInFinder() {
  const path = editor.filePath
  if (!path) return
  try {
    await getBridge().showItemInFolder(path)
  } catch (e) {
    console.error('[reveal-in-finder] failed:', e)
  }
}

const isSaved = computed(() => !editor.isModified)
</script>

<template>
  <div class="three-pane" :class="{ 'ws-collapsed': !workspaceOpen }">
    <SystemRail
      :is-dark="isDark"
      :workspace-open="workspaceOpen"
      @toggle-workspace="workspaceOpen = !workspaceOpen"
      @open-theme="openTheme"
      @open-image-host="openImageHost"
      @toggle-dark="toggleDark"
      @open-settings="onOpenSettings"
    />

    <div class="workspace-rail">
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

    <ContentArea
      v-model="editorContent"
      :file-name="editor.fileName"
      :saved="isSaved"
      :is-external="editor.isExternal"
      :external-file-path="editor.filePath"
      :rendered-html="editor.renderedHtml"
      :is-dark="isDark"
      :view-mode="viewMode"
      :has-active-file="workspace.hasActiveFile"
      @save="editor.saveFile()"
      @set-view-mode="viewMode = $event"
      @copy-wechat="copyWechat"
      @copy-html="copyHtml"
      @reveal-in-finder="onRevealInFinder"
      @select-workspace="selectWorkspace"
    />

    <ThemeSelector
      :open="showThemePanel"
      :current-id="themeStore.currentThemeId"
      :is-dark="isDark"
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
    <MediaManager
      v-if="showMediaManager"
      @close="showMediaManager = false"
    />
    <ToastMessage />
  </div>
</template>

<style>
.three-pane {
  height: 100vh;
  display: flex;
  gap: 10px;
  padding: 10px;
  box-sizing: border-box;
  overflow: hidden;
  background: var(--bg-page);
}

.three-pane.ws-collapsed {
  --ws-width: 0px;
}

.three-pane.ws-collapsed .workspace-rail {
  opacity: 0;
  overflow: hidden;
  margin: 0 -10px;
  pointer-events: none;
  transform: translateX(-8px);
}

.workspace-rail {
  flex: 0 0 var(--ws-width, 280px);
  transition: flex-basis 0.28s ease, opacity 0.2s ease, transform 0.28s ease, margin 0.28s ease;
  min-width: 0;
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: var(--border-width) solid var(--glass-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

.workspace-rail :deep(.file-sidebar) {
  height: 100%;
}

@media (max-width: 1100px) {
  .workspace-rail {
    --ws-width: 240px;
  }
}
</style>
