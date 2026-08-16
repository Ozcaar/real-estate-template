import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Boundary + behavior tests for `usePageSeo` (Task 102).
 *
 * The composable must:
 *
 *  - Prefer the per-tenant canonical site URL seeded by the
 *    server-only tenancy plugin into
 *    `useState('site-config-url')` (the Task 102 carrier).
 *  - Fall back to `runtimeConfig.public.siteUrl` (the global
 *    single-tenant knob) when the per-tenant URL is absent.
 *  - Strip any trailing slash from the resolved URL so
 *    concatenation with `route.path` (which already starts
 *    with `/`) never produces `//`.
 *
 * The Vitest suite runs in Node only (no Vue Test Utils).
 * The runtime behavior is exercised end-to-end by the
 * Playwright multi-tenant smoke test in
 * `tests/e2e/multi-tenant.spec.ts` against the live
 * `pnpm preview` server. This file pins the source-level
 * contract: a future regression that drops the
 * `site-config-url` precedence (or re-imports the registry)
 * would fail here.
 */

const COMPOSABLE_PATH = join(__dirname, 'usePageSeo.ts')

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
}

describe('usePageSeo composable — tenant-aware canonical URL (Task 102)', () => {
  describe('source-level (textual)', () => {
    it('reads the per-tenant URL from useState("site-config-url") (the Task 102 carrier)', () => {
      const source = stripComments(readFileSync(COMPOSABLE_PATH, 'utf8'))
      // The per-tenant URL is seeded by the server-only
      // tenancy plugin into `useState('site-config-url')`.
      // The composable must read from that state to honor the
      // Task 102 per-tenant resolution.
      expect(source).toMatch(/useState.*['"]site-config-url['"]/)
    })

    it('falls back to runtimeConfig.public.siteUrl when the per-tenant state is empty', () => {
      const source = stripComments(readFileSync(COMPOSABLE_PATH, 'utf8'))
      // The composable must prefer the seeded per-tenant URL
      // and fall back to the global env-var value. The
      // fallback is what keeps the single-tenant deployment
      // byte-identical.
      expect(source).toMatch(/config\.public\.siteUrl/)
    })

    it('strips trailing slashes from the resolved URL', () => {
      const source = stripComments(readFileSync(COMPOSABLE_PATH, 'utf8'))
      // Both the per-tenant URL and the global fallback must
      // be normalized (trailing slash stripped) so
      // concatenation with `route.path` never produces `//`.
      expect(source).toMatch(/\/\\\/\\\$\/\\\/\\\$/)
    })

    it('does not import the tenant registry (the multi-tenant surface stays server-only)', () => {
      const source = stripComments(readFileSync(COMPOSABLE_PATH, 'utf8'))
      // The composable must not pull in the registry — the
      // resolved SiteConfig + per-tenant URL are seeded by
      // the server-only plugin into `useState`, and that is
      // the only carrier from server to client.
      expect(source).not.toMatch(/agencies\/registry/)
      expect(source).not.toMatch(/agencies\/tenant-context/)
      expect(source).not.toMatch(/\bagencyRegistry\b/)
      expect(source).not.toMatch(/\bselectAgencyByHost\b/)
      expect(source).not.toMatch(/\bresolveTenantContext\b/)
    })

    it('does not import the server-only tenant-context module directly', () => {
      const source = stripComments(readFileSync(COMPOSABLE_PATH, 'utf8'))
      // `server/utils/tenant-context.ts` is server-only; the
      // composable reaches the resolved URL via
      // `useState('site-config-url')`, not via a direct
      // import.
      expect(source).not.toMatch(/server\/utils\/tenant-context/)
      expect(source).not.toMatch(/~\/server/)
    })
  })
})