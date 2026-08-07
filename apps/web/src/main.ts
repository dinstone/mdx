// Wails 3 runtime must be loaded before anything that calls the Go backend.
// It sets up window._wails, which the bridge uses for platform detection.
//
// In browser-only dev mode (pnpm dev without Wails), window.__WAILS_MODE__ is
// false and the runtime is never loaded.  The bridge will automatically fall
// back to BrowserBridge (IndexedDB).

import "./styles/theme.css";
// KaTeX stylesheet: math formulas are rendered by the @mdx/core markdown
// parser via KaTeX, but the rendered HTML needs this CSS (fonts + layout)
// or formulas appear broken/overlapping in the live preview.
import "katex/dist/katex.min.css";

import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import { useWorkspaceStore } from "./stores/workspace";
import { useEditorStore } from "./stores/editor";
import { isPathInsideWorkspace } from "./stores/workspace-types";
import { initDesktop, getDesktopBridge } from "./bridge";

// Restore the UI theme before Vue renders to avoid a flash of the wrong mode.
(function restoreTheme() {
  try {
    if (localStorage.getItem('mdx-ui-theme') === 'dark') {
      document.documentElement.setAttribute('data-ui-theme', 'dark');
    }
  } catch {
    // localStorage not available (e.g. private mode).
  }
})();

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);

// Mount Vue before wiring Wails events so the UI renders even if the
// runtime event system is not available (e.g. in browser-only mode).
app.mount("#app");

const store = useWorkspaceStore();

// ---- Browser mode ----
// Open the most recent workspace (or create a temp one) using IndexedDB.
// Desktop mode does its own initialisation inside the Wails runtime block.
// Desktop mode detection:
//   - Dev:  WAILS_VITE_PORT is set → vite injects __WAILS_MODE__=true
//   - Prod: WAILS_VITE_PORT is NOT set → vite injects __WAILS_MODE__=false,
//           but the page is served from embedded assets over a non-http
//           protocol (wails://), which is a reliable desktop indicator.
const isDesktop = window.__WAILS_MODE__ ||
  !location.protocol.startsWith('http')

if (isDesktop) {
  // ---- Desktop mode ----
  // Load the desktop bridge and Wails runtime together in a single dynamic
  // chunk. The runtime has internal circular imports that Vite/Rolldown can
  // resolve correctly when they are reached from the bridge chunk, but which
  // break if the runtime is imported as a top-level dynamic import.
  initDesktop()
    .then(async ({ Events }) => {
      console.log("[init] DesktopBridge ready, registering event listeners");

    // Wrap the cold-launch handling in a try so errors are visible.
    try {
      // ---------- Register event listeners FIRST ----------
      // These must be in place before we signal "frontend ready" to Go,
      // otherwise Go may emit events that nobody is listening to.

      // Track whether a file:opened event already handled workspace opening,
      // so we don't double-open with store.open().
      let fileOpenedHandled = false;

      /**
       * 处理文件关联（从 Finder / 资源管理器双击 .md 打开）的核心逻辑。
       *
       *   1) 文件已在「当前工作区」内 → 仅切换活动文件，工作区根不变
       *   2) 文件在「某个最近工作区」内 → 打开那个工作区，再打开文件
       *   3) 都不匹配（游离文件）   → 保持当前工作区不变（无则先建默认/Temp
       *                              工作区），只在编辑器打开，不进侧边栏树
       *
       * 这样双击打开文件不会再拿父目录去造一个新工作区。
       */
      async function openFileFromAssociation(filePath: string) {
        // 1) 已在当前工作区中
        if (store.isOpen && isPathInsideWorkspace(filePath, store.rootPath)) {
          await store.setActiveFile(filePath);
          return;
        }
        // 2) 在某个最近工作区中
        const ancestor = store.findAncestorRecent(filePath);
        if (ancestor) {
          await store.openWorkspace(ancestor);
          await store.setActiveFile(filePath);
          return;
        }
        // 3) 游离文件：保持当前工作区不变（必要时先确保有一个默认/Temp 工作区），
        //    只交给编辑器打开，不污染工作区文件树。
        if (!store.isOpen) await store.open();
        const editor = useEditorStore();
        await editor.loadFile(filePath);
      }

      Events.On("workspace:opened", (event: any) => {
        console.log("[event] workspace:opened", event?.data);
        const path = event?.data;
        if (typeof path === "string" && path) {
          store.openWorkspace(store.resolveWorkspace(path)).catch((e) =>
            console.error("[event] workspace:opened failed:", e),
          );
        }
      });

      Events.On("workspace:closed", () => {
        console.log("[event] workspace:closed");
        store.close().catch((e) =>
          console.error("[event] workspace:closed failed:", e),
        );
      });

      // Handle file associations — works for both:
      //   Hot launch  — app already running, user double-clicks in Finder.
      //   Cold launch — ApplicationOpenedWithFile fires AFTER frontendReady
      //                  is true; Go emits this event directly.
      Events.On("file:opened", (event: any) => {
        const filePath = event?.data;
        console.log("[event] file:opened", filePath);
        if (typeof filePath === "string" && filePath) {
          fileOpenedHandled = true;
          openFileFromAssociation(filePath).catch((e) =>
            console.error("[event] file:opened failed:", e),
          );
        }
      });

      // ---------- Cold-launch file association ----------
      // Calling GetPendingOpenFile signals "frontend ready" to Go.
      // From this point on, ApplicationOpenedWithFile will emit "file:opened"
      // directly instead of queueing.
      const bridge = getDesktopBridge();
      if (!bridge) {
        console.warn("[init] getDesktopBridge returned null, falling back");
        store.loadRecentWorkspaces();
        return;
      }

      console.log("[init] checking for pending cold-launch file...");
      const pendingFile = await bridge.getPendingOpenFile();

      if (pendingFile) {
        // Cold-launch file queued BEFORE frontend was ready.
        // 交给统一逻辑处理：不再用父目录造工作区。
        console.log("[cold-launch] opening file association:", pendingFile);
        fileOpenedHandled = true;
        await openFileFromAssociation(pendingFile);
      } else {
        // No file was queued yet.  But ApplicationOpenedWithFile might fire
        // shortly after (goroutine scheduling / dispatch_async delay).
        // Wait a brief window for file:opened to arrive.
        console.log("[cold-launch] no pending file, waiting for late event...");
        await new Promise((r) => setTimeout(r, 300));
      }

      if (!fileOpenedHandled) {
        console.log("[init] no file association, opening recent workspace");
        await store.open();
      } else {
        console.log("[init] file association handled, skipping store.open()");
      }
    } catch (e: unknown) {
      console.error("[init] desktop init failed:", e);
      // Fallback: try to open recent workspace anyway
      try {
        await store.open();
      } catch {
        /* last resort */
      }
    }
  })
  .catch((e: unknown) => {
    console.error("[init] failed to load desktop bridge, falling back to browser:", e);
    store.open().catch((err) => console.error("[browser fallback] store.open failed:", err));
  });
} else {
  // ---- Browser mode ----
  // Open immediately with BrowserBridge (IndexedDB).
  store.open().catch((e) => console.error("[browser] store.open failed:", e));
}
