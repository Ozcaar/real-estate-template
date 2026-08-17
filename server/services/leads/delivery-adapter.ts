import type { Lead } from '../../../app/features/leads/types/lead.types'
import type { TenantLeadsConfig } from '../../utils/lead-config'

/**
 * Server-only delivery adapter boundary.
 *
 * The adapter receives a **stamped** `Lead` (server-only fields
 * populated by `leadService`). It never receives the raw input, the
 * request body, the IP, or the user-agent. The adapter is the only
 * surface that touches an external destination (or a local sink such
 * as `console.info`).
 *
 * The adapter is **synchronous-input / asynchronous-output**: a
 * `Promise<LeadDeliveryResult>` so the lead service can `await` every
 * adapter uniformly. The `disabled` and `log` adapters are
 * effectively synchronous; the `webhook` adapter awaits a real
 * `fetch`. A future queue adapter (BullMQ, Cloudflare Queues, SQS)
 * drops in without changing the contract.
 *
 * **No throw.** The adapter is expected to return a result for every
 * input. Network errors, timeouts, 5xx responses, and authentication
 * failures all become a structured `LeadDeliveryResult` with an
 * `errorCode`. The endpoint maps the result to an HTTP status; the
 * adapter never raises.
 *
 * **Per-tenant lead configuration (Task 106).** When the contact
 * endpoint resolves the active tenant's `TenantLeadsConfig` (a
 * per-request snapshot of the resolved adapter id + webhook /
 * SMTP / email credentials), it threads the snapshot into
 * {@link LeadDeliveryInput.tenantLeadsConfig}. Adapters read from
 * this snapshot **first**, falling back to `useRuntimeConfig()` when
 * it is absent (preserves the single-tenant / no-tenant-context
 * behavior). The snapshot is opaque to the lead service — the
 * service only forwards it. This is the documented boundary that
 * keeps concurrent requests for different tenants from sharing
 * adapter configuration (no module-level mutable state).
 */
export interface LeadDeliveryInput {
  /** The stamped lead. */
  lead: Lead
  /**
   * Optional per-tenant lead-delivery configuration. When
   * present, the adapter reads its `webhookUrl` / `webhookSecret`
   * / `smtpHost` / `smtpPort` / `smtpSecure` / `smtpUser` /
   * `smtpPassword` / `emailFrom` / `emailTo` from this snapshot.
   * When absent, the adapter falls back to `useRuntimeConfig()` —
   * the documented single-tenant behavior.
   *
   * Note: `adapterId` is NOT threaded here. Adapter selection is
   * the lead service's responsibility (via
   * {@link getAdapter}); the input only carries the credentials
   * the chosen adapter needs.
   */
  tenantLeadsConfig?: TenantLeadsConfig
}

export interface LeadDeliveryResult {
  ok: boolean
  /**
   * Stable, short error code. Never includes provider internals.
   * The endpoint maps this to an HTTP status (502 for `transport`,
   * `auth`, or `unsupported`; 429 for `rate_limited`; 503 for
   * `disabled`).
   */
  errorCode?:
    | 'disabled'
    | 'transport'
    | 'auth'
    | 'rate_limited'
    | 'unsupported'
  /**
   * Whether the failure is retryable. The endpoint logs non-retryable
   * failures at `warn` and retryable failures at `error`; the client
   * never sees this distinction.
   */
  retryable?: boolean
}

export interface LeadDeliveryAdapter {
  /** Stable identifier. Used by the runtime-config-driven selector. */
  readonly id: 'disabled' | 'log' | 'webhook' | 'email'
  /**
   * Deliver the stamped lead. Returns a result; never throws.
   */
  deliver(input: LeadDeliveryInput): Promise<LeadDeliveryResult>
}
