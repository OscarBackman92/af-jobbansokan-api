/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// All API paths are proxied to the Django dev server, so the browser
// only ever talks same-origin and no CORS configuration is needed.
// VITE_BACKEND lets the E2E suite point at its own backend port.
const DJANGO = process.env.VITE_BACKEND || "http://127.0.0.1:8000";

export default defineConfig({
  base: "/app/",
  plugins: [react()],
  build: {
    outDir: "dist/app",
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/api": DJANGO,
      "/dj-rest-auth": DJANGO,
      "/health": DJANGO,
      "/runtime-config.js": DJANGO,
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.js",
    // Keep Playwright specs (e2e/) out of the Vitest run.
    include: ["src/**/*.{test,spec}.{js,jsx,ts,tsx}"],
  },
});
