# Deployment Guide

This guide walks an operator through taking a rebranded real-estate agency instance from the repository to a real production deployment. It is the bridge between the **rebranding workflow** (how the agency config is filled in) and the **production-readiness checklist** (what must be true before traffic).

Rebranding is about content and identity. This guide is about the operational steps that let the rebrand reach real users: environment variables, build target, hostname and TLS, lead delivery, validation, the deploy itself, post-deploy smoke checks, and how to roll back if the first attempt goes wrong.

The guide is **provider-agnostic**. It does not assume Vercel, Netlify, Cloudflare, AWS, or any other specific host. Every step is stated in terms the operator's platform of choice can translate to its own primitives (web UI, CLI, Terraform, etc.). The template ships no Docker files, no CI/CD deployment jobs, no Terraform modules, no health endpoints, no analytics, and no monitoring integrations — those are deliberate choices that keep the template portable.

## 1. Related Docs

Read these before starting:

- `docs/REBRANDING.md` — the rebranding workflow (§1–§15) and the production-readiness checklist (§16). This guide refers to it; it does not duplicate it.
- `docs/MULTI_TENANT.md` — only relevant if the deployment hosts multiple agencies behind a single build. The single-tenant deployment (Option A) needs nothing here.
- `docs/RELEASE_NOTES_v1.1.md` — what the v1.1.0 lead-capture pipeline ships and the static-vs-Nitro trade-off.
- `README.md` — the supported scripts and the two deployment modes (`pnpm build` and `pnpm generate`).
- `docs/ROADMAP.md` — the current implementation state and the milestone log.

## 2. The 8-Step Deployment Flow

The operator runs the steps in order. Steps 1–6 are pre-deploy; step 7 is the deploy; step 8 is post-deploy.

1. **Complete rebranding.** Run the full rebrand workflow in `docs/REBRANDING.md` §1–§15. The output is a working tree where every visible string, image, agency field, and data record is the agency's own.
2. **Configure the production environment variables.** Set the env vars the deployment needs (site URL, data sources, lead delivery, multi-tenant overrides). See §4 below.
3. **Choose static vs Node/Nitro deployment.** The two `pnpm` targets produce different outputs. See §5 below.
4. **Configure hostname and TLS.** Point the agency's hostname at the deployment and terminate TLS at the edge. See §6 below.
5. **Configure lead delivery.** Decide which adapter the agency wants and set the matching env vars. See §7 below.
6. **Run the production validation commands.** Run the full pipeline before every deploy. See §8 below.
7. **Deploy.** Push the built output to the host.
8. **Run post-deployment smoke checks.** Verify the live URLs and the lead pipeline. See §9 below.

## 3. Pre-Flight: the Production-Readiness Checklist

Before deploying, run the production-readiness checklist in `docs/REBRANDING.md` §16. The checklist's 8 blocking items are the pre-flight gate:

- Production site URL is set.
- Agency identity is the real one.
- 22 placeholder assets are replaced.
- Six sample data files are replaced.
- Locale copies are reviewed.
- Hostname + TLS are correctly configured.
- Lead delivery destination is configured (if real leads are expected).
- Validation pipeline is green.

§16.2 lists the post-launch recommendations (monitoring, analytics, security headers, error tracking, distributed rate limiter, pre-commit hooks). §16.3 lists the optional future improvements (CMS providers, lead persistence, multi-region, browser matrix, visual regression). §16.4 is the capability matrix that names who owns each concern (template vs. operator).

This guide does not duplicate §16. The operator runs §16 first; this guide then provides the operational procedure for the deploy steps §16 references.

## 4. Environment-Variable Checklist

Every env var is classified along **two axes**. The first is the lifecycle (when the value is read); the second is whether the env var is required for the deployment to work as documented.

### 4.0 Lifecycle — by deployment mode

The lifecycle of every env var is fundamentally driven by the deployment mode. A static export (`pnpm generate`) and a Node / Nitro server (`pnpm build`) are not equivalent: a pure static deployment has no runtime Nitro server after deployment, while a Node / Nitro deployment runs a long-running Node process that reads `process.env` at boot and on every request for the server-only loaders.

#### 4.0a Static (`pnpm generate`)

A static export is built once and frozen. The generated artifact under `.output/public/` is a fully self-contained set of HTML, CSS, JS, and JSON files. There is no Nitro runtime after deployment; the deployed host serves files, it does not execute server-side code.

- **Variables that affect generated output must be present during generation.** `nuxt.config.ts` reads `process.env.NUXT_PUBLIC_SITE_URL` to set the default for `runtimeConfig.public.siteUrl`. The data-source loaders (when the static export happens to run them, e.g. when `NUXT_PROPERTIES_DATA_SOURCE=api` is set at build time) read `process.env.NUXT_PROPERTIES_*` / `NUXT_AGENTS_*` / `NUXT_DEVELOPMENTS_*` directly and the per-feature servers fetch the remote API / CMS source **once per `pnpm generate` run**. The result is baked into the pre-rendered HTML, the JSON payload files (`/_payload.json`), the pre-rendered `/sitemap.xml`, and the pre-rendered `/robots.txt`.
- **The generated artifact is frozen.** A remote API / CMS source that is fetched at build time is frozen at the moment of generation. A later change to the remote source is **not** reflected in the deployed artifact until the next `pnpm generate` run ships a new build. The static host does not consult the hosting platform's env var store at request time — the artifact is closed.
- **There is no Nitro runtime after deployment.** The `POST /api/contact` endpoint and the server-only data-source loaders are **not** present in the static output. The hosting platform serves files; nothing in the deployed artifact can mutate state, read `process.env` at request time, or dispatch a webhook on the visitor's behalf. The visible form keeps the v1.0 placeholder behavior and the contact-methods column is the canonical completion path.
- **Changing an env var requires generating and deploying a new artifact.** Re-running `pnpm generate` with a changed env var produces a new artifact that must be deployed to the static host. The hosting platform's env var store is irrelevant to the already-deployed artifact — the deployed files were generated from a specific env-var snapshot, and the artifact does not consult the platform's env vars at request time.

The per-tenant overrides `NUXT_PUBLIC_SITE_URL__<TENANT_ID>` and `NUXT_LEADS_<KEY>__<TENANT_ID>` are read by the per-request resolver, which is **server-only**. On a static host, the resolver is not shipped; per-tenant overrides have no runtime effect. For per-tenant static outputs, the operator runs one `pnpm generate` per tenant with the per-tenant env var set at build time.

#### 4.0b Node / Nitro (`pnpm build`)

A Node / Nitro deployment runs both the prerendered public pages and the runtime server routes. The Nitro server output is a long-running Node process. The `runtimeConfig`-backed env vars are read at boot, and the server-only data-source loaders + per-tenant resolver read `process.env` per request.

- **`runtimeConfig`-backed `NUXT_*` values can be supplied by the production runtime environment.** `NUXT_PUBLIC_SITE_URL` is mapped to `runtimeConfig.public.siteUrl`; `NUXT_LEADS_ADAPTER` / `NUXT_LEADS_WEBHOOK_URL` / `NUXT_LEADS_WEBHOOK_SECRET` / `NUXT_LEADS_SMTP_*` / `NUXT_LEADS_EMAIL_*` are mapped to the private `runtimeConfig.leadsAdapter` / `runtimeConfig.leadsWebhookUrl` / etc. via Nuxt's automatic env-var binding. The runtime env var takes precedence over the build-time default (`process.env.NUXT_* || 'default'` in `nuxt.config.ts`). The Node process reads the env var at boot; the value is cached in `runtimeConfig` for the lifetime of the process.
- **`NUXT_PUBLIC_SITE_URL` is NOT universally build-time-only.** The build-time `nuxt.config.ts` reads `process.env.NUXT_PUBLIC_SITE_URL` to set the default; the runtime env var (when set in the production environment) overrides the default at boot. The value is then surfaced to `usePageSeo`, `useSiteConfig`, the sitemap and robots Nitro routes, and the JSON-LD payloads via `useRuntimeConfig().public.siteUrl`. The env var is read **once at boot** for `runtimeConfig`; changes after boot are not picked up without a restart.
- **`NUXT_LEADS_*` are runtime server configuration.** The `POST /api/contact` endpoint reads `useRuntimeConfig().leadsAdapter` (and the adapter-specific credentials) per request and dispatches the configured adapter. The four adapter files in `server/services/leads/adapters/` read the same `useRuntimeConfig()` fields. The runtime env var takes precedence when set; the value is cached at boot.
- **`.env` files are not automatically read by the built production server.** Nuxt's dev server loads `.env` files automatically. The built production server does **not**. The operator's platform-specific secret manager (or equivalent) is the source of truth for production env vars. The same env-var store is the source of truth for the data-source and per-tenant env vars.
- **Direct `process.env` reads for the data-source and per-tenant env vars.** `NUXT_PROPERTIES_*`, `NUXT_AGENTS_*`, `NUXT_DEVELOPMENTS_*` are read by the server-only loaders (`server/utils/properties.ts`, `server/utils/agents.ts`, `server/utils/developments.ts`) via `process.env` directly (not via `runtimeConfig`). The per-tenant overrides `NUXT_PUBLIC_SITE_URL__<TENANT_ID>` and `NUXT_LEADS_<KEY>__<TENANT_ID>` are read by the per-request `resolveTenantContext` / `resolveTenantLeadsConfig` resolver via `process.env` directly. Each request constructs a fresh adapter from the current `process.env`; the resolver dispatches per-tenant env vars on top of the global `useRuntimeConfig()`.

**Operational application of changed env vars.** The Node code reads `process.env` per request for the data-source and per-tenant env vars. In principle, a change to the runtime env var is visible to the next request. **However, the operational application of a changed env var depends on the deployment platform's process lifecycle.** A long-running process must be restarted (or a new deploy must run) for the change to be picked up by the actual running process. A serverless preset may pick up env vars on each new instance — but the running instances retain the values they booted with. The application code's read-pattern is not a guarantee of operational visibility; the platform's process lifecycle is. Do not assume that changing a hosting-platform env var becomes visible to an already-running process without a restart or redeploy.

### 4.1 Site URL (required for SEO infrastructure)

| Env var | Required | Default | Purpose |
| --- | --- | --- | --- |
| `NUXT_PUBLIC_SITE_URL` | **yes** | `''` | Canonical site URL. Read at build time. The sitemap returns 503, `robots.txt` blocks all crawling, and `<link rel="canonical">` / `og:url` are omitted when this is empty. |

Multi-tenant override (see `docs/MULTI_TENANT.md` §2):

| Env var | Required | Default | Purpose |
| --- | --- | --- | --- |
| `NUXT_PUBLIC_SITE_URL__<TENANT_ID>` | no | inherits global | Per-tenant override. The tenant id is uppercased and any non-alphanumeric character is replaced with `_` (e.g. `NUXT_PUBLIC_SITE_URL__ACME`). |

### 4.2 Data sources (optional; default is `static`)

The properties, agents, and developments features each have a per-feature data-source selector. The default for every feature is `static` (the bundled sample data). Switching to `api` or `cms` requires the per-feature URL env var.

| Env var | Required | Default | Purpose |
| --- | --- | --- | --- |
| `NUXT_PROPERTIES_DATA_SOURCE` | no | `static` | One of `static` / `api` / `cms`. |
| `NUXT_PROPERTIES_API_URL` | when `NUXT_PROPERTIES_DATA_SOURCE=api` | — | Remote property list endpoint (must serve a JSON array matching `propertyListSchema`). |
| `NUXT_PROPERTIES_API_TIMEOUT_MS` | no | `10000` | Per-request HTTP timeout for the api adapter. |
| `NUXT_PROPERTIES_CMS_URL` | when `NUXT_PROPERTIES_DATA_SOURCE=cms` | — | Remote CMS endpoint for the generic HTTP/JSON CMS driver. |
| `NUXT_PROPERTIES_CMS_TIMEOUT_MS` | no | `10000` | Per-request HTTP timeout for the CMS adapter. |
| `NUXT_AGENTS_DATA_SOURCE` | no | `static` | Same selector for agents. |
| `NUXT_AGENTS_API_URL` | when `NUXT_AGENTS_DATA_SOURCE=api` | — | Remote agent list endpoint. |
| `NUXT_AGENTS_API_TIMEOUT_MS` | no | `10000` | Per-request HTTP timeout. |
| `NUXT_AGENTS_CMS_URL` | when `NUXT_AGENTS_DATA_SOURCE=cms` | — | Remote CMS endpoint. |
| `NUXT_AGENTS_CMS_TIMEOUT_MS` | no | `10000` | Per-request HTTP timeout. |
| `NUXT_DEVELOPMENTS_DATA_SOURCE` | no | `static` | Same selector for developments. |
| `NUXT_DEVELOPMENTS_API_URL` | when `NUXT_DEVELOPMENTS_DATA_SOURCE=api` | — | Remote development list endpoint. |
| `NUXT_DEVELOPMENTS_API_TIMEOUT_MS` | no | `10000` | Per-request HTTP timeout. |
| `NUXT_DEVELOPMENTS_CMS_URL` | when `NUXT_DEVELOPMENTS_DATA_SOURCE=cms` | — | Remote CMS endpoint. |
| `NUXT_DEVELOPMENTS_CMS_TIMEOUT_MS` | no | `10000` | Per-request HTTP timeout. |

The data-source env vars are read by the server-only loaders (`server/utils/properties.ts`, `server/utils/agents.ts`, `server/utils/developments.ts`) and are **never** sent to the client bundle. An empty / whitespace URL raises `DataSourceMissingConfigError` at construction; selecting `cms` before a CMS driver is registered raises `DataSourceNotImplementedError`. Both error classes are pinned by the boundary regression tests.

### 4.3 Lead delivery (optional; default is `disabled`)

Lead delivery is **opt-in**. The default `disabled` adapter keeps the v1.0 placeholder behavior: the visible form is permanently disabled and the contact-methods column is the completion path. The agency must flip **two** flags to go live: `agency.leads.enabled = true` in `app/config/agencies/default.agency.ts`, AND `NUXT_LEADS_ADAPTER` plus the adapter-specific env vars in the deployment environment.

| Env var | Required | Default | Purpose |
| --- | --- | --- | --- |
| `NUXT_LEADS_ADAPTER` | no | `disabled` | One of `disabled` / `log` / `webhook` / `email`. The endpoint returns 503 on every submission when the adapter is `disabled`. |
| `NUXT_LEADS_WEBHOOK_URL` | when `NUXT_LEADS_ADAPTER=webhook` | — | The agency-controlled endpoint that receives the stamped lead as JSON. |
| `NUXT_LEADS_WEBHOOK_SECRET` | when `NUXT_LEADS_ADAPTER=webhook` | — | Random 32+ character string. The webhook adapter signs the exact JSON payload with HMAC SHA-256 and sends the `X-Lead-Signature: sha256=<hex>` header. The agency-side endpoint must verify the signature with the same secret. The reference verification pseudocode is in `docs/REBRANDING.md` §12.3. |
| `NUXT_LEADS_SMTP_HOST` | when `NUXT_LEADS_ADAPTER=email` | — | SMTP server hostname. |
| `NUXT_LEADS_SMTP_PORT` | when `NUXT_LEADS_ADAPTER=email` | — | SMTP server port (e.g. `587`, `465`, `25`). Strings are rejected by the adapter's non-integer-port guard. |
| `NUXT_LEADS_SMTP_SECURE` | no | `''` | When the string is `"true"`, Nodemailer forces TLS. Any other value (including empty) means plaintext SMTP. |
| `NUXT_LEADS_SMTP_USER` | when `NUXT_LEADS_ADAPTER=email` | — | SMTP authentication username. |
| `NUXT_LEADS_SMTP_PASSWORD` | when `NUXT_LEADS_ADAPTER=email` | — | SMTP authentication password. |
| `NUXT_LEADS_EMAIL_FROM` | when `NUXT_LEADS_ADAPTER=email` | — | The `From:` address shown in the email client. |
| `NUXT_LEADS_EMAIL_TO` | when `NUXT_LEADS_ADAPTER=email` | — | The `To:` address (where the lead lands). |

Adapter error mapping is documented in `docs/REBRANDING.md` §12.3 and §12.3b. The endpoint never exposes provider details to the client; a 502 is the catch-all for any adapter failure.

**Multi-tenant overrides.** A multi-tenant lead-delivery deployment overrides per-tenant with the same convention as the site URL: `NUXT_LEADS_<KEY>__<TENANT_ID>` (tenant id uppercased, non-alphanumeric replaced with `_`). The per-tenant override takes precedence over the global; the global is the fallback. The full convention and the field-by-field fallback semantics are in `docs/MULTI_TENANT.md` §9.

### 4.4 Setting env vars

The env vars are plain shell variables. The exact mechanism depends on the deployment mode (§4.0):

**Static (`pnpm generate`).** Every env var that affects the generated output must be present in the **build environment** before `pnpm generate` runs. The Nuxt dev server's `.env` loading is irrelevant — the static export uses the `process.env` of the `pnpm generate` invocation. The pre-rendered HTML, the JSON payload files, the sitemap, and the robots file are frozen at build time; the static hosting platform's env var store is not consulted at request time.

**Node / Nitro (`pnpm build`).** The `runtimeConfig`-backed env vars (`NUXT_PUBLIC_SITE_URL`, `NUXT_LEADS_*`) must be present in the **runtime environment** before the Node process starts. Nuxt's automatic env-var binding reads them at boot and caches the values in `runtimeConfig`; the running process does not re-read `process.env` for these. The data-source env vars (`NUXT_PROPERTIES_*`, `NUXT_AGENTS_*`, `NUXT_DEVELOPMENTS_*`) and the per-tenant overrides (`NUXT_PUBLIC_SITE_URL__<TENANT_ID>`, `NUXT_LEADS_<KEY>__<TENANT_ID>`) are read by the server-only code from `process.env` directly on every request. **The built production server does not automatically read `.env` files** — the operator's platform-specific secret manager (or equivalent) is the source of truth for production env vars.

Do **not** commit secrets to the repository.

## 5. Static vs Node/Nitro Deployment

The template supports two deployment targets. The choice is **not** provider-specific — it is a build-output choice. The same host can serve either. The two outputs are **not equivalent**: a pure static deployment has no runtime Nitro server and therefore cannot serve `/api/*` endpoints at request time.

### 5.1 Why the two targets differ

`pnpm generate` produces a fully static export under `.output/public/`. No Nitro server is shipped. Every public page is rendered to HTML at build time; every server route under `server/api/`, `server/routes/`, and `server/middleware/` is either pre-rendered (the dynamic `/sitemap.xml` and `/robots.txt` are written as static files at build time) or **not shipped at all** (the `POST /api/contact` endpoint is not present in the static output). A pure static host has no way to execute server-side code at request time — nothing in the static output can mutate state, read `process.env`, or dispatch a webhook on the visitor's behalf.

`pnpm build` produces a Node / Nitro server output under `.output/server/` plus the same static assets under `.output/public/`. The Node process boots once, reads `process.env` into the private `runtimeConfig` block, and serves both the prerendered public pages and the runtime server routes (`POST /api/contact`, the same-origin property / agent / development catalog endpoints, the tenant-aware sitemap and robots routes) at request time. The same host can serve both — but the static `/sitemap.xml` and `/robots.txt` are still pre-rendered at build time, and serve the default tenant.

### 5.2 Capability matrix

The two targets expose a different runtime surface. The matrix below names every capability the operator might want a real-client deployment to provide.

| Capability | Static (`pnpm generate`) | Node / Nitro (`pnpm build`) |
| --- | --- | --- |
| Prerendered public pages (`/`, `/properties`, `/properties/[slug]`, `/agents`, `/agents/[slug]`, `/developments`, `/developments/[slug]`, `/about`, `/contact`) | **Yes** | **Yes** |
| Static bundled catalogs (the `sampleProperties` / `sampleAgents` / `sampleDevelopments` arrays in `app/features/*/data/*.ts`) | **Yes** | **Yes** |
| SEO assets generated at build time (`<link rel="canonical">`, `og:url`, `og:image`, per-page JSON-LD payloads, the pre-rendered `/sitemap.xml` and `/robots.txt`) | **Yes** | **Yes** |
| **One deployment / build per tenant** when tenant-specific output is needed (per-tenant catalog, per-tenant copy, per-tenant sitemap) | **Yes** | No |
| Runtime `POST /api/contact` (lead capture) | **No** | **Yes** |
| Runtime same-origin property / agent / development API endpoints (`GET /api/properties`, `GET /api/agents`, `GET /api/developments`) | **No** | **Yes** |
| Runtime `api` / `cms` data-source adapters (catalog fetched per request from `NUXT_PROPERTIES_API_URL` / `NUXT_PROPERTIES_CMS_URL` etc.) | **No** | **Yes** |
| Request-time hostname tenant resolution (multi-tenant hostname dispatch in `server/utils/tenant-context.ts`) | **No** | **Yes** |
| Per-tenant lead delivery configuration (`NUXT_LEADS_<KEY>__<TENANT_ID>` overrides) | **No** | **Yes** |
| Per-tenant canonical site URL at request time (`NUXT_PUBLIC_SITE_URL__<TENANT_ID>`) | **No** | **Yes** |
| Build-time content baking of a remote API / CMS source (see §5.3) | **Yes** | **Yes** |
| Runtime freshness of a remote API / CMS source | **No** | **Yes** |
| Per-process rate limit (5-per-10-minute lead-capture limiter) | **No** | **Yes** |
| Adapter selection at request time (`NUXT_LEADS_ADAPTER=disabled` / `log` / `webhook` / `email`) | **No** | **Yes** |

### 5.3 Build-time content baking on a static host

A `pnpm generate` run with a remote source configured (`NUXT_PROPERTIES_DATA_SOURCE=api` + `NUXT_PROPERTIES_API_URL` set at build time) **does** fetch the remote catalog at build time and bake the result into the static HTML. The same is true for `cms` and for the agents / developments features. This is **build-time content baking**, not runtime freshness:

- The remote endpoint is contacted **once**, during the `pnpm generate` run. The HTML, the JSON-LD payloads, the sitemap entries, and the JSON payload files (`/_payload.json`) all carry the snapshot fetched at build time.
- A later call to the remote endpoint is **not** reflected in the static output until the next `pnpm generate` run ships a new build artifact. A pure static host cannot observe a new record, a price change, or a `status: 'hidden'` flag until the operator rebuilds and re-deploys.
- The `pnpm generate` build is the only "live" moment for the remote data on a static host. The static output is frozen until the next build.

A Node / Nitro deployment serves the catalog through the same-origin Nitro endpoints (`server/api/properties.get.ts`, etc.), which read the loader's `process.env` per request. The remote source is fetched on every request (with concurrent-call coalescing inside the loader); a record added to the upstream API is reflected on the next page render.

### 5.4 Choosing

The choice is one question: **does the agency need any capability that requires a runtime Nitro server?**

The required capabilities are:

- **Live lead capture** (the agency wants the form to submit to a real destination). The agency must flip `agency.leads.enabled = true` AND configure a non-`disabled` lead adapter per §7. This requires `POST /api/contact` at request time.
- **Remote catalog with runtime freshness** (the agency wants the catalog to update without a redeploy). This requires the runtime `api` / `cms` data-source adapters.
- **Hostname-based multi-tenancy** (more than one agency behind a single build, dispatched by hostname). This requires the per-request tenant resolver.
- **Per-tenant lead delivery configuration** (different tenants send leads to different destinations). This requires the per-tenant lead resolver.

If any of the above is required, the deployment is **Node / Nitro** (`pnpm build`). This is the recommended deployment mode for a normal real-client deployment because the agency usually wants at least one of them — most commonly live lead capture.

If **none** of the above is required — the agency is shipping a brochure site with a static contact page and the contact-methods column is the canonical completion path — `pnpm generate` is the right choice. The build pipeline is simpler, the host is cheaper, and the operator does not need to provision a runtime Nitro server.

There is no hybrid. The static export cannot dynamically serve `POST /api/contact`; the Nitro server can also serve the prerendered static files but the operator pays the runtime cost.

## 6. Hostname and TLS

The hostname is the URL the agency's visitors type. The TLS certificate terminates at the edge (CDN, load balancer, or the Node server itself). The template does not ship a certificate, a DNS record, or a port-mapping config — the operator's platform owns all three.

Operational checklist:

1. **DNS.** Point the agency's hostname (and `www.` subdomain if the agency uses it) at the operator's edge. The active hostname is the lookup key for the multi-tenant registry; no DNS work is required for the default tenant.
2. **TLS certificate.** Issue a certificate that covers the hostname. A `Let's Encrypt` cert or the platform's managed cert is sufficient. The browser will reject the connection if the hostname does not match the certificate.
3. **Redirects.** If the agency wants the `www.` subdomain to canonicalize to the apex (or vice versa), configure the redirect at the edge. The template does not ship redirect logic.
4. **Verification.** After the DNS change propagates, `curl -I https://<host>/` returns `200` and `Content-Type: text/html`. The TLS chain is verified by the browser; the operator can verify it with `curl -I -v https://<host>/` and inspect the certificate.

Multi-tenant deployments repeat the checklist per tenant. The registry entry in `app/config/agencies/registry.ts` is the source of truth for which hostname routes to which agency config; the deployment's DNS is the source of truth for which hostname resolves to the deployment.

## 7. Lead Delivery

Lead delivery is the most operationally sensitive part of the deploy. The agency must decide which adapter before the deploy starts.

### 7.1 Choose an adapter

| Adapter | Operational profile |
| --- | --- |
| `disabled` | No live capture. The v1.0 placeholder behavior is preserved. The contact methods column is the completion path. |
| `log` | Single `console.info` line per accepted lead. No PII in the log line. Development-only. |
| `webhook` | The stamped lead is POSTed to `NUXT_LEADS_WEBHOOK_URL` with a 5-second timeout, an `X-Lead-Signature` HMAC SHA-256 header, and no redirect following. The agency-side endpoint verifies the signature with `NUXT_LEADS_WEBHOOK_SECRET`. The right choice when the agency has a CRM or a queue that accepts JSON. |
| `email` | The stamped lead is sent as a plain-text + HTML email through any configured SMTP server via Nodemailer. The right choice when the agency wants every lead to land in an inbox and does not want to wire a custom webhook endpoint. |

See `docs/REBRANDING.md` §12.2 for the full env-var table and §12.3 / §12.3b for the per-adapter error mapping and security notes.

### 7.2 Verify the destination

Before flipping the agency to live lead capture, verify the destination works in isolation:

- **Webhook:** `curl -X POST https://<agency-hook-url>/inbox -H "Content-Type: application/json" -d '{"sentinel":"smoke-test"}'` returns the expected 2xx response (the agency's endpoint must verify the signature in production, but the smoke test can omit the header for an out-of-band check).
- **Email:** Send a one-off test email from the SMTP server's web UI or a separate Nodemailer client to confirm the inbox is reachable and not on a spam list.

The endpoint itself is verified end-to-end after the deploy by the smoke checks in §9.

### 7.3 Go live

Two flags must flip together:

1. `app/config/agencies/default.agency.ts` → `leads.enabled: true`.
2. The deployment environment → `NUXT_LEADS_ADAPTER` plus the adapter-specific env vars.

Flipping only one is half-configured: if the agency enables the form but no adapter is set, the endpoint returns 503 on every submission; if the adapter is set but the agency has not enabled the form, the placeholder UI is shown and no submission is attempted.

## 8. Production Validation Commands

Run the full pipeline before every deploy. The pipeline is the same set of commands the CI workflow runs (`pnpm lint`, `pnpm test`, `pnpm build`, `pnpm test:e2e`) plus the static-export smoke check and the whitespace-check.

```bash
pnpm install
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
NUXT_PUBLIC_SITE_URL=https://example.test pnpm generate
git diff --check
```

Exit code 0 from every command is the gate. The exact results from the current `feature/lead-capture-v1.1` HEAD:

- `pnpm test` — 1150 Vitest cases across 42 files pass.
- `pnpm test:e2e` — 62 Playwright cases across 8 spec files pass.
- `pnpm lint` — 0 errors, 0 warnings.
- `pnpm build` — completes successfully.
- `pnpm generate` — 203 prerendered routes with `NUXT_PUBLIC_SITE_URL=https://example.test`.
- `git diff --check` — clean.

A known unrelated `@nuxt/image` warning about missing `sharp` binaries for `win32-x64` is emitted on Windows hosts. It is non-fatal: the build completes, the generated site renders, and the template ships SVG placeholder images that do not require `sharp`. The warning is documented in `docs/REBRANDING.md` §13.

The `pnpm test:e2e` requires a prior `pnpm build` (its `webServer` boots `pnpm preview`). Run it after the build completes.

## 9. Deploy

The deploy step is platform-specific. The template does not ship provider-specific infrastructure (no Docker, no CI/CD deployment jobs, no Terraform, no configuration for a specific provider). The operator translates the following two inputs into the platform's deploy primitive:

- **Static export:** upload `.output/public/` to the static host. The directory is fully self-contained and contains no server-side state.
- **Node / Nitro server:** ship `.output/server/index.mjs` plus `.output/public/` to the runtime. The standard Node entry point is `node .output/server/index.mjs`; the operator's platform provides the process manager, port mapping, and restart policy.

Environment variables are passed through the platform's secret manager to the runtime. The build-time env vars (`NUXT_PUBLIC_SITE_URL`) must be present at build time; the server-only env vars (everything else) must be present at runtime. Both are read by `runtimeConfig` and `process.env` respectively.

There is no special deploy hook to wire. The template's CI workflow (`.github/workflows/ci.yml`) runs the validation pipeline on every push and pull request to the default branches but does not deploy.

## 10. Post-Deployment Smoke Checks

Run the smoke checks from a host on the public internet (not from inside the deployment's private network). The pattern is the same one `docs/REBRANDING.md` §16.1 / §16.2 uses for the production-readiness checklist.

### 10.1 The four public routes

```bash
curl -I https://<host>/
curl -I https://<host>/properties
curl -I https://<host>/about
curl -I https://<host>/contact
```

Each must return `200 OK` and `Content-Type: text/html`. The `/properties` route must show the real catalog (titles + prices + locations matching the replaced sample data). The `/contact` route must show the contact-methods column and either the placeholder form (agency has `leads.enabled: false`) or the live form (agency has `leads.enabled: true`).

### 10.2 The SEO infrastructure

```bash
curl -I https://<host>/sitemap.xml
curl -I https://<host>/robots.txt
```

Both must return `200 OK`. The sitemap body must include a `<urlset>` element (use `curl https://<host>/sitemap.xml` to inspect the body); the `robots.txt` body must include a `Sitemap: https://<host>/sitemap.xml` line and a `User-Agent: *` block (use `curl https://<host>/robots.txt` to inspect the body). The two routes are safe GET routes — they do not mutate state and do not consume any rate limit budget.

`curl -I` is for status and headers only. **To inspect the response body, use plain `curl`** (no `-I` flag) and pipe through `head` or `less` as needed.

### 10.3 The lead pipeline (when live)

When the agency has live lead capture:

```bash
curl -X POST https://<host>/api/contact \
  -H "Content-Type: application/json" \
  -d '{"name":"Smoke Test","email":"smoke@example.test","phone":"+1 555 000 0001","message":"Smoke test from the deployment runbook. Please ignore.","locale":"en"}'
```

A successful submission returns `200 OK` with `{ ok: true, accepted: true }`. The destination (the webhook inbox, the SMTP inbox, or the `log` stdout depending on the adapter) must show the lead within seconds. Failed deliveries return a JSON error body that documents the transport response:

| Status | Cause | Operator action |
| --- | --- | --- |
| 200 | Accepted. | Confirm the destination received the lead. |
| 400 | Schema validation failure. | The smoke payload must include every required field. |
| 413 | Body > 16 KB. | The smoke payload is small; 413 indicates a client bug. |
| 415 | Content-Type is not `application/json`. | The smoke test must send `Content-Type: application/json`. |
| 429 | Per-process rate limit (5 accepted attempts per 10 minutes per request key). | Wait 10 minutes or restart the process to reset the limiter. |
| 502 | Adapter delivery failure. | Inspect the destination (webhook / SMTP) and the server-side `console.warn` / `console.error` lines. |
| 503 | Adapter is `disabled`. | Confirm `NUXT_LEADS_ADAPTER` is set and the agency has `leads.enabled: true`. |

A GET to `/api/contact` returns 405 by design — the endpoint is POST-only. **Do not use `POST /api/contact` as an uptime probe.** The safe uptime probes are `/` and `/sitemap.xml` (see §10.2).

### 10.4 The catalog (when a remote data source is in use)

When the agency is using `api` or `cms` for a feature:

```bash
curl https://<host>/properties | grep -o '<title>[^<]*</title>' | head -5
curl https://<host>/agents | grep -o '<title>[^<]*</title>' | head -5
curl https://<host>/developments | grep -o '<title>[^<]*</title>' | head -5
```

The page titles must match the agency's real catalog (the loaded data, not the bundled sample data). If the page shows the placeholder content, the data-source env vars are not set correctly.

### 10.5 JSON-LD sanity

The home page and the structured-data pages emit JSON-LD as `<script type="application/ld+json">` blocks. Confirm the canonical URL and the `@id` reflect the configured `NUXT_PUBLIC_SITE_URL`:

```bash
curl -s https://<host>/ | grep -o 'application/ld+json[^<]*<[^>]*>[^<]*' | head -5
```

The `RealEstateAgent.@id` should be the home page's absolute URL (`https://<host>/`). The `Sitemap:` line in `robots.txt` should be `https://<host>/sitemap.xml`. When `NUXT_PUBLIC_SITE_URL` is empty, these absolute URLs are omitted — the deployment is broken if the site URL is unreachable.

## 11. Rollback

Rollback is a deploy-time concept, not a runtime concept. The operator's platform owns the rollback mechanism (a previous deploy, a previous build artifact, a previous Git tag). The template does not ship a rollback script.

A simple operational rollback looks like this:

1. **Pin the previous known-good build.** Every successful deploy should be tagged with a build id (a Git SHA, a CI run number, a timestamp). The operator's platform keeps the last N build artifacts (the default in most serverless / container hosts is 5–10).
2. **Promote the previous build.** Re-point the production traffic at the previous build's URL or re-deploy the previous artifact. For a static host, this is a re-upload of the previous `.output/public/`. For a Node / Nitro server, this is a restart with the previous image / artifact.
3. **Verify the rollback.** Re-run the smoke checks in §10 against the rolled-back deployment. The four public routes, the SEO infrastructure, and (if applicable) the lead pipeline must all pass.
4. **Diagnose the regression.** Inspect the failed build's logs. For the lead pipeline, the `console.warn` / `console.error` lines on the server output are the structured-logging hooks an error tracker consumes. For a Nitro build, the server log includes the adapter error code (`auth` / `transport` / `unsupported`).
5. **Forward-fix and re-deploy.** Apply the fix on top of the last known-good build. Run the validation pipeline (§8) before re-deploying.

Two retryable patterns to keep in mind:

- **The lead pipeline is sticky.** The 5-per-10-minute per-process rate limit is in-memory. A server restart resets the limiter. A re-deploy typically restarts the process. A re-deploy is therefore safe to use as a "reset the rate limit" operation, but it does **not** reset the limit for a determined attacker — the limit is per-process, and a multi-process deployment shares no state between instances.
- **The agency config is read at module load.** A wrong env var takes effect on the next deploy, not on the next request. The same is true for the agency config file — a re-deploy is required to pick up the new config.

The rollback time depends on the operator's host. The steps above are honest about what needs to happen, not about how long a specific platform takes to do it.

## 12. References

- `docs/REBRANDING.md` §16 — the production-readiness checklist (8 blockers, 6 recommended, 5 optional).
- `docs/REBRANDING.md` §12 — the lead-capture pipeline, the four adapter env-var tables, and the endpoint transport behavior.
- `docs/MULTI_TENANT.md` §2 — the per-tenant canonical URL override convention.
- `docs/MULTI_TENANT.md` §9 — the per-tenant lead delivery configuration convention.
- `docs/RELEASE_NOTES_v1.1.md` — the v1.1.0 release notes (the four pluggable adapters, the validation pipeline, the static-vs-Nitro trade-off).
- `docs/ROADMAP.md` M29 — the static, source-level production-readiness review that fed the §16 checklist.
- `README.md` — the supported scripts and the two deployment modes.
