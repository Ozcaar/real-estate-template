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
 * **`webServer` — three modes.**
 *
 * The Playwright webServer is configured to branch on the
 * `SANITY_REAL_E2E` environment variable so the default `pnpm test:e2e`
 * is **deterministic** (always uses the static Property / Agent /
 * Development data sources) regardless of the operator's local `.env`
 * configuration.
 *
 * 1. **Default mode** (`SANITY_REAL_E2E` unset — the canonical CI run).
 *    Playwright always starts a fresh webServer (`reuseExistingServer:
 *    false`) on port **3001** (to avoid colliding with the operator's
 *    `pnpm dev` server on port 3000). The `webServer.env` block sets
 *    the three `NUXT_*_DATA_SOURCE` env vars to `static` AND clears the
 *    `NUXT_SANITY_PROJECT_ID` and `NUXT_SANITY_TOKEN` env vars, so the
 *    spawned server uses the bundled static catalog regardless of the
 *    parent's environment. The `baseURL` is `http://127.0.0.1:3001`.
 *    The default deterministic suite (62 cases) runs against this
 *    server; the 9-case opt-in Sanity spec is skipped (its own
 *    `test.skip()` gate at the top of the describe block fires when the
 *    flag is unset).
 *
 * 2. **Opt-in mode** (`SANITY_REAL_E2E=1`).
 *    Playwright reuses the existing `pnpm dev` server on port **3000**
 *    (`reuseExistingServer: true`). The dev server was started by the
 *    operator with the real `NUXT_SANITY_*` env vars in their local
 *    `.env`; the dev server's data sources are therefore `cms` with
 *    the `sanity` provider. The `baseURL` is `http://127.0.0.1:3000`.
 *    The 9-case opt-in Sanity spec runs against the real Sanity data
 *    served by the dev server. The 62-case default deterministic
 *    suite is NOT part of this run — the opt-in is intended to be
 *    invoked via `pnpm test:e2e:sanity`, which targets only the Sanity
 *    spec file.
 *
 * 3. **Opt-in fallback** (operator runs `SANITY_REAL_E2E=1` without a
 *    dev server on 3000).
 *    Playwright's `command: 'pnpm dev'` starts a fresh dev server on
 *    port 3000 with the operator's local `.env` (which has the Sanity
 *    env vars). The opt-in spec runs against the new dev server. The
 *    dev server is torn down when Playwright exits.
 *
 * **Why a different port for the default mode.** Port 3000 is the
 * Nuxt dev server's default. The operator typically has `pnpm dev`
 * running on 3000 with their real Sanity `.env`. The default Playwright
 * suite must use static data; reusing the operator's dev server (port
 * 3000) would inherit the Sanity data and break the 62 static-data
 * cases. Running the default Playwright webServer on a separate port
 * (3001) keeps the two servers independent. The operator's dev
 * workflow is unaffected.
 *
 * **`webServer.env` pins** `NITRO_HOST=127.0.0.1` + the port so the
 * spawned server binds to the IPv4 loopback address that Playwright's
 * `webServer.url` probes. Without these env vars, Nitro binds to `::`
 * (IPv6 dual-stack) on Node v24 / Windows, which Playwright cannot
 * reach as `127.0.0.1` and the readiness probe times out. The pin is
 * a permanent test-infrastructure fix, not diagnostic instrumentation:
 * it makes the bind address deterministic across Windows / macOS /
 * Linux and across local + CI runs. Production deploys (and `pnpm
 * dev`) are unaffected because `webServer.env` only injects env vars
 * into the Playwright-spawned process.
 *
 * **How the operator runs the suites.**
 *
 *  - Default (deterministic) — `pnpm test:e2e`. Playwright starts a
 *    fresh webServer on 3001 with static data; the 62 static-data
 *    cases pass; the 9 opt-in Sanity cases are skipped.
 *  - Opt-in (real Sanity) — `pnpm test:e2e:sanity` (or
 *    `SANITY_REAL_E2E=1 pnpm test:e2e tests/e2e/sanity-real-validation.spec.ts`).
 *    Playwright reuses the operator's dev server on 3000; the 9
 *    opt-in cases run against the real Sanity data.
 */
const SANITY_REAL_E2E_FLAG = 'SANITY_REAL_E2E'
const isRealSanityE2E = process.env[SANITY_REAL_E2E_FLAG] === '1'

const DEFAULT_BASE_URL = 'http://127.0.0.1:3001'
// The opt-in reuses the operator's running dev server. The dev
// server is bound to `::` (IPv6 dual-stack) on Node v24 / Windows,
// so the readiness URL must use `localhost` (which resolves to
// `::1` in the IPv6-preferred path) or `[::1]` explicitly. Using
// `127.0.0.1` (IPv4) would fail the readiness probe because the
// dev server does NOT bind to the IPv4 loopback in this
// configuration.
const OPT_IN_BASE_URL = 'http://localhost:3000'

export default defineConfig({
  testDir: './tests/e2e',
  // The opt-in spec targets only the Sanity spec file via
  // `test:e2e:sanity`. We exclude it from the default run via
  // `testIgnore` only as a defence-in-depth — the spec's own
  // `test.skip()` is the canonical gate. The opt-in command runs
  // the spec explicitly, so the exclusion is harmless.
  testIgnore: isRealSanityE2E ? undefined : '**/sanity-real-validation.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: isRealSanityE2E ? OPT_IN_BASE_URL : DEFAULT_BASE_URL,
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
  webServer: isRealSanityE2E
    ? {
        // Opt-in mode: reuse the operator's dev server on 3000.
        // The dev server was started with the real Sanity env
        // vars; this is what the opt-in spec is validating.
        // If no dev server is running, Playwright starts one
        // via `pnpm dev` (which loads the operator's local
        // `.env`).
        command: 'pnpm dev',
        url: OPT_IN_BASE_URL,
        reuseExistingServer: true,
        timeout: 180_000,
        stdout: 'pipe',
        stderr: 'pipe',
      }
    : {
        // Default mode: start a fresh webServer on 3001 with
        // static data sources. The env block overrides any
        // inherited `NUXT_*_DATA_SOURCE=cms` / Sanity env vars
        // so the server uses the bundled static catalog
        // regardless of the operator's local `.env`.
        command: 'pnpm preview',
        url: DEFAULT_BASE_URL,
        env: {
          NITRO_HOST: '127.0.0.1',
          NITRO_PORT: '3001',
          // Force the static data sources for the default run.
          NUXT_PROPERTIES_DATA_SOURCE: 'static',
          NUXT_AGENTS_DATA_SOURCE: 'static',
          NUXT_DEVELOPMENTS_DATA_SOURCE: 'static',
          // Clear the Sanity env vars so the Sanity provider
          // is NOT selected even if the parent has them set.
          NUXT_SANITY_PROJECT_ID: '',
          NUXT_SANITY_TOKEN: '',
        },
        reuseExistingServer: false,
        timeout: 120_000,
        stdout: 'pipe',
        stderr: 'pipe',
      },
})
