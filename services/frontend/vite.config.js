import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  server: {
    // Dev server has no backend of its own: forward /api to the running compose stack (Caddy on :3000).
    proxy: {
      "/api": { target: process.env.API_PROXY_TARGET || "http://host.docker.internal:3000", changeOrigin: true },
    },
  },
});
