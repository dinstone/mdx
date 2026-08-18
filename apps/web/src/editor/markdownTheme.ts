import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'

/**
 * 亮色模式 Markdown 编辑器语法高亮。
 * 参考 wemd 设计：标题分层、强调、链接、行内代码等。
 * 行内代码不设置背景色，交由 CSS 控制，避免遮挡选中效果。
 */
const lightHighlightStyle = HighlightStyle.define([
  { tag: t.heading1, fontWeight: '700', fontSize: '1.75em', color: '#1a202c' },
  { tag: t.heading2, fontWeight: '700', fontSize: '1.5em', color: '#2d3748' },
  { tag: t.heading3, fontWeight: '600', fontSize: '1.25em', color: '#4a5568' },
  { tag: t.heading4, fontWeight: '600', fontSize: '1.1em', color: '#4a5568' },
  { tag: t.heading5, fontWeight: '600', color: '#718096' },
  { tag: t.heading6, fontWeight: '600', color: '#718096' },

  { tag: t.emphasis, fontStyle: 'italic', color: '#2d3748' },
  { tag: t.strong, fontWeight: '700', color: '#1a202c' },
  { tag: t.strikethrough, textDecoration: 'line-through', color: '#a0aec0' },

  { tag: t.link, color: '#07c160', fontWeight: '500' },
  { tag: t.url, color: '#38b2ac' },

  {
    tag: t.monospace,
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
    color: '#e53e3e',
    padding: '2px 5px',
    borderRadius: '3px',
    fontSize: '0.9em',
  },

  { tag: t.meta, color: '#a0aec0' },
  { tag: t.comment, color: '#a0aec0', fontStyle: 'italic' },
  { tag: t.separator, color: '#a0aec0' },
  { tag: t.contentSeparator, color: '#a0aec0' },
])

/**
 * 暗色模式 Markdown 编辑器语法高亮。
 */
const darkHighlightStyle = HighlightStyle.define([
  { tag: t.heading1, fontWeight: '700', fontSize: '1.75em', color: '#81d4fa' },
  { tag: t.heading2, fontWeight: '700', fontSize: '1.5em', color: '#4fc3f7' },
  { tag: t.heading3, fontWeight: '600', fontSize: '1.25em', color: '#29b6f6' },
  { tag: t.heading4, fontWeight: '600', fontSize: '1.1em', color: '#29b6f6' },
  { tag: t.heading5, fontWeight: '600', color: '#03a9f4' },
  { tag: t.heading6, fontWeight: '600', color: '#03a9f4' },

  { tag: t.emphasis, fontStyle: 'italic', color: '#b0bec5' },
  { tag: t.strong, fontWeight: '700', color: '#f5f5f5' },
  { tag: t.strikethrough, textDecoration: 'line-through', color: '#78909c' },

  { tag: t.link, color: '#4caf50', fontWeight: '500' },
  { tag: t.url, color: '#4db6ac' },

  {
    tag: t.monospace,
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
    color: '#ce9178',
    padding: '2px 5px',
    borderRadius: '3px',
    fontSize: '0.9em',
  },

  { tag: t.meta, color: '#78909c' },
  { tag: t.comment, color: '#78909c', fontStyle: 'italic' },
  { tag: t.separator, color: '#b0bec5' },
  { tag: t.content, color: '#d4d4d4' },
  { tag: t.contentSeparator, color: '#78909c' },
  { tag: t.processingInstruction, color: '#d4d4d4' },
  { tag: t.atom, color: '#ce9178' },
  { tag: t.special(t.string), color: '#ce9178' },
  { tag: t.character, color: '#ce9178' },
  { tag: t.escape, color: '#d7ba7d' },
])

export const markdownLightHighlighting = syntaxHighlighting(lightHighlightStyle)
export const markdownDarkHighlighting = syntaxHighlighting(darkHighlightStyle)
