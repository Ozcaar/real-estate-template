import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * Vitest configuration.
 *
 * Minimum-necessary setup for the lead-capture test foundation:
 *
 * - **Node environment** for every test. The lead-capture pipeline is
 *   server-side (Zod schema + delivery adapters + lead service). No
 *   DOM or jsdom is required.
 * - **Test patterns** cover the pure-function / branch-rich surface:
 *   the lead-capture Zod schema, the three delivery adapters, the
 *   adapter selector, and the lead service.
 * - **`#imports` alias** resolves the Nuxt-internal module to a small
 *   stub (see `tests/stubs/imports.ts`). Individual tests then
 *   override `useRuntimeConfig` with `vi.mock('#imports', ...)` to
 *   supply deterministic config values without booting a Nitro
 *   server. This keeps the source code unchanged and the adapter
 *   pipeline testable in isolation.
 * - **No browser, no coverage thresholds, no reporters.** The task
 *   scope is "small, maintainable Vitest foundation" only.
 */
export default defineConfig({
  resolve: {
    alias: {
      '#imports': fileURLToPath(new URL('./tests/stubs/imports.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: [
      'app/features/leads/schemas/**/*.test.ts',
      'server/services/leads/**/*.test.ts',
    ],
    // Each test file is its own module so the rate-limit map and the
    // adapter registry do not leak between test files.
    isolate: true,
  },
})
