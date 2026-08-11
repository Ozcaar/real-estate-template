import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Boundary tests for the `useSiteConfig` composable.
 *
 * The v1.1.0 M16 multi-tenant foundation requires a strict
 * server-only / client-safe split:
 *
 *  - The tenant registry (`app/config/agencies/registry.ts`) and
 *    its resolver (`selectAgencyByHost`, `normalizeHostname`)
 *    are server-only. They must never be bundled into the client
 *    output.
 *  - The `useSiteConfig` composable (`app/composables/`) is the
 *    only public surface a component consumes to read the active
 *    agency + theme. It must therefore never import the registry
 *    or expose the seed function to the client.
 *
 * These tests verify the contract at the source-file level
 * (textual inspection) and at the runtime level (the module's
 * exports). A future change that re-adds `seedSiteConfig` to the
 * composable, or imports the registry, would fail both checks.
 */

const COMPOSABLE_PATH = join(__dirname, 'useSiteConfig.ts')

describe('useSiteConfig composable — server-only / client-safe boundary', () => {
  describe('source-file level (textual)', () => {
    it('does not declare or export seedSiteConfig', () => {
      const source = readFileSync(COMPOSABLE_PATH, 'utf8')
      // The seed function lives in the server-only plugin
      // (`app/plugins/tenancy.server.ts`); the composable must
      // not re-export it or even mention it.
      expect(source).not.toMatch(/\bseedSiteConfig\b/)
    })

    it('does not import from the agencies registry module', () => {
      const source = readFileSync(COMPOSABLE_PATH, 'utf8')
      // The composable must not pull in the registry — neither
      // via the `~/config/agencies/registry` path, nor via a
      // relative `./registry` or `../config/agencies/registry`
      // import.
      expect(source).not.toMatch(/agencies\/registry/)
      expect(source).not.toMatch(/['"]\.\.?\/.*registry['"]/)
    })

    it('does not mention any registry identifier', () => {
      const source = readFileSync(COMPOSABLE_PATH, 'utf8')
      expect(source).not.toMatch(/\bagencyRegistry\b/)
      expect(source).not.toMatch(/\bselectAgencyByHost\b/)
      expect(source).not.toMatch(/\bDEFAULT_TENANT_ID\b/)
      expect(source).not.toMatch(/\bnormalizeHostname\b/)
    })

    it('does not declare or export the seed function via any name', () => {
      const source = readFileSync(COMPOSABLE_PATH, 'utf8')
      // Catch alternative spellings a future maintainer might
      // reach for (e.g. `seedTenant`, `resolveAndSeed`,
      // `initFromHost`).
      expect(source).not.toMatch(/\bseedTenant\b/)
      expect(source).not.toMatch(/\bresolveAndSeed\b/)
      expect(source).not.toMatch(/\binitFromHost\b/)
    })
  })

  describe('runtime level (module exports)', () => {
    it('exports only useSiteConfig', async () => {
      // Dynamic import — the composable has no top-level side
      // effects (the `useState` call lives inside the function
      // body), so the module loads cleanly in plain Node.
      const mod = await import('./useSiteConfig')
      expect(Object.keys(mod).sort()).toEqual(['useSiteConfig'])
    })

    it('does not expose seedSiteConfig on the module exports', async () => {
      const mod = await import('./useSiteConfig')
      expect(mod).not.toHaveProperty('seedSiteConfig')
      expect(mod.seedSiteConfig).toBeUndefined()
    })

    it('does not expose any registry helper on the module exports', async () => {
      const mod = await import('./useSiteConfig')
      // The module's namespace must be limited to the documented
      // public surface (`useSiteConfig`). A future regression that
      // re-exports a registry helper would be caught here.
      const exportedNames = Object.keys(mod)
      expect(exportedNames).not.toContain('agencyRegistry')
      expect(exportedNames).not.toContain('selectAgencyByHost')
      expect(exportedNames).not.toContain('DEFAULT_TENANT_ID')
      expect(exportedNames).not.toContain('normalizeHostname')
    })
  })
})