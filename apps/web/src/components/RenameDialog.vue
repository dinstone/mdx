<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  open: boolean
  name: string
  isFile: boolean
}>()

const emit = defineEmits<{
  close: []
  confirm: [newName: string]
}>()

const inputValue = ref('')
const inputRef = ref<HTMLInputElement | null>(null)

watch(
  () => props.open,
  (open) => {
    if (open) {
      inputValue.value = props.name
      nextTick(() => {
        inputRef.value?.focus()
        inputRef.value?.select()
      })
    }
  },
  { immediate: true }
)

function onConfirm() {
  const value = inputValue.value.trim()
  if (value) {
    emit('confirm', value)
  }
}

function onCancel() {
  emit('close')
}

function onBackdropClick(e: MouseEvent) {
  if (e.target === e.currentTarget) onCancel()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') onCancel()
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="rename-dialog-backdrop" @click="onBackdropClick">
      <div class="rename-dialog" @click.stop>
        <h3 class="rename-dialog-title">
          {{ isFile ? '重命名文件' : '重命名文件夹' }}
        </h3>
        <input
          ref="inputRef"
          v-model="inputValue"
          type="text"
          class="rename-dialog-input"
          @keyup.enter="onConfirm"
        />
        <div class="rename-dialog-actions">
          <button class="rename-dialog-btn rename-dialog-btn--cancel" @click="onCancel">
            取消
          </button>
          <button class="rename-dialog-btn rename-dialog-btn--confirm" @click="onConfirm">
            确认
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.rename-dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 2500;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
}

.rename-dialog {
  width: 320px;
  padding: 24px;
  background: var(--bg-primary);
  border: var(--border-width) solid var(--border-light);
  border-radius: var(--radius-md, 8px);
  box-shadow: var(--shadow-xl);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.rename-dialog-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.rename-dialog-input {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  font-size: 14px;
  color: var(--text-primary);
  background: var(--bg-secondary);
  border: var(--border-width) solid var(--border-light);
  border-radius: var(--radius-sm, 6px);
  outline: none;
  transition: all 0.2s ease;
}

.rename-dialog-input:focus {
  border-color: var(--accent-primary, #07c160);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-primary, #07c160) 20%, transparent);
}

.rename-dialog-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
}

.rename-dialog-btn {
  padding: 8px 18px;
  font-size: 14px;
  font-weight: 500;
  border-radius: var(--radius-sm, 6px);
  cursor: pointer;
  transition: all 0.15s ease;
  border: 1px solid transparent;
}

.rename-dialog-btn--cancel {
  background: transparent;
  color: var(--text-secondary);
  border-color: var(--border-light);
}

.rename-dialog-btn--cancel:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.rename-dialog-btn--confirm {
  background: var(--accent-primary, #07c160);
  color: #ffffff;
}

.rename-dialog-btn--confirm:hover {
  filter: brightness(1.05);
}
</style>
