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
    const config = useRuntimeConfig()
    const url = String(config.leadsWebhookUrl ?? '').trim()
    const secret = String(config.leadsWebhookSecret ?? '').trim()

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
