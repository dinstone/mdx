<script setup lang="ts">
import { computed } from 'vue'
import { downloadOpen, downloadVer, updateProgress, closeDownload } from '../stores/updateProgress'

const appVersion = __APP_VERSION__

function fmtBytes(n: number): string {
  if (!n && n !== 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let v = n
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(i ? 1 : 0)} ${units[i]}`
}
function fmtSpeed(n: number): string {
  if (!n) return '0 B/s'
  const units = ['B/s', 'KB/s', 'MB/s']
  let i = 0
  let v = n
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(1)} ${units[i]}`
}

// 进行中：尚未成功也未失败（含 devReady 之前的下载/校验/安装阶段）。
const busy = computed(
  () => updateProgress.value.active && !updateProgress.value.error && !updateProgress.value.devReady,
)
// 下载阶段且有总大小时显示真实进度条（与 wails 内置窗口一致）。
const showBar = computed(() => busy.value && updateProgress.value.total > 0)
// 终态标题：失败 / 已就绪（dev 手动重启）/ 即将重启。
const title = computed(() => {
  if (updateProgress.value.error) return '更新失败'
  if (updateProgress.value.devReady) return '更新已就绪'
  return '正在更新'
})
// 进行中（下载/校验/安装）不可关闭：避免误点遮罩或 ✕ 把进度窗口关掉，
// 生产模式下应用随后会自重启，关掉反而丢失进度展示。
function onMaskClick() {
  if (!busy.value) closeDownload()
}
</script>

<template>
  <div v-if="downloadOpen" class="udl-mask" @click.self="onMaskClick">
    <div class="udl">
      <div class="udl-head">
        <div
          class="udl-icon"
          :class="{ fail: updateProgress.error, ready: updateProgress.devReady && !updateProgress.error }"
        >
          ↑
        </div>
        <div class="udl-titles">
          <h2>{{ title }}</h2>
          <p class="udl-sub">v{{ appVersion }} → v{{ downloadVer || '…' }}</p>
        </div>
        <button class="udl-x" :disabled="busy" @click="closeDownload" title="关闭">✕</button>
      </div>

      <div class="udl-body">
        <!-- 下载中且有字节进度：进度条 + 百分比 + 已下载/总大小 + 速度 -->
        <div v-if="showBar" class="udl-progress">
          <div class="udl-bar">
            <div class="udl-fill" :style="{ width: updateProgress.percent + '%' }"></div>
          </div>
          <div class="udl-meta">
            <span>{{ updateProgress.percent }}% · {{ fmtBytes(updateProgress.written) }} / {{ fmtBytes(updateProgress.total) }}</span>
            <span>{{ fmtSpeed(updateProgress.rate) }}</span>
          </div>
        </div>

        <!-- 进行中：旋转进度 + 阶段文案（无字节进度或校验/安装阶段） -->
        <div v-else-if="busy" class="udl-prog">
          <i class="udl-spin"></i>
          <span>{{ updateProgress.stage || '正在更新…' }}</span>
        </div>

        <!-- 开发模式：已下载，提示手动重启 -->
        <div v-else-if="updateProgress.devReady" class="udl-box ready">
          <p class="udl-strong">{{ updateProgress.stage }}</p>
          <p class="udl-tip">新版本已下载完成，请手动重启 MDX 以应用更新。</p>
        </div>

        <!-- 失败：展示原因 -->
        <div v-else-if="updateProgress.error" class="udl-box fail">
          <p class="udl-strong">{{ updateProgress.stage }}</p>
          <p class="udl-tip">{{ updateProgress.error }}</p>
        </div>

        <!-- 即将重启（生产模式，应用随后自动重启） -->
        <div v-else class="udl-prog">
          <i class="udl-spin"></i>
          <span>{{ updateProgress.stage || '正在更新…' }}</span>
        </div>
      </div>

      <div class="udl-foot">
        <span class="udl-sp" />
        <button class="udl-btn primary" :disabled="busy" @click="closeDownload">
          {{ busy ? '更新进行中…' : '关闭' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.udl-mask {
  position: fixed;
  inset: 0;
  z-index: 220;
  background: rgba(20, 20, 20, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
}
.udl {
  width: 420px;
  max-width: 92vw;
  max-height: 86vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary, #ffffff);
  border: 1px solid var(--border-color, #e6e6e6);
  border-radius: 16px;
  padding: 20px 22px 16px;
  box-shadow: 0 18px 54px rgba(0, 0, 0, 0.28);
}
.udl-head {
  display: flex;
  align-items: center;
  gap: 12px;
}
.udl-icon {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  flex: none;
  background: var(--accent-primary, #07c160);
  color: #fff;
  font-size: 20px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.udl-icon.ready {
  background: var(--accent-primary, #07c160);
}
.udl-icon.fail {
  background: #e0404f;
}
.udl-titles {
  flex: 1;
  min-width: 0;
}
.udl-head h2 {
  margin: 0;
  font-size: 17px;
  color: var(--text-primary, #222);
}
.udl-sub {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--accent-primary, #07c160);
}
.udl-x {
  width: 26px;
  height: 26px;
  border: 0;
  background: none;
  color: var(--text-tertiary, #999);
  font-size: 14px;
  cursor: pointer;
  border-radius: 6px;
}
.udl-x:hover {
  background: var(--bg-hover, #f2f2f2);
  color: var(--text-primary, #222);
}
.udl-x:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.udl-body {
  overflow: auto;
  flex: 1;
  margin-top: 16px;
  min-height: 64px;
  display: flex;
  align-items: center;
}
.udl-prog {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: var(--text-secondary, #555);
}
.udl-box {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.udl-strong {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary, #222);
}
.udl-box.fail .udl-strong {
  color: #e0404f;
}
.udl-box.ready .udl-strong {
  color: var(--accent-primary, #07c160);
}
.udl-tip {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-tertiary, #888);
}

.udl-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
}
.udl-sp {
  flex: 1;
}
.udl-btn {
  border: 1px solid var(--border-color, #ddd);
  background: var(--bg-primary, #fff);
  border-radius: 7px;
  padding: 8px 16px;
  font-size: 13px;
  color: var(--text-primary, #222);
  cursor: pointer;
}
.udl-btn:hover {
  border-color: var(--accent-primary, #07c160);
  color: var(--accent-primary, #07c160);
}
.udl-btn.primary {
  background: var(--accent-primary, #07c160);
  color: #fff;
  border-color: var(--accent-primary, #07c160);
}
.udl-btn.primary:hover {
  filter: brightness(0.95);
  color: #fff;
}
.udl-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  border-color: var(--border-color, #ddd);
  background: var(--bg-hover, #f2f2f2);
  color: var(--text-tertiary, #999);
}
.udl-btn.primary:disabled:hover {
  filter: none;
}

.udl-spin {
  width: 16px;
  height: 16px;
  border: 2px solid var(--accent-primary, #07c160);
  border-top-color: transparent;
  border-radius: 50%;
  animation: udl-spin 0.7s linear infinite;
  flex: none;
}
@keyframes udl-spin {
  to {
    transform: rotate(360deg);
  }
}

/* 下载进度条：与 wails 内置窗口同结构 */
.udl-progress {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.udl-bar {
  height: 6px;
  background: var(--bg-hover, #eee);
  border-radius: 3px;
  overflow: hidden;
}
.udl-fill {
  height: 100%;
  background: var(--accent-primary, #07c160);
  border-radius: 3px;
  transition: width 0.2s linear;
}
.udl-meta {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--text-tertiary, #888);
}
</style>
