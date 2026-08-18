/**
 * Client/server-safe per-tenant i18n locale resolution (Task 107B).
 *
 * This module is the single source of truth for the per-tenant
 * locale priority order. It lives in `app/config/` (NOT in
 * `server/utils/`) so both the server-only tenancy plugin
 * (`app/plugins/tenancy.server.ts`) and the client-bundled
 * `app/app.vue` can import the same functions without pulling
 * server-only code (the tenant registry, the `useRuntimeConfig`
 * call, the env-var dispatch) into the client bundle.
 *
 * The tenant hostname/context resolution (the registry lookup,
 * the per-tenant env-var dispatch for the canonical site URL,
 * the `useRuntimeConfig` call) stays in
 * `server/utils/tenant-context.ts` — that file remains
 * server-only and is imported only by the server plugin. This
 * file contains no server-only dependencies (no
 * `useRuntimeConfig`, no `process.env`, no `agencyRegistry`)
 * and is safe to import from any client-bundled code.
 *
 * **Priority order** (each rule falls through to the next
 * when the previous one is missing or unsupported):
 *
 *  1. **Cookie wins** (the user's explicit choice). The
 *     cookie is the value of `i18n_locale` as set by the
 *     user's browser. When the cookie is set to a registered
 *     locale code, the function reports `{ kind: 'cookie' }`
 *     and the caller may or may not call `setLocale` — the
 *     i18n module's `detectBrowserLanguage` plugin typically
 *     already set the locale from the cookie value, but the
 *     resolution is still authoritative (see
 *     `applyTenantLocaleResolution`).
 *  2. **Tenant default** when the cookie is absent (or
 *     unrecognized) and the tenant's `defaultLocale` is in
 *     the i18n module's registered locales list. This is the
 *     per-tenant fallback: each tenant can ship its own
 *     default language, so a multi-tenant deployment renders
 *     the right `<html lang>` on the first SSR pass without
 *     a round-trip from the client.
 *  3. **i18n module default** when the tenant's `defaultLocale`
 *     is missing or unsupported. This is the documented
 *     last-resort fallback for a misconfigured tenant
 *     (`defaultLocale: 'fr'` but the i18n module ships only
 *     `en` / `es`).
 *
 * **No plugin-order assumption.** The
 * `applyTenantLocaleResolution` helper treats the resolution
 * as authoritative for ALL three outcomes — it calls `setLocale`
 * with the resolved locale when the current locale does not
 * already match. This makes the behavior independent of the
 * i18n module's `detectBrowserLanguage` execution order:
 * even if the i18n module's plugin has not yet set the locale
 * from the cookie, the resolved cookie locale is applied
 * unconditionally (modulo the no-op optimization).
 *
 * **No module-level state.** The function is pure — it
 * returns the same result for the same inputs. Concurrent
 * requests for different tenants cannot share locale
 * resolution.
 */

/**
 * The priority order. The discriminated union's `kind` field
 * tells the caller which rule won so the application step
 * (and any future logging) can be specific.
 */
export type TenantLocaleResolution =
  /** The cookie is set to a registered locale code (the
   *  user's explicit choice). The caller may skip the
   *  `setLocale` call when the current locale already
   *  matches — `applyTenantLocaleResolution` handles the
   *  no-op optimization. */
  | { readonly kind: 'cookie', readonly locale: string }
  /** The cookie is absent (or unrecognized) and the
   *  tenant's `defaultLocale` is in the i18n module's
   *  registered locales list. The caller overrides the
   *  i18n module's locale to this value before the first
   *  SSR render. */
  | { readonly kind: 'tenant', readonly locale: string }
  /** The cookie is absent and the tenant's `defaultLocale`
   *  is missing or unsupported. The caller falls back to
   *  the i18n module's deployment-wide default. */
  | { readonly kind: 'fallback', readonly locale: string }

/**
 * Resolve the active SSR / hydration locale from three
 * documented inputs.
 *
 * The function is pure — it returns the same result for the
 * same inputs. Concurrent requests for different tenants
 * cannot share locale resolution. The callers (the tenancy
 * plugin on the server, the `app/app.vue` on the client) read
 * the inputs from per-request sources (the HTTP request cookie,
 * the hydrated `useState`, the i18n module's
 * `useI18n().locales.value`).
 */
export function resolveTenantLocale(
  cookieValue: string | null | undefined,
  tenantDefault: string | null | undefined,
  availableLocaleCodes: readonly string[],
  i18nDefaultLocale: string,
): TenantLocaleResolution {
  // 1. Cookie wins. The cookie is the user's explicit choice,
  //    but only when the value is a registered locale code.
  //    This matches the i18n module's `detectBrowserLanguage`
  //    behavior: an unrecognized cookie value (including the
  //    empty string or whitespace) is ignored — the i18n
  //    module falls back to the deployment-wide default. When
  //    the cookie IS a registered locale, the i18n module
  //    already set the locale from the cookie value, so the
  //    caller does NOT have to override — but the resolution
  //    is still authoritative (see
  //    `applyTenantLocaleResolution` for the no-op optimization).
  if (
    cookieValue
    && cookieValue.length > 0
    && availableLocaleCodes.includes(cookieValue)
  ) {
    return { kind: 'cookie', locale: cookieValue }
  }
  // 2. Tenant default. When the cookie is absent (or
  //    unrecognized) and the tenant's `defaultLocale` is in
  //    the i18n module's registered locales list, use it.
  if (
    tenantDefault
    && tenantDefault.length > 0
    && availableLocaleCodes.includes(tenantDefault)
  ) {
    return { kind: 'tenant', locale: tenantDefault }
  }
  // 3. i18n module default. Last-resort fallback when the
  //    tenant's `defaultLocale` is missing or unsupported.
  return { kind: 'fallback', locale: i18nDefaultLocale }
}

/**
 * Minimal structural type for the i18n module interaction.
 *
 * The function does not import from `@nuxtjs/i18n` or
 * `vue-i18n` directly — the caller passes a value that
 * satisfies the structural type. The two fields the function
 * reads / writes are:
 *
 *  - `locale.value` — the i18n module's current locale (read).
 *  - `setLocale(locale)` — the i18n module's locale setter
 *    (called only when the current locale does not match the
 *    resolved locale).
 *
 * This structural type keeps the module client/server-safe
 * (no Nuxt-specific imports) and makes the function trivially
 * testable with a plain object mock.
 */
export interface TenantLocaleI18n {
  readonly locale: { readonly value: string }
  setLocale: (locale: string) => unknown
}

/**
 * Apply the resolved locale to the i18n module.
 *
 * Treats the resolution as authoritative for all three
 * outcomes — calls `setLocale(resolution.locale)` exactly once
 * when the current locale does not already match the resolved
 * locale. This makes the behavior independent of the i18n
 * module's `detectBrowserLanguage` execution order: even if
 * the i18n module's plugin has not yet set the locale from
 * the cookie, the resolved cookie locale is applied
 * unconditionally.
 *
 * The no-op optimization (skip when the current locale already
 * matches) avoids unnecessary `setLocale` calls — the i18n
 * module's reactive `locale` ref would otherwise trigger
 * downstream re-renders on every call. The optimization is
 * safe because `setLocale(currentLocale)` is a no-op for the
 * caller (no state change) but the function avoids the call
 * cost entirely.
 */
export function applyTenantLocaleResolution(
  resolution: TenantLocaleResolution,
  i18n: TenantLocaleI18n,
): void {
  if (i18n.locale.value !== resolution.locale) {
    i18n.setLocale(resolution.locale)
  }
}