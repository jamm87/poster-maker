import { defineConfig, devices } from "@playwright/test";

/**
 * E2E contra una tienda en marcha (BASE_URL, por defecto http://localhost:3000) con:
 * web con ALLOW_SIMULATED_CHECKOUT=true (sin Stripe) y worker con POSTER_DATA_PROVIDER=synthetic.
 * Ver README → «Tests».
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // En entornos con un Chromium preinstalado distinto al de esta versión de Playwright
        launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
      },
    },
  ],
});
