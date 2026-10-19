import { defineConfig, devices } from "@playwright/test";

// Hosted-mode end-to-end tests: a production build with the Supabase
// variables set, pointed at e2e/mock-supabase.mjs. Run: npm run test:e2e:hosted
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;
const port = Number(process.env.E2E_HOSTED_PORT || 3101);
const mockPort = 54399;
const env = {
  NEXT_DIST_DIR: ".next-hosted",
  NEXT_PUBLIC_SUPABASE_URL: `http://localhost:${mockPort}`,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
  NEXT_TELEMETRY_DISABLED: "1",
};

export default defineConfig({
  testDir: "./e2e",
  testMatch: ["hosted.spec.ts", "misconfigured.spec.ts"],
  timeout: 60_000,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${port}`, trace: "retain-on-failure", timezoneId: "UTC" },
  projects: [{ name: "hosted-desktop", use: { ...devices["Desktop Chrome"], launchOptions: { executablePath } } }],
  webServer: [
    { command: `node e2e/mock-supabase.mjs`, url: `http://localhost:${mockPort}/__state`, reuseExistingServer: false, env: { MOCK_SUPABASE_PORT: String(mockPort) } },
    { command: `npx next build && npx next start -p ${port}`, url: `http://localhost:${port}/about`, reuseExistingServer: false, timeout: 300_000, env },
    // Only one Supabase variable set: must fail closed.
    {
      command: `npx next build && npx next start -p ${port + 1}`,
      url: `http://localhost:${port + 1}/about`,
      reuseExistingServer: false,
      timeout: 300_000,
      env: { NEXT_DIST_DIR: ".next-misconfig", NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: "", NEXT_TELEMETRY_DISABLED: "1" },
    },
  ],
});
