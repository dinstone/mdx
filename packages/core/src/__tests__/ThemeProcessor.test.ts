import { describe, expect, it } from "vitest";
import { processHtml } from "../ThemeProcessor";

describe("ThemeProcessor mac bar", () => {
  it("保留 pre 与 code 之间的 mac bar SVG，并保持代码空格保护", () => {
    const html =
      '<pre class="custom"><span class="mac-sign" style="padding: 10px 14px 0;"><svg xmlns="http://www.w3.org/2000/svg" width="45" height="13" viewBox="0 0 450 130"></svg></span><code class="hljs language-ts">  const a = 1;\n    console.log(a);</code></pre>';
    const css = `
      #wemd pre.custom > .mac-sign {
        display: block;
      }
    `;

    const output = processHtml(html, css, false, true);

    expect(output).toContain("<svg");
    expect(output).toMatch(
      /<pre[^>]*>\s*<span[^>]*><svg[\s\S]*<\/svg><\/span><code/i,
    );
    expect(output).not.toMatch(/<code[^>]*>[\s\S]*<svg/i);
    expect(output).toContain("&nbsp;&nbsp;const a = 1;");
    expect(output).toContain("\n&nbsp;&nbsp;&nbsp;&nbsp;console.log(a);");
  });
});
