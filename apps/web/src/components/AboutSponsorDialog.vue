<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { getBridge } from '../bridge'
// Auto-update is desktop-only and deliberately NOT part of IServiceBridge —
// it lives in its own lazily-loaded module. Aliased because the local handlers
// below are named checkUpdate()/installUpdate().
import {
  checkUpdate as fetchUpdateInfo,
  installUpdate as runInstallUpdate,
  isUpdateSupported,
} from '../bridge/update'
import type { CheckUpdateResult } from '../bridge/update'
import { fetchSponsors, type Sponsor, type SponsorsData } from '../core/sponsors'
import { downloadOpen, downloadVer, updateProgress } from '../stores/updateProgress'

const props = defineProps<{
  currentVersion: string
}>()

const emit = defineEmits<{ close: [] }>()

type Status = 'idle' | 'checking' | 'up-to-date' | 'available' | 'error' | 'installing'

// Evaluated lazily on every render: the Wails runtime (and therefore the
// desktop bridge) is initialised asynchronously *after* app.mount(), so a
// setup-time snapshot could be false forever if the user opens this menu
// before bootstrap finishes.
const isDesktop = computed(() => isUpdateSupported())
const status = ref<Status>('idle')
const result = ref<CheckUpdateResult | null>(null)
const installError = ref('')

const canCheck = computed(() => isDesktop.value && status.value !== 'checking' && status.value !== 'installing')

// ---- 关于页信息 & 远程赞助者名单 ----
const loading = ref(false)
const loadError = ref<string | null>(null)
const data = ref<SponsorsData | null>(null)
const wxError = ref(false)
const HOMEPAGE = 'https://github.com/dinstone/mdx'

onMounted(loadSponsors)

async function loadSponsors() {
  loading.value = true
  loadError.value = null
  const r = await fetchSponsors()
  loading.value = false
  if (r.data) data.value = r.data
  else loadError.value = r.error
}

const proj = computed(() => data.value?.project ?? {})
const sorted = computed<Sponsor[]>(() =>
  [...(data.value?.sponsors ?? [])].sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0)),
)

function openHomepage() {
  const url = proj.value.homepage || HOMEPAGE
  getBridge().openExternal(url).catch(() => {})
}

async function checkUpdate() {
  if (!canCheck.value) return
  status.value = 'checking'
  result.value = null
  installError.value = ''
  try {
    const info = await fetchUpdateInfo()
    if (!info) {
      status.value = 'error'
      result.value = { hasUpdate: false, version: '', name: '', notes: '', url: '', error: '未获取到更新信息' }
      return
    }
    if (info.error) {
      status.value = 'error'
      result.value = info
      return
    }
    result.value = info
    status.value = info.hasUpdate ? 'available' : 'up-to-date'
  } catch (e) {
    status.value = 'error'
    result.value = { hasUpdate: false, version: '', name: '', notes: '', url: '', error: e instanceof Error ? e.message : String(e) }
  }
}

async function installUpdate() {
  if (status.value !== 'available') return
  installError.value = ''
  // 乐观地先打开进度窗口（Go 的 mdx:update:started 事件会再确认一次），
  // 并由 Go 端在 goroutine 里执行 DownloadAndInstall + Restart；前端 await
  // 会立即 resolve，真正的下载/校验/安装进度由事件流驱动进度窗口显示。
  downloadVer.value = result.value?.version || ''
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
  downloadOpen.value = true
  // 关闭关于框，让进度窗口成为焦点。
  emit('close')
  try {
    await runInstallUpdate()
  } catch (e) {
    // 正常路径下 runInstallUpdate 立即 resolve；若它真的 reject（极少见），
    // 在进度窗口里展示失败原因。
    updateProgress.value = {
      ...updateProgress.value,
      active: false,
      stage: '更新失败',
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

function openRelease() {
  const url = result.value?.url
  if (url) getBridge().openExternal(url).catch(() => {})
}

function close() {
  emit('close')
}

// Close on Escape.
function onKeyEsc(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}

onMounted(() => {
  document.addEventListener('keydown', onKeyEsc)
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeyEsc)
})
</script>

<template>
  <div class="ab-mask" @click.self="close">
    <div class="ab" role="dialog" aria-label="关于 / 赞助">
      <div class="ab-head">
        <div class="ab-title">
          <img class="ab-logo" src="/logo.png" alt="MDX" />
          <div>
            <h2>{{ proj.name || 'MDX' }}</h2>
            <p class="ab-ver">v{{ currentVersion }} · {{ proj.tagline || '更优雅的 Markdown 公众号排版工具' }}</p>
          </div>
        </div>
        <button class="ab-x" title="关闭" @click="close">✕</button>
      </div>

      <div class="ab-body">
        <section class="ab-sec">
          <p class="ab-lead">
            MDX 是一款<strong>免费、开源</strong>的 Markdown 公众号排版工具，
            面向个人与公益场景永久免费。如果你觉得它有用，欢迎通过赞助支持持续开发。
          </p>
          <ul class="ab-list">
            <li><span>许可证</span><b>{{ proj.license || 'Apache-2.0' }}</b>（永久免费开源）</li>
            <li class="ab-ver-row">
              <span>当前版本</span>
              <div class="ab-ver-cell">
                <div class="ab-ver-base">
                  <b>v{{ currentVersion }}</b>
                  <button class="ab-btn ghost" @click="checkUpdate" :disabled="!canCheck">{{ status === 'checking' ? '检查中…' : '检查更新' }}</button>
                </div>
                <template v-if="status === 'available'">
                  <span class="ab-ver-arrow">→</span>
                  <div class="ab-ver-action">
                    <b class="ab-ver-new">v{{ result?.version }}</b>
                    <button class="ab-btn primary" @click="installUpdate">立即更新</button>
                  </div>
                </template>
                <span v-else-if="status === 'up-to-date' || status === 'error'" class="ab-latest">
                  {{ status === 'up-to-date' ? '已是最新版本' : (result?.error || '更新检查失败，请稍后重试') }}
                </span>
              </div>
            </li>
            <li><span>项目主页</span><a href="#" @click.prevent="openHomepage">{{ proj.homepage || HOMEPAGE }}</a></li>
          </ul>

          <p v-if="installError" class="ab-install-err">更新失败：{{ installError }}</p>

          <div v-if="!isDesktop" class="ab-hint">自动更新仅桌面端可用</div>

          <!-- 微信赞赏码：始终展示，不依赖远程拉取，用户无需点击即可扫码赞助。
               图片缺失时降级为提示，避免破图。 -->
          <div class="ab-wx-wrap">
            <img v-if="!wxError" class="ab-wx" :src="'/wxsponsor.jpg'" alt="微信赞赏码" @error="wxError = true" />
            <div v-else class="ab-wx-fallback">微信赞赏码：请将赞赏码图片放到 <code>public/wxsponsor.jpg</code></div>
          </div>

          <div class="ab-thanks">
            <h3>感谢以下赞助者 <span class="ab-count">（{{ sorted.length }}）</span></h3>
            <div v-if="loading" class="ab-state">正在拉取赞助者名单…</div>
            <div v-else-if="loadError" class="ab-state err">
              {{ loadError }}
              <button class="ab-retry" @click="loadSponsors">重试</button>
            </div>
            <ul v-else-if="sorted.length" class="ab-sp">
              <li v-for="(s, i) in sorted" :key="i">
                <div class="ab-sp-left">
                  <a v-if="s.link" :href="s.link" target="_blank" rel="noopener" class="ab-sp-name">{{ s.name }}</a>
                  <span v-else class="ab-sp-name">{{ s.name }}</span>
                  <span v-if="s.tier" class="ab-sp-tier">{{ s.tier }}</span>
                  <span v-if="s.amount" class="ab-sp-amt">¥{{ s.amount }}</span>
                </div>
                <span v-if="s.date" class="ab-sp-date">{{ s.date }}</span>
                <p v-if="s.message" class="ab-sp-msg">“{{ s.message }}”</p>
              </li>
            </ul>
            <p v-else class="ab-state">还没有赞助者，成为第一个吧 ☕</p>
          </div>
        </section>
      </div>

      <div class="ab-foot">
        <span class="ab-sp" />
        <button class="ab-btn" @click="close">完成</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ab-mask {
  position: fixed; inset: 0; z-index: 300;
  background: rgba(0, 0, 0, .32);
  display: flex; align-items: center; justify-content: center;
}
.ab {
  width: 480px; max-width: 92vw; max-height: 86vh; display: flex; flex-direction: column;
  background: var(--bg-primary); border: var(--border-width, 1px) solid var(--border-light);
  border-radius: var(--radius-lg, 16px);
  padding: 20px 22px 16px; box-shadow: 0 18px 54px rgba(0, 0, 0, .30);
}
.ab-head { display: flex; align-items: center; justify-content: space-between; }
.ab-title { display: flex; align-items: center; gap: 12px; }
.ab-logo { width: 40px; height: 40px; border-radius: 10px; object-fit: cover; }
.ab-title h2 { margin: 0; font-size: 17px; color: var(--text-primary); }
.ab-ver { margin: 2px 0 0; font-size: 11px; color: var(--text-secondary); }
.ab-x { width: 26px; height: 26px; border: 0; background: none; color: var(--text-secondary); font-size: 14px; cursor: pointer; border-radius: 6px; }
.ab-x:hover { background: var(--bg-hover); color: var(--text-primary); }

.ab-body { overflow: auto; flex: 1; }
.ab-sec { padding: 4px 2px 8px; }
.ab-lead { font-size: 13px; line-height: 1.7; color: var(--text-primary); margin: 0 0 14px; }

.ab-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 9px; }
.ab-list li { display: flex; gap: 10px; font-size: 13px; color: var(--text-primary); }
/* 仅匹配「标签列」直接子 span，避免污染版本行里嵌套的箭头 span（否则箭头会被 72px 撑宽） */
.ab-list li > span { width: 72px; color: var(--text-secondary); flex: none; }
.ab-list a { color: var(--accent-primary, #07c160); word-break: break-all; }

.ab-hint { font-size: 12px; color: var(--text-tertiary, #999); margin-top: 8px; }
.ab-install-err { font-size: 12px; color: #d4380d; margin: 6px 0 0; }

.ab-state { font-size: 13px; color: var(--text-secondary); padding: 14px 0; text-align: center; }
.ab-state.err { color: #d4380d; }
.ab-retry { margin-left: 10px; border: 0.5px solid var(--border-light); background: var(--bg-hover); border-radius: 6px; padding: 3px 12px; font-size: 12px; color: var(--text-primary); cursor: pointer; }

.ab-wx-wrap { display: flex; justify-content: center; margin-top: 18px; margin-bottom: 16px; }
.ab-wx { display: block; width: 180px; border-radius: 8px; border: var(--border-width, 1px) solid var(--border-light); }
.ab-wx-fallback { font-size: 12px; color: var(--text-secondary); background: var(--bg-hover); border-radius: 8px; padding: 14px 16px; text-align: center; }
.ab-wx-fallback code { font-size: 11px; color: var(--accent-primary, #07c160); }

.ab-thanks h3 { font-size: 13px; color: var(--text-primary); margin: 4px 0 10px; }
.ab-count { color: var(--text-secondary); font-weight: 400; }
.ab-sp { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.ab-sp li { background: var(--bg-hover); border-radius: 9px; padding: 9px 12px; display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.ab-sp-left { display: flex; align-items: center; gap: 6px; flex: 1; min-width: 0; }
.ab-sp-name { font-size: 13px; font-weight: 600; color: var(--text-primary); }
.ab-sp-tier { font-size: 11px; color: var(--accent-primary, #07c160); background: color-mix(in srgb, var(--accent-primary, #07c160) 14%, transparent); border-radius: 5px; padding: 1px 7px; }
.ab-sp-amt { font-size: 12px; color: #b08900; }
.ab-sp-msg { width: 100%; font-size: 12px; color: var(--text-secondary); margin: 2px 0 0; line-height: 1.5; }
.ab-sp-date { font-size: 11px; color: var(--text-tertiary, #999); margin-left: auto; }

.ab-foot { display: flex; align-items: center; gap: 8px; margin-top: 14px; }
.ab-sp { flex: 1; }
.ab-btn { border: 0.5px solid var(--border-light); background: var(--bg-hover); border-radius: 7px; padding: 8px 18px; font-size: 13px; color: var(--text-primary); cursor: pointer; }
.ab-btn:hover { border-color: var(--accent-primary, #07c160); color: var(--accent-primary, #07c160); }
.ab-btn:disabled { opacity: 0.5; cursor: default; }
.ab-ver-row { display: flex; gap: 10px; align-items: center; }
.ab-ver-cell { display: flex; align-items: center; gap: 12px; flex: 1; flex-wrap: wrap; }
.ab-ver-cell b { color: var(--text-primary); }
/* 单元一：当前版本 + 检查更新按钮（内部紧排） */
.ab-ver-base { display: flex; align-items: center; gap: 6px; }
/* 单元二：箭头 + 新版本 + 立即更新按钮（内部紧排） */
.ab-ver-action { display: flex; align-items: center; gap: 4px; }
/* 版本行按钮紧凑化 */
.ab-ver-cell .ab-btn { padding: 5px 10px; font-size: 12px; }
.ab-btn.ghost { background: color-mix(in srgb, var(--accent-primary, #07c160) 8%, transparent); }
.ab-btn.primary { background: var(--accent-primary, #07c160); color: #fff; border-color: var(--accent-primary, #07c160); }
.ab-btn.primary:hover:not(:disabled) { filter: brightness(0.92); color: #fff; }
.ab-latest { font-size: 13px; color: var(--accent-primary, #07c160); }
.ab-ver-arrow { color: var(--text-secondary); font-size: 12px; width: 16px; text-align: center; flex: none; }
.ab-ver-new { color: var(--accent-primary, #07c160); }
</style>
