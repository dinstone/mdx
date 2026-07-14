/// <reference types="vite/client" />

/** Injected by vite.config.ts transformIndexHtml. True in Wails desktop mode. */
interface Window {
  readonly __WAILS_MODE__?: boolean;
}

/** Injected by vite.config.ts define. App version from root package.json. */
declare const __APP_VERSION__: string;
