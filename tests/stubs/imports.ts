/**
 * Stub for the Nuxt-internal `#imports` module.
 *
 * Nuxt resolves `#imports` at build time to a virtual module that
 * exports the project's auto-imported composables. The lead-capture
 * adapter pipeline reads server-only runtime config through
 * `useRuntimeConfig` from `#imports`.
 *
 * For Vitest, `#imports` is not resolvable (Nuxt's Vite plugin is not
 * loaded). `vitest.config.ts` aliases `#imports` to this stub so the
 * source modules can be imported as-is. Individual test files then
 * override `useRuntimeConfig` with `vi.mock('#imports', ...)` to
 * supply deterministic config values without booting a Nitro server.
 *
 * The stub's default `useRuntimeConfig` returns an empty object; tests
 * are expected to mock it before exercising the adapter pipeline.
 */

export function useRuntimeConfig(): Record<string, unknown> {
  return {}
}
