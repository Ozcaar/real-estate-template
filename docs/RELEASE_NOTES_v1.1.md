# Release Notes — v1.1.0

Real Estate Website Template — version 1.1.0.

## Release summary

v1.1.0 is the second stable release of the Real Estate Website
Template. It is **release-ready based on the verifiable checks
documented in this file** (lint, build, static generation, source-level
review, configuration validation, automated tests) and the
documented rebrand workflow.

The headline feature is a real, configurable **lead-capture
pipeline** behind a single Nitro endpoint (`POST /api/contact`) with
four pluggable server-side delivery adapters: `disabled` (the
default), `log` (development), `webhook` (production), and `email`
(production, via SMTP). The visible `/contact` form is driven by
`agency.leads.enabled`, which defaults to `false` in the sample
agency so a rebrand ships the same v1.0 placeholder behavior
until it explicitly opts in.

v1.1.0 also ships a **389-test Vitest suite** (the lead-capture
surface, the agency configuration schema, the pagination
utilities, the WhatsApp link builder, the `PostalAddress` JSON-LD
builder, and the property service) plus the structural changes
needed to host the tests (a `vitest.config.ts`, a `#imports`
stub, an `h3` test helper).

The v1.0.0 release (tag `v1.0.0` on `release/v1.0.0` at
`456284c`) is **not** changed by this release. v1.1.0 is in
development on `feature/lead-capture-v1.1` at HEAD `4e1e42d`
("Expand core utility test coverage"). The release branch for
v1.1.0 will be cut from this commit; the v1.0.0 tag and the
`release/v1.0.0` branch are not force-pushed or re-tagged.

The lead-capture work is **configuration-driven, server-only, and
privacy-respecting**. All credentials live in server-only runtime
config (outside the `public:` block) and are never sent to the
client bundle. There is no external storage, no third-party SDK,
no paid service, and no client-side state. A rebrand that does
not need lead capture keeps the v1.0 placeholder behavior and
the contact-methods column remains the canonical completion
path for every deployment target.

## Headline feature: `POST /api/contact`

The contact form on `/contact` posts to a single Nitro endpoint.
The endpoint is implemented in `server/api/contact.post.ts` and
delegates business logic to `server/services/leads/lead.service.ts`.

### Endpoint contract

| Aspect | Behavior |
| --- | --- |
| Method | `POST` only. Other methods return 405 via `assertMethod`. |
| Content type | `application/json` only. Any other type returns 415. |
| Body size | 16 KB hard limit, checked **before** JSON parsing. Larger bodies return 413. |
| JSON parse | Malformed bodies return 400 with an empty `issues` array (the schema re-runs as a safety net). |
| Honeypot | A non-empty `website` field is silently dropped with a 200 response. The bot cannot distinguish the response from a real success. |
| Schema | The shared `leadInputRefined` schema re-runs server-side. Failures return 400 with a populated `issues` array of `{ path, message }` pairs. |
| Rate limit | 5 accepted attempts per 10 minutes per request key (opaque, derived from the request IP and user-agent). The 6th attempt returns 429. Validation failures and honeypot trips do **not** consume the budget. |
| Delivery | The configured adapter (`disabled` / `log` / `webhook` / `email`) receives the stamped lead and returns a `LeadDeliveryResult`. The endpoint maps the result to an HTTP status. |
| Privacy | The endpoint never logs the body. The lead service does not store the IP or user-agent. The configured delivery adapter receives only the stamped lead (no IP, no user-agent, no cookies). |
| Response shape | Always JSON. The 8 transport responses are documented in `docs/DATA_MODELS.md` §5.6 and `docs/REBRANDING.md` §12.9. |

### Eight transport responses

| Status | When | Body |
| --- | --- | --- |
| 200 | Successful delivery (with the lead `id`) | `{ ok: true, id }` |
| 200 | Honeypot silent success (no `id`) | `{ ok: true }` |
| 400 | Malformed JSON or schema validation failure | `{ ok: false, error: 'validation', issues }` |
| 413 | Body larger than 16 KB | `{ ok: false, error: 'payload_too_large' }` |
| 415 | Content-Type is not `application/json` | `{ ok: false, error: 'unsupported_media_type' }` |
| 429 | Rate limit exceeded | `{ ok: false, error: 'rate_limited' }` |
| 502 | Adapter delivery failure (any `errorCode` other than `disabled`) | `{ ok: false, error: 'delivery' }` |
| 503 | Adapter is `disabled` | `{ ok: false, error: 'adapter_disabled' }` |

Provider details, webhook URLs, secrets, SMTP error codes, and
stack traces are **never** exposed to the client.

## Four pluggable delivery adapters

The active adapter is selected at request time by
`runtimeConfig.leadsAdapter` (sourced from
`NUXT_LEADS_ADAPTER`). The default is `'disabled'`. A fresh
deployment that has not configured a lead destination returns
503 on every submission rather than silently dropping leads. An
agency that wants live lead capture sets the env var to one of:

### `disabled` (default)

Returns `{ ok: false, errorCode: 'disabled' }` for every
submission. The endpoint maps this to a 503 with
`{ ok: false, error: 'adapter_disabled' }`. Used when the
runtime adapter is unset, when `NUXT_LEADS_ADAPTER` is empty,
when the value is unknown, or when the agency has not opted
in. No outbound request, no local write, no console output.

### `log`

Writes a **single** `console.info` line per accepted lead.
The line carries only the lead `id`, the `source`, the
field-presence booleans, and the message length. It **never**
logs name, email, phone, message content, cookies, raw IP, or
user-agent. The smallest adapter that works without an
external service. Useful in development and in production
where the agency wants the contact form to be live but has not
yet wired a real destination.

### `webhook`

POSTs the stamped lead as JSON to `NUXT_LEADS_WEBHOOK_URL`
with:

- `content-type: application/json`
- `x-lead-signature: sha256=<hex>` over the exact JSON
  payload, computed with `NUXT_LEADS_WEBHOOK_SECRET` (HMAC
  SHA-256)
- 5-second `AbortController` timeout
- `redirect: 'manual'` (a 3xx response is treated as a
  delivery failure, not a silent redirect)

The agency-side endpoint must verify the signature with the
shared secret using a constant-time comparison. The exact
pseudocode is in `docs/REBRANDING.md` §12.3.

Failure mapping:

| Upstream / failure | Adapter result | Endpoint status |
| --- | --- | --- |
| 2xx response | `{ ok: true }` | 200 |
| 401 or 403 from upstream | `{ ok: false, errorCode: 'auth', retryable: false }` | 502 |
| Other non-2xx (500, 502, 503, 3xx, …) | `{ ok: false, errorCode: 'transport', retryable: true }` | 502 |
| `fetch` network error / DNS failure | `{ ok: false, errorCode: 'transport', retryable: true }` | 502 |
| 5-second `AbortController` timeout | `{ ok: false, errorCode: 'transport', retryable: false }` | 502 |
| Missing URL or missing secret | `{ ok: false, errorCode: 'unsupported', retryable: false }` | 502 |

### `email`

Sends the stamped lead as a plain-text and HTML email
through any SMTP server (Mailgun, Postmark, Amazon SES,
Gmail with an app password, a self-hosted Postfix, etc.) via
Nodemailer. The agency configures 7 env vars; the
adapter validates every one before creating the transporter:

| Env var | Required | Purpose |
| --- | --- | --- |
| `NUXT_LEADS_SMTP_HOST` | yes | SMTP server hostname |
| `NUXT_LEADS_SMTP_PORT` | yes | SMTP server port (e.g. `587`, `465`, `25`) |
| `NUXT_LEADS_SMTP_SECURE` | no | Set to the string `"true"` to force TLS. Any other value (including empty) means plaintext SMTP. |
| `NUXT_LEADS_SMTP_USER` | yes | SMTP authentication username |
| `NUXT_LEADS_SMTP_PASSWORD` | yes | SMTP authentication password |
| `NUXT_LEADS_EMAIL_FROM` | yes | `From:` address shown in the email client |
| `NUXT_LEADS_EMAIL_TO` | yes | `To:` address (where the lead lands) |

The HTML body escapes every user-provided value (`< > & " '`)
so a malicious submission cannot inject markup. The lead's
email is set as `replyTo` **only when** the lead has a
non-empty email (an empty `replyTo` would cause Nodemailer to
reject the send). Nodemailer's `socketTimeout`,
`connectionTimeout`, and `greetingTimeout` are all set to 5
seconds.

SMTP error → delivery result mapping:

| Nodemailer `error.code` | Adapter result | Endpoint status |
| --- | --- | --- |
| (success) | `{ ok: true }` | 200 |
| `EAUTH` / `EAUTHENTICATION` | `{ ok: false, errorCode: 'auth', retryable: false }` | 502 |
| `ETIMEDOUT` / `EAI_AGAIN` | `{ ok: false, errorCode: 'transport', retryable: false }` | 502 |
| (no code, or other) | `{ ok: false, errorCode: 'transport', retryable: true }` | 502 |
| (missing required config) | `{ ok: false, errorCode: 'unsupported', retryable: false }` | 502 |

**Privacy.** The adapter never logs the password, the full
lead body, or the upstream SMTP error body. The only lead
field that appears in any log line is the lead `id`. SMTP-level
errors surface as the short `errorCode` and `retryable` flag
in the result; the client never sees the raw SMTP error
message.

**No persistence.** The adapter does not store leads to
disk, to `useStorage()`, or to any external sink the agency
did not configure. The SMTP server is the only destination.

## Configurable lead form

The visible `/contact` form is rendered by
`app/features/leads/components/LeadForm.vue`. The form is
**driven by `agency.leads.enabled`**, not by the runtime
adapter configuration.

### When `leads.enabled === false` (default)

The form keeps the v1.0 placeholder behavior: a visible
`contact.form.placeholderNotice` explaining that submission is
not enabled, and a permanently `disabled` submit button. The
contact-methods column (tel / mailto / WhatsApp / address /
business hours) is always rendered and is the canonical
completion path. The form is **still in the static export**;
it is just not submittable.

### When `leads.enabled === true`

The form is fully interactive and posts to `POST /api/contact`.
The state machine is five mutually exclusive states:
`idle ? submitting ? success | validation | error`. Each
field is labeled by an explicit `<label :for>` and, when
invalid, an additional `aria-describedby` points to the
field-level error `<p>`. The honeypot is `aria-hidden`,
`tabindex="-1"`, and `autocomplete="off"` so a real user
never reaches it. The submit button is keyboard-operable and
is `disabled` only while submitting or when lead capture is
disabled. Field-level errors are translated via stable
`contact.form.errors.*` keys (`name_too_short`,
`name_too_long`, `email_too_long`, `email_invalid`,
`phone_too_long`, `phone_invalid`, `message_too_short`,
`message_too_long`, `contact_channel_required`,
`locale_invalid`, `honeypot`).

## Validation, honeypot, rate limiting, and privacy behavior

The lead service (`server/services/leads/lead.service.ts`)
implements the pipeline. The transport-level guards
(method, content type, body size, JSON parse) live in the
endpoint. The pipeline:

1. **Honeypot check.** A non-empty `website` field returns a
   generic 200 success without delivering or logging anything.
   The bot detection is deliberately silent so the request
   looks indistinguishable from a real accepted submission.
   Validation failures and honeypot trips do **not** consume
   the rate-limit budget.
2. **Schema validation.** The shared `leadInputRefined`
   schema re-runs server-side. A failed parse returns the
   issues mapped to field paths. Field rules:
   - `name` — required, 2–120 trimmed characters
   - `email` — optional, but if present must be a valid
     email and at most 254 trimmed characters
   - `phone` — optional, permissive formatting, 6–32
     characters when present (accepts digits, spaces, dashes,
     parentheses, and a leading `+`)
   - `message` — required, 10–4000 trimmed characters
   - `website` — honeypot, the server accepts only an empty
     string
   - `locale` — optional, 2–12 characters
   - **Cross-field rule:** at least one of `email` or `phone`
     must be non-empty (a real lead has at least one contact
     channel)
3. **Per-process rate limit.** **5 accepted attempts per 10
   minutes per request key.** The key is opaque — derived
   from the request IP (honoring `x-forwarded-for` when
   behind a trusted proxy) and the `user-agent` header
   (truncated to 200 chars to bound the key size). The
   limit is in-memory and **per process**. A multi-process
   deployment (PM2 cluster, Cloudflare Workers isolates)
   shares no state between instances; a determined attacker
   can multiply their effective rate by the number of
   processes. The limit is a defense-in-depth layer for the
   MVP, not a guarantee.
4. **Stamp the lead.** Server-only fields (`id` is a UUIDv4
   via `crypto.randomUUID`, `receivedAt` is an ISO 8601
   string, `source` is `'contact'`) are added here. The raw
   IP and user-agent never reach the adapter.
5. **Delivery.** The configured adapter receives the stamped
   lead and returns a `LeadDeliveryResult`. The result is
   mapped to a transport status that the endpoint turns into
   an HTTP response.

**Privacy stance.** The endpoint does not persist leads. The
configured delivery adapter is the only place that sees the
stamped lead shape, and the stamped shape carries no IP, no
user-agent, and no cookies. The `log` adapter writes no PII;
the `webhook` adapter sends the stamped lead to the
agency-side endpoint under the agency's own retention policy;
the `email` adapter sends the stamped lead to the agency's
SMTP server (and only to the server — no local copy) under
the agency's own retention policy. SMTP credentials and the
full lead body are never logged by the `email` adapter.
The template makes no claim of GDPR, CCPA, or LFPDPPP
compliance. A rebrand that requires a privacy policy, a
consent checkbox, or a data-subject-access flow should add
those on top of the shipped pipeline. The end-to-end audit
of retention, export, and deletion is the agency's
responsibility, not the template's.

## 389-test Vitest suite

The v1.1.0 release ships a permanent Vitest foundation that
covers the pure-function / branch-rich surface end-to-end
across 13 test files and 389 test cases. The configuration
lives in `vitest.config.ts`; the `#imports` alias resolves to
a tiny stub at `tests/stubs/imports.ts` so the adapter
pipeline can be exercised without booting a Nitro server.

### Per-file breakdown

| Test file | Cases | What it covers |
| --- | --- | --- |
| `app/features/leads/schemas/lead.schema.test.ts` | 37 | Every `leadInputSchema` field rule (name 2–120, email 0–254, phone 6–32, message 10–4000, honeypot, locale 2–12, trim, cross-field contact-channel) |
| `app/features/properties/services/properties.service.test.ts` | 72 | `isPropertySort` allow-list, `getAll` / `getBySlug` / `getFeatured` / `getRelated` branches, `filter` for every operation, every type, location (case-insensitive, accent-insensitive on `México` / `Querétaro`, slugified haystack), every sort branch, the asc/desc mirror invariant, the stable `id` tiebreak, hidden-property exclusion |
| `app/core/utils/paginate.test.ts` | 43 | `parsePageParam` (null, undefined, `''`, whitespace, `'0'`, `'-3'`, `'abc'`, `'1.9'`, `'1e2'`, single-digit, exponential, trimmed, scalar non-string, empty array, array-with-undefined-first, multi-value array, decimal-in-array) and `paginate` on empty / single-item / underfilled / exact-fit / oversized lists, the pageSize coercion of `0` / negative / fractional, the request clamping of negative / zero / out-of-range / `NaN` / fractional, the input-immutability guarantee, the `readonly T[]` overload |
| `app/core/utils/whatsapp-link.test.ts` | 21 | `buildWhatsAppLink` (null, undefined, `''`, whitespace, no-digits, leading `+` strip, spaces, dashes, parentheses, dots, mixed-alphanumeric digit extraction, single / two-digit numbers, E.164 max length, oversized numbers, exact-prefix invariant) |
| `app/core/utils/postal-address.test.ts` | 18 | `agencyPostalAddress` (legacy / unmigrated, every partial-fields branch, full PostalAddress, `@type` invariant, whitespace-padded values, undefined-field omission, fallback to free-text) |
| `app/config/agencies/agency.schema.test.ts` | 73 | `measurementUnitSchema`, `agencyStructuredAddressSchema`, `agencyContactConfigSchema`, `agencySocialConfigSchema` (documents the no-`min(1)` contract), `agencyModulesConfigSchema`, `agencyLeadsConfigSchema`, the top-level `agencyConfigSchema` (id / name / logo / favicon / theme / locales / currency / measurement-unit rules), `validateAgencyConfig` (structural + cross-config + format warnings including the documented "default agency" case), `safeParseAgencyConfig` (structural failure, cross-config failure × 3 branches, non-object input × 5 types), `console.warn` isolation |
| `server/api/contact.post.test.ts` | 16 | Endpoint transport guards: valid submission, forwarded body / request key / fallback locale, 415 for missing / wrong Content-Type, 413 for body > 16 KB including the 16 KB + 1 byte boundary, 400 for empty / malformed JSON, 400 for schema validation with mapped issues, 200 silent success for honeypot, 429 for rate-limited, 503 for adapter-disabled, 502 for delivery failure, content-type header on every response |
| `server/services/leads/adapters/disabled.test.ts` | 3 | `disabledAdapter` id, errorCode, no-throw on empty lead |
| `server/services/leads/adapters/log.test.ts` | 9 | `logAdapter` id, `ok:true`, one `console.info` per lead, exact log line shape, **no PII** in the log line, field-presence fallbacks |
| `server/services/leads/adapters/webhook.test.ts` | 18 | `webhookAdapter` id, upstream 200 / 401 / 403 / 500 / 502 / 503 / 3xx / network error / AbortError, missing URL / secret / both, exact JSON payload, `content-type: application/json` header, `X-Lead-Signature: sha256=<64-hex>` header (verified by recomputing HMAC SHA-256 of the mock-received body), `redirect: 'manual'`, `AbortSignal` for the 5-second timeout |
| `server/services/leads/adapters/email.test.ts` | 35 | `emailAdapter` id, config validation (missing host / port / user / password / from / to, non-integer port, all-missing), successful delivery, plain-text + HTML body content, `replyTo` present when email is set / absent when empty, HTML escaping (`< > & " '`), em-dash placeholder for empty fields, newline → `<br>`, error mapping (`EAUTH` / `EAUTHENTICATION` → `auth`, `ETIMEDOUT` / `EAI_AGAIN` → `transport` retryable:false, `ECONNECTION` → `transport` retryable:true, no-code / non-Error throw → `transport` retryable:true), transporter lifecycle (close after success, close after failure, swallow close errors). **Nodemailer is fully mocked** — no real SMTP connection is ever opened. |
| `server/services/leads/adapters/index.test.ts` | 10 | Registry exports, selection by `NUXT_LEADS_ADAPTER` id (`disabled` / `log` / `webhook` / `email`), missing / unknown / whitespace ids, default fallback to `disabled` |
| `server/services/leads/lead.service.test.ts` | 33 | Full pipeline: honeypot silent path (no adapter call), schema validation mapping, rate limit (5-per-window cap, 6th blocked, validation failures and honeypot trips do not consume the budget, request keys are tracked independently), lead stamping (UUID `id`, ISO `receivedAt`, `source: 'contact'`, forwarded fields, locale fallback), delivery mapping (`ok` / `disabled` / `transport` / `auth` / `rate_limited` / `unsupported`), non-object body rejection (string, null, array), rate-limit window expiry (5 cases using `vi.useFakeTimers()`: window expiry after 10 min, strict greater-than boundary at exactly 10 min, full 5-slot reset after expiry, opportunistic cleanup of stale entries, partial-window timestamp tracking) |
| **Total** | **389** | Across 13 test files. |

Run the tests with:

```bash
pnpm test        # single-shot, CI-friendly (vitest run)
pnpm test:watch  # interactive watch mode (vitest)
```

All 389 tests pass on three consecutive `pnpm test` runs.

### What the Vitest suite does **not** cover (intentionally)

- **A live end-to-end test against a real upstream.** The
  webhook adapter tests use `vi.spyOn(globalThis, 'fetch')`
  to mock the upstream; the agency-side signature
  verification pseudocode in `docs/REBRANDING.md` §12.3 is
  the reference implementation. The email adapter tests use
  `vi.mock('nodemailer', ...)` to replace the entire
  `nodemailer` module; no real SMTP connection is ever
  opened. The test surface is the contract, not the live
  delivery.

## Static-hosting and Nitro-server deployment differences

The template supports two deployment targets. At v1.0.0 both
targets were equivalent in scope (a pure static export
covered every public route). At v1.1.0 the lead-capture
endpoint requires a server-capable Nitro deployment.

### `pnpm generate` — static export

`pnpm generate` produces a static export under
`.output/public/`. The dynamic Nitro routes (`/sitemap.xml`,
`/robots.txt`) are pre-rendered at build time so the static
output includes the SEO infrastructure. `NUXT_PUBLIC_SITE_URL`
must be set at build time when the SEO infrastructure routes
need absolute URLs.

**The static export does NOT include `POST /api/contact`.** An
agency that ships a pure static deploy keeps the v1.0
placeholder form behavior (visible notice + permanently
disabled submit) and the contact-methods column is the
canonical completion path. The visible form is **still
rendered** in the static export — the form is just not
submittable because the endpoint is not present.

This release was verified with
`NUXT_PUBLIC_SITE_URL=https://example.test pnpm generate` on a
Windows development host:

- 171 routes pre-rendered (the 7 public pages, the 6
  property detail pages, the `developments` page, the
  `sitemap.xml` and `robots.txt` Nitro routes, the i18n
  message bundles, and the `_ipx` image variants).
- The static `/contact` page contains the form with
  `disabled` submit, the honeypot field, and the visible
  `contact.form.placeholderNotice`.
- The static export contains zero references to
  `NUXT_LEADS_*` env-var names, zero references to
  `leadsSmtp*` / `leadsWebhook*` / `leadsEmail*` runtime
  config keys, and zero references to `leadsAdapter`.
- `runtimeConfig.public` (the only block that Nitro sends to
  the client bundle) contains exactly one field: `siteUrl`.

The verification was performed on a Windows development host.
Provider-specific deployment (Vercel, Netlify, Cloudflare
Pages, etc.) is **not** validated by this build. A rebrand
deploying to a specific provider must validate the
provider's deployment behavior separately.

### `pnpm build` — Nitro server build

`pnpm build` produces a Nitro server build under
`.output/server/`. The same dynamic SEO routes are served
at request time, gated by the same env var. The
`POST /api/contact` endpoint is reachable at
`/api/contact` in this target. Use this target (or any
serverless preset that ships a Nitro server runtime — Cloudflare
Workers, Vercel, Netlify) when the agency wants live lead
capture.

An agency that ships `pnpm build` and does not configure
`NUXT_LEADS_ADAPTER` keeps the v1.0 placeholder behavior: the
visible form is the same (because `leads.enabled` is `false`),
and the endpoint (if hit directly) returns 503. The form's
default `disabled` state is enforced by the
`leads.enabled` flag, not by the adapter, so the two
configuration axes (`leads.enabled` and `NUXT_LEADS_ADAPTER`)
can be set independently.

## Privacy and configuration summary

| Concern | How v1.1.0 addresses it |
| --- | --- |
| Where are SMTP / webhook credentials? | In server-only runtime config (`runtimeConfig.leadsSmtp*` / `leadsWebhook*` / `leadsEmail*`). They live outside the `public:` block in `nuxt.config.ts` and are never sent to the client bundle. |
| Where is the active adapter selected? | At request time by `runtimeConfig.leadsAdapter` (sourced from `NUXT_LEADS_ADAPTER`). The default is `'disabled'`. |
| What does the form log? | Nothing. The form is a Vue SFC and does not emit any log line. |
| What does the endpoint log? | The body is never logged. The rate-limit key is derived from the IP and user-agent; the key never leaves the server. |
| What does the `log` adapter log? | A single `console.info` line per accepted lead, with **no name, email, phone, message content, IP, or user-agent**. Only the lead `id`, `source`, field-presence booleans, and message length. |
| What does the `webhook` adapter log? | The upstream response body is logged server-side at `warn` for debugging; the client never sees it. |
| What does the `email` adapter log? | The adapter never logs the password, the full lead body, or the upstream SMTP error body. The only lead field that appears in any log line is the lead `id`. |
| What does the stamped lead contain? | `id` (UUIDv4), `receivedAt` (ISO 8601), `source: 'contact'`, `name`, `email`, `phone`, `message`, `locale`. **No IP, no user-agent, no cookies, no referer.** |
| Is there a honeypot? | Yes. The `website` field is hidden from real users (`aria-hidden`, `tabindex="-1"`, `autocomplete="off"`). A non-empty value at the server is silently dropped with a generic 200 response. |
| Is there a rate limit? | Yes. 5 accepted attempts per 10 minutes per request key, in-memory `Map`, opportunistic cleanup. Per-process, not distributed. |
| Is there a body size limit? | Yes. 16 KB, checked before any JSON parsing. A body larger than 16 KB returns 413. |
| Is the lead persisted? | No. The configured delivery adapter is the only place that sees the stamped lead shape. No local file, no `useStorage()`, no external database, no third-party SDK. |
| Does the agency need a consent checkbox? | The template ships without one. GDPR / CCPA / LFPDPPP compliance is the agency's responsibility; add a consent checkbox on top of the shipped pipeline if needed. |

## v1.0.0 → v1.1.0 change summary

| Area | v1.0.0 | v1.1.0 |
| --- | --- | --- |
| Lead capture | Documented placeholder form (visible `placeholderNotice`, permanently `disabled` submit) on `/contact`. Contact-methods column is the canonical completion path. | Real `POST /api/contact` Nitro endpoint with 4 pluggable adapters (`disabled` / `log` / `webhook` / `email`). Visible form is **driven by `agency.leads.enabled`** (default `false` in the sample agency so a rebrand ships the same v1.0 behavior). 16 KB body limit, honeypot, 5-per-10-min per-process rate limit, 8 transport responses, privacy-respecting log/email/webhook adapters. |
| Test surface | No test runner. | Vitest 4.1.10, 13 test files, 389 test cases. Lead-capture surface (Zod schema, 4 delivery adapters, adapter selector, lead service, endpoint transport, rate-limit window expiry). Property service (filter / sort / isPropertySort / getAll / getBySlug / getFeatured / getRelated). Core utilities (`paginate` / `parsePageParam`, `buildWhatsAppLink`, `agencyPostalAddress`). Agency configuration schema (structural + cross-config + format warnings). |
| New dependencies | (none beyond the v1.0.0 stack) | `nodemailer@9.0.3` (runtime, for the email adapter), `vitest@4.1.10` (devDependency), `h3@1.15.11` (devDependency, for endpoint tests), `@types/nodemailer@8.0.1` (devDependency). |
| New runtime config | (none) | `leadsAdapter`, `leadsWebhookUrl`, `leadsWebhookSecret`, `leadsSmtpHost`, `leadsSmtpPort`, `leadsSmtpSecure`, `leadsSmtpUser`, `leadsSmtpPassword`, `leadsEmailFrom`, `leadsEmailTo`. All in server-only runtime config (outside the `public:` block). |
| New i18n keys | (n/a) | 19 new `contact.form.*` keys (`title`, `description`, `nameLabel`, `namePlaceholder`, `emailLabel`, `emailPlaceholder`, `phoneLabel`, `phonePlaceholder`, `messageLabel`, `messagePlaceholder`, `submit`, `placeholderNotice`, `honeypotLabel`, `success`, `error`, plus 11 `errors.*` codes). Identical key structure in `en.json` and `es.json`. |
| Deployment targets | Static and Nitro-server equivalent. | `pnpm generate` (static) keeps the v1.0 placeholder behavior; `pnpm build` (Nitro server) is required for live lead capture. |
| `app/features/leads/` | (empty `.gitkeep`) | Full module: `types/lead.types.ts`, `schemas/lead.schema.ts`, `components/LeadForm.vue`. |
| `server/services/leads/` | (absent) | Full module: `delivery-adapter.ts`, `lead.service.ts`, `adapters/{disabled,log,webhook,email,index}.ts`. |
| `server/api/contact.post.ts` | (absent) | New endpoint, 145 lines, 4 transport guards + delegation to `leadService.submit`. |
| `vitest.config.ts` | (absent) | New, Node environment, 13 test patterns, `#imports` alias to `tests/stubs/imports.ts`. |
| `tests/` | (absent) | `tests/stubs/imports.ts` (the `#imports` stub), `tests/helpers/h3-event.ts` (the H3Event mock builder for the endpoint tests). |
| `pnpm test` script | (absent) | New `pnpm test` (single-shot, `vitest run`) and `pnpm test:watch` (interactive) scripts. |
| `docs/DATA_MODELS.md` | §5 listed lead capture as "planned". | §5 is now "shipped (Task 080 / M26) + extended (Task 087 / M5)": every field rule, the stamped shape, the honeypot, the 8 transport responses, the per-adapter behavior, the per-adapter test count. §6 includes the `AgencyLeadsConfig` interface and the `leads` field on `AgencyConfig`. |
| `docs/REBRANDING.md` | Lead capture listed as "real lead capture" in the deferred table. | §12 is the canonical rebrand section: form interactivity, server-only runtime config, webhook signature, SMTP adapter, deployment requirements, no-JS / failed-delivery fallback, privacy stance, rebrand checklist, troubleshooting, endpoint transport behavior, automated tests. |
| `docs/ROADMAP.md` | v1.1.0 listed as "in development" with v1.0.0-M0/M1 milestones. | v1.1.0 has 7 shipped milestones (M0 — audit, M1 — build + post-merge, M2 — Vitest foundation, M3 — doc parity, M4 — endpoint + rate-limit tests, M5 — SMTP email adapter, M6 — broader-repo coverage). Section 5 identifies Task 089 (release preparation) as the active task. |
| Milestone-divergence note | Documented in `RELEASE_NOTES_v1.0.md` as a future merge-time consideration. | Reconciled: v1.0.0 was merged into `feature/lead-capture-v1.1` (commit `443890b`); the lead-capture branch's pre-merge M25 / M26 entries were renumbered to v1.1.0 M0 / M1. The release branch's M25 / M26 entries remain on `release/v1.0.0` as part of the v1.0.0 release. |

## Validated configurations (rebrand verification)

The v1.1.0 release candidate was verified end-to-end as
part of Task 089 with the same two-agency rebrand path used
for v1.0.0:

| Axis | v1.1.0 verification |
| --- | --- |
| Lead-capture disabled by default | `app/config/agencies/default.agency.ts` ships with `leads.enabled: false`. A fresh deployment that has not set `NUXT_LEADS_ADAPTER` and `leads.enabled` ships the v1.0 placeholder behavior — verified by the static export rendering the disabled form, the placeholder notice, and the contact methods column. |
| Private webhook / SMTP configuration is not in the client bundle | The static `.output/public/` contains zero references to `NUXT_LEADS_*` env-var names, zero references to `leadsSmtp*` / `leadsWebhook*` / `leadsEmail*` runtime config keys, and zero references to `leadsAdapter`. `runtimeConfig.public` (the only block that Nitro sends to the client) contains exactly one field: `siteUrl`. |
| Endpoint maps all 8 transport responses | `server/api/contact.post.test.ts` covers all 8: 200 (success), 200 (honeypot), 400 (validation), 413 (oversized), 415 (wrong content type), 429 (rate-limited), 502 (delivery failure), 503 (adapter disabled). |
| Honeypot is silent | A non-empty `website` field returns a generic 200 success with no `id` field; the bot cannot distinguish the response from a real success. Verified by `lead.service.test.ts` and `contact.post.test.ts`. |
| Rate limit is per-process | Documented as a per-process `Map`-based limiter; the rate-limit window expiry is exercised with `vi.useFakeTimers()`. A rebrand that needs a distributed limiter can move it to a Nitro storage driver in a future v1.x task. |
| Static export works | `NUXT_PUBLIC_SITE_URL=https://example.test pnpm generate` prerendered 171 routes on the development host. The static `/contact` page contains the form with `disabled` submit, the honeypot field, and the placeholder notice. |
| Nitro server build works | `pnpm build` completes successfully; the endpoint is reachable at `POST /api/contact` in the resulting `.output/server/index.mjs`. |
| `pnpm lint` is clean | 0 errors, 0 warnings. |
| `pnpm test` is green | 389 tests pass on three consecutive runs. |
| `pnpm build` succeeds | Build complete; the only warning is the documented unrelated `@nuxt/image` Windows `sharp` warning (non-fatal). |
| `git diff --check` is clean | No whitespace issues. |

## Known limitations (intentional, deferred from v1.1.0)

The following items are **not** in the v1.1.0 release. They
are documented here as the canonical "what is not in v1.1.0"
list. A future v1.x patch or a v2 release can add them; none
are required for v1.1.0.

| Limitation | Reason | Where |
| --- | --- | --- |
| **Distributed rate limiter** (Redis / Nitro storage / Cloudflare KV) | The shipped rate limiter is a per-process `Map`. A multi-process deployment (PM2 cluster, Cloudflare Workers isolates) shares no state between instances; a determined attacker can multiply their effective rate by the number of processes. The per-process limiter is a defense-in-depth layer for the MVP, not a guarantee. | Deferred to v1.x or v2; no client-facing impact. |
| **Property-specific inquiry form** (a per-property contact form on `/properties/[slug]`) | The v1.0/v1.1 property detail page uses a "Contact" card linking to `/contact` and a `tel:` link. A per-property form is a deliberate future task. | v1.x+ |
| **Per-development detail page** (`/developments/[slug]`) | The `Development.slug` field is reserved. | v1.x+ |
| **Per-agent detail page** (`/agents/[slug]`) | The `Agent.id` field is reserved. | v1.x+ |
| **Fullscreen property-gallery lightbox** (with focus trap, body-scroll lock, Escape handler, backdrop click) | Intentionally deferred from v1.0 (M20 / M21). The Swiper carousel covers the three real gaps (mobile swipe, keyboard nav, desktop prev/next). A real-estate user wanting a larger view can use the browser's built-in image controls on the current main image. | v1.x+ |
| **Real API or CMS integration** | The Zod-validated static data is the v1.1.0 contract. The `propertiesService`, `agents`, and `developments` modules are the runtime boundary. A CMS, REST API, or external image source is a deliberate future task. | v1.x+ |
| **Playwright smoke tests + CI** | No browser runner, no GitHub Actions workflow, no `.gitlab-ci.yml`. The Vitest unit-test foundation covers the pure-function / branch-rich surface. | v1.x+ |
| **Browser accessibility certification (axe, Lighthouse, NVDA, VoiceOver)** | The v1.0 accessibility was reviewed at the source level (M22 / Task 076). A real browser pass is post-v1.0. | v1.x+ |
| **GDPR / CCPA / LFPDPPP compliance** | The template makes no claim of compliance. A rebrand that requires a privacy policy, a consent checkbox, or a data-subject-access flow should add those on top of the shipped pipeline. | v1.x+ |
| **Dark mode** | The token system supports it via `[data-theme='dark']`; the implementation is post-v1.0. | v1.x+ |
| **Multi-tenant deployment** | `useSiteConfig` is `useState`-backed and supports the future pattern. | v1.x+ |

## Known Windows `sharp` warning

On Windows, `pnpm build` may emit a pre-existing
`@nuxt/image` warning similar to:

```text
[@nuxt/image] WARN sharp binaries for win32-x64 cannot be found.
```

This warning is currently **non-fatal**: the build completes
successfully, the generated site renders correctly, and the
template ships with SVG placeholder images that do not require
`sharp`. A rebrand that replaces the placeholders with raster
images (`webp`, `jpg`, `avif`) may want `sharp` to be installed
to allow on-the-fly resizing.

If a rebrand wants to silence the warning, run
`pnpm rebuild sharp` (or `pnpm install --shamefully-hoist` if
the postinstall script does not pick the platform-specific
binary automatically). This is a troubleshooting step, not a
fix to the template.

## Migration from v1.0.0

A v1.0.0 deployment that does not want lead capture at
v1.1.0:

- No code changes required. The form keeps the v1.0
  placeholder behavior because `leads.enabled` is `false` in
  the sample agency.
- The static export behavior is unchanged. `pnpm generate`
  still works and the static `/contact` page still contains
  the form with `disabled` submit and the placeholder notice.
- The Nitro server build behavior is unchanged for the
  visible form. The `POST /api/contact` endpoint is new and
  returns 503 by default; it is reachable only when the
  agency has configured an adapter and flipped
  `leads.enabled`.

A v1.0.0 deployment that wants live lead capture at v1.1.0:

1. Upgrade to the v1.1.0 codebase.
2. Set `leads.enabled: true` in
   `app/config/agencies/<your-agency>.agency.ts`.
3. Set `NUXT_LEADS_ADAPTER` in the deploy environment
   (`disabled`, `log`, `webhook`, or `email`).
4. For `webhook`, set `NUXT_LEADS_WEBHOOK_URL` to a URL the
   agency controls (a Cloudflare Worker, a Make / Zapier /
   n8n hook, or the agency's own server) and
   `NUXT_LEADS_WEBHOOK_SECRET` to a random 32+ character
   string. The agency-side endpoint must verify the
   `X-Lead-Signature` header.
5. For `email`, set `NUXT_LEADS_SMTP_HOST`,
   `NUXT_LEADS_SMTP_PORT`, `NUXT_LEADS_SMTP_USER`,
   `NUXT_LEADS_SMTP_PASSWORD`, `NUXT_LEADS_EMAIL_FROM`, and
   `NUXT_LEADS_EMAIL_TO` (plus `NUXT_LEADS_SMTP_SECURE` if
   the server requires TLS). The adapter creates a Nodemailer
   transporter, sends a plain-text + HTML email, and closes
   the socket pool.
6. Switch the deploy target to `pnpm build` (or a
   serverless preset that ships a Nitro server runtime). A
   pure static `pnpm generate` deployment cannot serve
   `/api/contact`.
7. Confirm the contact methods column is correct for the
   agency. It remains the no-JS and failed-delivery fallback.
8. If the agency needs a privacy policy, consent checkbox,
   or data retention schedule, add it on top of the shipped
   pipeline.

## What the v1.1.0 release does **not** claim

- **Browser-level accessibility.** No browser, no axe, no
  NVDA / VoiceOver. The v1.0 accessibility was reviewed at
  the source level (M22 / Task 076). A real browser pass
  with axe / Lighthouse / NVDA / VoiceOver is post-v1.0.
- **Runtime performance.** No Lighthouse, no WebPageTest, no
  production-network measurement. The `pnpm build` and
  `pnpm generate` outputs are size counts only.
- **Provider-specific deployment.** The static generation
  was performed with
  `NUXT_PUBLIC_SITE_URL=https://example.test pnpm generate`
  on a Windows development host. Vercel, Netlify, Cloudflare
  Pages, and other static hosts are **not** validated by
  this build. A rebrand deploying to a specific provider
  must validate the provider's deployment behavior
  separately. Likewise, the Nitro server build was validated
  against the `node-server` preset; serverless presets are
  documented as compatible but are not exercised in CI.
- **CI.** No continuous integration is configured. The
  Vitest suite is runnable locally via `pnpm test`; a CI
  integration is a deliberate future task.
- **GDPR / CCPA / LFPDPPP compliance.** The template makes
  no claim of compliance. The privacy stance is documented
  in this file and in `docs/REBRANDING.md` §12.6; the
  end-to-end audit of retention, export, and deletion is
  the agency's responsibility.
- **Cross-config Zod validation** is exercised but the
  **second-agency file is not added to a CI matrix**; the
  rebrand verification is a one-time execution during the
  v1.1.0 release-candidate preparation.
- **Live webhook / SMTP testing.** The Vitest suite mocks
  `globalThis.fetch` (webhook) and the entire `nodemailer`
  module (email). No real HTTP request is ever made and no
  real SMTP connection is ever opened. A rebrand that wires
  a real destination must validate the destination
  end-to-end separately.

## Release artifacts

- **Tag:** `v1.1.0` (to be cut on the release branch at the
  current `feature/lead-capture-v1.1` HEAD, commit `4e1e42d`).
- **Release branch:** `release/v1.1.0` (to be cut from
  `feature/lead-capture-v1.1` after the v1.1.0 final-correction
  commit).
- **HEAD at the time of writing:** `4e1e42d` ("Expand core
  utility test coverage") on `feature/lead-capture-v1.1`.
- **Working tree at the time of writing:** clean (the M6
  coverage expansion is committed; the v1.1.0 release notes
  and any release-blocking fixes are uncommitted in the
  working tree as part of Task 089).
- **The `v1.0.0` tag and the `release/v1.0.0` branch are not
  changed by this release.** They are not force-pushed, not
  re-tagged, and not rebased.
