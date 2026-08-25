# Client Onboarding Guide

This is the practical checklist used **before** starting a real-agency implementation. It exists to collect the agency information and access responsibilities the implementer needs to deliver a working deployment, and to separate what must be true before development can begin from what must be true before the production deploy can go live.

The guide pairs with:

- `docs/REBRANDING.md` — the rebranding workflow for the technical implementation (every agency field, every data file, every placeholder asset).
- `docs/DEPLOYMENT.md` — the operational procedure for the production deploy (env-var lifecycle, static vs Node/Nitro, post-deploy smoke checks, rollback).
- `docs/MULTI_TENANT.md` — multi-tenant deployment guidance (only relevant when more than one agency is hosted behind a single build).

This guide does not duplicate either of those. It is the upstream "what to collect from the client" checklist that feeds them.

## 1. Who this guide is for

- **The implementation lead** collecting requirements from a real agency before any code or content changes.
- **The agency owner** confirming what the implementer needs before development starts, and what the agency is responsible for handing over at the end of the implementation.
- **The deployment operator** confirming what production-side ownership (DNS, hosting, lead delivery, monitoring) the agency must keep alive after the deliverable is shipped.

The guide is **provider-agnostic**. It does not assume a specific hosting platform, DNS provider, email provider, CRM, or analytics vendor. The implementer picks the platforms with the agency; the checklist captures the inputs that any platform will need.

## 2. Information required from a first client

The information is grouped into three piles: **required before development**, **required before production**, and **optional enhancements**. The implementer can build and iterate on the rebrand with only the first pile; the second pile is the production go-live gate. The third pile is a backlog of post-launch improvements.

### 2.1 Required before development

The implementer cannot start meaningful rebrand work without these. Most of them are agency-controlled (the agency must produce or confirm them); the implementer's job is to make the asks explicit so the client can deliver them upfront.

**Agency identity and contact information.**

- Legal / display name (`agency.name`).
- Optional short marketing slogan (`agency.slogan`).
- Primary phone number with country code (`agency.contact.phone`).
- WhatsApp number (often the same as phone; must include country code for `https://wa.me/` link normalization).
- Primary email address (used by the contact form, the footer, and the JSON-LD `email` field).
- Physical address (free-text for the visible footer + contact card; optional `PostalAddress` companion for the JSON-LD if the agency wants structured data).
- Optional business hours (e.g. `Mon-Fri 9am-5pm`).
- Social links the agency wants surfaced (Facebook, Instagram, LinkedIn, TikTok, YouTube — any subset is fine).
- A unique slug for the agency (`agency.id`, lowercase letters + digits + dashes, used in the multi-tenant registry if applicable).

**Brand colors, fonts, and imagery.**

- **Logo** — vector (`SVG`) preferred, with a fallback PNG. Drop the file at `public/images/logo.svg` (or rename the data file accordingly). The logo is the same file used by the header, the footer, and the OG share fallback.
- **Favicon** — `ICO` or `PNG`, drop at `public/favicon.ico`. Browsers cache aggressively; the implementer instructs the agency to hard-refresh on first load.
- **Theme palette** — primary, secondary, accent, surface, foreground, muted, border, success, warning, error. The agency may already have a brand guide; otherwise the implementer picks a palette and the agency confirms. No hardcoded brand colors are allowed in components — the palette is consumed through CSS variables (`var(--color-*)`).
- **Heading and body font families** — the agency may have a preferred font (e.g. Inter, Lato, a custom serif). Free Google Fonts are acceptable; licensed fonts need to be approved with the agency.
- **Photography** — the agency provides real photos for the 22 placeholder assets (`logo`, `favicon`, hero, about, 4 locations, 6 properties, 4 agents, 4 developments). The full path map is in `docs/REBRANDING.md` §4. The implementer exports them as WebP / AVIF for the best LCP.

**Locale requirements.**

- The default locale (`agency.defaultLocale`, e.g. `'en'`).
- The list of enabled locales (`agency.availableLocales`, e.g. `['en', 'es']`). The template ships English + Spanish; any other locale requires adding a new `i18n/locales/<code>.json` file.
- Per-locale copy review: the agency confirms every active locale is translated and that placeholder strings ("Find your ideal property", "Heading") are replaced.

**Enabled modules.**

- For each module in `agency.modules` (`properties`, `developments`, `agents`, `blog`, `testimonials`, `contact`) the agency confirms it wants the module enabled. The template ships `blog: false` because the blog module is not part of the MVP; the agency is told that flipping `blog: true` does not enable a real blog today.

**Lead destination and preferred delivery adapter.**

- The agency confirms whether live lead capture is in scope for the first deploy. If yes:
  - Preferred delivery adapter (`disabled` / `log` / `webhook` / `email`) — see `docs/REBRANDING.md` §12 for the operational profile of each.
  - If `webhook`: the agency-side endpoint URL (Cloudflare Worker, Make / Zapier / n8n hook, or the agency's own server) and a fresh 32+ character random secret (`NUXT_LEADS_WEBHOOK_SECRET`).
  - If `email`: SMTP credentials (host, port, secure flag, user, password, `From:` address, `To:` address).
- If the agency is not ready to choose an adapter on day one, the deploy ships with the default `disabled` adapter and the contact-methods column is the canonical completion path. The visible form remains the placeholder UI until the agency is ready to flip `leads.enabled: true` together with the env var.

**CMS project (when `DATA_SOURCE=cms` for any feature).**

The current CMS integration is a **generic HTTP/JSON driver** at `app/core/data-source/adapters/http-json-cms-driver.ts`. It fetches a JSON array from a configured endpoint and validates the response against the boundary Zod schema. It is **not** a provider-specific integration: there is no Sanity / Contentful / Strapi driver shipping today, and any provider-specific driver is a future task. A rebrand that needs a CMS picks up the generic driver by exposing a JSON endpoint that returns the agency's catalog in the documented `Property` / `Agent` / `Development` shape.

**Important — the current generic HTTP/JSON driver does not expose an authentication-token configuration.** The `HttpJsonCmsDriverOptions` interface accepts only `endpoint`, `source`, `timeoutMs`, and `fetchImpl`; the production fetch sends only `Accept: application/json` as a header. The endpoint must currently be reachable using the capabilities the generic driver supports — public or IP-allow-listed endpoints without an auth header. A future provider-specific driver (Sanity, Contentful, Strapi) may need server-side credentials (API tokens, signed requests, secrets stored in the platform's secret manager) and will document those requirements at the time the driver ships. CMS secrets must never be exposed to client-side code — the data-source loaders are server-only (`server/utils/properties.ts`, `server/utils/agents.ts`, `server/utils/developments.ts`); the loader's output is the only thing the client bundle sees.

The architecture preserves **one client = one agency = one isolated CMS project / workspace**. Each rebranded deployment owns its own CMS project; CMS projects are not shared across clients and not shared across agencies inside a multi-tenant deployment. The catalog the deliverable serves comes from that project alone. Clients only receive access to their own isolated CMS project.

What must be decided before implementation:

- **CMS provider.** Is the agency providing a CMS that is already callable as a JSON endpoint (e.g. a hosted CMS with a public REST API, a custom API the agency maintains, or a CMS that exposes its content via a webhook-to-JSON adapter)? If the agency wants a headless CMS that requires a provider-specific driver (Sanity, Contentful, Strapi, etc.), the implementer documents that as a future task and continues with the static adapter or the generic HTTP/JSON driver for the first deploy.
- **CMS project / workspace owner.** The agency owns the CMS project. The implementer may provision it during the engagement but transfers ownership before the handoff.
- **Who creates and owns the account.** The account that hosts the CMS project is owned by the agency (or the agency's IT), not by the implementer. The implementer never holds the only-admin access.
- **Client editor / admin access.** The agency decides who in their team can edit content. The implementer does not need an editor account in production; one is granted during development and transferred at the handoff.
- **At least one administrator must remain with the agency after handoff.** The agency must have at least one CMS administrator at all times — the agency is the sole owner of the only-admin access. The implementer releases the admin role at the handoff unless an ongoing maintenance agreement explicitly keeps the operator on the admin role.
- **Developer / admin access after handoff is optional and depends on the maintenance agreement.** When the engagement is project-based, the implementer releases all roles at the handoff. When the agency signs an ongoing-maintenance contract with the operator (the implementer, a third-party operator, or the agency's in-house team), the operator retains a developer or admin role appropriate to the maintenance agreement. The handoff documents who holds which role and on what schedule it is renewed.
- **Image / media ownership.** The agency's photography is uploaded to the CMS project's media store (or the agency provides an external CDN URL). The implementer does not keep copies of the licensed assets on personal accounts.
- **Content migration responsibility.** A first-client CMS migration has two halves: the agency provides the source content (a CSV / spreadsheet / a previous CMS export / handwritten records), and the implementer (or the agency, by contract) is responsible for transforming it into the per-feature Zod schema and uploading it to the new CMS project. The implementer documents the schema and the field-level rules so the agency can take over subsequent migrations.
- **Production vs preview / draft requirements.** The CMS exposes a published / production endpoint and (optionally) a preview / draft endpoint. The generic HTTP/JSON driver points at the production endpoint. Draft preview is a future enhancement (the current driver has no preview-mode toggle).

If the agency is not ready to deliver a CMS project on day one, the deploy ships with the default `static` data source and the implementer starts the CMS project in parallel. The handoff includes the CMS project URL, the production endpoint, and the CMS driver's relevant env vars (`NUXT_PROPERTIES_CMS_URL`, `NUXT_PROPERTIES_CMS_TIMEOUT_MS`, and the same for agents and developments).

### 2.2 Required before production

These are the items the deploy needs before traffic can be pointed at the site. They are the production-readiness checklist in `docs/REBRANDING.md` §16, restated from the agency's perspective.

**Domain / hostname ownership.**

- The hostname the agency will use (e.g. `www.example.com`). The agency owns the domain registration and authorizes the implementer (or the operator) to manage DNS.
- The `www.` redirect preference (canonicalize to apex, or keep `www.`). The implementer configures the redirect at the edge; the template does not ship redirect logic.
- TLS certificate procurement (Let's Encrypt, the platform's managed cert, or the agency's existing cert). The certificate must cover the hostname.

**Deployment ownership.**

- The agency owns the hosting-platform account (or explicitly authorizes the implementer to use a shared account). The implementer confirms the platform, the plan, and the cost-model.
- The agency owns the deployment credentials (or the operator stores them in a shared secret manager). The operator owns the process manager, the port mapping, the restart policy, and the deploy primitive.
- The agency confirms who is responsible for the next deploy (the agency, the implementer, or a third-party operator). The handoff is documented in §4.

**Lead delivery credentials.**

- For `webhook`: the URL is in production, the secret is stored in the platform's secret manager, and the agency-side endpoint verifies the `X-Lead-Signature` header with the same secret.
- For `email`: the SMTP credentials are valid, the `From:` and `To:` addresses are routable, and the receiving inbox is monitored.
- The agency confirms the destination inbox or webhook is owned by the agency (not a personal account) and the retention policy is documented. The template does not persist leads; the destination is the only place that sees the stamped shape.

**Maintenance expectations.**

- Who updates the sample data on a recurring basis (the agency itself, the implementer on a retainer, or a third-party operator)?
- Who owns the lead-delivery credentials rotation (the agency, the implementer, or the operator)?
- Who responds to `pnpm lint` / `pnpm test` failures on a rebrand change (the implementer, the operator)?
- What is the expected response time for a production incident (the example SLA is one business day for a content or config fix, longer for a code change)?

### 2.3 Optional enhancements

The implementer does not need these to ship the first deploy. They are documented so the agency can plan for them after launch.

- **Uptime monitoring** — an external monitor (UptimeRobot, Better Uptime, the platform's check) on the safe GET routes `/` and `/sitemap.xml`. The safe-route smoke checks are in `docs/DEPLOYMENT.md` §10. The template ships no monitor.
- **Analytics** — Plausible, Google Analytics, Fathom, Matomo, or any provider the agency prefers. The template ships zero analytics.
- **Security headers** — CSP, X-Frame-Options, Referrer-Policy, HSTS at the edge or via a Nitro middleware. The static-hash option for the anti-FOUC inline script is documented in `docs/REBRANDING.md` §16.2.
- **Error tracking** — Sentry / GlitchTip / similar wired to the server output. The `log` adapter writes one `console.info` line per lead; the webhook / email adapters write `console.warn` / `console.error` on adapter failures. These are the structured-logging hooks an error tracker consumes most cheaply.
- **Distributed rate limiter** — the lead-capture rate limit is per-process. A multi-process deployment shares no state between instances. The upgrade is a future v1.x task.
- **Pre-commit / pre-push hooks** — Husky / lefthook that runs `pnpm lint && pnpm test` locally. The CI workflow catches the same failures but local hooks catch them at the source.
- **Custom 404 / 500 pages** — the template ships default Nuxt error pages. A custom design is a rebrand add-on.
- **Image optimization** — the template uses `@nuxt/image` for the standard `<ResponsiveImage>` machinery. The Windows `sharp` warning is documented in `docs/REBRANDING.md` §13; a rebrand that targets Windows and raster images may want to install `sharp` to silence the warning and enable on-the-fly resizing.

## 3. First-client implementation sequence

The implementer runs the steps in order. The rebranding and deployment guides are the canonical references; this sequence just names which step reads which guide.

1. **Collect the information required before development.** Run §2.1 above with the agency. Confirm every field before any code or content changes; the agency fields are the inputs to the next step.
2. **Run the rebranding workflow.** Open `docs/REBRANDING.md` and walk through §1–§15 in order: agency identity → 22 placeholder assets → six sample data files → locale copies → theme → modules → production site URL → build and verify. The output is a working tree where every visible string, image, agency field, and data record is the agency's own.
3. **Run the validation pipeline.** `pnpm install && pnpm lint && pnpm test && pnpm build && pnpm test:e2e` and `NUXT_PUBLIC_SITE_URL=https://example.test pnpm generate`. The pipeline is the gate that separates a rebrand from a deploy. Exact command list and the expected results are in `docs/DEPLOYMENT.md` §8.
4. **Run the production-readiness checklist.** Open `docs/REBRANDING.md` §16. Resolve every blocker before the deploy. The checklist's 8 blocking items are the pre-flight gate; §16.2 lists the post-launch recommendations the agency can plan for after launch.
5. **Collect the information required before production.** Run §2.2 above with the agency. Confirm the hostname, the deployment ownership, the lead-delivery credentials, and the maintenance expectations.
6. **Run the deployment workflow.** Open `docs/DEPLOYMENT.md` and walk through §4 (env-var lifecycle) → §5 (static vs Node/Nitro) → §7 (lead delivery) → §9 (deploy) → §10 (post-deployment smoke checks). The Node/Nitro deployment is the recommended target for a normal real client because the agency usually wants at least one runtime-server capability (most commonly live lead capture).
7. **Run the handoff checklist.** Open §4 below. Walk through every item with the agency; capture the owner and the access location for each.
8. **Open the maintenance backlog.** The first 30 days are the §2.3 enhancements: monitoring, analytics, security headers, error tracking, distributed rate limiter, pre-commit hooks. The agency owns the priorities; the implementer can quote them on a retainer.

## 4. Client handoff checklist

The handoff is the moment the agency takes ownership of the deployment. This checklist is the agency's sign-off record; the implementer keeps a copy, the agency keeps a copy. Each row has the owner (who holds the credential or the responsibility), the access location (where it lives), and the renewal / rotation cadence.

### 4.1 Credentials / access ownership

| Item | Owner | Access location | Renewal cadence |
| --- | --- | --- | --- |
| Hosting platform account | The agency | The platform's identity directory (or the implementer's if the agency has delegated) | When the agency owner changes or the implementer relationship ends |
| Hosting platform billing | The agency | The platform's billing portal | Monthly / annual per the platform's billing cycle |
| Domain registrar account | The agency | The registrar's identity directory | When the agency owner changes |
| DNS provider access | The agency (or the operator) | The DNS provider's console | When the DNS provider changes |
| TLS certificate (if managed outside the platform) | The agency (or the operator) | The certificate store | Per the certificate's validity period (90 days for Let's Encrypt, 1 year for many paid CAs) |
| SMTP credentials (for the email adapter) | The agency | The agency's email provider | When the SMTP password rotates |
| Webhook destination credentials (for the webhook adapter) | The agency | The platform-specific secret manager | When the webhook URL or secret changes |
| Source-code repository access | The agency (or the implementer) | The Git host (GitHub, GitLab, etc.) | When the implementer relationship ends |
| CI / CD secrets | The agency (or the implementer) | The CI / CD provider's secret store | When the agency owner changes |

### 4.2 Domain and DNS

| Item | Owner | Notes |
| --- | --- | --- |
| Domain registration | The agency | The agency owns the domain; the registry is the source of truth. |
| Nameservers | The agency (or the operator) | The DNS provider's nameservers are set at the registrar. |
| Apex / `www.` records | The agency (or the operator) | The deploy's hostname (apex or `www.`) is an `A` / `AAAA` / `CNAME` record pointing to the platform's edge. |
| `www.` redirect | The platform's edge | Configured at the edge; the template does not ship redirect logic. |

### 4.3 Deployment platform

| Item | Owner | Notes |
| --- | --- | --- |
| Hosting platform account | The agency | The agency owns the account; the implementer may have a shared account during the engagement. |
| Production deploy primitive | The operator | The operator owns the process manager, the port mapping, and the restart policy. |
| Secrets store | The operator | The platform's secret manager is the source of truth for production env vars (the runtime env vars `NUXT_LEADS_*`, the data-source URLs, the per-tenant overrides). `.env` files are not used in production. |
| Build artifact retention | The operator | The platform keeps the last N build artifacts (the default in most platforms is 5–10). The handoff confirms the retention policy. |
| Rollback procedure | The operator | The 5-step rollback is in `docs/DEPLOYMENT.md` §11. The operator owns the previous-build promotion. |

### 4.4 Lead-delivery credentials

| Item | Owner | Notes |
| --- | --- | --- |
| `NUXT_LEADS_ADAPTER` value | The agency | Set at deploy time. Default is `disabled`; the form is the placeholder UI until the agency is ready. |
| `NUXT_LEADS_WEBHOOK_URL` (when `webhook`) | The agency | The agency-controlled endpoint URL. |
| `NUXT_LEADS_WEBHOOK_SECRET` (when `webhook`) | The agency | 32+ character random string. The agency-side endpoint verifies the `X-Lead-Signature` header with the same secret. |
| `NUXT_LEADS_SMTP_*` and `NUXT_LEADS_EMAIL_*` (when `email`) | The agency | The SMTP credentials and the `From:` / `To:` addresses. |
| Webhook signature verification | The agency | The agency-side endpoint owns the verification logic. The reference pseudocode is in `docs/REBRANDING.md` §12.3. |
| Lead retention policy | The agency | The template does not persist leads; the destination is the only place that sees the stamped shape. The agency owns the retention policy at the destination. |

### 4.5 Analytics / monitoring ownership (if used)

| Item | Owner | Notes |
| --- | --- | --- |
| Uptime monitor target | The operator | The monitor is configured against the safe GET routes `/` and `/sitemap.xml`. The template ships no monitor. |
| Uptime monitor account | The agency | The agency owns the monitor account (or the operator's shared account). |
| Analytics provider account | The agency | The agency owns the analytics account (Plausible, GA, Fathom, Matomo, etc.). |
| Analytics destination URL | The agency | The agency's property id, GA measurement id, or equivalent. |
| Error tracking account | The agency | The agency owns the Sentry / GlitchTip / similar account. |
| Error tracking DSN | The operator | The DSN is configured at the deploy time. |

### 4.6 Source-code ownership and delivery expectations

| Item | Owner | Notes |
| --- | --- | --- |
| Source-code repository | The agency | The agency owns the repository (or the implementer holds the canonical fork during the engagement). |
| License | The implementer | The template's license is preserved; the agency's rebranded code is owned by the agency per the engagement contract. |
| Build instructions | The repository | The README is the canonical source. The handoff confirms the implementer has updated the README to point at the agency's hostname / repo. |
| Deployment instructions | The repository | `docs/DEPLOYMENT.md` is the canonical procedure. The handoff confirms the operator has read it. |
| Test suite | The repository | The validation pipeline (`pnpm lint`, `pnpm test`, `pnpm build`, `pnpm test:e2e`, `git diff --check`) is the source of truth. |
| Future update ownership | The agency | The agency owns the decision of who maintains the codebase after the handoff (the implementer, an internal team, a third-party operator). |

### 4.7 CMS access and ownership (when `DATA_SOURCE=cms` is in use)

The CMS project is the operator's remote content store. The agency's CMS project is **isolated**: clients only have access to their own agency CMS project. The implementer does not share one CMS project across clients and does not share access across agencies inside a multi-tenant deployment. The handoff confirms the access split before the implementer leaves the engagement.

The current integration is the **generic HTTP/JSON driver** at `app/core/data-source/adapters/http-json-cms-driver.ts`. There is no provider-specific Sanity / Contentful / Strapi driver shipping today; a provider-specific driver is a future task. The handoff documents whether the agency needs one and which provider is the target.

**The current generic HTTP/JSON driver does not expose an authentication-token configuration.** The endpoint must be reachable using the capabilities the driver supports (no auth header, only `Accept: application/json`). A future provider-specific driver (Sanity, Contentful, Strapi) may require server-side credentials (API tokens, signed requests, secrets stored in the platform's secret manager). **CMS secrets must never be exposed to client-side code** — the data-source loaders are server-only; the loader's output is the only thing the client bundle sees.

The **long-term ownership model** is:

- **The agency owns the CMS account and project.** The account that hosts the CMS project is owned by the agency (or the agency's IT), not by the implementer.
- **The agency must have at least one administrator after handoff.** At least one CMS administrator remains with the agency at all times — the agency is the sole owner of the only-admin access. The implementer releases the admin role at the handoff unless an ongoing maintenance agreement explicitly keeps the operator on the admin role.
- **The client only receives access to its own isolated CMS project.** The agency never grants access to other agencies' CMS projects, even inside a multi-tenant deployment.
- **Operator / developer access after handoff is optional and depends on the maintenance agreement.** A project-based engagement releases all roles at the handoff. An ongoing-maintenance contract may keep the operator on a developer or admin role appropriate to the agreement; the handoff documents who holds which role and on what schedule the role is renewed. Removing operator access is **not** required when ongoing maintenance is contracted.

| Item | Owner | Notes |
| --- | --- | --- |
| CMS account (the company's billing account) | The agency | The agency owns the account. The implementer is a member, not the owner. |
| CMS project / workspace | The agency | One client = one agency = one isolated CMS project. The project's name matches the agency's `agency.id`. |
| CMS admin role (at least one) | The agency | The agency owns the only-admin access after handoff. The implementer holds an admin role during the build and transfers it. The handoff confirms at least one agency-side administrator remains. |
| CMS editor role | The agency | The agency decides who in their team can edit content. The implementer does not need an editor role in production. |
| Developer / read-only role (post-handoff) | The agency (with optional operator) | Project-based engagements release all roles at the handoff. Ongoing-maintenance contracts may keep the operator on a developer role appropriate to the agreement; the handoff documents who holds which role and on what schedule it is renewed. |
| Image / media store | The agency | The agency's photography is uploaded to the CMS project's media store (or the agency provides an external CDN URL). The implementer does not keep copies of the licensed assets on personal accounts. |
| Content migration responsibility | The agency (with optional operator) | The handoff documents who is responsible for the next migration: the agency (typical for content-only updates) or the operator (typical for schema changes). The per-feature Zod schema is the boundary schema. |
| Preview / draft endpoint | The agency (with optional operator) | The current generic HTTP/JSON driver points at the production endpoint. A preview / draft endpoint is a future enhancement; the handoff documents whether the agency has one and how it is exposed. |
| CMS provider-specific driver | The agency (with optional operator) | The current integration is the generic HTTP/JSON driver. A provider-specific driver (Sanity, Contentful, Strapi) is a future task; the handoff documents whether the agency needs one and which provider is the target. |
| CMS provider credentials | The agency | The CMS provider's credentials (admin password, API token, etc.) are owned by the agency. The operator does not need them in production today — the generic HTTP/JSON driver does not consume them. When a future provider-specific driver ships, server-side credentials are stored in the platform's secret manager and never exposed to the client bundle. The implementer needs the credentials during the build and transfers them. |

## 5. Environment-variable template

The repository does not ship a `.env.example` by default. The `.gitignore` already exempts `.env.example` so it can be added without changing the gitignore. The implementer creates a `.env.example` at the root of the agency-specific working tree with **variable names and non-secret placeholder values only** — no real credentials, no real domains, no real client names.

The template the implementer should use is the one in the repository's `.env.example` (the file is committed once the template is generic; the sample below is the canonical placeholder shape). All values are non-secret; the secrets (the webhook signing key, the SMTP password) are intentionally blank with a comment that names the field.

| Variable | Sample placeholder | Purpose |
| --- | --- | --- |
| `NUXT_PUBLIC_SITE_URL` | `https://example.test` | The canonical site URL. Build-time + runtime. The real default is empty; the placeholder is the production shape. |
| `NUXT_PROPERTIES_DATA_SOURCE` | `static` | `static` / `api` / `cms`. The real default is `static`. |
| `NUXT_PROPERTIES_API_URL` | `# https://api.example.test/properties` | Required when `kind=api`. Real default is empty. |
| `NUXT_PROPERTIES_API_TIMEOUT_MS` | `10000` | Optional. The real default is `10000` ms (10 seconds). |
| `NUXT_PROPERTIES_CMS_URL` | `# https://cms.example.test/properties` | Required when `kind=cms`. Real default is empty. |
| `NUXT_PROPERTIES_CMS_TIMEOUT_MS` | `10000` | Optional. The real default is `10000` ms (10 seconds). |
| `NUXT_AGENTS_*` | same pattern as properties | Per-feature data source. |
| `NUXT_DEVELOPMENTS_*` | same pattern as properties | Per-feature data source. |
| `NUXT_LEADS_ADAPTER` | `disabled` | `disabled` / `log` / `webhook` / `email`. Real default is `disabled`. |
| `NUXT_LEADS_WEBHOOK_URL` | (blank — secret) | When `webhook`. |
| `NUXT_LEADS_WEBHOOK_SECRET` | (blank — secret) | When `webhook`. |
| `NUXT_LEADS_SMTP_HOST` | `smtp.example.test` | When `email`. |
| `NUXT_LEADS_SMTP_PORT` | `587` | When `email`. Required as a positive integer. |
| `NUXT_LEADS_SMTP_SECURE` | (blank — real default) | When `email`. Real default is empty (= plaintext SMTP). The string `"true"` forces TLS; any other value (including empty, `"false"`, `"1"`) means plaintext. The adapter treats STARTTLS (port 587 + `NUXT_LEADS_SMTP_SECURE` unset) as the most common production setup. |
| `NUXT_LEADS_SMTP_USER` | `leads@example.test` | When `email`. |
| `NUXT_LEADS_SMTP_PASSWORD` | (blank — secret) | When `email`. |
| `NUXT_LEADS_EMAIL_FROM` | `leads@example.test` | When `email`. |
| `NUXT_LEADS_EMAIL_TO` | `inbox@example.test` | When `email`. |
| `NUXT_PUBLIC_SITE_URL__<TENANT_ID>` | `# https://tenant.example.test` | Multi-tenant override. Real default is empty (the global `NUXT_PUBLIC_SITE_URL` is the fallback). |

The agency-specific values are NOT in `.env.example`. They are filled in by the operator at deploy time through the platform's secret manager. The implementer's `.env.example` is a documentation artifact that names the variables the deploy needs; the operator's secret manager is the source of truth.

## 6. First-client rebrand dry-run (Task 122)

This section is the **canonical "what does it actually take to turn the template into a client-ready agency website" checklist**, derived from the fictional first-client rebrand dry-run that ships in the v1.2 branch. The dry-run replaces every default placeholder with a fictional boutique Mexican Pacific-coast agency ("Bahía del Mar Propiedades") end-to-end and validates that the result compiles, lints, builds, and passes the 1230-test unit suite without touching any generic application code.

The fictional agency is **not** a real client. Every name, address, phone, email and URL is fictional placeholder content. The dry-run exists to measure the real onboarding friction: which steps are pure configuration, which steps are asset replacement, which steps require touching test fixtures, and which steps (if any) still require editing generic application code. The answer is **none of the steps require editing generic application code**; the dry-run's friction surface is bounded to data, theme, agency config, and a small number of golden test assertions.

### 6.1 Rebrand dry-run — files touched

The dry-run modifies (or creates) the following files. None of the changes edit generic application code; every change is bounded to either data, theme tokens, agency config, or the test fixtures that pin the bundled sample catalog.

| File | Action | Classification |
| --- | --- | --- |
| `app/config/agencies/bahia-del-mar.agency.ts` | **Created.** The fictional agency's identity (name, slogan, contact, address, social URLs, currency, locale, theme id, modules, leads). | Configuration only |
| `app/config/agencies/registry.ts` | **Modified.** Imports the new agency and registers a new entry under id `bahia-del-mar` with the production hostnames (`bahia-del-mar.test`, `www.bahia-del-mar.test`). | Configuration only |
| `app/config/site.config.ts` | **Modified.** Imports the new agency as the active fallback (so `pnpm generate` and non-server-rendered contexts render the Bahía del Mar identity). | Configuration only |
| `app/themes/bahia.theme.ts` | **Created.** The fictional agency's brand palette (deep ocean-blue primary, warm sand-beige secondary, coral-sunset accent), font stack, radius and shadow tokens. | Configuration only |
| `app/themes/index.ts` | **Modified.** Registers the new theme in the theme registry. | Configuration only |
| `app/features/properties/data/properties.ts` | **Modified.** Replaces the six-shipped sample properties with five fictional Pacific-coast listings (MXN prices, Nayarit locations, Spanish copy). | Content replacement |
| `app/features/agents/data/agents.ts` | **Modified.** Replaces the four-shipped sample agents with three fictional team members (Spanish copy, agency contact phone). | Content replacement |
| `app/features/developments/data/developments.ts` | **Modified.** Replaces the four-shipped sample developments with two fictional Pacific-coast developments (one pre-sale, one under construction, MXN prices). | Content replacement |
| `app/features/home/data/stats.ts` | **Modified.** Replaces the four-shipped home stats with agency-specific placeholder values (10+ years, 450+ properties, 1,800+ clients, 8+ areas). | Content replacement |
| `app/features/home/data/locations.ts` | **Modified.** Replaces the four-shipped home locations with four fictional Pacific-coast locations (Sayulita, San Pancho, Punta Mita, Bucerías). | Content replacement |
| `app/features/home/data/testimonials.ts` | **Modified.** Replaces the three-shipped home testimonials with three fictional client quotes in Spanish. | Content replacement |
| `server/api/{properties,agents,developments}.get.test.ts` | **Modified.** Updates three golden slug assertions from the shipped sample slugs to the new agency's slugs (the tests assert "the bundled static catalog is served", and the new catalog has different slugs). | Test fixture update |
| `server/utils/{properties,agents,developments}.test.ts` | **Modified.** Same golden-slug update on the server-side loader tests. | Test fixture update |
| `server/routes/sitemap.xml.test.ts` | **Modified.** Updates one golden URL assertion to the new agency's first property slug. | Test fixture update |
| `app/features/properties/services/properties.service.test.ts` | **Modified.** Updates four golden location-filter assertions to use cities that exist in the new catalog (Sayulita, Punta Mita, Bucerías) and tightens one strict-equality country assertion to be accent-insensitive (matching the documented filter contract). | Test fixture update |
| `app/features/developments/data/developments.ts` | **Modified.** Sets one of the two developments to `featured: false` so the `getFeatured` test (which asserts the catalog has at least one unfeatured record) continues to pass. | Content replacement |

### 6.2 Rebrand dry-run — classification of every step

The five categories from the user request, applied to every step:

- **Configuration only** — `app/config/agencies/bahia-del-mar.agency.ts` (create + fill); `app/config/agencies/registry.ts` (1 import + 1 registry entry); `app/config/site.config.ts` (1 import swap); `app/themes/bahia.theme.ts` (create + fill); `app/themes/index.ts` (1 import + 1 registry entry).
- **Asset replacement** — the dry-run keeps the existing SVG placeholders under `public/images/`. A real rebrand replaces logo, favicon, hero, about, 4 location tiles, 4–6 property covers, 3–4 agent portraits, and 2–4 development covers at the documented paths in `docs/REBRANDING.md` §4.
- **CMS setup** — the dry-run does NOT use a CMS (the fictional agency's catalog lives in the static data files). A rebrand that switches a feature to the static data source keeps the static files. A rebrand that switches a feature to Sanity / Contentful / a custom HTTP API follows the CMS-specific path in `docs/CLIENT_ONBOARDING.md` §2.1 (CMS subsection) plus `docs/SANITY_OPERATIONS.md` for Sanity-specific setup, or the generic HTTP/JSON driver path in `docs/REBRANDING.md` + `docs/CLIENT_ONBOARDING.md` §2.1.
- **Deployment configuration** — the deploy-time env vars are unchanged from `.env.example`. A production rebrand sets `NUXT_PUBLIC_SITE_URL=https://www.bahia-del-mar.test` (or the agency's real hostname), `NUXT_LEADS_ADAPTER` to one of the four documented values, the matching lead-delivery env vars (`NUXT_LEADS_WEBHOOK_URL` + secret, or the SMTP stack), and (for a CMS-driven deploy) the four `NUXT_SANITY_*` env vars plus the per-feature `NUXT_<FEATURE>_CMS_PROVIDER` + `NUXT_<FEATURE>_DATA_SOURCE=cms`. The full env-var checklist is in `docs/DEPLOYMENT.md` §4.
- **Code change** — **none.** Every rebrand step is data, theme, asset, agency-config, or deploy-config. The generic application code (the components, pages, layouts, composables, services, stores, and runtime config) is **untouched** during a normal rebrand.

### 6.3 Rebrand dry-run — golden-test friction (the only rebrand-required code change)

The dry-run reveals a single friction point: **some unit tests assert the shipped sample catalog's specific slugs and city names** (the "golden tests"). The shipped sample catalog has six properties (`modern-hillside-villa`, …), four agents (`maria-gonzalez`, …), and four developments (`mirador-del-valle`, …). Several unit tests in `server/api/*`, `server/utils/*`, `server/routes/sitemap.xml.test.ts`, and `app/features/properties/services/properties.service.test.ts` reference these slugs to assert "the loader returns the bundled static catalog". A rebrand that swaps the sample data for the agency's catalog MUST also update these golden assertions to the new slugs and city names.

The friction is **bounded**: nine test files, eleven specific assertions, no test logic changes. The contract being tested (the loader returns the bundled catalog, the filter is case- and accent-insensitive, the sitemap emits one URL per visible record) is unchanged; only the literal slugs / city names referenced in the golden assertions change. The friction is documented here so a real rebrand knows to update the golden assertions in the same commit that swaps the data files.

A more durable fix — extracting the sample-data slugs into a small fixture file the golden assertions import — is a future task and not part of this dry-run.

### 6.4 Rebrand dry-run — full configuration / asset / CMS / deployment sequence

The complete rebranding workflow, in order, from a clean clone to a branded deployment:

**Step 1 — Configuration (no code change).**

There are **two distinct agency surfaces** in the rebranding workflow, and they are **not interchangeable**:

- `app/config/site.config.ts` exports the **`siteConfig` constant** that is bundled into the **fallback** seed value for `useState('site-config')`. This constant is what a `pnpm generate` static export, a client-only navigation, or a unit test that bypasses the Nitro server sees.
- `app/config/agencies/registry.ts` exports the **`agencyRegistry`** — the **runtime** tenant selector. On every Nitro request the server-only plugin `app/plugins/tenancy.server.ts` reads `useRequestURL().hostname`, calls `selectAgencyByHost(registry, host)`, and seeds `useState('site-config')` with the entry's pre-resolved `SiteConfig`. A Node / SSR deployment selects the active agency from the **request hostname** through this resolver — **not** through the `site.config.ts` import.

Changing `app/config/site.config.ts` alone does **not** select the agency for an SSR request when the tenancy plugin runs. The static-export path and the unit-test path read the `siteConfig` constant; the SSR path reads the `agencyRegistry` and the request hostname. Both paths must agree on the same agency for a clean deployment.

With that distinction explicit, the configuration steps are:

1. Create `app/config/agencies/<your-agency>.agency.ts` (copy `default.agency.ts` as a template; fill in every field).
2. Add a new entry to the `agencyRegistry` in `app/config/agencies/registry.ts` with the agency's production hostnames (`example.com`, `www.example.com`). This is the **runtime** entry — a Node / SSR deployment reads it per request.
3. Update `app/config/site.config.ts` so its `siteConfig` constant uses the new agency as the **fallback** (one-line import swap from `default.agency` to your new agency). This is the surface that `pnpm generate` and any non-server-rendered context consume; it must agree with the registry's default-tenant entry so the static export and the SSR rendering show the same agency.
4. Create `app/themes/<your-theme>.theme.ts` (copy `default.theme.ts`; fill in colors / fonts / radii / shadows / layout).
5. Register the theme in `app/themes/index.ts` (1 import + 1 registry entry).
6. Set `agency.theme` to the new theme id in the agency config.

**Step 1a — Hostname configuration (client onboarding, no code change).**

Hostname configuration is a separate, **explicit** step in the client onboarding workflow. The implementer collects the production hostnames from the agency (see `§2.2 "Domain / hostname ownership"`) before the deployment, and the rebrand commits the matching `hosts` list to the registry entry. The development hostname is a local-test concern; the production hostnames are a deployment concern. Both belong in the same registry entry.

1. **Register the agency in `agencyRegistry`.** The new entry's `id` is the tenant id (unique across the registry). The id is the same value the implementer will use later for the per-tenant env-var dispatch convention (`NUXT_PUBLIC_SITE_URL__<TENANT_ID>`).
2. **Configure the production hostnames.** Add the agency's production apex and `www.` subdomain to the entry's `hosts` array (`example.com`, `www.example.com`). The hostname is the lookup key the per-request resolver matches; the operator's DNS is the source of truth for which hostname resolves to the deployment.
3. **Configure an appropriate development hostname for local testing.** Add a development hostname (`localhost`, `127.0.0.1`, or a project-specific hostname like `bahia-del-mar.local`) to the entry's `hosts` array. This is what `pnpm dev` and `pnpm preview` use; without it, a request to the development hostname resolves to the registry's `default` tenant (the documented single-agency fallback). The development hostname is **not** a recommended production configuration; it is a local-test convenience.
4. **Verify the resolved agency id and theme id match the expected tenant.** Hit the dev server with the development hostname (e.g. `curl -H 'Host: <dev-hostname>' http://localhost:3000/`) and confirm the rendered HTML carries the new agency's name and brand colors. The runtime resolver is `app/plugins/tenancy.server.ts` → `app/config/agencies/registry.ts` → `selectAgencyByHost(registry, host)`; the resolved `SiteConfig.agency.id` and `SiteConfig.theme.id` are the canonical tenant identifiers. A request to a hostname that does not match any `hosts` list resolves to the `default` tenant via the fallback (see `docs/MULTI_TENANT.md` §5 "Unknown-host fallback").

**Step 2 — Asset replacement (no code change).**
7. Replace `public/images/logo.svg` and `public/favicon.ico` with the agency's real assets.
8. Replace the placeholder assets under `public/images/home/`, `public/images/properties/`, `public/images/agents/`, `public/images/developments/`, and `public/images/locations/` with the agency's real photography. Keep file names stable when possible; if a new filename is required, update the corresponding data file in Step 3.
9. The full path map is in `docs/REBRANDING.md` §4.

**Step 3 — Content replacement (no code change).**
10. Replace `app/features/properties/data/properties.ts` with the agency's property catalog.
11. Replace `app/features/agents/data/agents.ts` with the agency's team roster.
12. Replace `app/features/developments/data/developments.ts` with the agency's development portfolio.
13. Replace `app/features/home/data/{stats,locations,testimonials}.ts` with the agency's home-page content.
14. **Update the golden test assertions** (the friction point above) to reference the new agency's slugs and city names. The eleven assertions are in `server/api/{properties,agents,developments}.get.test.ts`, `server/utils/{properties,agents,developments}.test.ts`, `server/routes/sitemap.xml.test.ts`, `app/features/properties/services/properties.service.test.ts`, and `app/features/developments/services/developments.service.test.ts`.
15. Ensure each record passes Zod validation at module load — the runtime boundary schemas (`app/features/*/schemas/*.schema.ts`) reject malformed entries and the build fails fast. See `docs/DATA_MODELS.md` for the exact field names and types.
16. (Optional) replace the i18n strings in `i18n/locales/en.json` and `i18n/locales/es.json`. The shipped keys are reusable labels (nav, common, footer, seo, etc.) that do not need to change for a rebrand; an agency that wants different copy edits the same keys in both locale files.

**Step 4 — Local validation.**
17. `pnpm install --frozen-lockfile` — exit 0.
18. `pnpm test` — 1230 / 1230 across 47 files (the unit suite covers the lead-capture pipeline, all four delivery adapters, the data-source foundation, the agency schema, the property / agent / development services, the i18n contract, the multi-tenant resolver, the JSON-LD builder, etc.).
19. `pnpm lint` — 0 errors / 0 warnings.
20. `pnpm build` — completes.
21. `pnpm preview` + a manual walk through `/`, `/properties`, `/properties/<slug>`, `/agents`, `/agents/<slug>`, `/developments`, `/developments/<slug>`, `/contact`, `/about`. Confirm the new agency's name, logo, slogan, contact info, and brand colors render correctly.

**Step 5 — CMS setup (only if a feature uses `cms` instead of `static`).**
22. Follow `docs/SANITY_OPERATIONS.md` for Sanity, or `docs/CLIENT_ONBOARDING.md` §2.1 (CMS subsection) for the generic HTTP/JSON driver or another provider.
23. Set the per-feature `NUXT_<FEATURE>_DATA_SOURCE=cms` + `NUXT_<FEATURE>_CMS_PROVIDER` env vars on the deployment's secret manager.
24. Set the shared CMS env vars (`NUXT_SANITY_*` for Sanity; `NUXT_<FEATURE>_CMS_URL` for the generic HTTP/JSON driver).
25. Run the one-time validation procedure (`docs/SANITY_VALIDATION.md` for Sanity; the manual `curl https://<host>/api/properties` smoke check for the generic driver).

**Step 6 — Deployment.**
26. Set `NUXT_PUBLIC_SITE_URL` to the agency's real hostname on the deployment's secret manager. Required for the sitemap, robots.txt, canonical links, and JSON-LD.
27. Set the lead-delivery env vars (`NUXT_LEADS_ADAPTER` + the matching `NUXT_LEADS_*`) if `agency.leads.enabled` is `true`.
28. Set the per-tenant overrides (`NUXT_PUBLIC_SITE_URL__<TENANT_ID>`, `NUXT_LEADS_<KEY>__<TENANT_ID>`) for a multi-tenant deploy.
29. Follow `docs/DEPLOYMENT.md` for the 8-step deployment flow, the static vs Node/Nitro decision, the post-deploy smoke checks, and the rollback procedure.

**Step 7 — Handoff.**
30. Follow `docs/CLIENT_ONBOARDING.md` §4 for the credentials / access ownership table, the domain/DNS table, the deployment platform table, the lead-delivery credentials table, and the analytics / monitoring table.
31. For a CMS-driven rebrand, follow `docs/SANITY_OPERATIONS.md` §8 for the Sanity-side end-of-contract handoff (operator access removal, source-code access conditional on the commercial agreement).

### 6.5 Rebrand dry-run — validation results

The dry-run validates clean at every step:

- `pnpm install --frozen-lockfile` — exit 0, 6 s.
- `pnpm test` — **1230 / 1230 across 47 files** (8 s wall clock).
- `pnpm lint` — **0 errors / 0 warnings**.
- `pnpm build` — completes (Nitro preset `node-server`, 246 s wall clock, no `sharp` warning).
- `git diff --check` — exit 0.

#### 6.5.1 Dry-run hostname / tenant-resolution verification (Task 123 follow-up)

The original Task 123 dry-run swapped `site.config.ts` to the Bahía del Mar fallback and registered the new entry in `agencyRegistry` with the production hostnames `bahia-del-mar.test` and `www.bahia-del-mar.test`. The first local validation pass against `pnpm dev` / `pnpm preview` on `localhost:3000` did **not** render the Bahía theme; the rendered agency was the registry's `default` tenant. The discrepancy was investigated through the runtime resolver and recorded as follows:

- **Initial state.** A request to `localhost:3000` (and to `localhost:3000` with no `Host` override) was normalized to `localhost`, walked the registry's `hosts` lists, and resolved to the `default` tenant via `selectAgencyByHost`'s fallback. The `default` tenant's `agency.theme` is `'default'`, so the bundled default palette rendered. The Bahía del Mar identity was correct in the static `siteConfig` constant but invisible to the SSR request because the SSR path reads the `agencyRegistry` + the request hostname, not the `site.config.ts` import.
- **Temporary dry-run configuration.** `localhost` was added to the Bahía del Mar entry's `hosts` list as a **temporary dry-run-only** mapping (alongside the production `bahia-del-mar.test` and `www.bahia-del-mar.test`). This is the local-test convenience described in `Step 1a` §3.
- **Re-test.** With the temporary mapping in place, the same `localhost:3000` request resolved to the `bahia-del-mar` entry; the pre-resolved `SiteConfig.theme.id` was `'bahia'`; the rendered HTML carried the Bahía identity (name, slogan, brand colors, MXN currency, metric measurement, Spanish locale). Removing the temporary `localhost` mapping and restoring the registry to its production state caused the same request to resolve back to the `default` tenant.
- **Conclusion.** The theme system is **working**: the same theme token resolution path that renders the default theme on the default tenant also renders the Bahía theme on the Bahía tenant when the per-request resolver selects the right entry. The original issue was **not** a theme-resolution bug. The issue was **tenant hostname selection** — the `agencyRegistry`'s `hosts` list for the Bahía entry did not include `localhost`, so the per-request resolver fell through to the `default` tenant. The fix is configuration (add the development hostname to the registry entry per `Step 1a` §3), not code.
- **Important.** The `localhost` mapping is **temporary dry-run configuration**, not a recommended production configuration. A real first-client rebrand registers the agency's production hostnames only; a development hostname (if used) belongs in the operator's local environment or in a project-specific development registry, not in the production registry. The production registry continues to ship with `localhost` absent from every tenant's `hosts` list, so an out-of-the-box `pnpm dev` on `localhost:3000` resolves to the `default` tenant — the documented single-agency behavior is preserved.

#### 6.5.2 Step-by-step hostname / tenant-resolution dry-run sequence

For reproducibility, the dry-run followed this exact sequence:

1. `pnpm dev` on `localhost:3000` with the registry shipping the production state (no `localhost` mapping) — request to `localhost` resolves to `default`, default theme renders.
2. Edit `app/config/agencies/registry.ts`: add `localhost` to the `bahia-del-mar` entry's `hosts` array (temporary, dry-run-only).
3. Re-test `pnpm dev` on `localhost:3000` — request to `localhost` resolves to `bahia-del-mar`, Bahía theme renders.
4. Revert `app/config/agencies/registry.ts` to the production state (no `localhost` mapping) — request to `localhost` resolves back to `default`, default theme renders.
5. Run `pnpm test` — 1230 / 1230 across 47 files (no test changes; the registry's hostname tests in `app/config/agencies/registry.test.ts` cover the fallback path byte-identically).
6. Run `pnpm lint` — 0 errors / 0 warnings.
7. Run `pnpm build` — completes.
8. Run `git diff --check` — exit 0.

### 6.6 Rebrand dry-run — repeatability of the workflow

The dry-run measures the rebrand workflow's repeatability. The friction is **bounded and predictable**:

- **Configuration steps (6 files):** atomic, parallelisable across the five files (`<agency>.agency.ts`, `registry.ts`, `site.config.ts`, `<theme>.theme.ts`, `themes/index.ts`).
- **Asset replacement (1 directory):** purely file-system work; the path map is in `docs/REBRANDING.md` §4 and stable across rebrands.
- **Content replacement (6 data files + 6 test files):** the data files are atomic; the golden test updates are a **bounded** 11-assertion follow-up.
- **Deployment configuration (env vars):** the `.env.example` is the canonical checklist; the deploy-time env vars are platform-standard.
- **No generic application code changes** — the components, pages, layouts, composables, services, stores, and runtime config are untouched.

A real client engagement that follows the §6.4 sequence and updates the 11 golden test assertions in the same commit completes the rebrand without touching generic application code. The dry-run's friction surface is documented and quantified; the next rebrand knows exactly what to expect.

## 7. References

- `docs/REBRANDING.md` — the rebranding workflow (§1–§15) and the production-readiness checklist (§16).
- `docs/DEPLOYMENT.md` — the deployment flow (§3–§11), the env-var lifecycle (§4), the static vs Node/Nitro capability matrix (§5), the post-deploy smoke checks (§10), and the rollback procedure (§11).
- `docs/MULTI_TENANT.md` — per-tenant hostname dispatch, per-tenant canonical URL, per-tenant lead delivery.
- `docs/SANITY_OPERATIONS.md` — the Sanity CMS post-implementation operations guide (project setup, dataset, Studio deploy, ownership, editor workflow, backup / restore, incident recovery, handoff).
- `docs/SANITY_VALIDATION.md` — the one-time Sanity validation procedure.
- `docs/RELEASE_NOTES_v1.1.md` — the v1.1.0 lead-capture pipeline and the static-vs-Nitro trade-off.
- `README.md` — the supported scripts and the two deployment modes.
- `docs/ROADMAP.md` — the current implementation state and the milestone log.
