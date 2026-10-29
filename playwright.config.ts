import { defineConfig, devices } from "@playwright/test";

// Los tres sistemas (next start) y sus workers los arranca e2e/global-setup.ts contra la base tb2_e2e
// en los puertos 3211 (Vínculo), 3212 (Talentia) y 3213 (Puente), para que las pruebas puedan reiniciarlos.
export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  use: {
    baseURL: "http://localhost:3211",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "es-CO",
    timezoneId: "America/Bogota",
  },
  projects: [
    { name: "escritorio", use: { ...devices["Desktop Chrome"] } },
    { name: "movil", use: { ...devices["Pixel 7"] }, grep: /@movil/ },
  ],
});
