/**
 * 更新进度状态 —— 由 Go 端通过事件驱动（mdx:update:started / mdx:update:finished
 * 以及 wails updater 内置的 wails:updater:* 事件）。
 *
 * 设计要点（与 GujiStudio 对齐）：
 * - 本模块只持有响应式状态 + 一个监听器初始化函数，**不直接 import @wailsio/runtime**。
 *   真正的 Events 对象由 main.ts 在 initDesktop() 之后注入，保证 @wailsio/runtime 永远
 *   只出现在桌面端动态 chunk 里，不污染浏览器版 bundle。
 * - 进度窗口（UpdateProgressDialog）始终挂载在 App 根，靠 downloadOpen 控制显隐。
 */
import { ref } from 'vue'

export const updateProgress = ref<{
  active: boolean
  stage: string
  devReady: boolean
  error: string
  written: number
  total: number
  rate: number
  percent: number
}>({
  active: false,
  stage: '',
  devReady: false,
  error: '',
  written: 0,
  total: 0,
  rate: 0,
  percent: 0,
})

// 更新下载窗口：点「立即更新」后统一展示下载 / 校验 / 安装进度。
// 关于页（手动检查）与自动更新弹窗两条路径共用，确保反馈一致。
export const downloadOpen = ref(false)
export const downloadVer = ref('')

export function closeDownload() {
  downloadOpen.value = false
}

// 结构化事件接收器类型，避免在此文件静态 import @wailsio/runtime。
type EventSink = {
  On: (event: string, callback: (event?: any) => void) => void
}

/**
 * 在桌面端（initDesktop 之后）调用，注册更新进度事件监听。
 * @param Events @wailsio/runtime 的 Events 对象（仅桌面端存在）。
 */
export function initUpdateProgressListeners(Events: EventSink) {
  const started = (version?: string) => {
    updateProgress.value = {
      active: true,
      stage: '正在下载更新…',
      devReady: false,
      error: '',
      written: 0,
      total: 0,
      rate: 0,
      percent: 0,
    }
    if (version) downloadVer.value = version
    downloadOpen.value = true
  }

  // 应用层事件：下载开始 / 终态（错误 / 开发模式就绪 / 即将重启）。
  Events.On('mdx:update:started', (e?: any) => {
    const d = e?.data || {}
    started(typeof d.version === 'string' ? d.version : undefined)
  })

  Events.On('mdx:update:finished', (e?: any) => {
    const d = e?.data || {}
    if (d.error) {
      updateProgress.value = {
        ...updateProgress.value,
        active: false,
        stage: '更新失败',
        devReady: false,
        error: String(d.error || ''),
      }
    } else if (d.devReady) {
      updateProgress.value = {
        ...updateProgress.value,
        active: false,
        stage: '已下载完成，请手动重启应用',
        devReady: true,
        error: '',
      }
    } else {
      updateProgress.value = {
        ...updateProgress.value,
        active: true,
        stage: '更新完成，即将重启…',
        devReady: false,
        error: '',
      }
    }
  })

  // wails updater 内置事件作为补充/兜底（驱动字节级进度条）。
  Events.On('wails:updater:download-started', () => {
    updateProgress.value = { ...updateProgress.value, active: true, stage: '正在下载更新…' }
    downloadOpen.value = true
  })
  Events.On('wails:updater:download-progress', (e?: any) => {
    const d = e?.data || {}
    const written = Number(d.written || 0)
    const total = Number(d.total || 0)
    const rate = Number(d.rate || 0)
    const percent = total > 0 ? Math.min(100, Math.max(0, Math.round((written / total) * 100))) : 0
    updateProgress.value = {
      ...updateProgress.value,
      active: true,
      stage: '正在下载更新…',
      written,
      total,
      rate,
      percent,
    }
  })
  Events.On('wails:updater:download-complete', () => {
    updateProgress.value = { ...updateProgress.value, active: true, percent: 100, stage: '正在下载更新…' }
  })
  Events.On('wails:updater:verifying', () => {
    if (updateProgress.value.active) updateProgress.value = { ...updateProgress.value, stage: '正在校验更新包…' }
  })
  Events.On('wails:updater:installing', () => {
    if (updateProgress.value.active) updateProgress.value = { ...updateProgress.value, stage: '正在安装更新…' }
  })
  Events.On('wails:updater:update-ready', () => {
    if (updateProgress.value.active) updateProgress.value = { ...updateProgress.value, stage: '即将完成，准备重启…' }
  })
  Events.On('wails:updater:error', (e?: any) => {
    const msg = e?.data?.message || (typeof e?.data === 'string' ? e.data : '')
    updateProgress.value = {
      ...updateProgress.value,
      active: false,
      stage: '更新失败',
      devReady: false,
      error: String(msg || '未知错误'),
    }
  })
}
