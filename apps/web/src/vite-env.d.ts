/// <reference types="vite/client" />

/** Injected by vite.config.ts transformIndexHtml. True in Wails desktop mode. */
interface Window {
  readonly __WAILS_MODE__?: boolean;
}
