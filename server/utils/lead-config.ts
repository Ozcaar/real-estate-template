import { useRuntimeConfig } from '#imports'
import {
  agencyRegistry,
  DEFAULT_TENANT_ID,
  selectAgencyByHost,
  type AgencyRegistry,
} from '../../app/config/agencies/registry'

/**
 * Per-tenant lead-delivery configuration (Task 106).
 *
 * The fields mirror the existing `NUXT_LEADS_*` env-var set
 * declared in `nuxt.config.ts → runtimeConfig`, mapped one-to-one
 * to the M5 / M5 SMTP shipping adapter:
 *
 *  - `adapterId`         → `NUXT_LEADS_ADAPTER`
 *  - `webhookUrl`        → `NUXT_LEADS_WEBHOOK_URL`
 *  - `webhookSecret`     → `NUXT_LEADS_WEBHOOK_SECRET`
 *  - `smtpHost`          → `NUXT_LEADS_SMTP_HOST`
 *  - `smtpPort`          → `NUXT_LEADS_SMTP_PORT`
 *  - `smtpSecure`        → `NUXT_LEADS_SMTP_SECURE`
 *  - `smtpUser`          → `NUXT_LEADS_SMTP_USER`
 *  - `smtpPassword`      → `NUXT_LEADS_SMTP_PASSWORD`
 *  - `emailFrom`         → `NUXT_LEADS_EMAIL_FROM`
 *  - `emailTo`           → `NUXT_LEADS_EMAIL_TO`
 *
 * The fields are populated by {@link resolveTenantLeadsConfig} per
 * request and passed explicitly through the contact endpoint /
 * lead pipeline. The adapter reads from the snapshot, NOT from
 * `useRuntimeConfig()`, so concurrent requests for different
 * tenants cannot share adapter configuration.
 *
 * The default fallback keeps single-tenant deployments
 * byte-identical: when no per-tenant override is configured,
 * every field falls back to the runtime-config value sourced
 * from the existing `NUXT_LEADS_*` env vars.
 */
export interface TenantLeadsConfig {
  /** Active adapter id: `'disabled' | 'log' | 'webhook' | 'email'`. */
  readonly adapterId: string
  readonly webhookUrl: string
  readonly webhookSecret: string
  readonly smtpHost: string
  readonly smtpPort: string
  readonly smtpSecure: string
  readonly smtpUser: string
  readonly smtpPassword: string
  readonly emailFrom: string
  readonly emailTo: string
}

/**
 * Per-tenant env-var dispatcher.
 *
 * Resolution order for the supplied `baseEnvKey`:
 *
 *  1. `process.env[baseEnvKey + '__' + <upperTenant>]` (per-tenant
 *     override; non-empty wins).
 *  2. `globalValue` (the runtime-config value already sourced from
 *     `NUXT_LEADS_<KEY>` — the documented single-tenant
 *     knob).
 *
 * The tenant id is uppercased and any non-alphanumeric character
 * is replaced with `_` for the env-var name — the same
 * normalization rule the site-URL resolver uses (`server/utils/tenant-context.ts`).
 * This keeps the per-tenant override convention consistent
 * across both leads and site URL.
 *
 * **Whitespace-only is treated as "missing"** for the fall-back
 * decision. An operator who set only whitespace did not set a
 * real value, so the resolver moves on to the next fallback
 * source.
 *
 * **Credential fields** (webhook secret, SMTP username, SMTP
 * password) are passed `{ preserveWhitespace: true }` so the
 * exact configured value is returned — leading or trailing
 * whitespace in a credential is a meaningful part of the
 * secret, not a formatting artifact. Non-credential fields
 * (URLs, hostnames, port numbers, email addresses, adapter ids)
 * keep the historical trim behavior so a `.env` file with
 * stray whitespace does not break a URL or email address.
 *
 * Pure helper exported for the test surface (so the test does
 * not have to import the entire resolver).
 */
export function readTenantLeadEnv(
  tenantId: string,
  baseEnvKey: string,
  globalValue: string,
  env: NodeJS.ProcessEnv = process.env,
  options: { /** When `true`, the returned value is NOT trimmed
   *  — leading or trailing whitespace in a credential is
   *  meaningful. Whitespace-only values still fall back to
   *  the global override; the fall-back decision is
   *  orthogonal to the return-shape decision. When `false`
   *  (the default), the value is trimmed, matching the
   *  historical behavior for non-credential fields. */
  preserveWhitespace?: boolean } = {},
): string {
  const upperTenant = tenantId.toUpperCase().replace(/[^A-Z0-9_]/g, '_')
  const tenantKey = `${baseEnvKey}__${upperTenant}`
  const tenantRaw = env[tenantKey]
  // Whitespace-only is treated as "missing" so the global
  // fallback kicks in. The check uses `.trim()` for the
  // fall-back decision only — the returned value is
  // preserved exactly as configured when the
  // `preserveWhitespace` option is set.
  const tenant = typeof tenantRaw === 'string' && tenantRaw.trim() !== '' ? tenantRaw : ''
  if (tenant !== '') {
    return options.preserveWhitespace ? tenant : tenant.trim()
  }
  const global = typeof globalValue === 'string' && globalValue.trim() !== '' ? globalValue : ''
  if (global !== '') {
    return options.preserveWhitespace ? global : global.trim()
  }
  return ''
}

/**
 * Resolve the active tenant's lead-delivery configuration for a
 * Nitro request.
 *
 * The function is pure from the perspective of request state:
 * every call constructs a fresh `TenantLeadsConfig` snapshot.
 * The only shared state is the registry (defaulting to the
 * production `agencyRegistry`; injectable for tests) and the
 * process-wide `useRuntimeConfig()` + `process.env`, both of
 * which are deployment-scoped (not per-request).
 *
 * The `registry` parameter is a thin dependency-injection seam
 * for the test surface: tests pass a custom registry with
 * isolated entries to exercise the multi-tenant matching +
 * fallback paths without `vi.doMock` gymnastics. Production
 * callers always omit the second argument and use the bundled
 * default registry.
 *
 * **No module-level state.** Two concurrent requests on different
 * hostnames cannot share `TenantLeadsConfig`. Clearing
 * `process.env` or unsetting the runtime config between tests
 * is sufficient to reset the resolver. The `agencyRegistry`
 * itself is the only piece of cross-call state, and it is
 * `Object.freeze`-ed at module load so it cannot be mutated
 * by the resolver.
 *
 * **Per-tenant override example.** A deployment hosting
 * `acme.example.com` (webhook destination) and
 * `coastal.example.com` (SMTP destination) sets:
 *
 * ```sh
 * NUXT_LEADS_ADAPTER=webhook           # default fallback
 * NUXT_LEADS_WEBHOOK_URL=https://acme-hooks.example.com/inbox
 * NUXT_LEADS_WEBHOOK_SECRET=acme-secret
 *
 * NUXT_LEADS_ADAPTER__COASTAL=email
 * NUXT_LEADS_SMTP_HOST__COASTAL=mail.coastal.example.com
 * NUXT_LEADS_SMTP_PORT__COASTAL=587
 * NUXT_LEADS_SMTP_USER__COASTAL=leads@coastal.example.com
 * NUXT_LEADS_SMTP_PASSWORD__COASTAL=coastal-secret
 * NUXT_LEADS_EMAIL_FROM__COASTAL=leads@coastal.example.com
 * NUXT_LEADS_EMAIL_TO__COASTAL=inbox@coastal.example.com
 * ```
 *
 * A request to `acme.example.com` produces a `TenantLeadsConfig`
 * with `adapterId: 'webhook'`, `webhookUrl: <global env var>`, no SMTP fields
 * (all SMTP fields remain empty / dispatched from the global
 * fallback). A request to `coastal.example.com` produces a
 * `TenantLeadsConfig` with `adapterId: 'email'`, fully-populated SMTP fields,
 * empty webhook fields. A request to an unknown hostname falls
 * back to the default tenant, which reads from the global
 * `NUXT_LEADS_*` env vars only.
 */
export function resolveTenantLeadsConfig(
  rawHost: string | null | undefined,
  registry: AgencyRegistry = agencyRegistry,
): TenantLeadsConfig {
  const entry = selectAgencyByHost(registry, rawHost, DEFAULT_TENANT_ID)
  const tenantId = entry.id
  const config = useRuntimeConfig()

  // Per-field dispatch. Each field's per-tenant env var
  // (`NUXT_LEADS_<KEY>__<TENANT_ID>`) takes precedence; the
  // global value (already sourced from `NUXT_LEADS_<KEY>` by
  // Nuxt's `useRuntimeConfig()` plumbing) is the fallback.
  //
  // Credential fields (webhookSecret, smtpUser, smtpPassword)
  // use `preserveWhitespace: true` so the exact configured
  // value is returned — leading or trailing whitespace in a
  // credential is a meaningful part of the secret, not a
  // formatting artifact. Non-credential fields (URLs,
  // hostnames, port numbers, email addresses, adapter ids)
  // keep the historical trim behavior so a `.env` file with
  // stray whitespace does not break a URL or email address.
  return {
    adapterId: readTenantLeadEnv(tenantId, 'NUXT_LEADS_ADAPTER', String(config.leadsAdapter ?? 'disabled'), process.env),
    webhookUrl: readTenantLeadEnv(tenantId, 'NUXT_LEADS_WEBHOOK_URL', String(config.leadsWebhookUrl ?? ''), process.env),
    webhookSecret: readTenantLeadEnv(tenantId, 'NUXT_LEADS_WEBHOOK_SECRET', String(config.leadsWebhookSecret ?? ''), process.env, { preserveWhitespace: true }),
    smtpHost: readTenantLeadEnv(tenantId, 'NUXT_LEADS_SMTP_HOST', String(config.leadsSmtpHost ?? ''), process.env),
    smtpPort: readTenantLeadEnv(tenantId, 'NUXT_LEADS_SMTP_PORT', String(config.leadsSmtpPort ?? ''), process.env),
    smtpSecure: readTenantLeadEnv(tenantId, 'NUXT_LEADS_SMTP_SECURE', String(config.leadsSmtpSecure ?? ''), process.env),
    smtpUser: readTenantLeadEnv(tenantId, 'NUXT_LEADS_SMTP_USER', String(config.leadsSmtpUser ?? ''), process.env, { preserveWhitespace: true }),
    smtpPassword: readTenantLeadEnv(tenantId, 'NUXT_LEADS_SMTP_PASSWORD', String(config.leadsSmtpPassword ?? ''), process.env, { preserveWhitespace: true }),
    emailFrom: readTenantLeadEnv(tenantId, 'NUXT_LEADS_EMAIL_FROM', String(config.leadsEmailFrom ?? ''), process.env),
    emailTo: readTenantLeadEnv(tenantId, 'NUXT_LEADS_EMAIL_TO', String(config.leadsEmailTo ?? ''), process.env),
  }
}