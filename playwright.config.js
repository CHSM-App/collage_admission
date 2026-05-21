// @ts-check
const { defineConfig, devices } = require('@playwright/test')

/**
 * Playwright E2E configuration.
 *
 * IMPORTANT: Before running tests you need:
 *   1. BackEnd running on http://localhost:8000
 *   2. FrontEnd dev server running on http://localhost:5173
 *   3. A test database with seed data (see e2e/fixtures/README.md)
 *
 * Run all tests:      npx playwright test
 * Run with UI:        npx playwright test --ui
 * Run single file:    npx playwright test e2e/tests/auth.spec.js
 * Run headed:         npx playwright test --headed
 * Debug a test:       npx playwright test --debug
 */
module.exports = defineConfig({
  globalSetup: './e2e/global-setup.js',
  testDir: './e2e/tests',

  // How long a single test can take before it times out
  timeout: 30_000,

  // How long to wait for expect() assertions
  expect: { timeout: 8_000 },

  // Stop after first failure in CI — comment out locally if you want full report
  // failOnFlakyTests: true,

  // Run tests in parallel (each test file is isolated)
  fullyParallel: false,   // keep false — tests share a DB, ordering matters

  // Retry failed tests once in CI
  retries: process.env.CI ? 1 : 0,

  // How many workers to use. Keep at 1 for now (shared DB state).
  workers: 1,

  reporter: [
    ['list'],
    ['html', { outputFolder: 'e2e/report', open: 'never' }],
  ],

  use: {
    // Every test starts here
    baseURL: 'http://localhost:5173',

    // Capture screenshot only on failure
    screenshot: 'only-on-failure',

    // Record video on failure
    video: 'retain-on-failure',

    // Capture trace on first retry
    trace: 'on-first-retry',

    // Run headless by default; override with --headed flag
    headless: true,
  },

  projects: [
    // Run auth setup first — logs in once per role and saves storage state files
    {
      name: 'setup',
      testDir: './e2e/setup',
      testMatch: /auth\.setup\.js/,
      use: { ...devices['Desktop Chrome'] },
    },

    // All tests run with pre-authenticated browser state
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Each test suite picks up the relevant storage state below;
        // defaults to student state for backward compatibility.
        storageState: 'e2e/auth-states/student.json',
      },
      dependencies: ['setup'],
    },
  ],

  // Uncomment to auto-start dev servers before tests
  // webServer: [
  //   {
  //     command: 'cd FrontEnd && npm run dev',
  //     url: 'http://localhost:5173',
  //     reuseExistingServer: true,
  //     timeout: 30_000,
  //   },
  //   {
  //     command: 'cd BackEnd && npm run dev',
  //     url: 'http://localhost:8000',
  //     reuseExistingServer: true,
  //     timeout: 30_000,
  //   },
  // ],
})
