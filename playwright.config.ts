import { defineConfig, devices } from "@playwright/test";

// Uses a system Chromium when PLAYWRIGHT_CHROMIUM_PATH is set (e.g. a sandbox
// with a preinstalled browser); otherwise Playwright's own download.
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;
const port = Number(process.env.E2E_PORT || 3100);

export default defineConfig({
  testDir: "./e2e",
  testIgnore: ["hosted.spec.ts"],
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${port}`,
    launchOptions: { executablePath },
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], launchOptions: { executablePath } } },
    { name: "phone", use: { ...devices["Pixel 7"], launchOptions: { executablePath } } },
  ],
  webServer: {
    command: `npm run start -- -p ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
