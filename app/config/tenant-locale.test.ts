import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  applyTenantLocaleResolution,
  resolveTenantLocale,
  type TenantLocaleI18n,
} from './tenant-locale'

/**
 * Tests for the client/server-safe per-tenant i18n locale
 * resolution module (Task 107 / 107B).
 *
 * The module is the single source of truth for the per-tenant
 * locale priority order. It is imported by both the server-only
 * tenancy plugin and the client-bundled `app/app.vue`, so it
 * must contain no server-only dependencies (no
 * `useRuntimeConfig`, no `process.env`, no `agencyRegistry`).
 *
 * The tests cover:
 *
 *  - `resolveTenantLocale` — the pure priority-order
 *    function (cookie > tenant default > i18n default).
 *  - `applyTenantLocaleResolution` — the authoritative
 *    application step that calls `setLocale` for all three
 *    outcomes (with the no-op optimization when the current
 *    locale already matches).
 *  - **Boundary regression** — `app/app.vue` does NOT import
 *    from `server/` (the tenant locale module is a
 *    client/server-safe shared module under `app/config/`).
 */

/* ------------------------------------------------------------------ *
 * resolveTenantLocale — pure helper
 * ------------------------------------------------------------------ */

describe('resolveTenantLocale', () => {
  const availableLocales = ['en', 'es'] as const

  describe('cookie wins (user explicit choice preserved)', () => {
    it('returns { kind: "cookie", locale: "es" } when the cookie is "es" and the tenant default is "en"', () => {
      expect(resolveTenantLocale('es', 'en', availableLocales, 'en'))
        .toEqual({ kind: 'cookie', locale: 'es' })
    })

    it('falls through to the tenant default when the cookie value is not in the registered locales list', () => {
      // The i18n module's `detectBrowserLanguage` plugin
      // ignores cookie values that aren't in the registered
      // locales list. The pure function matches that behavior:
      // an unrecognized cookie value falls through to the
      // tenant default (or the i18n default if the tenant
      // default is also unrecognized).
      expect(resolveTenantLocale('fr', 'en', availableLocales, 'en'))
        .toEqual({ kind: 'tenant', locale: 'en' })
    })

    it('preserves cookie over tenant default when the cookie is a registered locale', () => {
      expect(resolveTenantLocale('es', 'en', availableLocales, 'en'))
        .toEqual({ kind: 'cookie', locale: 'es' })
      expect(resolveTenantLocale('en', 'es', availableLocales, 'en'))
        .toEqual({ kind: 'cookie', locale: 'en' })
    })
  })

  describe('tenant default (no cookie)', () => {
    it('returns { kind: "tenant", locale } when the cookie is absent and the tenant default is in the registered locales', () => {
      expect(resolveTenantLocale(undefined, 'es', availableLocales, 'en'))
        .toEqual({ kind: 'tenant', locale: 'es' })
    })

    it('returns { kind: "tenant" } when the cookie is null', () => {
      expect(resolveTenantLocale(null, 'es', availableLocales, 'en'))
        .toEqual({ kind: 'tenant', locale: 'es' })
    })

    it('returns { kind: "tenant" } when the cookie is an empty string', () => {
      expect(resolveTenantLocale('', 'es', availableLocales, 'en'))
        .toEqual({ kind: 'tenant', locale: 'es' })
    })

    it('returns { kind: "tenant" } when the cookie is whitespace-only', () => {
      expect(resolveTenantLocale('   ', 'es', availableLocales, 'en'))
        .toEqual({ kind: 'tenant', locale: 'es' })
    })

    it('preserves tenant default even when the i18n default differs', () => {
      expect(resolveTenantLocale(undefined, 'es', availableLocales, 'en'))
        .toEqual({ kind: 'tenant', locale: 'es' })
    })
  })

  describe('i18n module default (no cookie + tenant default unsupported)', () => {
    it('returns { kind: "fallback", locale } when the cookie is absent and the tenant default is not in the registered locales', () => {
      expect(resolveTenantLocale(undefined, 'fr', availableLocales, 'en'))
        .toEqual({ kind: 'fallback', locale: 'en' })
    })

    it('returns { kind: "fallback" } when the tenant default is null', () => {
      expect(resolveTenantLocale(undefined, null, availableLocales, 'en'))
        .toEqual({ kind: 'fallback', locale: 'en' })
    })

    it('returns { kind: "fallback" } when the tenant default is the empty string', () => {
      expect(resolveTenantLocale(undefined, '', availableLocales, 'en'))
        .toEqual({ kind: 'fallback', locale: 'en' })
    })

    it('returns { kind: "fallback" } when the tenant default is whitespace-only', () => {
      expect(resolveTenantLocale(undefined, '   ', availableLocales, 'en'))
        .toEqual({ kind: 'fallback', locale: 'en' })
    })
  })

  describe('two tenants with different default locales', () => {
    it('returns acme\'s "en" when acme is the active tenant and no cookie is set', () => {
      expect(resolveTenantLocale(undefined, 'en', availableLocales, 'en'))
        .toEqual({ kind: 'tenant', locale: 'en' })
    })

    it('returns coastal\'s "es" when coastal is the active tenant and no cookie is set', () => {
      expect(resolveTenantLocale(undefined, 'es', availableLocales, 'en'))
        .toEqual({ kind: 'tenant', locale: 'es' })
    })

    it('returns the i18n default when the active tenant has no defaultLocale configured', () => {
      expect(resolveTenantLocale(undefined, null, availableLocales, 'en'))
        .toEqual({ kind: 'fallback', locale: 'en' })
    })
  })

  describe('explicit cookie overriding the tenant default', () => {
    it('returns the cookie locale when the cookie is set, even if the tenant default differs', () => {
      expect(resolveTenantLocale('en', 'es', availableLocales, 'en'))
        .toEqual({ kind: 'cookie', locale: 'en' })
      expect(resolveTenantLocale('es', 'en', availableLocales, 'en'))
        .toEqual({ kind: 'cookie', locale: 'es' })
    })

    it('returns the cookie locale regardless of the i18n default', () => {
      expect(resolveTenantLocale('en', 'es', availableLocales, 'fr'))
        .toEqual({ kind: 'cookie', locale: 'en' })
    })
  })

  describe('unknown-host fallback (no cookie + unsupported tenant default)', () => {
    it('returns the i18n default when the default tenant has an unsupported defaultLocale', () => {
      expect(resolveTenantLocale(undefined, 'fr', availableLocales, 'en'))
        .toEqual({ kind: 'fallback', locale: 'en' })
    })

    it('returns the default tenant\'s locale when it IS in the registered locales', () => {
      expect(resolveTenantLocale(undefined, 'en', availableLocales, 'es'))
        .toEqual({ kind: 'tenant', locale: 'en' })
    })
  })

  describe('SSR / hydration consistency (Task 107)', () => {
    it('produces the same result for the same inputs (no mutable state)', () => {
      const inputs = {
        cookieValue: null as string | null,
        tenantDefault: 'es',
        availableLocaleCodes: ['en', 'es'] as const,
        i18nDefaultLocale: 'en',
      }
      const r1 = resolveTenantLocale(inputs.cookieValue, inputs.tenantDefault, inputs.availableLocaleCodes, inputs.i18nDefaultLocale)
      const r2 = resolveTenantLocale(inputs.cookieValue, inputs.tenantDefault, inputs.availableLocaleCodes, inputs.i18nDefaultLocale)
      expect(r1).toEqual(r2)
      expect(r1).toEqual({ kind: 'tenant', locale: 'es' })
    })
  })

  describe('return shape', () => {
    it('returns a frozen-shape object with the documented kind/locale fields', () => {
      const r1 = resolveTenantLocale('es', 'en', ['en', 'es'], 'en')
      const r2 = resolveTenantLocale(undefined, 'es', ['en', 'es'], 'en')
      const r3 = resolveTenantLocale(undefined, 'fr', ['en', 'es'], 'en')
      for (const r of [r1, r2, r3]) {
        expect(typeof r.kind).toBe('string')
        expect(typeof r.locale).toBe('string')
      }
    })
  })
})

/* ------------------------------------------------------------------ *
 * applyTenantLocaleResolution — authoritative 3-outcome application
 * ------------------------------------------------------------------ */

function makeI18n(currentLocale: string): TenantLocaleI18n & {
  setLocale: ReturnType<typeof vi.fn>
} {
  return {
    locale: { value: currentLocale },
    setLocale: vi.fn(),
  }
}

describe('applyTenantLocaleResolution', () => {
  it('calls setLocale for a cookie resolution when the current locale differs', () => {
    const i18n = makeI18n('en')
    applyTenantLocaleResolution({ kind: 'cookie', locale: 'es' }, i18n)
    expect(i18n.setLocale).toHaveBeenCalledWith('es')
    expect(i18n.setLocale).toHaveBeenCalledTimes(1)
  })

  it('does not call setLocale for a cookie resolution when the current locale already matches', () => {
    // The cookie path is a no-op when the i18n module's
    // current locale already matches the cookie value (the
    // `detectBrowserLanguage` plugin typically set the locale
    // from the cookie on hydration).
    const i18n = makeI18n('es')
    applyTenantLocaleResolution({ kind: 'cookie', locale: 'es' }, i18n)
    expect(i18n.setLocale).not.toHaveBeenCalled()
  })

  it('calls setLocale for a tenant resolution when the current locale differs', () => {
    const i18n = makeI18n('en')
    applyTenantLocaleResolution({ kind: 'tenant', locale: 'es' }, i18n)
    expect(i18n.setLocale).toHaveBeenCalledWith('es')
    expect(i18n.setLocale).toHaveBeenCalledTimes(1)
  })

  it('does not call setLocale for a tenant resolution when the current locale already matches', () => {
    const i18n = makeI18n('es')
    applyTenantLocaleResolution({ kind: 'tenant', locale: 'es' }, i18n)
    expect(i18n.setLocale).not.toHaveBeenCalled()
  })

  it('calls setLocale for a fallback resolution when the current locale differs', () => {
    const i18n = makeI18n('fr')  // some unexpected locale
    applyTenantLocaleResolution({ kind: 'fallback', locale: 'en' }, i18n)
    expect(i18n.setLocale).toHaveBeenCalledWith('en')
    expect(i18n.setLocale).toHaveBeenCalledTimes(1)
  })

  it('does not call setLocale for a fallback resolution when the current locale already matches', () => {
    const i18n = makeI18n('en')
    applyTenantLocaleResolution({ kind: 'fallback', locale: 'en' }, i18n)
    expect(i18n.setLocale).not.toHaveBeenCalled()
  })

  it('the cookie path works without relying on plugin execution order (Task 107B regression)', () => {
    // **The cookie path works without plugin order.** The
    // `applyTenantLocaleResolution` helper treats the
    // resolution as authoritative for all three outcomes. Even
    // if the i18n module's `detectBrowserLanguage` plugin has
    // NOT yet set the locale from the cookie (the i18n
    // module's current locale is still the deployment-wide
    // default), the resolved cookie locale is applied
    // unconditionally. The function does NOT assume the
    // plugin's plugin-order. This pins the Task 107B
    // contract: client/server-safe, independent of i18n
    // plugin execution order.
    const i18n = makeI18n('en')  // i18n module's first-pass default
    applyTenantLocaleResolution({ kind: 'cookie', locale: 'es' }, i18n)
    expect(i18n.setLocale).toHaveBeenCalledWith('es')
    expect(i18n.setLocale).toHaveBeenCalledTimes(1)
  })

  it('the tenant path works without relying on plugin execution order (Task 107B regression)', () => {
    // Same as the cookie regression: the tenant path
    // overrides the i18n module's current locale to the
    // tenant's default. The function does not assume
    // `detectBrowserLanguage` already set the locale.
    const i18n = makeI18n('en')  // i18n module's first-pass default
    applyTenantLocaleResolution({ kind: 'tenant', locale: 'es' }, i18n)
    expect(i18n.setLocale).toHaveBeenCalledWith('es')
    expect(i18n.setLocale).toHaveBeenCalledTimes(1)
  })

  it('the fallback path works without relying on plugin execution order (Task 107B regression)', () => {
    const i18n = makeI18n('fr')  // some unexpected locale
    applyTenantLocaleResolution({ kind: 'fallback', locale: 'en' }, i18n)
    expect(i18n.setLocale).toHaveBeenCalledWith('en')
  })

  it('calls setLocale exactly once per applyTenantLocaleResolution call (no duplicate calls)', () => {
    // The no-op optimization ensures that even when the i18n
    // module has already been initialized with the correct
    // locale (e.g. by a previous SSR pass or by
    // `detectBrowserLanguage`), the helper does NOT make
    // redundant `setLocale` calls.
    const i18n = makeI18n('es')
    applyTenantLocaleResolution({ kind: 'cookie', locale: 'es' }, i18n)
    applyTenantLocaleResolution({ kind: 'tenant', locale: 'es' }, i18n)
    applyTenantLocaleResolution({ kind: 'fallback', locale: 'es' }, i18n)
    expect(i18n.setLocale).not.toHaveBeenCalled()
  })
})

/* ------------------------------------------------------------------ *
 * Boundary regression — `app/app.vue` does not import from `server/`
 * ------------------------------------------------------------------ */

describe('app/app.vue — client/server-safe boundary (Task 107B)', () => {
  // The `app.vue` file is bundled to BOTH the server and the
  // client. The `server/` directory is server-only (per the
  // project's multi-tenant boundary convention documented in
  // `docs/ARCHITECTURE.md`). The per-tenant locale resolution
  // is a client/server-safe concern; it lives in
  // `app/config/tenant-locale.ts` (this module, which has no
  // server-only imports). The `app.vue` file must import from
  // the client/server-safe shared module, NOT from `server/`.
  const appVuePath = join(__dirname, '..', 'app.vue')

  it('does not import from any server/ path (no server-only code leaks into the client bundle)', () => {
    const source = readFileSync(appVuePath, 'utf8')
    // The file must not import anything from `server/`. The
    // tenant locale resolution lives in
    // `app/config/tenant-locale.ts` (this module), which is
    // client/server-safe. A regression that adds a
    // `from '...server/...'` import to `app.vue` would pull the
    // tenant registry, the `useRuntimeConfig` call, and the
    // env-var dispatch into the client bundle.
    expect(source).not.toMatch(/from\s+['"][^'"]*server\//)
  })

  it('imports the locale resolution from the client/server-safe shared module (app/config/tenant-locale)', () => {
    const source = readFileSync(appVuePath, 'utf8')
    // The file must import `resolveTenantLocale` (and the
    // `applyTenantLocaleResolution` helper) from the shared
    // module. A regression that drops the import (or
    // re-imports from `server/`) is caught here.
    expect(source).toMatch(/resolveTenantLocale/)
    expect(source).toMatch(/applyTenantLocaleResolution/)
    expect(source).toMatch(/from\s+['"][^'"]*config\/tenant-locale['"]/)
  })

  it('does not import the server-only tenant context resolver', () => {
    // `resolveTenantContext` is server-only (reads
    // `useRuntimeConfig`, walks the registry, etc.). The
    // client-bundled `app.vue` must not import it; the client
    // reads the already-resolved tenant context from the
    // hydrated `useSiteConfig()` state instead.
    const source = readFileSync(appVuePath, 'utf8')
    expect(source).not.toMatch(/resolveTenantContext/)
  })

  it('does not import the tenant context module at all', () => {
    // The `app/config/tenant-locale.ts` module is the
    // client/server-safe shared module; the
    // `server/utils/tenant-context.ts` module is server-only.
    // `app.vue` must import the shared module (this module)
    // and NOT the server-only module. A regression that
    // imports from `server/utils/tenant-context` would re-introduce
    // the boundary leak.
    const source = readFileSync(appVuePath, 'utf8')
    expect(source).not.toMatch(/server\/utils\/tenant-context/)
  })
})