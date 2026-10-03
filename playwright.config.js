import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./test/browser",
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  timeout: 120000,
  // The world loads Phaser and builds a scene; under parallel load that can
  // take longer than the default 5 s on a cold reload.
  expect: { timeout: 10000 },
  use: {
    baseURL: "http://127.0.0.1:4173",
    channel: process.env.CI ? undefined : "chrome",
    trace: "retain-on-failure",
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
