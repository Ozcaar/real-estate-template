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
 * 2. `webServer.env` pins `NITRO_HOST=127.0.0.1` + `NITRO_PORT=3000`
 *    so the preview server binds to the IPv4 loopback address that
 *    Playwright's `webServer.url: 'http://127.0.0.1:3000'` probes.
 *    Without these env vars, Nitro binds to `::` (IPv6 dual-stack)
 *    on Node v24 / Windows, which Playwright cannot reach as
 *    `127.0.0.1` and the readiness probe times out. The pin is a
 *    permanent test-infrastructure fix, not diagnostic
 *    instrumentation: it makes the bind address deterministic
 *    across Windows / macOS / Linux and across local + CI runs.
 *    Production deploys (and `pnpm dev`) are unaffected because
 *    `webServer.env` only injects env vars into the Playwright-
 *    spawned `pnpm preview` process.
 * 3. The `nuxt preview` server binds to `0.0.0.0:3000` by default
 *    on older Nitro versions and to `::3000` on newer ones; the
 *    `webServer.env` pin overrides both with the IPv4 loopback.
 *    `reuseExistingServer: !process.env.CI` lets a developer run
 *    `pnpm test:e2e` against an already-running `pnpm dev` server
 *    (or `pnpm preview`) without Playwright starting a duplicate.
 * 4. The CI workflow runs `pnpm build` once and then `pnpm
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
    // Pin the preview server's bind address to the IPv4 loopback
    // so it matches the readiness URL above. See the JSDoc on the
    // `webServer` block above for the full rationale.
    env: {
      NITRO_HOST: '127.0.0.1',
      NITRO_PORT: '3000',
    },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
