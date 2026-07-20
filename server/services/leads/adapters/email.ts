import nodemailer from 'nodemailer'
import { useRuntimeConfig } from '#imports'
import type {
  LeadDeliveryAdapter,
  LeadDeliveryInput,
  LeadDeliveryResult,
} from '../delivery-adapter'

/**
 * SMTP email delivery adapter.
 *
 * Sends the **stamped lead** as a plain-text and HTML email through
 * any SMTP server (Mailgun, Postmark, Amazon SES, Gmail, a self-hosted
 * Postfix, etc.). The adapter is the right choice when the agency
 * wants every lead to land in an inbox and does not want to wire a
 * custom webhook endpoint.
 *
 * **Configuration.** All SMTP credentials and delivery addresses
 * are read from server-only runtime config. None of them are ever
 * exposed to the client bundle, and none are part of agency branding
 * (rebrands must not require touching a delivery destination):
 *
 * | Env var                       | Runtime config key       | Required |
 * | ----------------------------- | ------------------------ | -------- |
 * | `NUXT_LEADS_SMTP_HOST`        | `leadsSmtpHost`          | yes      |
 * | `NUXT_LEADS_SMTP_PORT`        | `leadsSmtpPort`          | yes      |
 * | `NUXT_LEADS_SMTP_SECURE`      | `leadsSmtpSecure`        | no       |
 * | `NUXT_LEADS_SMTP_USER`        | `leadsSmtpUser`          | yes      |
 * | `NUXT_LEADS_SMTP_PASSWORD`    | `leadsSmtpPassword`      | yes      |
 * | `NUXT_LEADS_EMAIL_FROM`       | `leadsEmailFrom`         | yes      |
 * | `NUXT_LEADS_EMAIL_TO`         | `leadsEmailTo`           | yes      |
 *
 * `NUXT_LEADS_SMTP_SECURE` accepts `"true"` (use TLS) or any other
 * value (plaintext SMTP). Nodemailer's `secure` flag is `true` when
 * the connection uses port 465 by default; setting the env var
 * explicitly overrides that.
 *
 * **Validation.** All required values are checked **before** the
 * transporter is created. A missing host / port / user / password /
 * from / to returns `{ ok: false, errorCode: 'unsupported',
 * retryable: false }` so the endpoint surfaces a 502 with a clear
 * agency-side configuration error and no SMTP connection is
 * attempted.
 *
 * **Email body.** Both plain-text and HTML versions are sent. The
 * HTML body escapes every user-provided value (name, email, phone,
 * message, locale, id, receivedAt) so a malicious submission cannot
 * inject markup. The plain-text body is the same content with no
 * escaping. The lead's email is set as `replyTo` **only when** the
 * lead has a non-empty email — an empty `replyTo` would cause
 * Nodemailer to reject the send.
 *
 * **Timeouts.** Nodemailer's `socketTimeout`, `connectionTimeout`,
 * and `greetingTimeout` are all set to 5 seconds. A timeout becomes
 * `{ ok: false, errorCode: 'transport', retryable: false }` because
 * retrying immediately is unlikely to help an overloaded SMTP
 * server; the per-process rate limiter at the service layer is the
 * dedicated anti-retry mechanism.
 *
 * **Privacy.** The adapter never logs the password, the full lead
 * body, or the upstream SMTP error body. The only lead field that
 * appears in any log line is the lead `id`. SMTP-level errors
 * surface as the short `errorCode` (e.g. `'auth'`, `'transport'`)
 * and `retryable` flag in the result; the client never sees the
 * raw SMTP error message.
 *
 * **No throw.** The adapter returns a result for every input. SMTP
 * errors, timeouts, and missing configuration all become a structured
 * `LeadDeliveryResult` with a stable `errorCode`.
 */
const SMTP_TIMEOUT_MS = 5000

interface SmtpConfig {
  host: string
  port: number
  secure: boolean
  user: string
  pass: string
  from: string
  to: string
}

function readSmtpConfig(): SmtpConfig | null {
  const config = useRuntimeConfig()
  const host = String(config.leadsSmtpHost ?? '').trim()
  const portRaw = String(config.leadsSmtpPort ?? '').trim()
  const secureRaw = String(config.leadsSmtpSecure ?? '').trim()
  const user = String(config.leadsSmtpUser ?? '').trim()
  const pass = String(config.leadsSmtpPassword ?? '').trim()
  const from = String(config.leadsEmailFrom ?? '').trim()
  const to = String(config.leadsEmailTo ?? '').trim()

  if (!host || !portRaw || !user || !pass || !from || !to) {
    return null
  }

  const port = Number(portRaw)
  if (!Number.isFinite(port) || port <= 0 || !Number.isInteger(port)) {
    return null
  }

  // `NUXT_LEADS_SMTP_SECURE` accepts the string "true" (case-insensitive);
  // any other value (including the empty string, "false", "1", etc.)
  // means plaintext SMTP. This matches the documented contract.
  const secure = secureRaw.toLowerCase() === 'true'

  return { host, port, secure, user, pass, from, to }
}

/**
 * Escape a string for safe interpolation into an HTML document.
 *
 * Handles the five characters that have meaning in HTML: `&`, `<`,
 * `>`, `"`, `'`. The function is deliberately small and local to
 * the email adapter; a full library is not needed for a flat
 * lead-summary table.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Escape a value that may be undefined / null into a safe display
 *  string. Empty values render as `—` (em dash) so the table never
 *  shows literal `undefined` / `null`. */
function escapeDisplay(value: string | undefined | null): string {
  if (value === undefined || value === null || value === '') return '—'
  return escapeHtml(value)
}

/** Render the lead as a plain-text email body. No escaping is needed. */
function renderText(lead: LeadDeliveryInput['lead']): string {
  const lines: string[] = []
  lines.push('New lead from the contact form')
  lines.push('')
  lines.push(`Name: ${lead.name || '—'}`)
  lines.push(`Email: ${lead.email || '—'}`)
  lines.push(`Phone: ${lead.phone || '—'}`)
  lines.push('')
  lines.push('Message:')
  lines.push(lead.message || '—')
  lines.push('')
  lines.push(`Locale: ${lead.locale || '—'}`)
  lines.push(`Source: ${lead.source}`)
  lines.push(`ID: ${lead.id}`)
  lines.push(`Received: ${lead.receivedAt}`)
  return lines.join('\n')
}

/** Render the lead as an HTML email body. Every user-provided value
 *  is HTML-escaped. */
function renderHtml(lead: LeadDeliveryInput['lead']): string {
  const row = (label: string, value: string): string => {
    const safeValue = escapeDisplay(value)
    return `      <tr><th style="text-align:left;padding:4px 8px">${escapeHtml(label)}</th><td style="padding:4px 8px">${safeValue}</td></tr>`
  }
  const message = escapeDisplay(lead.message).replace(/\n/g, '<br>')

  return [
    '<div style="font-family:system-ui,sans-serif;max-width:560px">',
    '  <h2 style="font-size:18px;margin:0 0 12px">New lead from the contact form</h2>',
    '  <table style="border-collapse:collapse;width:100%">',
    row('Name', lead.name),
    row('Email', lead.email),
    row('Phone', lead.phone),
    '    <tr><th style="text-align:left;padding:4px 8px;vertical-align:top">Message</th><td style="padding:4px 8px">',
    `      ${message}`,
    '    </td></tr>',
    row('Locale', lead.locale),
    row('Source', lead.source),
    row('ID', lead.id),
    row('Received', lead.receivedAt),
    '  </table>',
    '</div>',
  ].join('\n')
}

/**
 * Map a Nodemailer error to the adapter's `LeadDeliveryResult`
 * contract. The mapping mirrors the webhook adapter:
 *
 * - `EAUTH*` (any code that starts with `EAUTH`) → `auth` (not retryable)
 * - `ETIMEDOUT` and `EAI_AGAIN` → `transport` (not retryable)
 * - everything else → `transport` (retryable)
 *
 * Nodemailer does not expose a single canonical "is timeout?" check,
 * so the mapping is explicit.
 */
function mapSmtpError(error: unknown): LeadDeliveryResult {
  const code = (error as { code?: string } | null)?.code
  if (typeof code === 'string') {
    if (code.startsWith('EAUTH')) {
      return { ok: false, errorCode: 'auth', retryable: false }
    }
    if (code === 'ETIMEDOUT' || code === 'EAI_AGAIN') {
      return { ok: false, errorCode: 'transport', retryable: false }
    }
  }
  return { ok: false, errorCode: 'transport', retryable: true }
}

export const emailAdapter: LeadDeliveryAdapter = {
  id: 'email',
  async deliver(input: LeadDeliveryInput): Promise<LeadDeliveryResult> {
    const cfg = readSmtpConfig()
    if (!cfg) {
      return { ok: false, errorCode: 'unsupported', retryable: false }
    }

    const { lead } = input
    const subject = `New lead: ${lead.name || 'Contact form submission'}`
    const text = renderText(lead)
    const html = renderHtml(lead)

    // Build mail options. `replyTo` is set only when the lead has a
    // non-empty email — passing `replyTo: ''` to Nodemailer is invalid.
    const mailOptions: nodemailer.SendMailOptions = {
      from: cfg.from,
      to: cfg.to,
      subject,
      text,
      html,
    }
    const replyTo = lead.email.trim()
    if (replyTo) {
      mailOptions.replyTo = replyTo
    }

    let transporter: nodemailer.Transporter | null = null
    try {
      transporter = nodemailer.createTransport({
        host: cfg.host,
        port: cfg.port,
        secure: cfg.secure,
        auth: { user: cfg.user, pass: cfg.pass },
        socketTimeout: SMTP_TIMEOUT_MS,
        connectionTimeout: SMTP_TIMEOUT_MS,
        greetingTimeout: SMTP_TIMEOUT_MS,
      })

      await transporter.sendMail(mailOptions)
      return { ok: true }
    }
    catch (error) {
      return mapSmtpError(error)
    }
    finally {
      // Close the transporter's socket pool so the process can exit
      // cleanly. `close()` is a no-op when the transporter was never
      // created (e.g. when `createTransport` itself throws).
      if (transporter) {
        try {
          transporter.close()
        }
        catch {
          // Closing the pool must never affect the delivery result.
        }
      }
    }
  },
}
