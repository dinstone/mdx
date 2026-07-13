// Wails 3 runtime must be loaded before anything that calls the Go backend.
// It sets up window._wails, which the bridge uses for platform detection.
//
// In browser-only dev mode (pnpm dev without Wails), window.__WAILS_MODE__ is
// false and the runtime is never loaded.  The bridge will automatically fall
// back to BrowserBridge (IndexedDB).

import "./styles/theme.css";

import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import { useWorkspaceStore } from "./stores/workspace";
import { initDesktop } from "./bridge";

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

// Open the most recent workspace (or create a temp one).
// In browser mode this uses BrowserBridge (IndexedDB); in desktop mode
// Wails will re-open system workspaces via DesktopBridge below.
const store = useWorkspaceStore();
store.open().catch(() => {
  /* non-critical */
});

// Only load the Wails runtime inside the Wails desktop shell (WebView).
// In browser-only dev mode the runtime attempts POST /wails/runtime and
// would 404 without a running Go backend.
if (window.__WAILS_MODE__) {
  // Dynamic import prevents @wailsio/runtime from loading in browser mode.
  import("@wailsio/runtime").then(async ({ Events }) => {
    // Swap the bridge from BrowserBridge → DesktopBridge now that the
    // Go backend communications layer is ready.
    await initDesktop();

    // DesktopBridge is now ready — re-open with the real backend.
    // store.open() handles loadRecents → pick most recent → open.
    try { await store.open(); } catch { /* ignore */ }

    // Listen for native menu-driven workspace events from the Go backend.
    try {
      Events.On("workspace:opened", (event: any) => {
        const path = event?.data;
        if (typeof path === "string" && path) {
          store.openWorkspace(store.resolveWorkspace(path)).catch(() => {
            /* ignore */
          });
        }
      });
      Events.On("workspace:closed", () => {
        store.close().catch(() => {
          /* ignore */
        });
      });
    } catch {
      // Events system not available (browser mode or pre-init phase).
      // The app still works — users can open a workspace via the UI buttons.
    }
  });
}
