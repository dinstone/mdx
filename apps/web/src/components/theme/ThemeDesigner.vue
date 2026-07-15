<script setup lang="ts">
/**
 * 主题设计器控件面板 — 只负责渲染右侧编辑区
 * 外层由 ThemeSelector 负责布局、状态、保存/应用
 */
import { ref, computed } from 'vue'
import type { DesignerVariables, HeadingLevel } from '../../theme-designer/types'
import {
  fontFamilyOptions,
  fontSizeOptions,
  primaryColorOptions,
  lineHeightOptions,
  headingStylePresets,
  strongStyleOptions,
  quoteStylePresets,
  ulStyleOptions,
  olStyleOptions,
  inlineCodeStyleOptions,
  codeBlockThemeOptions,
  underlineStyleOptions,
  hrStyleOptions,
  headingSizePresets,
} from '../../theme-designer/styleOptions'
import TileGrid, { type TileOption } from './TileGrid.vue'
import ColorTile from './ColorTile.vue'

const props = defineProps<{
  variables: DesignerVariables
  readonly?: boolean
}>()

const emit = defineEmits<{
  'update:variables': [v: DesignerVariables]
  'update-heading': [level: HeadingLevel, style: Partial<DesignerVariables[HeadingLevel]>]
}>()

type SectionId = 'global' | 'heading' | 'paragraph' | 'quote' | 'list' | 'code' | 'image' | 'table-hr' | 'other'

const sections: { id: SectionId; label: string }[] = [
  { id: 'global', label: '全局' },
  { id: 'heading', label: '标题' },
  { id: 'paragraph', label: '段落' },
  { id: 'quote', label: '引用' },
  { id: 'list', label: '列表' },
  { id: 'code', label: '代码' },
  { id: 'image', label: '图片' },
  { id: 'table-hr', label: '表格' },
  { id: 'other', label: '其他' },
]

const activeSection = ref<SectionId>('global')
const activeHeading = ref<HeadingLevel>('h1')

const primaryColorTiles = computed<TileOption[]>(() =>
  primaryColorOptions.map((o) => ({ label: o.label, value: o.value, color: o.value })),
)

function patch<K extends keyof DesignerVariables>(key: K, value: DesignerVariables[K]) {
  emit('update:variables', { ...props.variables, [key]: value })
}

function updateListMarkerColor(color: string) {
  emit('update:variables', {
    ...props.variables,
    listMarkerColor: color,
    listMarkerColorL2: color,
  })
}

function patchHeading(level: HeadingLevel, style: Partial<DesignerVariables[HeadingLevel]>) {
  emit('update-heading', level, style)
}

function handlePrimaryColorChange(newColor: string) {
  emit('update:variables', {
    ...props.variables,
    primaryColor: newColor,
    listMarkerColor: newColor,
    listMarkerColorL2: newColor,
  })
}

function patchNumberFromInput(key: keyof DesignerVariables, e: Event) {
  const target = e.target as HTMLInputElement
  patch(key, Number(target.value) as DesignerVariables[typeof key])
}

function patchTextFromInput(key: keyof DesignerVariables, e: Event) {
  const target = e.target as HTMLInputElement
  patch(key, target.value as DesignerVariables[typeof key])
}

function patchBoolFromInput(key: keyof DesignerVariables, e: Event) {
  const target = e.target as HTMLInputElement
  patch(key, target.checked as DesignerVariables[typeof key])
}
</script>

<template>
  <div class="td-controls" :class="{ readonly: readonly }">
    <!-- Tabs -->
    <div class="td-tabs">
      <button
        v-for="s in sections"
        :key="s.id"
        class="td-tab"
        :class="{ active: activeSection === s.id }"
        :disabled="readonly"
        @click="activeSection = s.id"
      >
        {{ s.label }}
      </button>
    </div>

    <!-- Tab content -->
    <div class="td-tab-content">
      <!-- ==================== 全局 ==================== -->
      <div v-if="activeSection === 'global'" class="td-section">
        <div class="td-field">
          <label>字体</label>
          <TileGrid
            :model-value="variables.fontFamily"
            :options="fontFamilyOptions"
            :disabled="readonly"
            @update:model-value="patch('fontFamily', $event)"
          />
        </div>
        <div class="td-field">
          <label>正文字号</label>
          <TileGrid
            :model-value="variables.fontSize"
            :options="fontSizeOptions"
            :disabled="readonly"
            @update:model-value="patch('fontSize', $event)"
          />
        </div>
        <div class="td-field">
          <label>主题色</label>
          <TileGrid
            :model-value="variables.primaryColor"
            :options="primaryColorTiles"
            :disabled="readonly"
            @update:model-value="handlePrimaryColorChange($event as string)"
          />
          <div class="td-color-pick">
            <span class="td-swatch" :style="{ background: variables.primaryColor }" />
            <input type="color" :value="variables.primaryColor" :disabled="readonly" @input="handlePrimaryColorChange(($event.target as HTMLInputElement).value)">
          </div>
        </div>
        <div class="td-field">
          <label>行高</label>
          <TileGrid
            :model-value="variables.lineHeight"
            :options="lineHeightOptions"
            :disabled="readonly"
            @update:model-value="patch('lineHeight', $event)"
          />
        </div>
        <div class="td-field">
          <label>页边距 {{ variables.pagePadding }}px</label>
          <input type="range" min="0" max="40" step="2" :value="variables.pagePadding" :disabled="readonly" @input="patchNumberFromInput('pagePadding', $event)">
        </div>
        <div class="td-field">
          <label>字间距 {{ variables.baseLetterSpacing }}px</label>
          <input type="range" min="0" max="6" step="0.5" :value="variables.baseLetterSpacing" :disabled="readonly" @input="patchNumberFromInput('baseLetterSpacing', $event)">
        </div>
      </div>

      <!-- ==================== 标题 ==================== -->
      <div v-if="activeSection === 'heading'" class="td-section">
        <div class="td-heading-tabs">
          <button
            v-for="lvl in (['h1','h2','h3','h4'] as HeadingLevel[])"
            :key="lvl"
            class="td-tab td-tab-sm"
            :class="{ active: activeHeading === lvl }"
            :disabled="readonly"
            @click="activeHeading = lvl"
          >{{ lvl.toUpperCase() }}</button>
        </div>
        <div class="td-field">
          <label>字号 {{ variables[activeHeading].fontSize }}px</label>
          <input
            type="range"
            :min="headingSizePresets[activeHeading].min"
            :max="headingSizePresets[activeHeading].max"
            step="1"
            :value="variables[activeHeading].fontSize"
            :disabled="readonly"
            @input="patchHeading(activeHeading, { fontSize: Number(($event.target as HTMLInputElement).value) })"
          >
        </div>
        <div class="td-field">
          <label>颜色</label>
          <div class="td-color-pick">
            <input type="color" :value="variables[activeHeading].color" :disabled="readonly" @input="patchHeading(activeHeading, { color: ($event.target as HTMLInputElement).value })">
          </div>
        </div>
        <div class="td-field">
          <label>上边距 {{ variables[activeHeading].marginTop }}px</label>
          <input type="range" min="0" max="60" step="2" :value="variables[activeHeading].marginTop" :disabled="readonly" @input="patchHeading(activeHeading, { marginTop: Number(($event.target as HTMLInputElement).value) })">
        </div>
        <div class="td-field">
          <label>下边距 {{ variables[activeHeading].marginBottom }}px</label>
          <input type="range" min="0" max="60" step="2" :value="variables[activeHeading].marginBottom" :disabled="readonly" @input="patchHeading(activeHeading, { marginBottom: Number(($event.target as HTMLInputElement).value) })">
        </div>
        <div class="td-field">
          <label>预设样式</label>
          <TileGrid
            :model-value="variables[activeHeading].preset || ''"
            :options="headingStylePresets"
            :disabled="readonly"
            @update:model-value="patchHeading(activeHeading, { preset: $event as string })"
          />
        </div>
        <div class="td-field td-field-inline">
          <label>
            <input type="checkbox" :checked="variables[activeHeading].centered" :disabled="readonly" @change="patchHeading(activeHeading, { centered: ($event.target as HTMLInputElement).checked })"> 居中
          </label>
        </div>
      </div>

      <!-- ==================== 段落 ==================== -->
      <div v-if="activeSection === 'paragraph'" class="td-section">
        <div class="td-field">
          <label>文字颜色</label>
          <div class="td-color-pick">
            <input type="color" :value="variables.paragraphColor" :disabled="readonly" @input="patchTextFromInput('paragraphColor', $event)">
          </div>
        </div>
        <div class="td-field">
          <label>段落间距 {{ variables.paragraphMargin }}px</label>
          <input type="range" min="0" max="40" step="2" :value="variables.paragraphMargin" :disabled="readonly" @input="patchNumberFromInput('paragraphMargin', $event)">
        </div>
        <div class="td-field">
          <label>段内边距 {{ variables.paragraphPadding }}px</label>
          <input type="range" min="0" max="40" step="2" :value="variables.paragraphPadding" :disabled="readonly" @input="patchNumberFromInput('paragraphPadding', $event)">
        </div>
        <div class="td-field td-field-inline">
          <label>
            <input type="checkbox" :checked="variables.textIndent" :disabled="readonly" @change="patchBoolFromInput('textIndent', $event)"> 首行缩进
          </label>
          <label>
            <input type="checkbox" :checked="variables.textJustify" :disabled="readonly" @change="patchBoolFromInput('textJustify', $event)"> 两端对齐
          </label>
        </div>
        <div class="td-field">
          <label>粗体样式</label>
          <TileGrid
            :model-value="variables.strongStyle"
            :options="strongStyleOptions"
            :disabled="readonly"
            @update:model-value="patch('strongStyle', $event)"
          />
        </div>
        <div class="td-field">
          <label>粗体颜色</label>
          <div class="td-color-pick">
            <input type="color" :value="variables.strongColor === 'inherit' ? '#333333' : variables.strongColor" :disabled="readonly" @input="patchTextFromInput('strongColor', $event)">
            <button class="td-btn-sm" :disabled="readonly" @click="patch('strongColor', 'inherit')">继承</button>
          </div>
        </div>
      </div>

      <!-- ==================== 引用 ==================== -->
      <div v-if="activeSection === 'quote'" class="td-section">
        <div class="td-field">
          <label>预设</label>
          <TileGrid
            :model-value="variables.quotePreset"
            :options="quoteStylePresets"
            :disabled="readonly"
            @update:model-value="patch('quotePreset', $event)"
          />
        </div>
        <div class="td-field">
          <label>背景色</label>
          <div class="td-color-pick">
            <input type="color" :value="variables.quoteBackground" :disabled="readonly" @input="patchTextFromInput('quoteBackground', $event)">
          </div>
        </div>
        <div class="td-field">
          <label>边框颜色</label>
          <div class="td-color-pick">
            <input type="color" :value="variables.quoteBorderColor" :disabled="readonly" @input="patchTextFromInput('quoteBorderColor', $event)">
          </div>
        </div>
        <div class="td-field">
          <label>文字颜色</label>
          <div class="td-color-pick">
            <input type="color" :value="variables.quoteTextColor" :disabled="readonly" @input="patchTextFromInput('quoteTextColor', $event)">
          </div>
        </div>
        <div class="td-field td-field-inline">
          <label>
            <input type="checkbox" :checked="variables.quoteTextCentered" :disabled="readonly" @change="patchBoolFromInput('quoteTextCentered', $event)"> 居中
          </label>
        </div>
      </div>

      <!-- ==================== 列表 ==================== -->
      <div v-if="activeSection === 'list'" class="td-section">
        <h4 class="td-subhead">无序列表</h4>
        <div class="td-field">
          <label>一级符号</label>
          <TileGrid
            :model-value="variables.ulStyle"
            :options="ulStyleOptions"
            :disabled="readonly"
            @update:model-value="patch('ulStyle', $event)"
          />
        </div>
        <div class="td-field">
          <label>二级符号</label>
          <TileGrid
            :model-value="variables.ulStyleL2"
            :options="ulStyleOptions"
            :disabled="readonly"
            @update:model-value="patch('ulStyleL2', $event)"
          />
        </div>
        <h4 class="td-subhead">有序列表</h4>
        <div class="td-field">
          <label>一级编号</label>
          <TileGrid
            :model-value="variables.olStyle"
            :options="olStyleOptions"
            :disabled="readonly"
            @update:model-value="patch('olStyle', $event)"
          />
        </div>
        <div class="td-field">
          <label>二级编号</label>
          <TileGrid
            :model-value="variables.olStyleL2"
            :options="olStyleOptions"
            :disabled="readonly"
            @update:model-value="patch('olStyleL2', $event)"
          />
        </div>
        <div class="td-field">
          <label>符号颜色</label>
          <ColorTile
            :model-value="variables.listMarkerColor"
            :disabled="readonly"
            @update:model-value="updateListMarkerColor"
          />
        </div>
      </div>

      <!-- ==================== 代码 ==================== -->
      <div v-if="activeSection === 'code'" class="td-section">
        <div class="td-field">
          <label>代码块背景色</label>
          <div class="td-color-pick">
            <input type="color" :value="variables.codeBackground" :disabled="readonly" @input="patchTextFromInput('codeBackground', $event)">
          </div>
        </div>
        <div class="td-field">
          <label>代码字号 {{ variables.codeFontSize }}px</label>
          <input type="range" min="10" max="18" step="1" :value="variables.codeFontSize" :disabled="readonly" @input="patchNumberFromInput('codeFontSize', $event)">
        </div>
        <div class="td-field">
          <label>行内代码样式</label>
          <TileGrid
            :model-value="variables.inlineCodeStyle"
            :options="inlineCodeStyleOptions"
            :disabled="readonly"
            @update:model-value="patch('inlineCodeStyle', $event)"
          />
        </div>
        <div class="td-field">
          <label>行内代码颜色</label>
          <div class="td-color-pick">
            <input type="color" :value="variables.inlineCodeColor" :disabled="readonly" @input="patchTextFromInput('inlineCodeColor', $event)">
          </div>
        </div>
        <div class="td-field">
          <label>高亮主题</label>
          <TileGrid
            :model-value="variables.codeTheme"
            :options="codeBlockThemeOptions"
            :disabled="readonly"
            @update:model-value="patch('codeTheme', $event)"
          />
        </div>
        <div class="td-field td-field-inline">
          <label>
            <input type="checkbox" :checked="variables.showMacBar" :disabled="readonly" @change="patchBoolFromInput('showMacBar', $event)"> 显示 Mac 工具栏
          </label>
        </div>
      </div>

      <!-- ==================== 图片 ==================== -->
      <div v-if="activeSection === 'image'" class="td-section">
        <div class="td-field">
          <label>间距 {{ variables.imageMargin }}px</label>
          <input type="range" min="0" max="40" step="2" :value="variables.imageMargin" :disabled="readonly" @input="patchNumberFromInput('imageMargin', $event)">
        </div>
        <div class="td-field">
          <label>圆角 {{ variables.imageBorderRadius }}px</label>
          <input type="range" min="0" max="24" step="1" :value="variables.imageBorderRadius" :disabled="readonly" @input="patchNumberFromInput('imageBorderRadius', $event)">
        </div>
        <div class="td-field td-field-inline">
          <label>
            <input type="checkbox" :checked="variables.imageShadow" :disabled="readonly" @change="patchBoolFromInput('imageShadow', $event)"> 显示阴影
          </label>
        </div>
        <div class="td-field">
          <label>图注颜色</label>
          <div class="td-color-pick">
            <input type="color" :value="variables.imageCaptionColor" :disabled="readonly" @input="patchTextFromInput('imageCaptionColor', $event)">
          </div>
        </div>
        <div class="td-field">
          <label>图注字号 {{ variables.imageCaptionFontSize }}px</label>
          <input type="range" min="10" max="20" step="1" :value="variables.imageCaptionFontSize" :disabled="readonly" @input="patchNumberFromInput('imageCaptionFontSize', $event)">
        </div>
      </div>

      <!-- ==================== 表格/分割线 ==================== -->
      <div v-if="activeSection === 'table-hr'" class="td-section">
        <h4 class="td-subhead">表格</h4>
        <div class="td-field">
          <label>表头背景</label>
          <div class="td-color-pick">
            <input type="color" :value="variables.tableHeaderBackground" :disabled="readonly" @input="patchTextFromInput('tableHeaderBackground', $event)">
          </div>
        </div>
        <div class="td-field">
          <label>表头颜色</label>
          <div class="td-color-pick">
            <input type="color" :value="variables.tableHeaderColor === 'inherit' ? '#333' : variables.tableHeaderColor" :disabled="readonly" @input="patchTextFromInput('tableHeaderColor', $event)">
          </div>
        </div>
        <div class="td-field">
          <label>边框颜色</label>
          <div class="td-color-pick">
            <input type="color" :value="variables.tableBorderColor" :disabled="readonly" @input="patchTextFromInput('tableBorderColor', $event)">
          </div>
        </div>
        <div class="td-field td-field-inline">
          <label>
            <input type="checkbox" :checked="variables.tableZebra" :disabled="readonly" @change="patchBoolFromInput('tableZebra', $event)"> 斑马条纹
          </label>
        </div>
        <h4 class="td-subhead">分割线</h4>
        <div class="td-field">
          <label>样式</label>
          <TileGrid
            :model-value="variables.hrStyle"
            :options="hrStyleOptions"
            :disabled="readonly"
            @update:model-value="patch('hrStyle', $event)"
          />
        </div>
        <div class="td-field">
          <label>颜色</label>
          <div class="td-color-pick">
            <input type="color" :value="variables.hrColor" :disabled="readonly" @input="patchTextFromInput('hrColor', $event)">
          </div>
        </div>
      </div>

      <!-- ==================== 其他 ==================== -->
      <div v-if="activeSection === 'other'" class="td-section">
        <h4 class="td-subhead">链接与文本装饰</h4>
        <div class="td-field">
          <label>链接颜色</label>
          <div class="td-color-pick">
            <input type="color" :value="variables.linkColor || variables.primaryColor" :disabled="readonly" @input="patchTextFromInput('linkColor', $event)">
          </div>
        </div>
        <div class="td-field td-field-inline">
          <label>
            <input type="checkbox" :checked="variables.linkUnderline" :disabled="readonly" @change="patchBoolFromInput('linkUnderline', $event)"> 链接下划线
          </label>
        </div>
        <div class="td-field">
          <label>高亮背景色</label>
          <div class="td-color-pick">
            <input type="color" :value="variables.markBackground" :disabled="readonly" @input="patchTextFromInput('markBackground', $event)">
          </div>
        </div>
        <h4 class="td-subhead">下划线</h4>
        <div class="td-field">
          <label>样式</label>
          <TileGrid
            :model-value="variables.underlineStyle"
            :options="underlineStyleOptions"
            :disabled="readonly"
            @update:model-value="patch('underlineStyle', $event)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.td-controls {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: var(--bg-primary);
}

.td-controls.readonly {
  opacity: 0.7;
}

/* Tabs */
.td-tabs {
  display: flex;
  gap: 4px;
  padding: 6px;
  margin: 8px 12px 0;
  background: var(--bg-secondary);
  border-radius: 10px;
  flex-shrink: 0;
  overflow-x: auto;
}

.td-tab {
  padding: 6px 12px;
  border: none;
  border-radius: 8px;
  background: transparent;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;
}

.td-tab:hover:not(:disabled) { color: var(--text-primary); }
.td-tab.active {
  background: var(--bg-primary);
  color: var(--ui-accent-primary, #07c160);
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}
.td-tab:disabled { cursor: not-allowed; opacity: 0.6; }

/* Tab content */
.td-tab-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.td-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Heading sub-tabs */
.td-heading-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 4px;
}

.td-tab-sm {
  padding: 4px 12px;
  font-size: 12px;
  border-radius: 6px;
  border: 1px solid var(--border-light);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  cursor: pointer;
}
.td-tab-sm:hover:not(:disabled) { color: var(--text-primary); }
.td-tab-sm.active {
  background: var(--ui-accent-primary, #07c160);
  color: #fff;
  border-color: var(--ui-accent-primary, #07c160);
}
.td-tab-sm:disabled { cursor: not-allowed; opacity: 0.6; }

/* Sub heading */
.td-subhead {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  margin: 0;
  padding: 4px 0;
  border-bottom: 1px solid var(--border-light);
}

/* Field */
.td-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.td-field > label {
  font-size: 13px;
  color: var(--text-primary);
  font-weight: 600;
}

.td-field input[type="range"] {
  width: 100%;
  -webkit-appearance: none;
  appearance: none;
  height: 4px;
  background: var(--border-light);
  border-radius: 2px;
  outline: none;
  cursor: pointer;
}

.td-field input[type="range"]:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.td-field input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--ui-accent-primary, #07c160);
  cursor: pointer;
}

/* Color picker row */
.td-color-pick {
  display: flex;
  align-items: center;
  gap: 8px;
}

.td-color-pick input[type="color"] {
  width: 28px;
  height: 28px;
  border: 1px solid var(--border-light);
  border-radius: 4px;
  padding: 2px;
  cursor: pointer;
  background: none;
}

.td-color-pick input[type="color"]:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.td-swatch {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: 1px solid var(--border-light);
  display: inline-block;
}

/* Inline checkbox fields */
.td-field-inline {
  flex-direction: row;
  gap: 16px;
}

.td-field-inline label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  cursor: pointer;
}

.td-field-inline input[type="checkbox"] {
  accent-color: var(--ui-accent-primary, #07c160);
}

.td-field-inline input[type="checkbox"]:disabled {
  cursor: not-allowed;
}

/* Buttons */
.td-btn-sm {
  padding: 2px 8px;
  font-size: 11px;
  border: 1px solid var(--border-light);
  border-radius: 4px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  cursor: pointer;
  margin-top: 4px;
  align-self: flex-start;
}

.td-btn-sm:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.td-btn-sm:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

/* Scrollbar */
.td-tab-content::-webkit-scrollbar {
  width: 4px;
}

.td-tab-content::-webkit-scrollbar-thumb {
  background: var(--border-light);
  border-radius: 2px;
}
</style>
