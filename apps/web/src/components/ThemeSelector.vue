<script setup lang="ts">
/**
 * 主题管理器 + 可视化设计器 — 单面板三列布局
 * 左侧：主题列表  |  中间：实时预览  |  右侧：编辑控件
 */
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useThemeStore, type CustomTheme } from '../stores/themes'
import { useEditorStore } from '../stores/editor'
import { useToast } from '../composables/useToast'
import type { DesignerVariables, HeadingLevel } from '../theme-designer/types'
import { defaultVariables } from '../theme-designer/defaults'
import { generateCSS } from '../theme-designer/generateCSS'
import ThemeDesigner from './theme/ThemeDesigner.vue'
import ThemeLivePreview from './theme/ThemeLivePreview.vue'

const props = defineProps<{
  open: boolean
  currentId: string
  isDark: boolean
}>()

const emit = defineEmits<{
  select: [id: string]
  close: []
}>()

const themeStore = useThemeStore()
const editorStore = useEditorStore()
const toast = useToast()

// ---------------------------------------------------------------------------
// Selected theme in editor (highlighted in list + shown in right panel)
// ---------------------------------------------------------------------------
const selectedId = ref(props.currentId)

watch(() => props.open, (val) => {
  if (val) {
    selectedId.value = props.currentId
    // select first theme if nothing selected
    if (!selectedId.value) {
      selectedId.value = themeStore.allThemes[0]?.id ?? ''
    }
    loadThemeIntoEditor(selectedId.value)
  }
})

const selectedTheme = computed<CustomTheme | undefined>(() => {
  return themeStore.allThemes.find((t) => t.id === selectedId.value)
})

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------
const search = ref('')

const builtInList = computed(() =>
  themeStore.allThemes
    .filter((t) => t.isBuiltIn && t.name.toLowerCase().includes(search.value.toLowerCase())),
)

const customList = computed(() =>
  themeStore.customThemes
    .filter((t) => t.name.toLowerCase().includes(search.value.toLowerCase())),
)

// ---------------------------------------------------------------------------
// Right panel — visual editor state
// ---------------------------------------------------------------------------
const variables = ref<DesignerVariables>(JSON.parse(JSON.stringify(defaultVariables)))
const editingName = ref('')
/** Whether the selected theme is a visual theme (i.e. has designerVariables) */
const isVisualTheme = computed(() => {
  return selectedTheme.value?.editorMode === 'visual' && !!selectedTheme.value?.designerVariables
})
const isBuiltIn = computed(() => selectedTheme.value?.isBuiltIn ?? false)

/** 预览用 CSS：可视化主题用变量实时生成，内置/CSS 主题直接用主题自身 CSS */
const editingCSS = ref('')
const liveCSS = computed(() => {
  if (isVisualTheme.value) {
    return generateCSS(variables.value)
  }
  return selectedTheme.value?.css ?? ''
})
const hasUnsavedChanges = computed(() => {
  if (!selectedTheme.value) return false
  if (isBuiltIn.value) return false
  if (editingName.value.trim() !== selectedTheme.value.name) return true
  if (isVisualTheme.value) {
    return JSON.stringify(variables.value) !== JSON.stringify(selectedTheme.value.designerVariables)
  }
  return editingCSS.value !== (selectedTheme.value.css ?? '')
})

function loadThemeIntoEditor(id: string) {
  const t = themeStore.allThemes.find((x) => x.id === id)
  if (!t) return
  editingName.value = t.name
  editingCSS.value = t.css

  if (t.editorMode === 'visual' && t.designerVariables) {
    variables.value = JSON.parse(JSON.stringify(t.designerVariables))
  } else {
    variables.value = JSON.parse(JSON.stringify(defaultVariables))
  }
}

watch(() => selectedId.value, (id) => {
  loadThemeIntoEditor(id)
})

// ---------------------------------------------------------------------------
// Preview source toggle
// ---------------------------------------------------------------------------
const previewSource = ref<'sample' | 'current'>('current')
const previewMarkdown = computed(() => {
  if (previewSource.value === 'current' && editorStore.rawContent) {
    return editorStore.rawContent
  }
  // Fall back to sample
  return undefined // let ThemeLivePreview use default
})

// When panel opens and there's an active document, default to current article
watch(() => props.open, (val) => {
  if (val) {
    previewSource.value = editorStore.rawContent ? 'current' : 'sample'
  }
})

// ---------------------------------------------------------------------------
// Heading update relay (from ThemeDesigner to variables)
// ---------------------------------------------------------------------------
function onUpdateVariables(v: DesignerVariables) {
  variables.value = v
}

function onUpdateHeading(level: HeadingLevel, style: Partial<DesignerVariables[HeadingLevel]>) {
  variables.value = {
    ...variables.value,
    [level]: { ...variables.value[level], ...style },
  }
}

// ---------------------------------------------------------------------------
// Actions — save / apply
// ---------------------------------------------------------------------------
function handleSaveChanges() {
  if (!selectedTheme.value || selectedTheme.value.isBuiltIn) return

  const name = editingName.value.trim() || selectedTheme.value.name
  if (isVisualTheme.value) {
    themeStore.updateTheme(selectedId.value, {
      name,
      css: generateCSS(variables.value),
      designerVariables: JSON.parse(JSON.stringify(variables.value)),
    })
  } else {
    themeStore.updateTheme(selectedId.value, {
      name,
      css: editingCSS.value,
      designerVariables: undefined,
    })
  }

  // If saving the currently applied theme, emit select to refresh
  if (selectedId.value === themeStore.currentThemeId) {
    emit('select', selectedId.value)
  }

  toast.success('主题已保存')
}

function handleApply() {
  if (!selectedTheme.value) return

  // If there are unsaved changes and it's a custom theme, save first
  if (hasUnsavedChanges.value && !isBuiltIn.value) {
    handleSaveChanges()
  }

  if (selectedId.value !== themeStore.currentThemeId) {
    emit('select', selectedId.value)
  }
  emit('close')
}

/** "Copy & edit" a built-in theme into the visual editor */
function duplicateAndEdit() {
  if (!selectedTheme.value) return
  const sourceName = selectedTheme.value.name
  const newTheme = themeStore.createVisualTheme(
    `${sourceName} (副本)`,
    JSON.parse(JSON.stringify(variables.value)),
  )
  selectedId.value = newTheme.id
  editingName.value = `${sourceName} (副本)`
  toast.success(`已创建可视化副本「${newTheme.name}」`)
}

// ---------------------------------------------------------------------------
// Create theme dialog (in-panel)
// ---------------------------------------------------------------------------
const showCreateDialog = ref(false)
const newThemeName = ref('')
const createMode = ref<'duplicate' | 'blank' | 'visual'>('visual')

function openCreate() {
  showCreateDialog.value = true
  createMode.value = 'visual'
  newThemeName.value = ''
  nextTick(() => {
    const input = document.querySelector('.ts-create-dialog input') as HTMLInputElement | null
    input?.focus()
  })
}

function confirmCreate() {
  const name = newThemeName.value.trim()
  if (!name) return

  if (createMode.value === 'visual') {
    const t = themeStore.createVisualTheme(name, JSON.parse(JSON.stringify(defaultVariables)))
    selectedId.value = t.id
    // Don't apply immediately — let user edit first
  } else {
    const css = createMode.value === 'duplicate'
      ? themeStore.getThemeCSS(themeStore.currentThemeId)
      : ''
    const t = themeStore.createTheme(name, css)
    selectedId.value = t.id
    toast.success('主题创建成功')
  }
  showCreateDialog.value = false
  newThemeName.value = ''
}

function cancelCreate() {
  showCreateDialog.value = false
  newThemeName.value = ''
}

// ---------------------------------------------------------------------------
// Bottom bar actions
// ---------------------------------------------------------------------------
const showExportMenu = ref(false)
const showDeleteConfirm = ref(false)
const exportMenuEl = ref<HTMLElement | null>(null)

function onDocumentClick(e: MouseEvent) {
  if (!showExportMenu.value) return
  if (!exportMenuEl.value) return
  if (!exportMenuEl.value.contains(e.target as Node)) {
    showExportMenu.value = false
  }
}

function handleExport(type: 'json' | 'css') {
  showExportMenu.value = false
  if (!selectedTheme.value) return
  if (type === 'json') {
    themeStore.exportTheme(selectedId.value)
  } else {
    themeStore.exportThemeCSS(selectedId.value)
  }
}

function onDeleteClick() {
  if (!selectedTheme.value || isBuiltIn.value) return
  showDeleteConfirm.value = true
}

function cancelDelete() {
  showDeleteConfirm.value = false
}

function confirmDeleteFromBar() {
  if (!selectedTheme.value || isBuiltIn.value) return
  themeStore.deleteTheme(selectedId.value)
  if (selectedId.value === themeStore.currentThemeId) {
    selectedId.value = themeStore.currentThemeId
  }
  toast.success('主题已删除')
  showDeleteConfirm.value = false
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick)
})
// ---------------------------------------------------------------------------
// Import / Export
// ---------------------------------------------------------------------------
const fileInputRef = ref<HTMLInputElement | null>(null)

function triggerImport() {
  fileInputRef.value?.click()
}

async function handleImportFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const ok = await themeStore.importTheme(file)
  if (ok) {
    toast.success('主题导入成功')
  } else {
    toast.error('导入失败，请检查文件格式')
  }
  input.value = ''
}
</script>

<template>
  <div v-if="open" class="ts-overlay" @click.self="emit('close')">
    <div class="ts-panel">
      <!-- ========== LEFT: Theme list ========== -->
      <div class="ts-left">
        <div class="ts-left-header">
          <h3>主题管理</h3>
          <button class="ts-icon-btn" title="关闭" @click="emit('close')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <!-- Search -->
        <div class="ts-search">
          <input v-model="search" type="text" placeholder="搜索主题..." />
        </div>

        <!-- List -->
        <div class="ts-list">
          <div class="ts-section-label">内置主题</div>
          <button
            v-for="t in builtInList"
            :key="t.id"
            class="ts-item ts-item-builtin"
            :class="{ active: selectedId === t.id, applied: currentId === t.id }"
            @click="selectedId = t.id"
          >
            <svg class="ts-item-type-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <span class="ts-item-name">{{ t.name }}</span>
            <svg v-if="currentId === t.id" class="ts-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
          </button>

          <div v-if="customList.length > 0" class="ts-section-label">自定义主题</div>
          <div
            v-for="t in customList"
            :key="t.id"
            class="ts-item ts-item-custom"
            :class="{ active: selectedId === t.id, applied: currentId === t.id }"
            @click="selectedId = t.id"
          >
            <svg class="ts-item-type-icon ts-item-type-icon--custom" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
            <span class="ts-item-name">{{ t.name }}</span>
            <svg v-if="currentId === t.id" class="ts-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
          </div>

          <div v-if="search && builtInList.length === 0 && customList.length === 0" class="ts-empty">
            无匹配主题
          </div>
        </div>

        <!-- Footer buttons -->
        <div class="ts-left-footer">
          <button class="ts-foot-btn ts-foot-btn-primary" @click="openCreate">+ 新建自定义主题</button>
          <button class="ts-foot-btn" @click="triggerImport">导入主题</button>
          <input ref="fileInputRef" type="file" accept=".json" class="ts-file-hidden" @change="handleImportFile" />
        </div>
      </div>

      <!-- ========== CENTER: Preview ========== -->
      <div class="ts-center">
        <div class="ts-center-header">
          <h3>实时预览</h3>
          <div class="ts-preview-tabs">
            <button
              class="ts-preview-tab"
              :class="{ active: previewSource === 'current' }"
              @click="previewSource = 'current'"
            >当前文章</button>
            <button
              class="ts-preview-tab"
              :class="{ active: previewSource === 'sample' }"
              @click="previewSource = 'sample'"
            >示例内容</button>
          </div>
        </div>
        <ThemeLivePreview
          :key="selectedId"
          :css="liveCSS"
          :markdown="previewMarkdown"
          :is-dark="props.isDark"
        />
      </div>

      <!-- ========== RIGHT: Editor ========== -->
      <div class="ts-right">
        <div class="ts-right-header">
          <h3>主题样式</h3>
          <div class="ts-header-spacer" />
        </div>

        <!-- Editor content -->
        <div class="ts-right-body">
          <div class="ts-form-group">
            <label class="ts-form-label">主题名称</label>
            <input
              v-model="editingName"
              class="ts-name-input"
              :disabled="isBuiltIn"
              placeholder="输入主题名称..."
              @focus="($event.target as HTMLInputElement).select()"
            />
          </div>

          <!-- Visual editor for visual themes -->
          <div v-if="isVisualTheme" class="ts-designer-wrap">
            <ThemeDesigner
              :variables="variables"
              :readonly="false"
              @update:variables="onUpdateVariables"
              @update-heading="onUpdateHeading"
            />
          </div>

          <!-- Built-in / CSS-only theme: show CSS textarea + tip -->
          <template v-else>
            <div class="ts-form-group ts-form-group--grow">
              <label class="ts-form-label">CSS 样式</label>
              <textarea
                v-model="editingCSS"
                class="ts-css-textarea"
                :disabled="isBuiltIn"
                placeholder="/* CSS 样式 */"
                spellcheck="false"
              />
            </div>
            <div class="ts-tip">
              <span class="ts-tip-icon">&#x1F4A1;</span>
              <span>{{ isBuiltIn ? '内置主题不可编辑，点击下方"复制"按钮可基于此主题创建自定义主题' : 'CSS 主题可直接编辑，保存后生效' }}</span>
            </div>
          </template>
        </div>

        <!-- Action buttons moved to bottom bar -->
      </div>

      <!-- ========== BOTTOM: Unified action bar ========== -->
      <div class="ts-bottom-bar">
        <div class="ts-bottom-left">
          <template v-if="showDeleteConfirm">
            <button class="ts-btn ts-btn-delete" @click="confirmDeleteFromBar">确认删除</button>
            <button class="ts-btn ts-btn-cancel" @click="cancelDelete">取消</button>
          </template>
          <template v-else>
            <button
              class="ts-btn ts-btn-copy"
              title="复制并创建自定义主题"
              @click="duplicateAndEdit"
            >复制</button>
            <div class="ts-export-wrap" ref="exportMenuEl">
              <button class="ts-btn" @click="showExportMenu = !showExportMenu">
                导出
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              <div v-if="showExportMenu" class="ts-export-menu">
                <button @click="handleExport('json')">导出 JSON</button>
                <button @click="handleExport('css')">导出 CSS</button>
              </div>
            </div>
            <button
              class="ts-btn ts-btn-delete"
              :disabled="isBuiltIn"
              title="删除自定义主题"
              @click="onDeleteClick"
            >删除</button>
          </template>
        </div>
        <div class="ts-bottom-right">
          <template v-if="showDeleteConfirm">
            <span class="ts-delete-hint">删除后不可恢复，请确认</span>
          </template>
          <template v-else>
            <button class="ts-btn ts-btn-cancel" @click="emit('close')">取消</button>
            <button
              class="ts-btn ts-btn-save"
              :disabled="!hasUnsavedChanges || isBuiltIn"
              @click="handleSaveChanges"
            >保存修改</button>
            <button class="ts-btn ts-btn-apply" @click="handleApply">应用主题</button>
          </template>
        </div>
      </div>
    </div>

    <!-- Create dialog (overlay on panel) -->
    <div v-if="showCreateDialog" class="ts-create-overlay" @click.self="cancelCreate">
      <div class="ts-create-dialog">
        <h4>新建自定义主题</h4>
        <div class="ts-create-mode">
          <button class="ts-mode-btn" :class="{ active: createMode === 'visual' }" @click="createMode = 'visual'">可视化设计</button>
          <button class="ts-mode-btn" :class="{ active: createMode === 'duplicate' }" @click="createMode = 'duplicate'">复制当前主题</button>
          <button class="ts-mode-btn" :class="{ active: createMode === 'blank' }" @click="createMode = 'blank'">从空白创建</button>
        </div>
        <input
          v-model="newThemeName"
          type="text"
          placeholder="输入主题名称..."
          @keydown.enter="confirmCreate"
          @keydown.escape="cancelCreate"
        />
        <div class="ts-create-btns">
          <button class="ts-btn ts-btn-apply" :disabled="!newThemeName.trim()" @click="confirmCreate">创建</button>
          <button class="ts-btn ts-btn-cancel" @click="cancelCreate">取消</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ================================================================
   Overlay & Panel
   ================================================================ */
.ts-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: tsFadeIn 0.2s ease;
}

.ts-panel {
  width: 95vw;
  max-width: 1280px;
  height: 88vh;
  max-height: 900px;
  background: var(--bg-primary);
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
  display: grid;
  grid-template-columns: 240px 1fr 340px;
  grid-template-rows: 1fr auto;
  overflow: hidden;
}

/* ================================================================
   LEFT: Theme list
   ================================================================ */
.ts-left {
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border-light);
  background: var(--bg-secondary);
  overflow: hidden;
}

.ts-left-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-light);
  flex-shrink: 0;
}

.ts-left-header h3 {
  font-size: 14px;
  font-weight: 700;
  margin: 0;
  color: var(--text-primary);
}

.ts-icon-btn {
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}
.ts-icon-btn:hover { background: var(--bg-hover); color: var(--text-primary); }

/* Search */
.ts-search {
  padding: 10px 12px;
  flex-shrink: 0;
}
.ts-search input {
  width: 100%;
  padding: 7px 10px;
  border: 1px solid var(--border-light);
  border-radius: 6px;
  font-size: 12px;
  background: var(--bg-primary);
  color: var(--text-primary);
  outline: none;
}
.ts-search input:focus {
  border-color: var(--accent-primary, #07c160);
}

/* List */
.ts-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 8px 8px;
}

.ts-section-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-tertiary);
  padding: 8px 8px 4px;
}

.ts-item {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 7px 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  text-align: left;
  transition: all 0.12s;
  margin-bottom: 1px;
}
.ts-item:hover { background: var(--bg-hover); color: var(--text-primary); }
.ts-item.active {
  background: rgba(7, 193, 96, 0.12);
  color: var(--text-primary);
  font-weight: 600;
  box-shadow: inset 3px 0 0 var(--ui-accent-primary, #07c160);
}
.ts-item.applied { font-weight: 600; color: var(--ui-accent-primary, #07c160); }
.ts-item.active.applied {
  box-shadow: inset 3px 0 0 var(--ui-accent-primary, #07c160);
}

.ts-item-custom {
  padding-right: 4px;
}

.ts-item-type-icon {
  flex-shrink: 0;
  opacity: 0.45;
  transition: opacity 0.12s;
}
.ts-item:hover .ts-item-type-icon,
.ts-item.active .ts-item-type-icon { opacity: 0.7; }
.ts-item-type-icon--custom { opacity: 0.35; }
.ts-item:hover .ts-item-type-icon--custom,
.ts-item.active .ts-item-type-icon--custom { opacity: 0.55; }

.ts-item-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ts-check {
  flex-shrink: 0;
  color: var(--accent-primary, #07c160);
}

.ts-empty {
  text-align: center;
  padding: 20px;
  color: var(--text-tertiary);
  font-size: 13px;
}

/* Left footer */
.ts-left-footer {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  border-top: 1px solid var(--border-light);
  flex-shrink: 0;
}

.ts-foot-btn {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border-light);
  border-radius: 6px;
  background: var(--bg-primary);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}
.ts-foot-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
.ts-foot-btn-primary {
  background: var(--accent-primary, #07c160);
  color: #fff;
  border-color: var(--accent-primary, #07c160);
}
.ts-foot-btn-primary:hover { opacity: 0.9; }

.ts-file-hidden { display: none; }

/* ================================================================
   CENTER: Preview
   ================================================================ */
.ts-center {
  display: flex;
  flex-direction: column;
  background: var(--bg-page);
  overflow: hidden;
}

.ts-center-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-light);
  flex-shrink: 0;
}

.ts-center-header h3 {
  font-size: 14px;
  font-weight: 700;
  margin: 0;
  color: var(--text-primary);
}

.ts-preview-tabs {
  display: flex;
  gap: 0;
  border: 1px solid var(--border-light);
  border-radius: 6px;
  overflow: hidden;
  background: var(--bg-primary);
}

.ts-preview-tab {
  padding: 5px 16px;
  border: none;
  background: transparent;
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}
.ts-preview-tab.active {
  background: var(--accent-primary, #07c160);
  color: #fff;
  font-weight: 600;
}

.ts-center :deep(.tlp-wrap) {
  height: 100%;
  border: none;
}

/* ================================================================
   RIGHT: Editor
   ================================================================ */
.ts-right {
  display: flex;
  flex-direction: column;
  border-left: 1px solid var(--border-light);
  overflow: hidden;
  background: var(--bg-primary);
}

.ts-right-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-light);
  flex-shrink: 0;
}

.ts-right-header h3 {
  font-size: 14px;
  font-weight: 700;
  margin: 0;
  color: var(--text-primary);
}

.ts-header-spacer {
  width: 28px;
  height: 28px;
}

.ts-name-input {
  width: 100%;
  padding: 7px 10px;
  border: 1px solid var(--border-light);
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  background: var(--bg-primary);
  outline: none;
}
.ts-name-input:focus {
  border-color: var(--accent-primary, #07c160);
}
.ts-name-input:disabled {
  background: var(--bg-secondary);
  color: var(--text-tertiary);
  cursor: not-allowed;
}

/* Right body (controls or readonly info) */
.ts-right-body {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 16px;
  gap: 14px;
}

.ts-form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ts-form-group--grow {
  flex: 1;
  min-height: 0;
}

.ts-form-label {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
}

.ts-css-textarea {
  width: 100%;
  flex: 1;
  min-height: 120px;
  padding: 10px;
  border: 1px solid var(--border-light);
  border-radius: 6px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 1.5;
  resize: none;
  outline: none;
}
.ts-css-textarea:focus {
  border-color: var(--accent-primary, #07c160);
}
.ts-css-textarea:disabled {
  background: var(--bg-secondary);
  color: var(--text-tertiary);
  cursor: not-allowed;
}

.ts-designer-wrap {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  margin: -16px;
  padding: 16px;
}

.ts-tip {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 6px;
  color: #166534;
  font-size: 12px;
  line-height: 1.5;
}

.ts-tip-icon {
  flex-shrink: 0;
  font-size: 14px;
  line-height: 1.4;
}

/* Bottom action bar */
.ts-bottom-bar {
  grid-column: 1 / -1;
  grid-row: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-top: 1px solid var(--border-light);
  background: var(--bg-secondary);
  flex-shrink: 0;
  gap: 12px;
}

.ts-bottom-left,
.ts-bottom-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ts-bottom-bar .ts-btn {
  flex: 0 0 auto;
}

.ts-export-wrap {
  position: relative;
}

.ts-export-wrap .ts-btn {
  display: flex;
  align-items: center;
  gap: 4px;
}

.ts-export-menu {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 0;
  min-width: 120px;
  background: var(--bg-primary);
  border: 1px solid var(--border-light);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  padding: 4px;
  display: flex;
  flex-direction: column;
  z-index: 10;
}

.ts-export-menu button {
  padding: 8px 12px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  text-align: left;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
}

.ts-export-menu button:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.ts-btn-delete {
  color: #e53e3e;
  border-color: #e53e3e;
  background: var(--bg-primary);
}

.ts-btn-delete:hover:not(:disabled) {
  background: color-mix(in srgb, #e53e3e 8%, transparent);
}

.ts-delete-hint {
  font-size: 12px;
  color: #e53e3e;
  font-weight: 500;
}

/* Right footer (deprecated, kept for safety) */
.ts-right-footer {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--border-light);
  flex-shrink: 0;
}

.ts-btn {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--border-light);
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.ts-btn-cancel {
  background: var(--bg-secondary);
  color: var(--text-secondary);
}
.ts-btn-cancel:hover { background: var(--bg-hover); }

.ts-btn-copy {
  background: var(--bg-primary);
  color: var(--text-secondary);
  border-color: var(--border-light);
}
.ts-btn-copy:hover { background: var(--bg-hover); color: var(--text-primary); }

.ts-btn-save {
  background: var(--bg-primary);
  color: var(--accent-primary, #07c160);
  border-color: var(--accent-primary, #07c160);
}
.ts-btn-save:hover { background: color-mix(in srgb, var(--accent-primary, #07c160) 8%, transparent); }
.ts-btn-save:disabled { opacity: 0.4; cursor: not-allowed; }

.ts-btn-apply {
  background: var(--accent-primary, #07c160);
  color: #fff;
  border-color: var(--accent-primary, #07c160);
}
.ts-btn-apply:hover { opacity: 0.9; }

/* ================================================================
   Create dialog
   ================================================================ */
.ts-create-overlay {
  position: fixed;
  inset: 0;
  z-index: 2010;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.2);
}

.ts-create-dialog {
  background: var(--bg-primary);
  border: 1px solid var(--border-light);
  border-radius: 10px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
  padding: 20px;
  width: min(340px, 85vw);
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.ts-create-dialog h4 {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.ts-create-mode {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ts-mode-btn {
  width: 100%;
  padding: 9px 14px;
  border: 1px solid var(--border-light);
  border-radius: 6px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s;
}
.ts-mode-btn:hover { background: var(--bg-hover); }
.ts-mode-btn.active {
  background: color-mix(in srgb, var(--accent-primary, #07c160) 15%, transparent);
  border-color: var(--accent-primary, #07c160);
  color: var(--accent-primary, #07c160);
  font-weight: 600;
}

.ts-create-dialog input {
  width: 100%;
  padding: 9px 12px;
  border: 1px solid var(--border-light);
  border-radius: 6px;
  font-size: 13px;
  background: var(--bg-primary);
  color: var(--text-primary);
  outline: none;
}
.ts-create-dialog input:focus { border-color: var(--accent-primary, #07c160); }

.ts-create-btns {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
.ts-create-btns .ts-btn { flex: 0 0 auto; min-width: 72px; }

/* ================================================================
   Animations
   ================================================================ */
@keyframes tsFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* ================================================================
   Responsive
   ================================================================ */
@media (max-width: 960px) {
  .ts-panel {
    grid-template-columns: 200px 1fr;
    grid-template-rows: 1fr;
    width: 100vw;
    height: 100vh;
    max-height: 100vh;
    border-radius: 0;
  }
  .ts-right { display: none; }
}

@media (max-width: 640px) {
  .ts-panel {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr;
    border-radius: 0;
  }
  .ts-center { display: none; }
}
</style>
