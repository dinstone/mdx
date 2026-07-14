<script setup lang="ts">
import { useToast } from '../composables/useToast'

const { toasts, dismiss } = useToast()
</script>

<template>
  <teleport to="body">
    <div class="toast-container" aria-live="polite">
      <transition-group name="toast" tag="div">
        <div
          v-for="t in toasts"
          :key="t.id"
          class="toast-item"
          :class="`toast--${t.type}`"
          @click="dismiss(t.id)"
        >
          <span v-if="t.type === 'success'" class="toast-icon">&#10003;</span>
          <span v-else-if="t.type === 'error'" class="toast-icon">&#10007;</span>
          <span v-else class="toast-icon">&#9432;</span>
          <span class="toast-text">{{ t.message }}</span>
        </div>
      </transition-group>
    </div>
  </teleport>
</template>

<style scoped>
.toast-container {
  position: fixed;
  top: 90px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10000;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  pointer-events: none;
}

.toast-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border-radius: 50px;
  font-size: 14px;
  font-weight: 500;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  color: #1a1a1a;
  box-shadow: 0 12px 30px -10px rgba(0, 0, 0, 0.12);
  border: 1px solid rgba(0, 0, 0, 0.05);
  cursor: pointer;
  pointer-events: auto;
  white-space: nowrap;
}

.toast-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  font-size: 12px;
  flex-shrink: 0;
}

.toast--success .toast-icon {
  background: #07c160;
  color: #fff;
}

.toast--error .toast-icon {
  background: #ef4444;
  color: #fff;
}

.toast--info .toast-icon {
  background: #3b82f6;
  color: #fff;
}

/* transition */
.toast-enter-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.toast-leave-active {
  transition: all 0.2s ease-in;
}

.toast-enter-from {
  opacity: 0;
  transform: translateY(-12px) scale(0.95);
}

.toast-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.95);
}
</style>
