import {
  LanguageDescription,
  LanguageSupport,
  StreamLanguage,
} from '@codemirror/language'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { python } from '@codemirror/lang-python'
import { css } from '@codemirror/lang-css'
import { html } from '@codemirror/lang-html'
import { java } from '@codemirror/lang-java'
import { cpp } from '@codemirror/lang-cpp'
import { go } from '@codemirror/lang-go'
import { rust } from '@codemirror/lang-rust'
import { sql } from '@codemirror/lang-sql'
import { xml } from '@codemirror/lang-xml'
import { yaml } from '@codemirror/lang-yaml'
import { php } from '@codemirror/lang-php'
import { markdown } from '@codemirror/lang-markdown'
import { shell } from '@codemirror/legacy-modes/mode/shell'
import { dockerFile } from '@codemirror/legacy-modes/mode/dockerfile'

/**
 * 编辑器内代码块（围栏 ```lang）的静态高亮支持列表。
 *
 * 为什么不用 @codemirror/language-data 的 `languages`：
 * 该数组里每个语言的解析器都是「运行时 import() 懒加载」。在 Vite dev server
 * 下正常，但 Wails 内嵌 webview 的生产包（GitHub Actions 打出的 .app/.exe）
 * 里动态 chunk 加载常失败，导致代码块失去高亮、而标题/加粗等静态高亮仍在。
 *
 * 这里改用 LanguageDescription.of({ support }) 把语言**预打包进主 bundle**，
 * 零运行时动态导入，dev 与生产包表现完全一致。
 */
function lang(
  name: string,
  alias: string[],
  extensions: string[],
  support: LanguageSupport,
): LanguageDescription {
  return LanguageDescription.of({ name, alias, extensions, support })
}

function legacy(name: string, alias: string[], support: LanguageSupport): LanguageDescription {
  // 部分语言（bash/shell、dockerfile 等）来自 legacy-modes，只靠别名匹配，不含扩展名
  return LanguageDescription.of({ name, alias, support })
}

export const codeLanguages: LanguageDescription[] = [
  lang('JavaScript', ['js', 'javascript', 'jsx', 'mjs', 'cjs', 'node'], ['js', 'jsx', 'mjs', 'cjs'], javascript()),
  lang('TypeScript', ['ts', 'typescript', 'tsx'], ['ts', 'tsx'], javascript({ typescript: true })),
  lang('JSON', ['json', 'jsonc'], ['json', 'jsonc'], json()),
  lang('Python', ['py', 'python'], ['py'], python()),
  lang('CSS', ['css'], ['css'], css()),
  lang('HTML', ['html', 'htm', 'xhtml'], ['html', 'htm'], html()),
  lang('Java', ['java'], ['java'], java()),
  lang('C++', ['cpp', 'c++', 'cxx', 'hpp'], ['cpp', 'cxx', 'hpp'], cpp()),
  lang('C', ['c', 'h'], ['c', 'h'], cpp()),
  lang('Go', ['go'], ['go'], go()),
  lang('Rust', ['rs', 'rust'], ['rs'], rust()),
  lang('SQL', ['sql'], ['sql'], sql()),
  lang('XML', ['xml', 'svg'], ['xml'], xml()),
  lang('YAML', ['yaml', 'yml'], ['yaml', 'yml'], yaml()),
  lang('PHP', ['php'], ['php'], php()),
  lang('Markdown', ['md', 'markdown'], ['md'], markdown()),
  legacy('Shell', ['bash', 'sh', 'shell', 'zsh', 'console'], new LanguageSupport(StreamLanguage.define(shell))),
  legacy('Dockerfile', ['dockerfile', 'docker'], new LanguageSupport(StreamLanguage.define(dockerFile))),
]

export default codeLanguages
