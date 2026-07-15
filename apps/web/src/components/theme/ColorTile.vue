<script setup lang="ts">
/**
 * 颜色图块 — 点击弹出系统取色器，图块实时显示当前颜色
 */
const props = defineProps<{
  modelValue: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLInputElement).value)
}
</script>

<template>
  <button type="button" class="color-tile" :disabled="disabled">
    <span class="color-tile-swatch" :style="{ background: modelValue }" />
    <input
      type="color"
      class="color-tile-input"
      :value="modelValue"
      :disabled="disabled"
      @input="onInput"
      @change="onInput"
    >
  </button>
</template>

<style scoped>
.color-tile {
  position: relative;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 1px solid var(--border-light);
  border-radius: 10px;
  background: var(--bg-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  cursor: pointer;
}

.color-tile:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.color-tile-swatch {
  width: 28px;
  height: 20px;
  border-radius: 6px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  flex-shrink: 0;
}

.color-tile-input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
  padding: 0;
  border: none;
  background: none;
}

.color-tile-input:disabled {
  cursor: not-allowed;
}
</style>
