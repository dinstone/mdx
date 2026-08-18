/**
 * 编辑器与预览的滚动同步（基于标题锚点的分块对齐）。
 *
 * 思路：编辑器源码里的 `#` 标题与预览渲染出的 <h1>..<h6> 按顺序一一对应。
 * 把文档按标题切成若干「块」，块内单独按进度比例映射，块与块之间以标题为锚点对齐，
 * 这样就不会像纯百分比同步那样在长文档上累积偏移。
 */

export interface EditorHeading {
  /** 0-based 行号（对应 CodeMirror doc.lineAt().number - 1） */
  line: number
  level: number
  text: string
}

/** 从 Markdown 源码提取 ATX 标题（#..######）。忽略 setext 标题（== / --）。 */
export function parseEditorHeadings(md: string): EditorHeading[] {
  const lines = md.split('\n')
  const result: EditorHeading[] = []
  // 允许行尾闭合 # 号（常见风格）
  const re = /^(#{1,6})\s+(.+?)\s*#*\s*$/
  for (let i = 0; i < lines.length; i++) {
    const m = re.exec(lines[i])
    if (m) {
      result.push({ line: i, level: m[1].length, text: m[2].trim() })
    }
  }
  return result
}

function clamp01(v: number): number {
  if (v < 0) return 0
  if (v > 1) return 1
  return v
}

/** 找到最后一个 start <= value 的下标；无则 -1 */
function findAnchorIndex(starts: number[], value: number): number {
  let k = -1
  for (let i = 0; i < starts.length; i++) {
    if (starts[i] <= value) k = i
    else break
  }
  return k
}

/**
 * 编辑器顶部行号 → 预览目标 scrollTop。
 * @param topLine     编辑器视口顶部行号（0-based）
 * @param headings    源码标题列表
 * @param previewTops 预览各标题相对滚动内容的绝对 top（按 heading 顺序）
 * @param maxScroll   预览可滚动最大距离
 * @param totalLines  编辑器总行数（用于最后一块的比例估算）
 */
export function editorToPreviewTop(
  topLine: number,
  headings: EditorHeading[],
  previewTops: number[],
  maxScroll: number,
  totalLines: number,
): number {
  const n = headings.length
  const k = findAnchorIndex(
    headings.map((h) => h.line),
    topLine,
  )

  const startLine = k < 0 ? 0 : headings[k].line
  const endLine = k + 1 < n ? headings[k + 1].line : totalLines - 1
  const ratio = clamp01((topLine - startLine) / Math.max(1, endLine - startLine))

  const startTop = k < 0 ? 0 : previewTops[k]
  const endTop = k + 1 < n ? previewTops[k + 1] : maxScroll
  const target = startTop + (endTop - startTop) * ratio
  return Math.max(0, Math.min(maxScroll, target))
}

/**
 * 预览 scrollTop → 编辑器目标行号。
 * @param scrollTop   预览当前 scrollTop
 * @param previewTops 预览各标题相对滚动内容的绝对 top（按 heading 顺序）
 * @param headings    源码标题列表
 * @param maxScroll   预览可滚动最大距离
 * @param totalLines  编辑器总行数
 */
export function previewToEditorLine(
  scrollTop: number,
  previewTops: number[],
  headings: EditorHeading[],
  maxScroll: number,
  totalLines: number,
): number {
  const n = headings.length
  const k = findAnchorIndex(previewTops, scrollTop)

  const startTop = k < 0 ? 0 : previewTops[k]
  const startLine = k < 0 ? 0 : headings[k].line
  const endTop = k + 1 < n ? previewTops[k + 1] : maxScroll
  const endLine = k + 1 < n ? headings[k + 1].line : totalLines - 1
  const ratio = clamp01((scrollTop - startTop) / Math.max(1, endTop - startTop))

  const line = startLine + ratio * (endLine - startLine)
  return Math.max(0, Math.min(totalLines - 1, Math.round(line)))
}
