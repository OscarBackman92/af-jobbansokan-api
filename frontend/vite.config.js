/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// All API paths are proxied to the Django dev server, so the browser
// only ever talks same-origin and no CORS configuration is needed.
const DJANGO = "http://127.0.0.1:8000";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": DJANGO,
      "/dj-rest-auth": DJANGO,
      "/health": DJANGO,
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.js",
  },
});
