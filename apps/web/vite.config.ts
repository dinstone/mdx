import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import wails from "@wailsio/runtime/plugins/vite";
import { resolve } from "path";

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: "127.0.0.1",
    port: Number(process.env.WAILS_VITE_PORT) || 5173,
    strictPort: true,
  },
  resolve: {
    alias: {
      "@mdx/core": resolve(__dirname, "../../packages/core/src"),
      "@": resolve(__dirname, "src"),
    },
  },
  plugins: [vue(), wails("./bindings")],
});
