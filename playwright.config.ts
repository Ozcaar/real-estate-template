import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright configuration for the post-v1.1.0 project.
 *
 * **Scope.** Minimal smoke-test foundation. One project, one browser
 * (Chromium), and a small set of focused route-loading tests. No
 * cross-browser matrix, no visual regression, no real SMTP / webhook
 * testing. The Vitest unit-test suite (`pnpm test`) is the primary
 * automated test surface; the Playwright suite (`pnpm test:e2e`) is
 * a thin integration check that the public routes render and that
 * the default lead form is in its documented disabled state.
 *
 * **`webServer`.** Playwright boots the Nuxt production server via
 * `pnpm preview` (after `pnpm build`). This is the right target
 * because:
 *
 * 1. The static-export deploy (`pnpm generate`) does not include
 *    `/api/contact`; the preview server mirrors the `pnpm build`
 *    Nitro output, which is the recommended deploy target for live
 *    lead capture.
 * 2. The `nuxt preview` server binds to `0.0.0.0:3000` by default;
 *    `reuseExistingServer: !process.env.CI` lets a developer run
 *    `pnpm test:e2e` against an already-running `pnpm dev` server
 *    (or `pnpm preview`) without Playwright starting a duplicate.
 * 3. The CI workflow runs `pnpm build` once and then `pnpm
 *    test:e2e`; the `webServer` step in the Playwright config then
 *    starts the preview server on demand and tears it down when
 *    the run is done.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // The `pnpm preview` script runs the built Nitro server. The
    // `pnpm build` step is run separately (by the CI workflow and
    // by the developer) so `webServer` does not re-run a build on
    // every test run.
    command: 'pnpm preview',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
