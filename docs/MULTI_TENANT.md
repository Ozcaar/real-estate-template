# Multi-tenant Deployment Guide

This document covers the v1.1.0 M19 multi-tenant deployment hardening: per-tenant canonical site URL, tenant-aware sitemap and robots, and tenant-aware default locale. It also documents the per-tenant configuration conventions (env-var dispatch, host resolution, fallback).

The M16 multi-tenant foundation (frozen registry + hostname resolver + plugin + composable) is documented in `docs/REBRANDING.md`. This guide adds the Task 102 hardening layer that makes the canonical URL, sitemap, robots, and default locale tenant-aware end to end.

## 1. Scope

The Task 102 hardening touches three remaining global assumptions in the M16 foundation:

| Global assumption (M16) | Hardened (M19) |
| --- | --- |
| `runtimeConfig.public.siteUrl` is a single env var read by `usePageSeo`, sitemap, and robots. | Per-tenant canonical URL via `NUXT_PUBLIC_SITE_URL__<TENANT_ID>` env-var override, with global `NUXT_PUBLIC_SITE_URL` fallback. |
| `sitemap.xml.ts` imports `siteConfig` directly (single-agency default). | Sitemap resolves the active tenant per request via `resolveTenantContext` and uses the tenant's `agency.modules`. |
| `robots.txt.ts` reads the global `siteUrl` env var. | Robots resolves the per-tenant URL via the same resolver. |
| i18n default locale is deployment-scoped. | `app.vue` honors the active tenant's `agency.defaultLocale` on the SSR HTML `lang` attribute when no `i18n_locale` cookie is present. |

What is **not** hardened in M19 (deferred to follow-up tasks):

- **Per-tenant lead delivery configuration.** Lead delivery is still global via `NUXT_LEADS_ADAPTER` and the matching `NUXT_LEADS_*` env vars. The Task 105 follow-up will introduce `NUXT_LEADS_<KEY>__<TENANT_ID>` overrides. Until then, a multi-tenant deployment shares one delivery destination (or runs separate processes per tenant).
- **Per-tenant i18n module `defaultLocale`.** The `@nuxtjs/i18n` module's deployment-scoped `defaultLocale` is the first-pass default on the server. The Task 102 hook in `app/app.vue` overrides the active locale to `agency.defaultLocale` only when no `i18n_locale` cookie is present. A future task can plumb the tenant's `defaultLocale` into the i18n module's first-pass logic (e.g. via `nuxt.config.ts` per-tenant config blocks) if needed.
- **Database, tenant admin UI, auth, billing, dynamic provisioning.** All out of scope per `docs/SPEC.md` §7.

## 2. Per-tenant canonical site URL

### 2.1 The convention

The resolver reads `process.env.NUXT_PUBLIC_SITE_URL__<TENANT_ID>` first, falling back to the global `NUXT_PUBLIC_SITE_URL` (the documented single-tenant knob). The tenant id is uppercased and any non-alphanumeric character is replaced with `_` for the env-var name.

```sh
# Single-tenant deployment (default tenant, no per-tenant override needed)
NUXT_PUBLIC_SITE_URL=https://example.com

# Multi-tenant deployment
NUXT_PUBLIC_SITE_URL=https://default.example.com
NUXT_PUBLIC_SITE_URL__ACME=https://acme.example.com
NUXT_PUBLIC_SITE_URL__COASTAL=https://coastal.example.com
```

### 2.2 Why env vars, not registry entries

The canonical URL is **deployment** configuration, not agency branding. Adding a `siteUrl` field to `AgencyConfig` (the rebrand-facing branding file) would force every single-tenant rebrand to either set the field or rely on the global env var — and would couple the branding surface to deployment-time configuration. Keeping the URL in the env-var dispatch means:

- Single-tenant rebrands keep the existing `NUXT_PUBLIC_SITE_URL` knob.
- Multi-tenant deployments add per-tenant env vars only for tenants that need a different URL.
- The branding surface (`AgencyConfig`) stays branding-only.

### 2.3 Resolution order

For a request to `acme.example.com`:

1. `process.env.NUXT_PUBLIC_SITE_URL__ACME` — non-empty wins. Trailing slash is stripped.
2. `runtimeConfig.public.siteUrl` (sourced from `NUXT_PUBLIC_SITE_URL`) — fallback. Trailing slash is stripped.
3. Empty string when neither is set. Consumers (sitemap, robots, `usePageSeo`) treat the empty value as "no canonical URL configured" and fall back to their own empty-URL behavior (sitemap 503, robots blocking rule, no canonical link).

### 2.4 What uses the per-tenant URL

| Consumer | Surface | Behavior |
| --- | --- | --- |
| `app/core/composables/usePageSeo.ts` | SSR `<link rel="canonical">`, `og:url`, OG/Twitter absolute image URLs. | Reads `useState('site-config-url')` (seeded by the tenancy plugin), falls back to `runtimeConfig.public.siteUrl` for the no-SSR / client-only navigation path. |
| `server/routes/sitemap.xml.ts` | `<loc>` URLs. | Calls `resolveTenantContext` per request. Returns 503 with a hint when the resolved URL is empty. |
| `server/routes/robots.txt.ts` | `Sitemap:` line. | Calls `resolveTenantContext` per request. Returns 200 with a blocking `Disallow: /` rule when the resolved URL is empty (no 503 — `robots.txt` is probed early by crawlers). |

### 2.5 Request host resolution

The sitemap and robots routes read the active tenant's host from the `host` header (or `x-forwarded-host` first, since a CDN / load balancer rewrites the host header at the edge). Both are lowercased and trimmed for stable matching against the registry's `hosts` lists.

```ts
const fwd = getRequestHeader(event, 'x-forwarded-host')
const host = getRequestHeader(event, 'host')
const raw = (fwd ?? host ?? '').split(',')[0]?.trim() ?? ''
```

The header value is normalized by the registry's `normalizeHostname` (port stripping, case folding, whitespace trimming) so `EXAMPLE.com:3000` resolves the same as `example.com`.

## 3. Tenant-aware default locale

### 3.1 The client/server-safe shared module

The per-tenant i18n locale resolution lives in `app/config/tenant-locale.ts` (Task 107B). This module is the single source of truth for the locale priority order. It is imported by BOTH the server-only tenancy plugin (`app/plugins/tenancy.server.ts`) AND the client-bundled `app/app.vue`. The module contains no server-only dependencies (no `useRuntimeConfig`, no `process.env`, no `agencyRegistry`) and is safe to import from any client-bundled code — the prior arrangement (Task 107) had the functions in `server/utils/tenant-context.ts`, which meant `app.vue` had to import from `server/` (a boundary leak that risked pulling the tenant registry, the `useRuntimeConfig` call, and the env-var dispatch into the client bundle).

The module exports:

- `resolveTenantLocale(cookieValue, tenantDefault, availableLocaleCodes, i18nDefaultLocale)` — the pure priority-order function.
- `TenantLocaleResolution` — the discriminated union (`{ kind: 'cookie' | 'tenant' | 'fallback', locale }`) that pins the priority order.
- `applyTenantLocaleResolution(resolution, i18n)` — the authoritative application step that calls `setLocale` for ALL three outcomes (with the no-op optimization when the current locale already matches).
- `TenantLocaleI18n` — a minimal structural type for the i18n module interaction (so the module has no Nuxt-specific imports).

### 3.2 The priority order

`resolveTenantLocale` returns:

1. **`{ kind: 'cookie', locale }`** — the `i18n_locale` cookie is set to a registered locale code. The function treats the cookie as the user's explicit choice. An empty string, whitespace-only, or unrecognized cookie value falls through to the next rule (the i18n module's `detectBrowserLanguage` ignores it).
2. **`{ kind: 'tenant', locale }`** — the cookie is absent (or unrecognized) and the tenant's `defaultLocale` is in the i18n module's registered locales list. The per-tenant fallback.
3. **`{ kind: 'fallback', locale }`** — the cookie is absent and the tenant's `defaultLocale` is missing or unsupported. The i18n module's deployment-wide default.

The cookie check is `cookieValue && cookieValue.length > 0 && availableLocaleCodes.includes(cookieValue)`. The same `tenantDefault` check applies to the tenant default (must be a non-empty string in the registered locales list).

### 3.3 SSR: the `tenancy.server.ts` plugin

The `tenancy.server.ts` plugin runs on every Nitro request, server-only. It calls `resolveTenantContext(host)` to resolve the active tenant, then calls `resolveTenantLocale(cookie.value, tenant.defaultLocale, availableLocaleCodes, i18nDefaultLocale)` to resolve the active locale. The plugin calls `applyTenantLocaleResolution(resolution, { locale, setLocale })` — which applies the resolution to the i18n module's locale. `applyTenantLocaleResolution` is authoritative for ALL three outcomes: when the resolution kind is `'cookie'`, the i18n module's `detectBrowserLanguage` plugin has already set the locale from the cookie value, and the helper skips the `setLocale` call because the current locale already matches (no-op optimization). When the resolution kind is `'tenant'` or `'fallback'`, the helper calls `setLocale` with the resolved locale.

This is the **first-pass tenant-aware locale** — it runs before any page renders, so the i18n module's initial locale is the tenant's default (not the deployment-wide `defaultLocale: 'en'`). The HTML's `<html lang>`, the SSR content, and the SEO metadata all use the tenant's default on the first pass.

### 3.4 Client: the `app.vue` override

The `app.vue` script runs the SAME `applyTenantLocaleResolution` function with the same inputs (cookie value from `useCookie('i18n_locale')`, tenant default from the hydrated `useSiteConfig()`, available locales from `useI18n().locales.value`, i18n default from `useI18n().locale.value`). The override runs on both the server and the client — there is no `if (import.meta.server)` guard. The `applyTenantLocaleResolution` helper is deterministic and the no-op optimization avoids redundant `setLocale` calls.

The reason: the server runs the override once in the `tenancy.server.ts` plugin, and `app.vue` runs it again on the client after `useSiteConfig()` is hydrated from the SSR payload. The pure function is deterministic, so both calls produce the same output. The client override is what fixes the prior hydration mismatch: without it, the client i18n module would use the deployment-wide `defaultLocale: 'en'` (the i18n module's first-pass value) when no cookie was set, even though the SSR HTML used the tenant's default.

### 3.5 No plugin-order assumption

`applyTenantLocaleResolution` treats the resolution as authoritative for ALL three outcomes — it calls `setLocale` with the resolved locale when the current locale does not already match. This makes the behavior independent of the i18n module's `detectBrowserLanguage` execution order: even if the i18n module's plugin has not yet set the locale from the cookie, the resolved cookie locale is applied unconditionally (modulo the no-op optimization). The cookie path works without relying on `detectBrowserLanguage` — the resolution is the source of truth.

### 3.6 SSR / hydration consistency

The same `resolveTenantLocale` and `applyTenantLocaleResolution` functions are used on both sides:

- **SSR:** the `tenancy.server.ts` plugin reads the cookie from the HTTP request, the tenant's `defaultLocale` from `resolveTenantContext(host)`, the available locales from `useI18n().locales.value`, and the i18n default from `useI18n().locale.value`. The result is applied to the i18n module's locale BEFORE the first SSR render.
- **Hydration:** the client reads the cookie from the browser, the tenant's `defaultLocale` from the hydrated `useSiteConfig()` (carried in the SSR payload), the available locales from `useI18n().locales.value`, and the i18n default from `useI18n().locale.value`. The result is applied to the i18n module's locale on the client BEFORE the page hydrates.

Both calls produce the same output for the same inputs, so SSR and hydration agree on the same initial locale. The cookie is the same value on both sides (it's part of the HTTP request). The tenant's `defaultLocale` is the same on both sides (it's part of the SSR payload via `useState('site-config')`). No per-request mutable state is involved.

### 3.7 Cookie preservation

The cookie is the user's explicit choice. When the cookie is set to a valid locale code (a value in the i18n module's registered locales), the i18n module's `detectBrowserLanguage` plugin reads the cookie on the server, and the i18n module's hydration reads the cookie on the client. `applyTenantLocaleResolution` reports `{ kind: 'cookie' }` and skips the `setLocale` call because the current locale already matches — the documented user-override path is preserved. A user that has explicitly switched languages keeps their choice across tenant navigations and page reloads.

When the cookie is empty, whitespace-only, or unrecognized, `resolveTenantLocale` falls through to the tenant default (or the i18n default if the tenant default is also unrecognized). The i18n module's `detectBrowserLanguage` plugin would have ignored the cookie in the same way (it checks the cookie against the registered locales), so the resolution matches the i18n module's effective behavior.

### 3.8 What was not changed

The cookie's persistence and the language switcher are unchanged. The cookie is still set by `@nuxtjs/i18n`'s `detectBrowserLanguage` plugin and read by the i18n module on every hydration. The `AppLanguageSwitcher` component (the user-facing language picker) is unchanged — it still calls `setLocale` to switch languages, and the i18n module's cookie persistence handles the persistence. The Task 107B change is purely structural: the locale resolution moved from `server/utils/tenant-context.ts` to the client/server-safe shared module `app/config/tenant-locale.ts`, and the application step now treats the resolution as authoritative for all three outcomes. No user-facing UX change.

## 4. Adding a new tenant (operational checklist)

A rebrand that wants a true multi-tenant deployment (multiple agencies behind a single build) adds entries to the registry and the env-var dispatch. No service or component changes.

### 4.1 Step 1 — Agency config

Add a new agency config file (e.g. `app/config/agencies/acme.agency.ts`). The shape is the documented `AgencyConfig` interface (`app/types/agency.types.ts`). Follow `docs/REBRANDING.md` for the full rebranding workflow.

### 4.2 Step 2 — Registry entry

Edit `app/config/agencies/registry.ts` to add a new entry:

```ts
import { acmeAgencyConfig } from './acme.agency'

export const agencyRegistry: AgencyRegistry = Object.freeze({
  [DEFAULT_TENANT_ID]: buildEntry(defaultAgencyConfig, []),
  acme: buildEntry(acmeAgencyConfig, [
    'acme.example.com',
    'www.acme.example.com',
  ]),
})
```

The default tenant (`DEFAULT_TENANT_ID`) is always present and always fallback-only (empty `hosts` list). Every custom entry declares its `hosts` list.

### 4.3 Step 3 — Per-tenant env vars

Set the env vars on the deployment:

```sh
NUXT_PUBLIC_SITE_URL=https://default.example.com
NUXT_PUBLIC_SITE_URL__ACME=https://acme.example.com
```

The first is the global fallback (used by the default tenant). The second overrides for the `acme` tenant.

### 4.4 Step 4 — DNS / TLS

Point the new hostname to the deployment. The hostname is the lookup key for the registry; no DNS work is required for the default tenant.

### 4.5 Step 5 — Verify

A request to `acme.example.com/` should return HTML whose `<link rel="canonical">` and `og:url` reflect `https://acme.example.com/...`, whose `Sitemap:` line in `robots.txt` reads `https://acme.example.com/sitemap.xml`, and whose `<html lang>` reflects `acmeAgencyConfig.defaultLocale`.

## 5. Unknown-host fallback

Every request to a hostname that does not match any registry entry's `hosts` list resolves to the default tenant via the registry's `selectAgencyByHost` fallback. The default tenant uses the global `NUXT_PUBLIC_SITE_URL` for its canonical URL, and the deployment-scoped i18n `defaultLocale` for its SSR `lang` attribute (overridden in `app.vue` to `agency.defaultLocale` when no cookie preference exists).

This preserves the documented single-tenant behavior byte-identically for a `pnpm dev` on `localhost:3000`, a `pnpm preview` on `127.0.0.1:3000`, and a `pnpm generate` static export — none of those hostnames match any registry entry by default.

## 6. Request isolation guarantees

Every `resolveTenantContext` call constructs a fresh `TenantContext` from:

- The frozen `agencyRegistry` (built once at module load, `Object.freeze`-ed).
- `process.env` (deployment-scoped, not per-request).
- `useRuntimeConfig()` (deployment-scoped, not per-request).

Two concurrent requests on different hostnames cannot share context. The tenancy plugin seeds `useState('site-config')` and `useState('site-config-url')` per request — Nuxt's `useState` is per-request on the server, and the SSR payload carries the seeded value to the client so client hydration agrees with the SSR output.

The sitemap and robots routes do not import app composables (`useState`, `useSiteConfig`, `useNuxtApp`, `useAsyncData`). They construct a fresh `TenantContext` per request via the resolver. No module-level state is shared between requests.

## 7. Boundary regression coverage

The Task 102 hardening is pinned by:

| Test file | Purpose |
| --- | --- |
| `server/utils/tenant-context.test.ts` | Two isolated tenants + unknown-host fallback + per-tenant URL override + request-isolation (no module-level state leak). |
| `server/routes/sitemap.xml.test.ts` | Updated for tenant-aware resolver + `x-forwarded-host` support + 503 on empty URL. |
| `server/routes/robots.txt.test.ts` (NEW) | Tenant-aware robots + `x-forwarded-host` + blocking rule on empty URL. |
| `app/core/composables/usePageSeo.test.ts` (NEW) | Source-level contract: per-tenant URL state takes precedence over the global env var; the composable never imports the registry or the server-only tenant-context module. |
| `app/composables/useSiteConfig.test.ts` (existing) | The composable's client-safe boundary is unchanged: it still never imports the registry or the resolver. |
| `tests/e2e/multi-tenant.spec.ts` (existing) | End-to-end: default tenant's agency name reaches the page output. |
| `app/config/agencies/registry.test.ts` (existing) | The registry's matching + fallback surface is unchanged. |

## 9. Per-tenant lead delivery configuration (Task 106)

The Task 102 hardening made the canonical site URL, the sitemap, and the robots tenant-aware. Lead delivery stayed global — a multi-tenant deployment either shared one delivery destination or ran separate processes per tenant. Task 106 makes lead delivery tenant-aware while preserving the single-tenant behavior byte-identically for deployments that do not opt in.

### 9.1 The convention

The contact endpoint resolves the active tenant from the request hostname (the same dispatch the sitemap, the robots, and the canonical URL use) and asks the per-tenant lead resolver for a `TenantLeadsConfig` snapshot. The snapshot is passed explicitly through the lead pipeline — the service threads it into the adapter's `LeadDeliveryInput`. The adapter reads URL / secret / SMTP fields from the snapshot first, falling back to `useRuntimeConfig()` when the snapshot is absent (the documented single-tenant / no-tenant-context behavior).

### 9.2 Per-tenant env-var dispatch

The resolver reads `process.env.NUXT_LEADS_<KEY>__<TENANT_ID>` first, falling back to the global `NUXT_LEADS_<KEY>` (the documented single-tenant knob, surfaced through `useRuntimeConfig()`). The tenant id is uppercased and any non-alphanumeric character is replaced with `_` for the env-var name — the same normalization rule the site-URL resolver uses (`server/utils/tenant-context.ts`).

```sh
# Single-tenant deployment (default tenant, no per-tenant override needed)
NUXT_LEADS_ADAPTER=email
NUXT_LEADS_SMTP_HOST=mail.example.com
NUXT_LEADS_SMTP_PORT=587
NUXT_LEADS_SMTP_USER=leads@example.com
NUXT_LEADS_SMTP_PASSWORD=secret
NUXT_LEADS_EMAIL_FROM=leads@example.com
NUXT_LEADS_EMAIL_TO=inbox@example.com

# Multi-tenant deployment: acme uses webhook, coastal uses email
NUXT_LEADS_ADAPTER=webhook
NUXT_LEADS_WEBHOOK_URL=https://default-hooks.example.com/inbox
NUXT_LEADS_WEBHOOK_SECRET=default-secret

NUXT_LEADS_ADAPTER__ACME=webhook
NUXT_LEADS_WEBHOOK_URL__ACME=https://acme-hooks.example.com/inbox
NUXT_LEADS_WEBHOOK_SECRET__ACME=acme-secret

NUXT_LEADS_ADAPTER__COASTAL=email
NUXT_LEADS_SMTP_HOST__COASTAL=mail.coastal.example.com
NUXT_LEADS_SMTP_PORT__COASTAL=587
NUXT_LEADS_SMTP_USER__COASTAL=leads@coastal.example.com
NUXT_LEADS_SMTP_PASSWORD__COASTAL=coastal-secret
NUXT_LEADS_EMAIL_FROM__COASTAL=leads@coastal.example.com
NUXT_LEADS_EMAIL_TO__COASTAL=inbox@coastal.example.com
```

Per-field dispatch: a tenant can override the adapter id only, the SMTP host only, or any combination. Unset fields fall back to the global config field-by-field (not all-or-nothing). The default tenant falls back to the global config when no per-tenant env vars are set — the documented single-tenant behavior.

### 9.3 How the snapshot flows through the pipeline

1. The contact endpoint reads the request hostname (`x-forwarded-host` first, then `host`) and calls `resolveTenantLeadsConfig(host)`.
2. The resolver dispatches per-tenant env vars over the global `useRuntimeConfig()` fallback and returns a fresh `TenantLeadsConfig` snapshot.
3. The endpoint passes the snapshot through `leadService.submit({ body, propertyContext }, { requestKey, fallbackLocale, tenantLeadsConfig })`.
4. The service uses `getAdapter(tenantLeadsConfig)` to select the adapter (per-tenant `adapterId` wins; empty / whitespace falls back to the global `runtimeConfig.leadsAdapter`).
5. The service calls `adapter.deliver({ lead, tenantLeadsConfig })` — the adapter reads URL / secret / SMTP fields from the snapshot first; absent snapshot fields fall back to `useRuntimeConfig()`.
6. The snapshot is opaque to the service — the service only forwards it. No module-level mutable state holds the snapshot; concurrent requests for different tenants cannot share adapter configuration.

### 9.4 Request-isolation guarantees

- **No module-level state.** Every call to `resolveTenantLeadsConfig` constructs a fresh `TenantLeadsConfig` snapshot. Two concurrent requests on different hostnames cannot share config.
- **Snapshot is forwarded by reference.** The service does not memoise the snapshot; the adapter receives the exact object the endpoint constructed. Clearing `process.env` between tests resets the resolver (no in-memory state to clear).
- **Per-tenant env-var lookup reads `process.env` directly.** `runtimeConfig` does not support per-tenant overrides (Nuxt's runtime config is global), so the resolver reads `process.env` for the per-tenant override path. The global fallback reads `useRuntimeConfig()` once per call (not once per field) so a test that uses `mockReturnValueOnce` sees the mocked values for all fields.
- **Adapter selection is per-call.** `getAdapter(tenantLeadsConfig)` returns a fresh `LeadDeliveryAdapter` lookup on every call. Concurrent requests for different tenants receive different adapters.
- **Existing single-tenant deployments are byte-identical.** When no per-tenant env vars are set, the resolver returns the global config and the adapter falls back to `useRuntimeConfig()`. A `pnpm dev` on `localhost:3000`, a `pnpm preview` on `127.0.0.1:3000`, and a `pnpm generate` static export all see the same single-tenant behavior.

### 9.5 What uses the per-tenant lead configuration

| Consumer | Surface | Behavior |
| --- | --- | --- |
| `server/api/contact.post.ts` | Lead capture endpoint | Resolves the active tenant from the request hostname, calls `resolveTenantLeadsConfig(host)`, threads the snapshot into `leadService.submit({ body, propertyContext }, { requestKey, fallbackLocale, tenantLeadsConfig })`. |
| `server/services/leads/lead.service.ts` | Lead service pipeline | Uses `getAdapter(tenantLeadsConfig)` to select the adapter; forwards `tenantLeadsConfig` to `adapter.deliver({ lead, tenantLeadsConfig })`. No module-level mutable state. |
| `server/services/leads/adapters/webhook.ts` | Webhook delivery | Reads `webhookUrl` / `webhookSecret` from the snapshot first; falls back to `useRuntimeConfig()`. |
| `server/services/leads/adapters/email.ts` | SMTP email delivery | Reads `smtpHost` / `smtpPort` / `smtpSecure` / `smtpUser` / `smtpPassword` / `emailFrom` / `emailTo` from the snapshot first; falls back to `useRuntimeConfig()`. |
| `server/services/leads/adapters/log.ts` | Redacted log delivery | Reads only `lead` (no config needed). |
| `server/services/leads/adapters/disabled.ts` | Disabled delivery | Reads only `lead` (no config needed). |

### 9.6 Boundary regression coverage

| Test file | Purpose |
| --- | --- |
| `server/utils/lead-config.test.ts` (NEW) | Per-tenant env-var dispatch + global fallback + two-tenant isolation + field-level fallback + unknown-host fallback. |
| `server/services/leads/adapters/index.test.ts` (UPDATED) | `getAdapter(tenantLeadsConfig)` selects the per-tenant adapter; the per-tenant path takes precedence over the global config. |
| `server/services/leads/lead.service.test.ts` (UPDATED) | The service threads the snapshot into the adapter input; concurrent requests for different tenants do not share adapter configuration. |
| `server/services/leads/adapters/webhook.test.ts` (UNCHANGED) | The single-tenant `useRuntimeConfig()` fallback path still works (backward compat). |
| `server/services/leads/adapters/email.test.ts` (UNCHANGED) | The single-tenant `useRuntimeConfig()` fallback path still works (backward compat). |
| `server/api/contact.post.test.ts` (UNCHANGED) | The endpoint's transport mapping is unchanged. |

## 10. Deferred work

- **Distributed rate limiting.** The lead-capture rate limiter is per-process (a `Map`-based sliding window). A multi-process deployment (PM2 cluster, Cloudflare Workers isolates) shares no state between instances. A future task can move the rate limiter to a Nitro storage driver backed by an external KV.
- **Distributed cache.** The per-request resolver is not cached. Two concurrent requests on the same hostname re-resolve from the registry + env vars. The cost is one `selectAgencyByHost` call (a frozen `Record` lookup) plus a small number of `process.env` reads — negligible at any scale. A future task can add a request-scoped cache if profiling shows a need.