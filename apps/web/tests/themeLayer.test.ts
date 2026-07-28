/**
 * 复制内置主题 → 可视化增量覆盖 的回归测试。
 * 验证：未改动组产生空覆盖层（baseCss 兜底保留精细样式），
 * 仅改动组进入覆盖层；且 --mdx-* 变量始终定义，保证跨组引用不丢失。
 */
import { describe, it, expect } from 'vitest'
import { generateCSS } from '../src/theme-designer/generateCSS'
import { parseThemeCssToVariables } from '../src/theme-designer/parseCSS'

// 一个"内置主题"风格 CSS：含三线表、特殊引用边框、callout、斑马纹等设计器无法表达的细节
const builtInCss = `#wemd {
  font-family: 'PingFang SC', sans-serif;
  color: #24292e;
  padding: 0 12px;
}
#wemd p { font-size: 15px; line-height: 1.7; margin: 14px 0; }
#wemd h1 .content { font-size: 26px; color: #c0392b; }
#wemd h2 .content { font-size: 22px; color: #2980b9; }
#wemd blockquote, #wemd .multiquote-1 {
  background: #f0f7ff; border-left: 4px solid #2980b9; padding: 12px 16px;
}
#wemd pre.custom { background: #1e1e1e; }
#wemd th { background: #34495e; color: #fff; }
#wemd th, #wemd td { border: 1px solid #2c3e50; }
#wemd tr:nth-child(even) { background: #ecf0f1; }
#wemd table { border-top: 2px solid #000; border-bottom: 2px solid #000; }
#wemd hr { border-top: 3px dashed #e74c3c; }
#wemd a { color: #2980b9; }
#wemd .callout-note { border-left: 4px solid #6366f1; background: #f5f5ff; }
`

describe('parseThemeCssToVariables', () => {
  it('从内置 CSS 提取可表达属性', () => {
    const v = parseThemeCssToVariables(builtInCss)
    expect(v.h1.color).toBe('#c0392b')
    expect(v.h1.fontSize).toBe(26)
    expect(v.tableZebra).toBe(true)
    expect(v.tableHeaderBackground).toBe('#34495e')
    expect(v.hrStyle).toBe('dashed')
    expect(v.hrColor).toBe('#e74c3c')
    expect(v.linkColor).toBe('#2980b9')
  })
})

describe('generateCSS 增量覆盖', () => {
  it('未改动时覆盖层不含任何属性组规则（仅始终保留的变量定义）', () => {
    const baseVars = parseThemeCssToVariables(builtInCss)
    const overlay = generateCSS(baseVars, { skipBase: baseVars })
    const groupComments = overlay.match(/@mdx-group:/g) || []
    expect(groupComments.length).toBe(0)
    expect(overlay).toMatch(/--mdx-primary-color:/)
  })

  it('只改 h1 颜色：覆盖层仅含 h1 组，内置细节由 baseCss 兜底', () => {
    const baseVars = parseThemeCssToVariables(builtInCss)
    const changed = JSON.parse(JSON.stringify(baseVars))
    changed.h1.color = '#ff0000'
    const overlay = generateCSS(changed, { skipBase: baseVars })
    const composed = builtInCss + '\n' + overlay

    // 覆盖层只动了 h1
    expect(overlay).toContain('@mdx-group:h1')
    expect(overlay).not.toContain('@mdx-group:quote')
    expect(overlay).not.toContain('@mdx-group:table')
    expect(overlay).toContain('--mdx-h1-color: #ff0000;')

    // baseCss 的精细样式被完整保留
    expect(composed).toContain('border-top: 2px solid #000')
    expect(composed).toContain('border-bottom: 2px solid #000')
    expect(composed).toContain('background: #f0f7ff')
    expect(composed).toContain('border-left: 4px solid #2980b9')
    expect(composed).toContain('.callout-note')
    expect(composed).toContain('#wemd h2 .content { font-size: 22px; color: #2980b9; }')

    // h1 用新色
    expect(composed).toMatch(/#wemd h1 \.content \{[\s\S]*color: var\(--mdx-h1-color\)/)
  })

  it('始终保留 --mdx-* 变量，跨组引用不丢失', () => {
    const baseVars = parseThemeCssToVariables(builtInCss)
    const changed = JSON.parse(JSON.stringify(baseVars))
    changed.primaryColor = '#00aa00'
    const overlay = generateCSS(changed, { skipBase: baseVars })
    expect(overlay).toContain('--mdx-primary-color: #00aa00;')
  })
})
