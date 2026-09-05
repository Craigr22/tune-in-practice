import { defineConfig } from "@playwright/test";

/**
 * End-to-end, against the app as a browser sees it.
 *
 * The suite starts the dev server itself so it needs no running app. Specs
 * that require signing in read credentials from the environment and skip
 * without them, so the smoke tests still run for anyone who checks out the
 * repo — including CI, which has no password.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  reporter: process.env.CI ? "list" : "html",
  use: { baseURL: "http://localhost:8080", trace: "on-first-retry" },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:8080",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
