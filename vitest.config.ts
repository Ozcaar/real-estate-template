import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * Vitest configuration.
 *
 * Minimum-necessary setup for the lead-capture test foundation plus
 * the broader pure-function / branch-rich surface in the repo:
 *
 * - **Node environment** for every test. The lead-capture pipeline is
 *   server-side (Zod schema + delivery adapters + lead service), the
 *   core utilities are pure functions, the property service reads
 *   static data, and the agency schema runs in plain Node. No DOM or
 *   jsdom is required.
 * - **Test patterns** cover the pure-function / branch-rich surface:
 *   the lead-capture Zod schema, the three delivery adapters, the
 *   adapter selector, the lead service, the `POST /api/contact`
 *   endpoint, the generic pagination helpers, the WhatsApp link
 *   builder, the agency `PostalAddress` JSON-LD builder, the property
 *   service (filter / sort / isPropertySort), the agency
 *   configuration schema, the data-source adapter foundation
 *   (contract + static adapter), and the multi-tenant agency
 *   registry.
 * - **`#imports` alias** resolves the Nuxt-internal module to a small
 *   stub (see `tests/stubs/imports.ts`). Individual tests then
 *   override `useRuntimeConfig` with `vi.mock('#imports', ...)` to
 *   supply deterministic config values without booting a Nitro
 *   server. This keeps the source code unchanged and the adapter
 *   pipeline testable in isolation.
 * - **No browser, no coverage thresholds, no reporters.** The task
 *   scope is "small, maintainable Vitest foundation" only.
 */
const importsStub = fileURLToPath(new URL('./tests/stubs/imports.ts', import.meta.url))
const appDir = fileURLToPath(new URL('./app', import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '~': appDir,
      '#imports': importsStub,
    },
  },
  test: {
    environment: 'node',
    include: [
      'app/features/leads/schemas/**/*.test.ts',
      'app/features/properties/services/**/*.test.ts',
      'app/features/developments/services/**/*.test.ts',
      'app/features/agents/services/**/*.test.ts',
      'app/core/utils/**/*.test.ts',
      'app/core/data-source/**/*.test.ts',
      'app/config/agencies/**/*.test.ts',
      'app/composables/**/*.test.ts',
      'server/services/leads/**/*.test.ts',
      'server/api/**/*.test.ts',
    ],
    // Each test file is its own module so the rate-limit map and the
    // adapter registry do not leak between test files.
    isolate: true,
  },
})
