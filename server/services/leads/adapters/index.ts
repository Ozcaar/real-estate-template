import { useRuntimeConfig } from '#imports'
import type { LeadDeliveryAdapter } from '../delivery-adapter'
import type { TenantLeadsConfig } from '../../../utils/lead-config'
import { disabledAdapter } from './disabled'
import { emailAdapter } from './email'
import { logAdapter } from './log'
import { webhookAdapter } from './webhook'

/**
 * Adapter registry and runtime selector.
 *
 * The active adapter is determined by the **resolved tenant lead
 * configuration** when a `tenantLeadsConfig` snapshot is passed in
 * (Task 106 multi-tenant deployment), or by
 * `runtimeConfig.leadsAdapter` (sourced from `NUXT_LEADS_ADAPTER`)
 * when the snapshot is absent (single-tenant / no-tenant-context
 * behavior).
 *
 * The default is `'disabled'`, so a fresh deployment that has not
 * configured a lead destination returns 503 on every submission
 * rather than silently dropping leads. An agency that wants live
 * lead capture sets the env var (or the per-tenant override) to
 * one of:
 *
 * - `'log'` (development) — writes a single redacted `console.info` line per lead
 * - `'webhook'` (production) — POSTs the stamped lead to a configured HTTPS endpoint with HMAC SHA-256 signature
 * - `'email'` (production) — sends a plain-text + HTML email through any configured SMTP server
 *
 * and provides the matching configuration.
 *
 * The registry is the **only** place that needs to change to add a
 * new adapter. The endpoint and the lead service are adapter-agnostic.
 */
const ADAPTERS: Record<string, LeadDeliveryAdapter> = {
  disabled: disabledAdapter,
  log: logAdapter,
  webhook: webhookAdapter,
  email: emailAdapter,
}

/**
 * Returns the configured adapter. The function reads the
 * per-tenant snapshot first (when provided) and falls back to
 * `runtimeConfig.leadsAdapter` so the documented single-tenant
 * behavior is preserved.
 *
 * **Per-tenant resolution (Task 106).** When the contact endpoint
 * resolves an active tenant's `TenantLeadsConfig` snapshot and
 * threads it into the lead pipeline, this function returns the
 * adapter the tenant selected via `NUXT_LEADS_ADAPTER__<TENANT_ID>`
 * (or its `disabled` fallback when no per-tenant adapter is
 * configured). Concurrent requests for different tenants never
 * share the resolved adapter because each request constructs a
 * fresh snapshot and the snapshot is passed explicitly — no
 * module-level mutable state is touched.
 *
 * The function reads `useRuntimeConfig()` (and, for per-tenant
 * env-var overrides, `process.env`) on every call so a test or
 * a future admin endpoint can change the active adapter without
 * a server restart (Nitro's `useRuntimeConfig()` reads from the
 * env on every call, by design).
 */
export function getAdapter(tenantLeadsConfig?: TenantLeadsConfig): LeadDeliveryAdapter {
  // Per-tenant adapter id takes precedence (Task 106). The
  // snapshot is a per-request value; two concurrent requests
  // for different tenants cannot share this lookup.
  const fromTenant = tenantLeadsConfig?.adapterId?.trim() ?? ''
  if (fromTenant !== '') {
    return ADAPTERS[fromTenant] ?? disabledAdapter
  }
  const config = useRuntimeConfig()
  const id = String(config.leadsAdapter ?? 'disabled').trim()
  return ADAPTERS[id] ?? disabledAdapter
}

export { disabledAdapter, emailAdapter, logAdapter, webhookAdapter }