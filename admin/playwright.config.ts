import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for the admin smoke pack.
 *
 * Run locally:
 *   pnpm --filter admin exec playwright install --with-deps chromium
 *   pnpm --filter admin smoke           # boots dev server, runs the suite
 *   pnpm --filter admin smoke:ui        # interactive runner
 *
 * In CI the suite assumes the backend at $E2E_API_URL is running with a
 * seeded super-admin (admin@saxony-egypt.edu / ChangeMe!2025 — see
 * backend/prisma/seed.ts). The `webServer` block spins up `next dev`
 * pointed at it.
 */
export default defineConfig({
  testDir: "./tests",
  testMatch: /.*\.spec\.ts/,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: process.env.E2E_ADMIN_URL ?? "http://localhost:3001",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: process.env.E2E_SKIP_WEB_SERVER
    ? undefined
    : {
        command: "pnpm dev",
        url: "http://localhost:3001",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
          NEXT_PUBLIC_API_BASE_URL:
            process.env.E2E_API_URL ?? "http://localhost:3000/api/v1",
        },
      },
});
