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
          const dir = filePath.substring(0, filePath.lastIndexOf("/"));
          store
            .openWorkspace(store.resolveWorkspace(dir))
            .then(() => store.setActiveFile(filePath))
            .catch((e) => console.error("[event] file:opened failed:", e));
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
        // Handle it directly.
        console.log("[cold-launch] opening workspace for:", pendingFile);
        fileOpenedHandled = true;
        const dir = pendingFile.substring(0, pendingFile.lastIndexOf("/"));
        await store.openWorkspace(store.resolveWorkspace(dir));
        store.setActiveFile(pendingFile);
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
