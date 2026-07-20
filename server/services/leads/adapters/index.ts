import { useRuntimeConfig } from '#imports'
import type { LeadDeliveryAdapter } from '../delivery-adapter'
import { disabledAdapter } from './disabled'
import { emailAdapter } from './email'
import { logAdapter } from './log'
import { webhookAdapter } from './webhook'

/**
 * Adapter registry and runtime selector.
 *
 * The active adapter is determined by `runtimeConfig.leadsAdapter`
 * (sourced from `NUXT_LEADS_ADAPTER`). The default is `'disabled'`,
 * so a fresh deployment that has not configured a lead destination
 * returns 503 on every submission rather than silently dropping
 * leads. An agency that wants live lead capture sets the env var
 * to one of:
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
 * Returns the configured adapter. The function reads
 * `runtimeConfig.leadsAdapter` on every call so a test or a future
 * admin endpoint can change the active adapter without a server
 * restart (Nitro's `useRuntimeConfig()` reads from the env on every
 * call, by design).
 */
export function getAdapter(): LeadDeliveryAdapter {
  const config = useRuntimeConfig()
  const id = String(config.leadsAdapter ?? 'disabled').trim()
  return ADAPTERS[id] ?? disabledAdapter
}

export { disabledAdapter, emailAdapter, logAdapter, webhookAdapter }
