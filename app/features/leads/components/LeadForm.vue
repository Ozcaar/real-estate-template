<script setup lang="ts">
import { computed, nextTick, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import { leadInputRefined } from '../schemas/lead.schema'
import type { LeadInput } from '../types/lead.types'

/**
 * Lead capture form for the public `/contact` page.
 *
 * **Enabled vs disabled.** The form is **driven by the agency's
 * `leads.enabled` flag**, not by the runtime adapter configuration.
 * When `leads.enabled === false`, the form keeps the historical
 * placeholder behavior (a visible notice and a permanently
 * `disabled` submit button) so an agency that has not opted in to
 * real lead capture ships the same UI as v1.0. When
 * `leads.enabled === true`, the form is fully interactive and posts
 * to `POST /api/contact`.
 *
 * **State machine.** Five states, mutually exclusive at the form
 * level: `idle`, `submitting`, `validation`, `success`, `error`. The
 * status region (success) and the alert region (error) are never
 * visible at the same time.
 *
 * **Accessibility.** Each field is labeled by an explicit `<label
 * :for>` and, when invalid, an additional `aria-describedby` points
 * to the field-level error `<p>`. The honeypot is `aria-hidden`,
 * `tabindex="-1"`, and `autocomplete="off"` so a real user never
 * reaches it. The submit button is keyboard-operable and is disabled
 * only while submitting or when lead capture is disabled.
 *
 * **Fallback.** The contact methods column (tel / mailto / WhatsApp)
 * is rendered by the page, not by this component, and is always
 * available regardless of this form's state.
 */

interface Props {
  /** Agency branding. `leads.enabled` controls form interactivity. */
  enabled: boolean
  /** Active locale code, used to pre-fill the optional `locale` field. */
  locale: string
}

const props = defineProps<Props>()

const { t } = useI18n()

type Status = 'idle' | 'submitting' | 'validation' | 'success' | 'error'

const form = ref<LeadInput>({
  name: '',
  email: '',
  phone: '',
  message: '',
  website: '',
  locale: props.locale,
})

/** Per-field translated error messages. `null` means "no error". */
const errors = ref<Partial<Record<keyof LeadInput, string>>>({})
/** Status of the form. */
const status = ref<Status>('idle')
/** Tracking id from the last successful submission. */
const lastId = ref<string | null>(null)

/** Field-level error association. The `useId()`-derived ids stay stable
 *  across re-renders so `aria-describedby` always points to a real
 *  element. */
const nameId = useId()
const emailId = useId()
const phoneId = useId()
const messageId = useId()
const websiteId = useId()
const nameErrorId = `${nameId}-error`
const emailErrorId = `${emailId}-error`
const phoneErrorId = `${phoneId}-error`
const messageErrorId = `${messageId}-error`

const isSubmitting = computed(() => status.value === 'submitting')
const isSuccess = computed(() => status.value === 'success')
const isError = computed(() => status.value === 'error')

/** Map a schema error code to a translated message. The schema uses
 *  short stable codes (e.g. `name_too_short`) so the i18n layer can
 *  override each rule's copy per locale without coupling the schema
 *  to a particular translation file. */
function errorMessage(code: string): string {
  const key = `contact.form.errors.${code}`
  // Fall back to the raw code if a translation is missing. The schema
  // emits the same code in every locale so this is never user-facing
  // for the supported locales.
  return t(key, code)
}

function fieldError(field: keyof LeadInput): string | null {
  const message = errors.value[field]
  return message ?? null
}

function clearErrors() {
  errors.value = {}
}

async function onSubmit() {
  if (!props.enabled) return
  if (isSubmitting.value) return

  // Pre-flight validation. The server re-validates the same schema —
  // this is a UX nicety, not a trust boundary.
  const parsed = leadInputRefined.safeParse(form.value)
  if (!parsed.success) {
    const next: Partial<Record<keyof LeadInput, string>> = {}
    for (const issue of parsed.error.issues) {
      const path = issue.path[0]
      if (typeof path === 'string' && !(path in next)) {
        next[path as keyof LeadInput] = errorMessage(issue.message)
      }
    }
    errors.value = next
    status.value = 'validation'
    await nextTick()
    focusFirstInvalid()
    return
  }

  clearErrors()
  status.value = 'submitting'

  try {
    const response = await $fetch<{ ok: true, id: string } | {
      ok: false,
      error: 'validation' | 'payload_too_large' | 'unsupported_media_type' | 'rate_limited' | 'delivery' | 'adapter_disabled',
      issues?: { path: string, message: string }[],
    }>('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form.value),
    })

    if (response.ok) {
      lastId.value = response.id
      status.value = 'success'
      // Reset only the user-visible fields on success. The honeypot
      // is always empty for a real user so resetting it is a no-op;
      // the locale stays the same.
      form.value = { name: '', email: '', phone: '', message: '', website: '', locale: props.locale }
      return
    }

    if (response.error === 'validation' && response.issues) {
      const next: Partial<Record<keyof LeadInput, string>> = {}
      for (const issue of response.issues) {
        const path = issue.path
        if (typeof path === 'string' && !(path in next)) {
          next[path as keyof LeadInput] = errorMessage(issue.message)
        }
      }
      errors.value = next
      status.value = 'validation'
      await nextTick()
      focusFirstInvalid()
      return
    }

    // payload_too_large / unsupported_media_type / rate_limited /
    // delivery / adapter_disabled all map to the error state with
    // a translated, non-provider-specific message. The server does
    // not leak provider details.
    status.value = 'error'
  }
  catch {
    // Network failure, server crash, CORS rejection, or any other
    // transport-level error. Treated identically to a 502.
    status.value = 'error'
  }
}

const fieldRefs = {
  name: ref<HTMLInputElement | null>(null),
  email: ref<HTMLInputElement | null>(null),
  phone: ref<HTMLInputElement | null>(null),
  message: ref<HTMLTextAreaElement | null>(null),
}

async function focusFirstInvalid() {
  const order: (keyof LeadInput)[] = ['name', 'email', 'phone', 'message']
  for (const field of order) {
    if (errors.value[field]) {
      const el = fieldRefs[field].value
      if (el) {
        el.focus()
        return
      }
    }
  }
}

function onFieldInput() {
  // Clear the field's error as the user types. Re-promotes the form
  // to `idle` when no other field has an error.
  if (status.value === 'validation' || status.value === 'error') {
    clearErrors()
    status.value = 'idle'
  }
}
</script>

<template>
  <form
    novalidate
    :aria-busy="isSubmitting"
    class="grid grid-cols-1 gap-4 sm:grid-cols-2"
    @submit.prevent="onSubmit"
  >
    <!-- Honeypot. Hidden from real users and assistive technology.
         Real users never reach it; a bot that fills it is dropped
         server-side. -->
    <div class="sr-only" aria-hidden="true">
      <label :for="websiteId">{{ t('contact.form.honeypotLabel') }}</label>
      <input
        :id="websiteId"
        ref="honeypotRef"
        v-model="form.website"
        type="text"
        name="website"
        tabindex="-1"
        autocomplete="off"
        aria-hidden="true"
      >
    </div>

    <div class="sm:col-span-2">
      <label
        :for="nameId"
        class="mb-1 block text-xs font-medium text-[var(--color-muted)]"
      >
        {{ t('contact.form.nameLabel') }}
      </label>
      <input
        :id="nameId"
        ref="nameRef"
        v-model="form.name"
        type="text"
        name="name"
        autocomplete="name"
        :aria-invalid="fieldError('name') ? 'true' : 'false'"
        :aria-describedby="fieldError('name') ? nameErrorId : undefined"
        :placeholder="t('contact.form.namePlaceholder')"
        :readonly="isSubmitting"
        :disabled="!props.enabled"
        class="h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-background)] px-3 text-sm text-[var(--color-foreground)]"
        @input="onFieldInput"
      >
      <p
        v-if="fieldError('name')"
        :id="nameErrorId"
        class="mt-1 text-xs text-[var(--color-error)]"
      >
        {{ fieldError('name') }}
      </p>
    </div>

    <div>
      <label
        :for="emailId"
        class="mb-1 block text-xs font-medium text-[var(--color-muted)]"
      >
        {{ t('contact.form.emailLabel') }}
      </label>
      <input
        :id="emailId"
        ref="emailRef"
        v-model="form.email"
        type="email"
        name="email"
        autocomplete="email"
        :aria-invalid="fieldError('email') ? 'true' : 'false'"
        :aria-describedby="fieldError('email') ? emailErrorId : undefined"
        :placeholder="t('contact.form.emailPlaceholder')"
        :readonly="isSubmitting"
        :disabled="!props.enabled"
        class="h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-background)] px-3 text-sm text-[var(--color-foreground)]"
        @input="onFieldInput"
      >
      <p
        v-if="fieldError('email')"
        :id="emailErrorId"
        class="mt-1 text-xs text-[var(--color-error)]"
      >
        {{ fieldError('email') }}
      </p>
    </div>

    <div>
      <label
        :for="phoneId"
        class="mb-1 block text-xs font-medium text-[var(--color-muted)]"
      >
        {{ t('contact.form.phoneLabel') }}
      </label>
      <input
        :id="phoneId"
        ref="phoneRef"
        v-model="form.phone"
        type="tel"
        name="phone"
        autocomplete="tel"
        :aria-invalid="fieldError('phone') ? 'true' : 'false'"
        :aria-describedby="fieldError('phone') ? phoneErrorId : undefined"
        :placeholder="t('contact.form.phonePlaceholder')"
        :readonly="isSubmitting"
        :disabled="!props.enabled"
        class="h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-background)] px-3 text-sm text-[var(--color-foreground)]"
        @input="onFieldInput"
      >
      <p
        v-if="fieldError('phone')"
        :id="phoneErrorId"
        class="mt-1 text-xs text-[var(--color-error)]"
      >
        {{ fieldError('phone') }}
      </p>
    </div>

    <div class="sm:col-span-2">
      <label
        :for="messageId"
        class="mb-1 block text-xs font-medium text-[var(--color-muted)]"
      >
        {{ t('contact.form.messageLabel') }}
      </label>
      <textarea
        :id="messageId"
        ref="messageRef"
        v-model="form.message"
        name="message"
        rows="5"
        :aria-invalid="fieldError('message') ? 'true' : 'false'"
        :aria-describedby="fieldError('message') ? messageErrorId : undefined"
        :placeholder="t('contact.form.messagePlaceholder')"
        :readonly="isSubmitting"
        :disabled="!props.enabled"
        class="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)]"
        @input="onFieldInput"
      />
      <p
        v-if="fieldError('message')"
        :id="messageErrorId"
        class="mt-1 text-xs text-[var(--color-error)]"
      >
        {{ fieldError('message') }}
      </p>
    </div>

    <div class="sm:col-span-2">
      <!-- Disabled mode: keep the v1.0 placeholder notice visible. -->
      <p
        v-if="!props.enabled"
        class="mb-4 rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3 text-xs text-[var(--color-muted)]"
      >
        {{ t('contact.form.placeholderNotice') }}
      </p>

      <!-- Enabled mode: one mutually exclusive polite status / assertive alert. -->
      <p
        v-if="isSuccess"
        role="status"
        class="mb-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3 text-sm text-[var(--color-foreground)]"
      >
        {{ t('contact.form.success', { id: lastId ?? '' }) }}
      </p>
      <p
        v-else-if="isError"
        role="alert"
        class="mb-4 rounded-[var(--radius-md)] border border-[var(--color-error)] bg-[var(--color-surface-muted)] p-3 text-sm text-[var(--color-foreground)]"
      >
        {{ t('contact.form.error') }}
      </p>

      <BaseButton
        type="submit"
        size="lg"
        :loading="isSubmitting"
        :disabled="!props.enabled || isSubmitting"
        block
      >
        {{ t('contact.form.submit') }}
      </BaseButton>
    </div>
  </form>
</template>
