import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./test/browser",
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  timeout: 120000,
  // The world paints its tale's art and builds a scene; under parallel load
  // that can take longer than the default 5 s on a cold reload.
  expect: { timeout: 10000 },
  // Disk: a passing run writes nothing. Failures keep a screenshot locally,
  // and a trace only on CI (traces run to tens of MB each). Review shots are
  // opt-in with SHOTS=1 (see helpers.js shot()).
  preserveOutput: "failures-only",
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    channel: process.env.CI ? undefined : "chrome",
    trace: process.env.CI ? "retain-on-failure" : "off",
    screenshot: "only-on-failure",
    video: "off",
  },
  webServer: [
    { command: "npm run dev", url: "http://127.0.0.1:4173", reuseExistingServer: !process.env.CI },
    // The production build, for service worker and offline checks.
    { command: "PORT=4174 node scripts/serve.mjs dist", url: "http://127.0.0.1:4174", reuseExistingServer: !process.env.CI },
  ],
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 1000 } } },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium", channel: process.env.CI ? undefined : "chrome" },
    },
  ],
});
