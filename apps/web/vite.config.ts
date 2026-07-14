import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";
import { readFileSync } from "fs";

// Wails desktop mode sets WAILS_VITE_PORT when it launches the Vite dev server.
// In browser-only dev mode (pnpm dev directly), this env var is NOT set.
const isWails = !!process.env.WAILS_VITE_PORT;

// Read app version from root package.json (single source of truth)
const rootPkg = JSON.parse(readFileSync(resolve(__dirname, "../../package.json"), "utf-8"));
const appVersion = rootPkg.version || "0.0.0";

// https://vitejs.dev/config/
export default defineConfig(async () => {
  const plugins: any[] = [
    // Inject __WAILS_MODE__ global before any module script runs,
    // so main.ts can conditionally load @wailsio/runtime.
    {
      name: "inject-wails-flag",
      transformIndexHtml(html: string) {
        return html.replace(
          "</head>",
          `<script>window.__WAILS_MODE__=${isWails};</script></head>`,
        );
      },
    },
    vue(),
  ];

  // Only include the Wails plugin when running in Wails desktop mode.
  // In browser dev mode, we skip it to avoid 404 errors on /wails/runtime.
  if (isWails) {
    const wailsPlugin = await import("@wailsio/runtime/plugins/vite");
    plugins.push(wailsPlugin.default("./bindings"));
  }

  return {
    define: {
      __APP_VERSION__: JSON.stringify(appVersion),
    },
    server: {
      host: "127.0.0.1",
      port: Number(process.env.WAILS_VITE_PORT) || 5173,
      strictPort: true,
    },
    resolve: {
      alias: {
        // cheerio (used by juice → @mdx/core) imports Node's "events" module.
        // Provide a minimal browser polyfill so the dev server doesn't crash.
        events: resolve(__dirname, "src/bridge/events-polyfill.ts"),
        "@mdx/core": resolve(__dirname, "../../packages/core/src"),
        "@": resolve(__dirname, "src"),
      },
    },
    plugins,
    // WKWebView on macOS Monterey (Safari 15.x) doesn't support top-level await
    // and some newer ES features. Force Vite to treat these deps as external
    // during dev so they're bundled by esbuild with the right target.
    optimizeDeps: {
      exclude: ["mermaid"],
    },
    esbuild: {
      target: "safari15",
    },
    build: {
      target: "safari15",
    },
  };
});
