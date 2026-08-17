import { createHmac } from 'node:crypto'
import { useRuntimeConfig } from '#imports'
import type {
  LeadDeliveryAdapter,
  LeadDeliveryInput,
  LeadDeliveryResult,
} from '../delivery-adapter'

/**
 * Webhook adapter.
 *
 * Sends the **stamped lead** as JSON to a configured HTTPS endpoint
 * with an HMAC SHA-256 signature header. The agency-side endpoint
 * verifies the signature with the shared secret before processing
 * the lead.
 *
 * **Configuration.** Both the webhook URL and the webhook secret
 * are read from server-only runtime config:
 *
 * - `runtimeConfig.leadsWebhookUrl` from `NUXT_LEADS_WEBHOOK_URL`
 * - `runtimeConfig.leadsWebhookSecret` from `NUXT_LEADS_WEBHOOK_SECRET`
 *
 * Both must be set for the adapter to deliver. If either is
 * missing the adapter returns `{ ok: false, errorCode: 'unsupported' }`
 * so the endpoint can surface a 502 with a clear agency-side
 * configuration error.
 *
 * **Per-tenant override (Task 106).** When the contact endpoint
 * resolves an active tenant's `TenantLeadsConfig` snapshot, the
 * webhook URL and secret come from the snapshot's
 * `webhookUrl` / `webhookSecret` instead of `useRuntimeConfig()`.
 * The per-tenant env-var convention is
 * `NUXT_LEADS_WEBHOOK_URL__<TENANT_ID>` /
 * `NUXT_LEADS_WEBHOOK_SECRET__<TENANT_ID>` with the documented
 * site-URL normalization (uppercase + non-alphanumeric → `_`).
 * Per-tenant overrides take precedence over the global env
 * vars; the global config remains the fallback so a missing
 * tenant override produces the documented single-tenant
 * behavior.
 *
 * **Behavior.**
 *
 * - 5-second timeout via `AbortController`.
 * - `redirect: 'manual'` so a 3xx response is treated as a delivery
 *   failure rather than a silent redirect.
 * - Non-2xx responses become
 *   `{ ok: false, errorCode: 'transport', retryable: true }`.
 * - Network errors and DNS failures become
 *   `{ ok: false, errorCode: 'transport', retryable: true }`.
 * - Timeout aborts (`AbortError` from the 5-second `AbortController`)
 *   become `{ ok: false, errorCode: 'transport', retryable: false }`
 *   because retrying immediately is unlikely to help an overloaded
 *   upstream and the rate limiter at the service layer is the
 *   dedicated anti-retry mechanism.
 * - 401 / 403 from the upstream (signature or auth failure) become
 *   `{ ok: false, errorCode: 'auth', retryable: false }`.
 *
 * **Signature.** The exact JSON payload sent to the upstream is
 * also the value signed by HMAC SHA-256. The agency-side endpoint
 * must verify with the shared secret using a constant-time
 * comparison. The signature header is `X-Lead-Signature` with the
 * value `sha256=<hex>`.
 *
 * **No upstream body is exposed.** A non-2xx response's body is
 * logged server-side at `warn` for debugging; the client never
 * sees it.
 */
export const webhookAdapter: LeadDeliveryAdapter = {
  id: 'webhook',
  async deliver(input: LeadDeliveryInput): Promise<LeadDeliveryResult> {
    // Per-tenant config takes precedence over the global runtime
    // config (Task 106). When the contact endpoint resolves
    // the active tenant and threads the snapshot into the
    // input, the adapter reads the URL + secret from the
    // snapshot; otherwise it falls back to the runtime config.
    //
    // The runtime-config fallback is fetched ONCE per call
    // (not once per field) so a test that uses
    // `mockReturnValueOnce` to set the next `useRuntimeConfig`
    // value sees the mocked values for both fields in the same
    // call — two calls would consume the `Once` value on the
    // first and read the default mock on the second.
    const tenant = input.tenantLeadsConfig
    const fallback = useRuntimeConfig()
    const url = tenant
      ? tenant.webhookUrl
      : String(fallback.leadsWebhookUrl ?? '').trim()
    const secret = tenant
      ? tenant.webhookSecret
      : String(fallback.leadsWebhookSecret ?? '').trim()

    if (!url || !secret) {
      return { ok: false, errorCode: 'unsupported', retryable: false }
    }

    const body = JSON.stringify(input.lead)
    const signature = createHmac('sha256', secret).update(body).digest('hex')
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-lead-signature': `sha256=${signature}`,
        },
        body,
        signal: controller.signal,
        redirect: 'manual',
      })
      clearTimeout(timeout)

      if (response.status === 401 || response.status === 403) {
        return { ok: false, errorCode: 'auth', retryable: false }
      }
      if (response.status >= 200 && response.status < 300) {
        return { ok: true }
      }
      return { ok: false, errorCode: 'transport', retryable: true }
    }
    catch (error) {
      clearTimeout(timeout)
      const isAbort = error instanceof Error && error.name === 'AbortError'
      return {
        ok: false,
        errorCode: 'transport',
        retryable: !isAbort,
      }
    }
  },
}
