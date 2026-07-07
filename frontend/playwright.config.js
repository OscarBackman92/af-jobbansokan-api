import { defineConfig } from "@playwright/test";

// Smoke suite: real Django backend (fresh SQLite, file-based mail),
// mocked JobTech, Vite dev server proxying to the backend.
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["github"]] : [["list"]],
  use: {
    baseURL: "http://127.0.0.1:5273/app",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "node e2e/mock-jobtech.mjs",
      url: "http://127.0.0.1:9797/health",
      reuseExistingServer: false,
      timeout: 15_000,
    },
    {
      command: "python e2e/backend.py",
      url: "http://127.0.0.1:8765/health/",
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: "npm run dev -- --host 127.0.0.1 --port 5273 --strictPort",
      url: "http://127.0.0.1:5273",
      reuseExistingServer: false,
      timeout: 60_000,
      env: { VITE_BACKEND: "http://127.0.0.1:8765" },
    },
  ],
});
