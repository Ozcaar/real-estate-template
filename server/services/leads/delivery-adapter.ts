import type { Lead } from '../../../app/features/leads/types/lead.types'

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
 */
export interface LeadDeliveryInput {
  /** The stamped lead. */
  lead: Lead
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
  readonly id: 'disabled' | 'log' | 'webhook'
  /**
   * Deliver the stamped lead. Returns a result; never throws.
   */
  deliver(input: LeadDeliveryInput): Promise<LeadDeliveryResult>
}
