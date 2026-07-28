import juice from "juice";

/**
 * 展开 CSS 自定义属性（CSS 变量），将 var(--name[, fallback]) 替换为具体值。
 *
 * 为什么要做这一步：juice.inlineContent 不会解析 CSS 变量，内联后元素携带的是
 * `var(--x)` 而非具体值；而微信公众号编辑器会剥离/不支持 CSS 自定义属性（--xxx），
 * 导致复制后所有 var() 失效、样式整体回退为默认值（即"预览正常、复制不对"）。
 * 可视化主题设计器生成的 CSS 大量使用 --mdx-* 变量，因此在交给 juice 内联前，
 * 先把变量解析为字面量，保证复制出的内联样式是具体值，公众号 100% 支持。
 */
function resolveCssVariables(css: string): string {
  if (!css || !css.includes("var(")) return css;

  // 1) 收集所有 --name: value 声明（任意规则块内，不区分选择器）
  const defs = new Map<string, string>();
  const blockRe = /\{([^{}]*)\}/g;
  let block: RegExpExecArray | null;
  while ((block = blockRe.exec(css)) !== null) {
    const decls = block[1];
    const declRe = /(--[\w-]+)\s*:\s*([^;]+);/g;
    let d: RegExpExecArray | null;
    while ((d = declRe.exec(decls)) !== null) {
      defs.set(d[1], d[2].trim());
    }
  }

  // 2) 解析单个 var() 调用：括号配平取出形参，按变量表/fallback 替换
  const substitute = (input: string): string => {
    let out = "";
    let i = 0;
    const n = input.length;
    while (i < n) {
      const at = input.indexOf("var(", i);
      if (at === -1) {
        out += input.slice(i);
        break;
      }
      out += input.slice(i, at);
      // 配平括号，取出 var( ... ) 内部内容
      let depth = 0;
      let j = at + 4; // 跳过 "var("
      for (; j < n; j++) {
        const ch = input[j];
        if (ch === "(") depth++;
        else if (ch === ")") {
          if (depth === 0) break;
          depth--;
        }
      }
      const inner = input.slice(at + 4, j);
      const commaIdx = inner.indexOf(",");
      const name = (commaIdx === -1 ? inner : inner.slice(0, commaIdx)).trim();
      const fallback = commaIdx === -1 ? undefined : inner.slice(commaIdx + 1).trim();
      let resolved: string;
      if (defs.has(name)) resolved = defs.get(name)!;
      else if (fallback !== undefined) resolved = fallback;
      else resolved = `var(${inner})`; // 无法解析，原样保留（后续迭代可能解析）
      out += resolved;
      i = j + 1; // 跳过 ")"
    }
    return out;
  };

  // 3) 先解析变量定义值内部的 var()，再整体替换使用处，循环至稳定（处理嵌套 var）
  for (const [k, v] of defs) {
    defs.set(k, substitute(v));
  }
  let result = css;
  for (let guard = 0; guard < 20; guard++) {
    const next = substitute(result);
    if (next === result) break;
    result = next;
  }
  return result;
}

/**
 * 从标题 HTML 内容生成稳定 slug。保留中文字符、数字、字母，其余转连字符。
 */
function slugify(text: string): string {
  const plain = String(text)
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .trim();

  if (!plain) return "heading";

  return plain
    .replace(/[^\p{L}\p{N}\s-]+/gu, " ")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .toLowerCase();
}

/**
 * 为 h1-h6 注入唯一 id 锚点。
 */
function injectHeadingIds(html: string): string {
  const seen = new Map<string, number>();
  return html.replace(
    /<h([1-6])(\s+[^>]*)?>([\s\S]*?)<\/h\1>/gi,
    (match: string, level: string, attrs: string | undefined, inner: string) => {
      const attributes = attrs || "";
      if (/\sid=["']/.test(attributes)) return match;

      let base = slugify(inner) || "heading";
      const count = seen.get(base) || 0;
      seen.set(base, count + 1);
      const id = count === 0 ? base : `${base}-${count}`;

      return `<h${level}${attributes} id="${id}">${inner}</h${level}>`;
    },
  );
}

const DATA_TOOL = "WeMD编辑器";
const SECTION_ID = "wemd";

const BLOCK_TAGS = [
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "blockquote",
  "table",
  "figure",
  "pre",
  "hr",
] as const;

/**
 * 处理 HTML，添加 data-tool 属性并应用 CSS 样式
 * @param html - 原始 HTML 字符串
 * @param css - CSS 样式字符串
 * @param inlineStyles - 是否内联样式 (使用 juice)，默认为 true。预览模式建议设为 false 以提高性能。
 * @param inlinePseudoElements - 是否内联伪元素内容（如 ::before / ::after），默认为 false。复制到微信时建议设为 true。
 * @returns 处理后的 HTML 字符串
 */
export const processHtml = (
  html: string,
  css: string,
  inlineStyles: boolean = true,
  inlinePseudoElements: boolean = false,
): string => {
  if (!html || !css) {
    return html || "";
  }

  // 内联路径（复制到公众号 / 导出 / 主题内联预览）前，先把 CSS 变量展开为具体值，
  // 否则 juice 不会解析 var()，而公众号又不支持 CSS 自定义属性，导致复制后样式失效。
  if (inlineStyles) {
    css = resolveCssVariables(css);
  }

  // 为顶级块元素添加 data-tool 属性
  BLOCK_TAGS.forEach((tag) => {
    const regex = new RegExp(`<${tag}(\\s+[^>]*|)>`, "gi");
    html = html.replace(regex, (match, attributes) => {
      if (match.includes("data-tool=")) return match;
      return `<${tag} data-tool="${DATA_TOOL}"${attributes}>`;
    });
  });

  // 为标题注入锚点，便于预览区目录导航
  html = injectHeadingIds(html);

  // 处理 MathJax 相关的替换
  html = html.replace(
    /<mjx-container (class="inline.+?)<\/mjx-container>/g,
    "<span $1</span>",
  );
  html = html.replace(/\s<span class="inline/g, '&nbsp;<span class="inline');
  html = html.replace(/svg><\/span>\s/g, "svg></span>&nbsp;");
  html = html.replace(/mjx-container/g, "section");
  html = html.replace(/class="mjx-solid"/g, 'fill="none" stroke-width="70"');
  html = html.replace(/<mjx-assistive-mml.+?<\/mjx-assistive-mml>/g, "");

  // 保护代码块中的空格，防止微信清洗时删除
  html = html.replace(
    /<code([^>]*class="[^"]*\bhljs\b[^"]*"[^>]*)>([\s\S]*?)<\/code>/g,
    (match, attrs: string, inner: string) => {
      let protected_ = inner;
      protected_ = protected_.replace(/\t/g, "&nbsp;&nbsp;");
      protected_ = protected_.replace(/<\/span> <span/g, " </span><span");
      protected_ = protected_.replace(/\n( +)/g, (m, spaces: string) => {
        return "\n" + "&nbsp;".repeat(spaces.length);
      });
      protected_ = protected_.replace(/^( +)/, (m, spaces: string) => {
        return "&nbsp;".repeat(spaces.length);
      });
      return `<code${attrs}>${protected_}</code>`;
    },
  );

  const wrappedHtml = `<section id="${SECTION_ID}">${html}</section>`;

  if (!inlineStyles) {
    return wrappedHtml;
  }

  try {
    let res = juice.inlineContent(wrappedHtml, css, {
      inlinePseudoElements,
      preserveImportant: true,
    });

    // 在 juice 处理之后，为代码块追加关键内联样式
    // 这确保我们的样式不会被 juice 覆盖，且优先级最高
    if (inlinePseudoElements) {
      const appendStyleValue = (styleValue: string, extra: string) => {
        const trimmed = styleValue.trim();
        if (!trimmed) return extra;
        const needsSemicolon = !trimmed.endsWith(";");
        return `${trimmed}${needsSemicolon ? ";" : ""}${extra}`;
      };

      // 处理 pre 元素：确保 overflow 和 white-space 正确
      res = res.replace(
        /<pre([^>]*)(style="[^"]*")([^>]*)>/gi,
        (match, before: string, styleAttr: string, after: string) => {
          const styleMatch = styleAttr.match(/style="([^"]*)"/i);
          const existing = styleMatch ? styleMatch[1] : "";
          const nextStyle = appendStyleValue(
            existing,
            "overflow-x:auto;-webkit-overflow-scrolling:touch;",
          );
          return `<pre${before}style="${nextStyle}"${after}>`;
        },
      );

      // 处理 code 元素：防止 text-align:justify 破坏代码格式
      // 匹配所有带 style 属性的 code 元素（不限制 class）
      res = res.replace(
        /<code([^>]*)(style="[^"]*")([^>]*)>/gi,
        (match, before: string, styleAttr: string, after: string) => {
          const styleMatch = styleAttr.match(/style="([^"]*)"/i);
          const existing = styleMatch ? styleMatch[1] : "";
          const normalized = existing.replace(
            /white-space:\s*pre-wrap/gi,
            "white-space:pre",
          );
          const nextStyle = appendStyleValue(
            normalized,
            "text-align:left;letter-spacing:0;word-spacing:0;",
          );
          return `<code${before}style="${nextStyle}"${after}>`;
        },
      );
    }

    return res;
  } catch (e) {
    console.error("Juice inline error:", e);
    return wrappedHtml;
  }
};
