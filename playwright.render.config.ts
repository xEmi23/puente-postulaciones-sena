import { defineConfig, devices } from "@playwright/test";

// Prueba de humo contra Render (e2e/humo-render.spec.ts). Sin global-setup: no arranca nada local.
//   RENDER_HUMO=1 npx playwright test -c playwright.render.config.ts
export default defineConfig({
  testDir: "e2e",
  testMatch: "humo-render.spec.ts",
  workers: 1,
  retries: 0,
  timeout: 180_000,
  expect: { timeout: 30_000 },
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report-render" }]],
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "es-CO",
    timezoneId: "America/Bogota",
    navigationTimeout: 120_000,
    actionTimeout: 60_000,
    ...devices["Desktop Chrome"],
  },
});
