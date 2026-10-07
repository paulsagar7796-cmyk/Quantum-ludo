import { defineConfig, devices } from "@playwright/test";

// Separate from the dev server (5199) so tests run while you play.
const PORT = 5198;

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  // E2E_BASE_URL=https://… runs the tests against a deployed site instead of a local dev server.
  use: { baseURL: process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}` },
  projects: [
    { name: "phone", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `pnpm --filter @qludo/web exec vite --port ${PORT} --strictPort --host 127.0.0.1`,
        url: `http://127.0.0.1:${PORT}`,
        reuseExistingServer: true,
      },
});
