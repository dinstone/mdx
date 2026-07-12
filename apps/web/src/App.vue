<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { getBridge } from './bridge'
import { useWorkspaceStore } from './stores/workspace'
import { useEditorStore } from './stores/editor'
import AppHeader from './components/AppHeader.vue'
import SidebarPanel from './components/SidebarPanel.vue'
import MarkdownEditor from './components/MarkdownEditor.vue'
import PreviewPanel from './components/PreviewPanel.vue'
import ThemeSelector from './components/ThemeSelector.vue'
import { themeOptions } from './config/themes'

const bridge = getBridge()
const workspace = useWorkspaceStore()
const editor = useEditorStore()

const platformInfo = ref({ os: '', arch: '', version: '' })
const isDark = ref((() => {
  try {
    return localStorage.getItem('mdx-ui-theme') === 'dark'
  } catch {
    return false
  }
})())

onMounted(async () => {
  const info = await bridge.getPlatform()
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

function toggleDark() {
  isDark.value = !isDark.value
}

async function openFolder() {
  try {
    const state = await bridge.pickFolder()
    workspace.applyState(state)
  } catch (e) {
    console.error('Open folder failed', e)
  }
}

async function selectWorkspace() {
  if (!bridge.isDesktop) {
    await workspace.open('/demo')
  } else {
    await openFolder()
  }
}

function createFile() {
  if (!workspace.rootPath) return
  workspace.createFile(workspace.rootPath, `note-${Date.now()}.md`)
}

function createFolder() {
  if (!workspace.rootPath) return
  workspace.createFolder(workspace.rootPath, `folder-${Date.now()}`)
}

const editorContent = computed({
  get: () => editor.rawContent,
  set: (value: string) => editor.updateContent(value),
})

async function copyHtml() {
  if (!editor.renderedHtml) return
  try {
    await navigator.clipboard.writeText(editor.renderedHtml)
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = editor.renderedHtml
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
  }
}

async function copyWechat() {
  await copyHtml()
}

function openStorage() {
  // Browser-only placeholder: open demo workspace
  workspace.open('/demo').catch(() => {})
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

function selectTheme(name: string) {
  editor.setThemeByName(name)
}

const showThemePanel = ref(false)
const showSidebar = ref(true)
const themeSelectorOptions = themeOptions.map((t) => ({ name: t.name, value: t.name }))

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
</script>

<template>
  <div class="app">
    <AppHeader
      :is-dark="isDark"
      :is-desktop="bridge.isDesktop"
      :sidebar-visible="showSidebar"
      @toggle-dark="toggleDark"
      @toggle-sidebar="toggleSidebar"
      @open-storage="openStorage"
      @open-image-host="openImageHost"
      @open-theme="openTheme"
      @copy-html="copyHtml"
      @copy-wechat="copyWechat"
    />

    <main class="app-main" :class="{ 'sidebar-hidden': !showSidebar }">
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
          />
        </div>
      </div>

      <div class="workspace">
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
                {{ bridge.isDesktop ? '打开文件夹' : '打开示例工作区' }}
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
      :options="themeSelectorOptions"
      :current="editor.currentThemeName"
      @select="selectTheme"
      @close="closeTheme"
    />
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
  grid-template-columns: 280px minmax(0, 1fr);
  gap: var(--spacing-xl);
  padding: var(--spacing-xl) var(--spacing-xxl);
  width: 100%;
  box-sizing: border-box;
  overflow: hidden;
  position: relative;
}

.app-main.sidebar-hidden {
  grid-template-columns: minmax(0, 1fr);
}

.history-pane {
  position: relative;
  overflow: hidden;
  height: 100%;
  min-height: 0;
  border-radius: 0;
  background: transparent;
}

.history-pane__content {
  height: 100%;
  min-height: 0;
  border-radius: 0;
  overflow: hidden;
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: var(--border-width) solid var(--glass-border);
  box-shadow: var(--glass-shadow);
  transition:
    transform 0.35s ease,
    box-shadow 0.35s ease,
    border-color 0.35s ease;
}

.workspace {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(0, 0.85fr);
  gap: var(--spacing-xl);
  height: 100%;
  min-height: 0;
}

.editor-pane,
.preview-pane {
  height: 100%;
  min-height: 0;
  border-radius: 0;
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: var(--border-width) solid var(--glass-border);
  box-shadow: var(--glass-shadow);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.editor-pane:hover,
.preview-pane:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
  border-color: color-mix(in srgb, var(--border-color) 60%, transparent);
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
    padding: 20px 24px 32px;
  }
}

@media (max-width: 1280px) {
  .app-main {
    grid-template-columns: 240px 1fr;
  }
}

@media (max-width: 960px) {
  .app-main {
    padding: 16px;
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
    grid-template-columns: 1fr;
    grid-template-rows: 1fr;
    padding: 8px;
    gap: 8px;
  }

  .history-pane {
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

  .editor-pane:hover,
  .preview-pane:hover {
    transform: none;
  }
}
</style>
