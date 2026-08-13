/**
 * Stub for the Nuxt-internal `#imports` module.
 *
 * Nuxt resolves `#imports` at build time to a virtual module that
 * exports the project's auto-imported composables. The
 * lead-capture adapter pipeline reads server-only runtime
 * config through `useRuntimeConfig` from `#imports`. The
 * property service reads the resolved public property list
 * from the same-origin Nitro endpoint at `/api/properties`
 * through the auto-injected `$fetch` global.
 *
 * For Vitest, `#imports` is not resolvable (Nuxt's Vite plugin
 * is not loaded). `vitest.config.ts` aliases `#imports` to this
 * stub so the source modules can be imported as-is. Individual
 * test files then override `useRuntimeConfig` with
 * `vi.mock('#imports', ...)` to supply deterministic config
 * values without booting a Nitro server.
 *
 * The stub's default `useRuntimeConfig` returns an empty object;
 * tests that need server-only runtime config (the lead-capture
 * pipeline) are expected to mock it before exercising the
 * pipeline.
 *
 * **`$fetch` is a global, not an import.** The property service
 * uses the auto-injected `$fetch` global that Nuxt sets on
 * both server and client; the service does NOT import `$fetch`
 * from `#imports`. Tests that exercise the property service
 * override the global with `vi.stubGlobal('$fetch', ...)` and
 * return a deterministic catalog — the stub therefore does NOT
 * export `$fetch` (exporting it would shadow the global
 * override and silently break the test).
 *
 * The stub retains a no-op `useNuxtApp` for legacy modules and
 * any future `useNuxtApp().$provide` consumer; the property
 * service does not consume `useNuxtApp`.
 */

export function useRuntimeConfig(): Record<string, unknown> {
  return {}
}

export function useNuxtApp(): Record<string, unknown> {
  return {}
}
