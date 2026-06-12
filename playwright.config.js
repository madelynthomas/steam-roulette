import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",

  // Run every test in every file in parallel (not just file-by-file).
  fullyParallel: true,

  // Fail the run immediately if a test.only() was accidentally committed —
  // keeps CI from silently running only one test.
  forbidOnly: !!process.env.CI,

  // Retry flaky tests on CI to reduce noise from transient timing issues.
  // No retries locally so failures surface immediately during development.
  retries: process.env.CI ? 2 : 0,

  // Limit to a single worker on CI to avoid port conflicts when multiple
  // parallel jobs share the same host. Locally, Playwright picks the optimal
  // count based on available CPUs.
  workers: process.env.CI ? 1 : undefined,

  // HTML reporter writes a browsable report to playwright-report/ (git-ignored).
  reporter: "html",

  use: {
    baseURL: "http://localhost:3000",

    // Capture a trace on the first retry of a failing test. Traces can be
    // opened with `npx playwright show-trace` for step-by-step debugging.
    trace: "on-first-retry",
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],

  webServer: {
    // Start the Next.js dev server before running the suite.
    command: "npm run dev",
    url: "http://localhost:3000",
    // Reuse an already-running dev server locally to skip startup time.
    // On CI a fresh server is always started to avoid stale state.
    reuseExistingServer: !process.env.CI,
  },
});
