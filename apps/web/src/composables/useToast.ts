/**
 * 全局 toast 通知状态
 * 通过 provide / inject 在 App 层级共享
 */
import { ref } from 'vue'

export interface ToastAction {
  label: string
  handler: () => void
}

export interface ToastItem {
  id: number
  message: string
  type: 'success' | 'error' | 'info'
  duration: number
  action?: ToastAction
}

let nextId = 0
const toasts = ref<ToastItem[]>([])

function showToast(
  message: string,
  type: ToastItem['type'] = 'info',
  duration = 2500,
  action?: ToastAction,
) {
  const id = ++nextId
  const item: ToastItem = { id, message, type, duration, action }
  toasts.value = [...toasts.value, item]
  if (duration > 0) {
    setTimeout(() => dismiss(id), duration)
  }
}

function dismiss(id: number) {
  toasts.value = toasts.value.filter((t) => t.id !== id)
}

export function useToast() {
  return {
    toasts,
    success: (message: string, duration?: number) => showToast(message, 'success', duration),
    error: (message: string, duration?: number) => showToast(message, 'error', duration),
    info: (message: string, duration?: number) => showToast(message, 'info', duration),
    /**
     * Show a toast with an inline action button (e.g. "立即更新"). The toast
     * persists (duration = 0) until the user clicks the button or dismisses it.
     */
    action: (
      message: string,
      label: string,
      handler: () => void,
      duration = 0,
      type: ToastItem['type'] = 'info',
    ) => showToast(message, type, duration, { label, handler }),
    dismiss,
  }
}
