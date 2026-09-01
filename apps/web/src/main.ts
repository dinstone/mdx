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
import { useToast } from "./composables/useToast";
import {
  getLastUpdate,
  installUpdate,
  startAutoUpdateCheck,
} from "./bridge/update";
import type { CheckUpdateResult } from "./bridge/update";

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

// ---- Bootstrap ----
// Decide between desktop and browser mode. The Wails runtime (window._wails)
// is injected by the Go host and may NOT exist yet at the moment this module
// evaluates — it can arrive a tick later, and some production builds serve the
// page over http(s) (where __WAILS_MODE__ is also false). A one-shot
// synchronous check here used to wrongly drop us into browser mode on those
// builds, silently disabling the native folder picker (the "只能添加临时工作空间"
// Windows issue). So:
//   * If we're unambiguously desktop (__WAILS_MODE__ set, or a non-http
//     protocol such as wails://), bootstrap desktop immediately.
//   * Otherwise (http(s) without an explicit wails signal) probe briefly for the
//     runtime. If it shows up, go desktop; if not, fall back to the browser
//     bridge. This keeps pure-web deployments snappy while still catching desktop
//     builds whose runtime is injected asynchronously.
const unambiguouslyDesktop =
  window.__WAILS_MODE__ || !location.protocol.startsWith('http')

if (unambiguouslyDesktop) {
  bootstrapDesktop()
} else {
  waitForWailsRuntime(2500)
    .then(() => bootstrapDesktop())
    .catch(() => {
      // No Wails runtime appeared → pure browser deployment.
      store.open().catch((e) => console.error('[browser] store.open failed:', e))
    })
}

/**
 * Desktop bootstrap.
 *
 * Wraps initDesktop() in a runtime-ready wait so a late-arriving Wails runtime
 * (or a transient race) does NOT silently drop the app into browser-fallback
 * mode — which would lose the native folder picker (only a temp/IndexedDB
 * workspace could be added) and file-association handling.  If the desktop
 * bridge genuinely can't load, we surface the error visibly instead of
 * swallowing it.
 */
async function bootstrapDesktop() {
  try {
    await waitForWailsRuntime()
  } catch (e) {
    console.warn('[init] Wails runtime not ready in time, proceeding anyway:', e)
  }

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
       *   1) 文件已在「当前工作空间」内 → 仅切换活动文件，工作空间根不变
       *   2) 文件在「某个最近工作空间」内 → 打开那个工作空间，再打开文件
       *   3) 都不匹配（游离文件）   → 保持当前工作空间不变（无则先建默认/Temp
       *                              工作空间），只在编辑器打开，不进侧边栏树
       *
       * 这样双击打开文件不会再拿父目录去造一个新工作空间。
       */
      async function openFileFromAssociation(filePath: string) {
        // 1) 已在当前工作空间中
        if (store.isOpen && isPathInsideWorkspace(filePath, store.rootPath)) {
          await store.setActiveFile(filePath);
          return;
        }
        // 2) 在某个最近工作空间中
        const ancestor = store.findAncestorRecent(filePath);
        if (ancestor) {
          await store.openWorkspace(ancestor);
          await store.setActiveFile(filePath);
          return;
        }
        // 3) 游离文件：保持当前工作空间不变（必要时先确保有一个默认/Temp 工作空间），
        //    只交给编辑器打开，不污染工作空间文件树。
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

      // ---------- Background update notification ----------
      // Go runs a one-shot update check a few seconds after launch and, when a
      // newer release exists, emits "updater:available". We then fetch the
      // details and surface a persistent toast with an "立即更新" action.
      const toast = useToast();

      Events.On("updater:available", (event: any) => {
        console.log("[event] updater:available", event?.data);
        getLastUpdate()
          .then((info: CheckUpdateResult | null) => {
            if (info && info.hasUpdate) {
              showUpdateToast(info);
            }
          })
          .catch((e) =>
            console.error("[event] updater:available fetch failed:", e),
          );
      });

      function showUpdateToast(info: CheckUpdateResult) {
        const label = info.name ? `${info.name} (v${info.version})` : `v${info.version}`;
        toast.action(
          `发现新版本 ${label}，点击更新`,
          "立即更新",
          () => {
            installUpdate().catch((e) =>
              console.error("[update] install failed:", e),
            );
          },
          0, // persist until the user acts or dismisses
        );
      }

      // Kick off the background auto-check now that the listener is registered.
      // The Go side also waits a few seconds, so this is race-free.
      startAutoUpdateCheck().catch((e) =>
        console.error("[update] startAutoUpdateCheck failed:", e),
      );

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
        // 交给统一逻辑处理：不再用父目录造工作空间。
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
    // Surface a visible error so a genuine desktop-bridge failure is
    // diagnosable (instead of silently showing the web-only "enter name"
    // prompt with no folder picker).  This is the exact symptom reported for
    // the "只能添加临时类型的工作空间" Windows issue.
    try {
      useToast().error(
        "桌面端桥接加载失败：本地文件夹工作空间不可用，仅临时空间可用。请打开控制台查看日志。",
        6000,
      );
    } catch {
      /* toast unavailable — console.error above already captured it */
    }
    store.open().catch((err) => console.error("[browser fallback] store.open failed:", err));
  });
}

/**
 * Wait until the Wails runtime (window._wails) is available.
 *
 * In a real desktop build the runtime is injected by the Go host before the
 * page loads, so this resolves essentially immediately. We still poll (rather
 * than assume) because in some builds the runtime script is loaded
 * asynchronously and may arrive a tick after the Vue app boots — racing that
 * used to cause initDesktop() to throw and silently drop the app into
 * browser-fallback mode (which only offered a temp/IndexedDB workspace, never
 * a real folder picker). If the runtime never arrives (e.g. someone opens the
 * built frontend in a plain browser) we time out and let the caller decide,
 * instead of hanging forever.
 *
 * Resolves when window._wails exists; rejects after timeoutMs.
 */
function waitForWailsRuntime(timeoutMs = 3000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window._wails) {
      resolve();
      return;
    }
    const start = Date.now();
    const timer = window.setInterval(() => {
      if (window._wails) {
        window.clearInterval(timer);
        resolve();
      } else if (Date.now() - start >= timeoutMs) {
        window.clearInterval(timer);
        reject(new Error(`Wails runtime not ready after ${timeoutMs}ms`));
      }
    }, 50);
  });
}
