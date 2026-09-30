/**
 * 赞助者名单：远程拉取（GitHub 主源 + Gitee 兜底）。
 *
 * 在两个仓库根目录各放一份相同的 `sponsors.json` 即可（Gitee 用于国内访问兜底）。
 * 文件结构（兼容「直接是数组」与「带字段的对象」两种写法）：
 *
 * {
 *   "updated": "2026-09-30",
 *   "project": {
 *     "name": "MDX",
 *     "tagline": "更优雅的 Markdown 公众号排版工具",
 *     "license": "Apache-2.0",
 *     "homepage": "https://github.com/dinstone/mdx"
 *   },
 *   "sponsorLinks": {
 *     "githubSponsors": "https://github.com/sponsors/<owner>",
 *     "afdian": "https://afdian.com/a/<id>",
 *     "wechatQr": "https://.../wechat-sponsor.png"   // 可选：微信赞赏码图片
 *   },
 *   "milestones": [
 *     { "title": "解锁：更多主题模板", "goal": 1000, "current": 320 }
 *   ],
 *   "sponsors": [
 *     { "name": "张三", "amount": 50, "tier": "咖啡", "date": "2026-09-10",
 *       "message": "支持开源！", "link": "" }
 *   ]
 * }
 *
 * 仅放数组也行：
 *   [ { "name": "张三", "amount": 50 }, ... ]
 */

export interface Sponsor {
  name: string
  amount?: number
  tier?: string
  date?: string
  message?: string
  link?: string
}
export interface Milestone {
  title: string
  goal: number
  current: number
}
export interface SponsorLinks {
  githubSponsors?: string
  afdian?: string
  wechatQr?: string
}
export interface SponsorsData {
  updated?: string
  project?: { name?: string; tagline?: string; license?: string; homepage?: string }
  sponsorLinks?: SponsorLinks
  milestones?: Milestone[]
  sponsors?: Sponsor[]
}

/* ===== 在此填入你的仓库坐标（两边放同一份 sponsors.json）===== */
const OWNER = 'dinstone'
const REPO = 'mdx'
const BRANCH = 'main'
const PATH = 'sponsors.json'
const GITHUB_RAW = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${PATH}`
const GITEE_RAW = `https://gitee.com/${OWNER}/${REPO}/raw/${BRANCH}/${PATH}`
/* =========================================================== */

/** 拉取顺序：GitHub 主源优先，失败/超时再试 Gitee 兜底 */
export const SPONSORS_SOURCES: string[] = [GITHUB_RAW, GITEE_RAW]

export interface SponsorFetch {
  data: SponsorsData | null
  source: string | null
  error: string | null
}

/**
 * 依次尝试各源拉取赞助者名单；任一成功即返回，全部失败返回 error。
 * 兼容文件本身是数组（直接当 sponsors）或对象（取 sponsors 字段）。
 */
export async function fetchSponsors(timeoutMs = 8000): Promise<SponsorFetch> {
  for (const url of SPONSORS_SOURCES) {
    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), timeoutMs)
      const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store' })
      clearTimeout(timer)
      if (!res.ok) continue
      const json: unknown = await res.json()
      const data: SponsorsData = Array.isArray(json)
        ? { sponsors: json as Sponsor[] }
        : (json as SponsorsData)
      return { data, source: url, error: null }
    } catch {
      /* 该源失败，尝试下一个 */
    }
  }
  return {
    data: null,
    source: null,
    error: '暂时无法拉取赞助者名单（请检查网络，或到 GitHub / Gitee 仓库查看）',
  }
}
