import type {
  LeadDeliveryAdapter,
  LeadDeliveryInput,
  LeadDeliveryResult,
} from '../delivery-adapter'

/**
 * Disabled adapter.
 *
 * Returns an **explicit disabled result** so the endpoint can map
 * it to a 503. The disabled adapter never returns delivery success
 * and never silently discards a real submission — the lead is
 * stamped and routed through the service's normal pipeline, and
 * the service maps the `disabled` errorCode to the
 * `adapter_disabled` transport status.
 *
 * Used when the runtime adapter is set to `disabled` (the default).
 * An agency that wants to operate the public site without
 * automated lead delivery keeps the contact methods column as the
 * canonical completion path.
 */
export const disabledAdapter: LeadDeliveryAdapter = {
  id: 'disabled',
  async deliver(_input: LeadDeliveryInput): Promise<LeadDeliveryResult> {
    return { ok: false, errorCode: 'disabled', retryable: false }
  },
}
