<script setup lang="ts">
/**
 * 方格选择器 — 用于主题设计器中的离散选项
 */
export interface TileOption {
  label: string
  value?: string | number
  id?: string | number
  desc?: string
  color?: string
}

const props = defineProps<{
  modelValue: string | number
  options: TileOption[]
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | number]
}>()

function getValue(opt: TileOption) {
  return (opt.value ?? opt.id ?? '') as string | number
}
</script>

<template>
  <div class="tile-grid">
    <button
      v-for="opt in options"
      :key="String(getValue(opt))"
      class="tile-btn"
      :class="{ active: modelValue === getValue(opt), color: !!opt.color }"
      :disabled="disabled"
      @click="emit('update:modelValue', getValue(opt))"
    >
      <span
        v-if="opt.color"
        class="tile-swatch"
        :style="{ background: opt.color }"
      />
      <span class="tile-label">{{ opt.label }}</span>
      <span v-if="opt.desc" class="tile-desc">{{ opt.desc }}</span>
    </button>
  </div>
</template>

<style scoped>
.tile-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
  gap: 8px;
}

.tile-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-height: 42px;
  padding: 8px 6px;
  border: 1px solid var(--border-light);
  border-radius: 10px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
  line-height: 1.2;
}

.tile-btn:hover:not(:disabled) {
  border-color: var(--ui-accent-primary, #07c160);
  color: var(--ui-accent-primary, #07c160);
}

.tile-btn.active {
  background: var(--ui-accent-primary, #07c160);
  border-color: var(--ui-accent-primary, #07c160);
  color: #fff;
}

.tile-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.tile-swatch {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 1px solid rgba(0, 0, 0, 0.08);
  flex-shrink: 0;
}

.tile-desc {
  font-size: 11px;
  color: var(--text-tertiary);
}

.tile-btn.active .tile-desc {
  color: rgba(255, 255, 255, 0.85);
}
</style>
