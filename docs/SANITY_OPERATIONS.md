# Sanity Operations Guide

This is the **post-implementation operations guide** for a real-estate agency that uses Sanity as the CMS behind the Nuxt app. It is the bridge between:

- `docs/CLIENT_ONBOARDING.md` — the upstream "what to collect from the client" checklist (the agency-side info, the project-ownership rules, the handoff table).
- `docs/SANITY_VALIDATION.md` — the one-time validation procedure (project creation, dataset, Studio install, real-content round-trip).
- `studio/README.md` — the Studio developer's manual (project creation, dataset creation, Studio install + deploy, schema contract, schema tests).
- `docs/DEPLOYMENT.md` — the Nuxt-side deploy procedure (env-var lifecycle, static vs Node/Nitro, smoke checks, rollback).

This guide does **not** duplicate any of those. It walks through the **day-to-day operational workflow** after the project is live: who owns what on the Sanity platform, who can change what, how the editor publishes content, how the agency / operator verifies a content change is live, how to recover from a bad publish, how to back up the dataset, and how to hand the project off when the engagement ends.

The guide is **CMS-specific to Sanity** but **provider-agnostic about hosting**: the Studio deploys to Sanity's managed hosting at `<projectId>.sanity.studio`; the Nuxt app deploys to whatever the operator chose (Vercel, Netlify, Cloudflare, AWS, a bare Node server, etc.). The hosting choice is in `docs/DEPLOYMENT.md`; this guide touches it only where the choice changes the Sanity-side operational workflow.

## 1. Ownership model (the cardinal rules)

These rules are **non-negotiable** and override any conflict with a maintenance agreement, an implementer preference, or a handoff document. The agency and the operator sign off on them in writing at the handoff.

### 1.1 Sanity platform ownership (the cardinal rules)

1. **One client = one agency = one isolated Sanity project.** Each rebranded deployment owns its own Sanity project. Sanity projects are **not** shared across clients and **not** shared across agencies inside a multi-tenant deployment. The catalog the deliverable serves comes from that project alone. Clients only receive access to their own isolated Sanity project.
2. **The agency owns the project and billing.** The Sanity organisation (the company-level billing entity) is the agency's. The implementer / operator is a member, not the owner. The agency's billing email receives Sanity's monthly / annual invoice.
3. **The agency always retains Administrator access.** At least one Sanity user with the **Administrator** role on the project is an agency member. The agency is the sole owner of the only-admin access. This rule does not lapse during a maintenance engagement, during an incident, or at the handoff.
4. **Operator access depends on the maintenance agreement.** A project-based engagement releases all operator roles at the handoff. An ongoing-maintenance contract may keep the operator on a role appropriate to the agreement (the role choice is the agreement's call — see §2.3); the maintenance agreement names the role and the renewal cadence. Removing operator access is **not** required when ongoing maintenance is contracted.
5. **The agency's photography is uploaded to the agency's own media store.** The implementer / operator does not keep copies of the licensed assets on personal Sanity accounts. The agency's Sanity project (or the agency's preferred external CDN) is the only canonical location for the agency's images.
6. **Sanity secrets are not committed to the repository.** The agency's project ID, dataset name, and read token live in the platform's secret manager (or in a local ignored `.env` file during development) — never in the committed source tree. The committed `.env.example` carries only variable names and non-secret placeholders.

### 1.2 Source-code ownership (the commercial agreement)

The cardinal rules above cover the **Sanity platform**: the agency owns the Sanity organisation, the project, the dataset, the billing, the content, and the credentials. The cardinal rules do **not** cover the **source-code repository** of the rebranded Nuxt + Studio codebase. The source-code repository, the license, the transfer rights, the delivery model, and the repository-access cadence are determined by the **commercial agreement** between the agency and the implementer / operator, not by these platform rules.

Concretely:

- A project-based engagement may deliver the source code under any license the commercial agreement names (the implementer's default license, a custom license, an open-source license, or a transfer-of-ownership clause). The agency's "ownership" of the platform (Sanity) is independent of the commercial agreement's "ownership" of the source code.
- An ongoing-maintenance engagement's source-code access (read-only, read + write, or admin on the Git host) is named in the commercial agreement, not in the platform rules above.
- The end-of-contract handoff in §8 records the source-code access split only if the commercial agreement grants the agency source-code ownership; the operations guide does not assert that the agency owns the source-code repository by default.

The handoff document in `docs/CLIENT_ONBOARDING.md` §4.7 records the access split before the implementer leaves the engagement; the commercial agreement (a separate document) records the source-code terms. This guide does not duplicate either; it adds the **post-handoff operational cycle** for the Sanity platform side of the engagement.

## 2. One-time setup (project, dataset, Studio, Nuxt)

The one-time setup is covered by the existing guides. This section indexes them in the order the operator follows them; it does not re-state the steps. Each step's scope is named, the owner is named, the deliverable is named, and the next step is named.

| # | Action | Owner | Reference | Deliverable |
| --- | --- | --- | --- | --- |
| 2.1 | Collect the Sanity-side inputs from the agency (CMS provider confirmation, agency Sanity organisation, billing email, project name). | The implementer | `docs/CLIENT_ONBOARDING.md` §2.1 (CMS project subsection) | A Sanity project URL + project ID + dataset name on paper. |
| 2.2 | Create the Sanity project on the agency's Sanity organisation. | The implementer (during the build) or the agency (after handoff) | `studio/README.md` §1; `docs/SANITY_VALIDATION.md` §2 | A live project URL on `https://www.sanity.io/manage`. |
| 2.3 | Create the `production` dataset with public visibility. | The implementer (during the build) or the agency (after handoff) | `studio/README.md` §5; `docs/SANITY_VALIDATION.md` §3 | A public `production` dataset the Nuxt driver can read via the public CDN. |
| 2.4 | Install the Studio locally + configure the project ID + dataset. | The implementer | `studio/README.md` §2–§3; `docs/SANITY_VALIDATION.md` §4 | A `studio/.env` (committed to the agency's working tree, never to git) with `SANITY_STUDIO_PROJECT_ID` + `SANITY_STUDIO_DATASET=production`. |
| 2.5 | Deploy the Studio to Sanity's managed hosting. | The implementer (during the build) or the agency (after handoff) | `studio/README.md` §7 | A live Studio at `<projectId>.sanity.studio` the agency editors sign in to. |
| 2.6 | Grant the agency Administrator access. | The implementer (during the build) | `studio/README.md` §8 | At least one Sanity user (the agency owner) with the Administrator role on the project. |
| 2.7 | Configure the Nuxt app's server-side Sanity env vars on the deployment's secret manager. | The implementer (during the build) or the operator (after handoff) | `docs/DEPLOYMENT.md` §4.2, §4.4; `docs/SANITY_VALIDATION.md` §7 | The deployment's secret manager holds `NUXT_SANITY_PROJECT_ID`, `NUXT_SANITY_DATASET`, `NUXT_SANITY_API_VERSION`, optional `NUXT_SANITY_TOKEN`, and the per-feature `NUXT_<FEATURE>_CMS_PROVIDER` + `NUXT_<FEATURE>_DATA_SOURCE=cms`. |
| 2.8 | Run the one-time Sanity validation procedure (real-content round-trip). | The implementer | `docs/SANITY_VALIDATION.md` §0–§13 | A verified end-to-end pipeline: real Studio content → published dataset → `@sanity/client` → GROQ projection → mapping → Zod boundary → same-origin Nitro endpoint → Nuxt page render. The opt-in `pnpm test:e2e:sanity` is the live round-trip. |
| 2.9 | Capture the handoff record. | The implementer + the agency | `docs/CLIENT_ONBOARDING.md` §4.7 | The handoff table signed by both parties; the operator's role named (Editor / Developer / Administrator — see §2.3) with a renewal / removal schedule. |

### 2.1 Sanity plan and role implications

Sanity ships three plan tiers with different role sets. The current default roles per plan are:

- **Free** — supports **Administrator** (full access) and **Viewer** (read-only). Two roles total.
- **Growth** — adds **Editor**, **Developer**, and **Contributor** to the Free pair. Five roles total.
- **Enterprise** — custom; the agency's contract with Sanity names the available roles.

The exact plan details (document count, dataset count, history-retention window, etc.) evolve with Sanity's product; the agency's account dashboard at <https://www.sanity.io/manage> is the source of truth for the live values. The implementer / operator confirms the plan with the agency before the agency-side accounts are created.

### 2.2 Role capabilities

The five Sanity project roles, in order of privilege:

- **Administrator** — full project access: administrative / billing / member authority over the project, content (create, read, update, publish, delete), and developer infrastructure (datasets, tokens, CORS, webhooks, GraphQL, deploy). The agency always retains at least one Administrator (§1.1 rule 3).
- **Editor** — content editing + publishing. Create, read, update, publish, and delete content. **Cannot** manage developer infrastructure (datasets, tokens, CORS, webhooks, GraphQL, deploy) and **cannot** perform administrative / billing / member actions. The right role for an agency editor whose scope is the published content alone.
- **Developer** — content editing + publishing + developer infrastructure. Create, read, update, publish, and delete content **and** manage developer infrastructure (datasets, tokens, CORS, webhooks, GraphQL, deploy). The Developer role is **not** read-only on content. **Cannot** perform administrative / billing / member actions. The right role for an operator whose scope includes both the publish workflow and the project infrastructure.
- **Contributor** — draft editing only. Create + update **drafts**. **Cannot** publish. **Cannot** manage developer infrastructure. **Cannot** perform administrative / billing / member actions. The right role for a content preparer whose drafts an Editor / Developer reviews before publish.
- **Viewer** — read-only content access. No administrative / billing / member authority, no developer infrastructure, no content editing.

### 2.3 Operator role choice (under the maintenance agreement)

The operator's Sanity role is named in the **maintenance agreement**; the role is renewed on the cadence the agreement names. The role choice is the agreement's call based on what the operator needs to do:

- **Operator only publishes content (the common case).** Choose **Editor**. The Editor role can publish content but cannot manage developer infrastructure. This is the right answer for an operator whose scope is the Nuxt deploy, the post-deploy smoke checks, the rollback, and the incident response — none of which require developer-infrastructure access.
- **Operator needs both content publishing AND developer-infrastructure responsibilities.** Choose **Developer**. The Developer role covers both capabilities (content editing/publishing + datasets, tokens, CORS, webhooks, GraphQL, deploy). There is no need to combine Editor + Developer — Developer already includes the full Editor content-publishing capability, so a single Developer role is sufficient and is the right answer.
- **Contributor is not appropriate for an operator who must publish production content.** Contributor can edit drafts but cannot publish; an operator on Contributor cannot perform the publish action the maintenance agreement typically requires. The role is for content preparers in a multi-step review workflow, not for an operator with publish responsibility.

The handoff document in `docs/CLIENT_ONBOARDING.md` §4.7 names the operator's role. The role is renewed on the cadence the agreement names (typically annual). Removing the role at the end of the engagement is the §8 handoff step.

### 2.4 Public vs private dataset

A **public** dataset is read via Sanity's public CDN with no token; this is the pilot's default. A **private** dataset requires a read token (`NUXT_SANITY_TOKEN`) and the agency's dataset must be marked private. The Nuxt driver reads both — the `useCdn: true` flag in `server/utils/sanity-config.ts` uses the public CDN when the dataset is public and the read token otherwise. A privacy-driven rebrand (the agency's catalog is not for public consumption) chooses the private path. The public path is the simpler default.

### 2.5 Token ownership and rotation (a recommended baseline, not a Sanity requirement)

A public dataset does not need a read token. A private dataset needs a read token (`NUXT_SANITY_TOKEN`). The token is a **project-scoped** Sanity API token; the agency owns the token (the implementer creates it during the build and transfers the secret at the handoff). The agency's billing account is the source of truth for the active token.

A **recommended baseline** rotation cadence is: when an agency member with access to the token leaves the team, or every 12 months, whichever is sooner. This baseline is a defensive default; Sanity does not require it. The **actual cadence is named in the maintenance agreement** (or in the agency's internal security policy if no maintenance agreement is in place). The rotation procedure is:

1. Create a new token in the project's **API → Tokens** panel.
2. Update the deployment's secret manager with the new token.
3. Redeploy the Nuxt app so the new token is loaded.
4. Revoke the old token in the project's **API → Tokens** panel.

The rotation is the agency's responsibility (or the operator's under a maintenance agreement that names the rotation as in-scope work). Sanity's project history is unaffected by a token rotation; the new token reads the same published dataset.

## 3. Client editing workflow (the normal day-to-day)

This is the workflow the agency's editor uses every time they publish a property, agent, or development. The agency editor is a non-technical user; the Studio is the only tool they need to know.

| # | Action | Owner | Reference | Notes |
| --- | --- | --- | --- | --- |
| 3.1 | Sign in to the Studio at `<projectId>.sanity.studio`. | The agency editor | `studio/README.md` §4 | The agency's Sanity account. The agency grants the editor the right role at the team-management step (Administrator on the Free plan, Editor on the Growth plan). |
| 3.2 | Pick the document type in the sidebar (Property, Agent, Development) and click **Create new**. | The agency editor | `studio/README.md` §6 | The Studio groups the fields into tabs. The default tab is the editorial starting point. The editor fills in the required fields (the Studio blocks publish on missing required fields with a human-readable error message). |
| 3.3 | Use the **slug** widget to override the auto-generated slug if needed. | The agency editor | `studio/README.md` §6 (slug source) | The slug is auto-generated from the title / name; the editor can override. The slug is the canonical URL parameter for the public route. |
| 3.4 | Upload the **cover image** (or development cover / agent portrait) and the **gallery** (for properties). | The agency editor | `studio/README.md` §6 (image guidance) | Square portraits for agents; landscape (16:9 or 4:3) for properties and developments. The Studio stores the asset on Sanity's media store; the GROQ projection flattens the asset to a URL the Nuxt IPX provider processes. |
| 3.5 | Set the **status** (Property + Development). | The agency editor | `studio/README.md` §6 (status descriptions) | A published property with the `hidden` status stays in the published dataset but is excluded from the public catalog by the GROQ filter. Sanity drafts are a separate concept; the Nuxt app reads the published dataset only. |
| 3.6 | Click **Publish**. | The agency editor | `studio/README.md` §6 | The Studio validates required fields and writes to the published dataset. The published dataset is the source of truth for the Nuxt app. |
| 3.7 | (Optional) verify the change is live on the public site. | The agency editor or the operator | `docs/DEPLOYMENT.md` §10 (the post-deploy smoke checks) | The agency editor's "did my change go live?" check: open the public listing / agent / development page; the new record should appear on the next page render. |

**The agency's responsibility ends at Publish.** The Nuxt deployment reads the published dataset; the deploy surface is the operator's responsibility. The agency editor does not touch the Nuxt repo, the deploy environment, the data-source env vars, or the Sanity project's API settings.

**Permissions the agency editor does NOT have.** The agency editor (on a Free plan Administrator role, or a Growth plan Editor role) does not have the project-management primitives: dataset creation, dataset deletion, project deletion, plan changes, billing changes, member-management changes. Those are reserved for the agency owner (the always-present Administrator). The implementer / operator does not change the project structure during an engagement without the agency's written approval.

## 4. Operator / maintenance workflow (when a contract is in place)

The operator's responsibility is the **Nuxt deploy** and the **Studio deploy** when the agency's CMS is the data source. The operator is also responsible for the **content pipeline health** — the validation, the smoke checks, the rollback, the incident response. The agency owns the content; the operator owns the engine that serves it.

| # | Action | Owner | Reference | Notes |
| --- | --- | --- | --- | --- |
| 4.1 | Maintain the Nuxt deploy (env vars, build, smoke checks, rollback). | The operator | `docs/DEPLOYMENT.md` §4, §8, §9, §10, §11 | The operator runs the production validation pipeline before every deploy and the post-deploy smoke checks after every deploy. The operator owns the previous-build promotion for rollback. |
| 4.2 | Maintain the Studio deploy at `<projectId>.sanity.studio`. | The operator (if contracted and the operator has the Developer role) or the agency (otherwise) | `studio/README.md` §7 | The Studio redeploys with `cd studio && pnpm deploy`. The Studio's authentication is Sanity's own; the operator's Developer role grants them access to redeploy. |
| 4.3 | Maintain the Sanity-side env vars on the Nuxt deployment. | The operator | `docs/DEPLOYMENT.md` §4.2 (data-source env vars), §4.4 (per-tenant overrides) | The env vars `NUXT_SANITY_PROJECT_ID`, `NUXT_SANITY_DATASET`, `NUXT_SANITY_API_VERSION`, optional `NUXT_SANITY_TOKEN`, and the per-feature `NUXT_<FEATURE>_CMS_PROVIDER` + `NUXT_<FEATURE>_DATA_SOURCE` are read from the deployment's secret manager. The operator's secret-manager access is named in the maintenance agreement. |
| 4.4 | Validate content changes against the live dataset after a published change. | The operator (or the agency) | `docs/SANITY_VALIDATION.md` §0–§13 (the validation procedure); `pnpm test:e2e:sanity` (the opt-in real-content round-trip) | The opt-in `pnpm test:e2e:sanity` is the live round-trip; it requires `SANITY_REAL_E2E=1` and a running dev server. The default `pnpm test:e2e` is the deterministic static-data suite and does not require a real Sanity project. |
| 4.5 | Respond to incidents (bad publish, schema drift, deploy failure). | The operator (Nuxt side) + the agency (Sanity content side) | This guide §6, §7; `docs/DEPLOYMENT.md` §11 (rollback) | The operator owns the Nuxt-side rollback. The agency owner owns the Sanity-side content fix (the operator's Sanity role is named in the maintenance agreement; the agency's Administrator is the only role that can change project structure). |
| 4.6 | Report the monthly / quarterly operational summary to the agency. | The operator | (no reference — the operator writes the summary) | The summary lists: deploys shipped, smoke-check results, incidents + resolutions, content-pipeline uptime, recommended follow-ups from `docs/CLIENT_ONBOARDING.md` §2.3. |

**Operator Sanity role.** The operator's Sanity role is named in the **maintenance agreement**; the role is renewed on the cadence the agreement names (see §2.3 for the role choice). The contract-dependent role is one of:

- **Editor** — when the operator only publishes content and does not need developer-infrastructure access.
- **Developer** — when the operator needs both content publishing AND developer-infrastructure responsibilities (datasets, tokens, CORS, webhooks, GraphQL, deploy). Developer already includes the full Editor content-publishing capability, so a single Developer role is sufficient and is the right answer.
- **Contributor** is not appropriate for an operator who must publish production content (§2.3).

**Operator access boundaries.** The operator does **not** delete documents in the published dataset unless the agency owner has approved the deletion in writing. The operator does **not** change the Studio schemas (`studio/schemas/*.ts`) unless the maintenance agreement explicitly includes schema work. The operator does **not** rotate the read token unless the agency owner has approved the rotation. The boundary protects the agency's content from accidental operator-driven change.

## 5. Smoke validation after content changes (the "did my change go live?" check)

The agency / operator verifies a content change with a 4-step smoke check. The check is fast (under 60 seconds) and can be run by the agency editor after a publish or by the operator after a deploy.

1. **The Studio confirms the publish.** Open the document in the Studio; the "Published" timestamp updates on every publish. The Studio's "Published" tab shows the live version.
2. **The Sanity dataset shows the change.** The operator (or a developer with the CLI) can run `pnpm exec sanity documents query --query '*[_type == "property" && slug.current == "<slug>"][0]{title, status, _updatedAt}'` from `studio/` to confirm the published record.
3. **The Nuxt app's same-origin API returns the change.** On a Node / Nitro deploy, `curl https://<host>/api/properties | jq '.[] | select(.slug == "<slug>") | .title'` returns the new title within seconds (the loader's no-permanent-cache + in-flight coalescing contract means the next request after a publish sees the new data). On a static deploy, the change is visible after the next `pnpm generate` ships a new artifact.
4. **The public page renders the change.** Open `https://<host>/properties/<slug>` in a browser; the new title, description, image, and fields are present. If the change is a `status: 'hidden'` flip, the page returns 404 (the runtime GROQ filter excludes hidden records).

The opt-in `pnpm test:e2e:sanity` Playwright spec automates the round-trip end-to-end: it requires `SANITY_REAL_E2E=1` and a running dev server. The 11 cases assert the published data, the cross-list reference resolution, and the image loading. The smoke check above is the manual counterpart.

**Smoke check after a deploy.** The post-deploy smoke checks in `docs/DEPLOYMENT.md` §10 are the operator's responsibility and are separate from the content-publish smoke check. A deploy without a content change still runs the deploy smoke checks; a content change without a deploy still runs the content-publish smoke check. A content change **plus** a deploy runs both, in the order: deploy smoke checks first (to confirm the deploy is healthy), content-publish smoke checks second (to confirm the new content is live).

## 6. Export / backup expectations

Sanity is a hosted service. The agency owns the **content**; Sanity owns the **infrastructure**. The agency is responsible for backing up the dataset because the published dataset is the agency's canonical content store.

### 6.1 Document history vs dataset export (which is the actual backup)

Sanity ships two recovery mechanisms; the agency / operator should use the right one for the situation:

- **Document history** — the Studio's "History" panel (and the `pnpm exec sanity documents mutations` API) shows the document's recent published versions. The agency editor (or the operator on the agency's request) can revert a single document to a previous version. **History is useful for recent content rollback** — a single bad publish, a wrong price, a wrong status. **Revision retention is plan-dependent**: the current Sanity plan tiers ship the following history-retention windows — **Free: 3 days; Growth: 90 days; Enterprise: 365 days, with custom retention potentially available**. The agency's account dashboard at <https://www.sanity.io/manage> is the source of truth for the live retention window; the values evolve with Sanity's product. The Free window is short by design (3 days of recent history is a recent-rollback window, not a long-term backup). **Document history is not a backup mechanism for long-term retention.**
- **Dataset export** — the `sanity datasets export` CLI produces a gzipped tarball the agency stores in a location the agency owns. The export is the **actual backup mechanism** for long-term retention. A backup's retention is whatever the agency's storage policy names (the Sanity plan's history window does not constrain the backup's retention).

The agency uses document history for the "I just published the wrong value" case (a recent rollback). The agency uses dataset exports for the "I need to recover from a corrupt dataset" case (a long-term backup). The two are complementary, not interchangeable.

### 6.2 Backup cadence (a recommended baseline, not a Sanity requirement)

A **recommended baseline** cadence is weekly for a small agency (a few hundred documents) and daily for a high-velocity catalog. The cadence is the agency's choice; the maintenance agreement may name a cadence the operator supports. Sanity does not require a specific cadence.

### 6.3 Backup procedure (current Sanity CLI shape)

The current Sanity CLI exposes `sanity datasets` (plural) for export / import. The backup procedure is:

```bash
cd studio
pnpm exec sanity datasets export production ./backups/production-<YYYY-MM-DD>.tar.gz
```

The export is a gzipped tarball the agency stores in a location the agency owns (the agency's cloud storage, the agency's local archive, etc.). Operator access to or retention of a working copy depends on the maintenance agreement and the applicable retention/security policy; operator backups must never be stored in unauthorized personal storage.

### 6.4 Restore procedure

The restore procedure is the inverse of the export. The preferred documented import form takes the target dataset via the `-d` flag:

```bash
cd studio
pnpm exec sanity datasets import -d production ./backups/production-<YYYY-MM-DD>.tar.gz --replace
```

`--replace` overwrites the dataset with the backup. The restore is destructive — every published record after the backup's timestamp is lost. The agency owner must approve every restore in writing. The restore is the agency's responsibility (or the operator's under a maintenance agreement that names the restore as in-scope work).

### 6.5 Backup ownership and retention

The backup file is the **agency's property**: the agency owns the dataset the backup is derived from, the agency owns the file the export produces, and the agency controls the authoritative backup location. Operator access to or retention of a working copy depends on the **maintenance agreement** and the **applicable retention/security policy** (the agency's own policy, the operator's own policy, or a combination named in the agreement). Concretely:

- During a maintenance engagement, the operator may hold a working copy of the most recent backup to support the operator's incident-response workflow. The maintenance agreement names the operator's access window, the backup's retention, and the storage location(s) the operator may use.
- At the end of a maintenance engagement, the operator returns (or destroys) the working copy as named in the agreement. The agency keeps the canonical backup.
- **Operator backups must never be stored in unauthorized personal storage.** A storage location outside the agreement's named scope is unauthorized, regardless of any other clause in the agreement.

### 6.6 Studio schema as code

The Studio's schemas live in `studio/schemas/*.ts` and are committed to the source-code repository. The agency (or the next operator) rebuilds the Studio from the same repository, so the schemas are version-controlled. The schemas are the source of truth for the editor contract; the GROQ queries in `server/utils/sanity-mappings.ts` and the runtime Zod schemas in `app/features/*/schemas/*.schema.ts` are the source of truth for the runtime contract. The two are matched by hand (and the Studio's `schemas.test.ts` pins the field-name parity).

## 6.7 Sanity webhook integration (Task 128)

The Studio webhook flow shrinks the static deployment's content-staleness window from "next `pnpm generate`" to "within seconds of the Sanity event". The Node/Nitro deployment already re-fetches the remote catalog on every request per the v1.1.0 M17 / M20 no-permanent-cache contract, so the webhook's primary value is the **static** case.

The webhook flow is **two separate architectures** — one per deployment mode — that converge on a single provider-agnostic external rebuild trigger.

The new server modules are:

- `server/utils/sanity-webhook.ts` — the inbound signature verifier (hand-rolled HMAC-SHA256, base64url-encoded; `node:crypto` only; no `@sanity/webhook` dependency).
- `server/utils/sanity-webhook-dedup.ts` — the in-memory idempotency cache keyed on the `idempotency-key` header.
- `server/utils/deploy-trigger.ts` — the provider-agnostic external rebuild trigger (`redirect: 'manual'`, bounded AbortController timeout).
- `server/api/webhooks/sanity.post.ts` — the Node/Nitro webhook endpoint that wires the three utility modules together and applies the documented status-code mapping.

### 6.7.1 Static deployment flow (`pnpm generate`)

A `pnpm generate` deployment emits `.output/public/` only — **no Nitro runtime, no `server/api/*` endpoints**. The Nuxt-side webhook endpoint at `server/api/webhooks/sanity.post.ts` does NOT exist at runtime on a static host. A webhook configured against the static hostname would 404 or hang at the static host's edge.

The static deployment's webhook trigger therefore terminates at infrastructure that actually exists at runtime:

- **A hosting-provider deploy hook.** Most static hosts expose a per-project deploy hook URL (a small webhook-to-deploy pipeline). The operator configures Sanity to POST to that URL. The host's pipeline runs `pnpm install --frozen-lockfile && pnpm generate && deploy`, and the new artifact picks up the latest content.
- **A CI workflow with `repository_dispatch` triggered via a serverless receiver.** A small receiver (Cloudflare Worker, Lambda, edge function, Vercel edge middleware, even a tiny Node script) receives the Sanity webhook, translates it into a `repository_dispatch` event with `event_type: 'sanity-webhook'`, and the workflow's `on.repository_dispatch` step runs the same `pnpm install --frozen-lockfile && pnpm generate && deploy` sequence.
- **A direct GitHub Actions `workflow_dispatch` via the GitHub REST API.** Equivalent to the above; the receiver authenticates with a GitHub PAT (`secrets.WORKFLOW_TOKEN`) and triggers the workflow.

The static deployment does NOT need `server/api/webhooks/sanity.post.ts` and does NOT need `NUXT_SANITY_WEBHOOK_SECRET` / `NUXT_DEPLOY_HOOK_URL` on its deployment environment. The receiver (not the Nuxt app) holds the secret + the deploy-hook URL.

### 6.7.2 Node/Nitro deployment flow (`pnpm build`)

A `pnpm build` deployment ships `.output/server/index.mjs` (Nitro runtime) + `.output/public/` (prerendered public pages). The webhook endpoint at `server/api/webhooks/sanity.post.ts` runs at request time and handles the Sanity webhook end-to-end:

1. **Verify the signature** against the raw request body with the configured secret. A missing / malformed / stale / mismatched signature returns 401; a missing secret returns 401 with the same shape (a misconfiguration is indistinguishable from an attack from the response side).
2. **Deduplicate on the `idempotency-key` header** (Sanity uses at-least-once delivery — see §6.7.7 for the full retry semantics). A replayed delivery returns 200 with `duplicate: true` and does NOT invoke the deploy hook a second time. The dedup lifecycle is **claim / complete / release** (§6.7.6): on every dispatch failure the endpoint calls `cache.release(key)` so the next Sanity retry with the same `idempotency-key` can re-claim and re-dispatch. **A failed dispatch NEVER permanently consumes the idempotency key.**
3. **POST to the configured deploy hook URL** (`NUXT_DEPLOY_HOOK_URL`) with the documented dispatch metadata. The trigger uses `redirect: 'manual'` so a 3xx response from the receiver is reported as `redirect_blocked` and the endpoint returns **503** (retryable — credentials are NEVER followed across an arbitrary redirect; the cache releases the idempotency-key claim so the next Sanity retry can re-claim and re-dispatch). A bounded 5-second `AbortController` timeout keeps the webhook under Sanity's 30-second delivery window.
4. **Log structured metadata** (`webhookId`, `operation`, `documentId`, `idempotencyKey`, `dataset`, `projectId`, `dispatch outcome`, `dispatch status`) without the raw body, the secret, or the provider response body.

The Nitro case's primary value is **observability + deduplication + future cache-prewarming**, not staleness reduction (the loader re-fetches on every request, so the next request already sees the new content). The static case's primary value is **true staleness reduction** — the deploy hook rebuilds the artifact on demand.

### 6.7.3 Required environment variables

| Variable | Required by | Default | Purpose |
| --- | --- | --- | --- |
| `NUXT_SANITY_WEBHOOK_SECRET` | Static receiver **and** Node/Nitro endpoint | empty | The shared secret Sanity includes in the signed-payload header. The operator generates this on the Sanity side (Studio → API → Webhooks → Create → set secret) and copies the value here. Server-only; never via `useRuntimeConfig`. Multi-tenant override: `NUXT_SANITY_WEBHOOK_SECRET__<TENANT_ID>` (uppercased, non-alphanumeric → `_`). |
| `NUXT_SANITY_WEBHOOK_TOLERANCE_MS` | Node/Nitro signature verifier | `300000` (5 minutes) | Replay-protection tolerance for the signature verifier. **The 5-minute default is a project replay-protection policy, NOT a requirement of Sanity's signature protocol** (Sanity's reference library does not enforce a tolerance at all). The two concerns are distinct from the dedup TTL below. |
| `NUXT_SANITY_WEBHOOK_DEDUP_TTL_MS` | Node/Nitro dedup cache | `3600000` (1 hour) | TTL per cached idempotency entry. **Deliberately separate from the signature tolerance** — the verifier's tolerance is a security boundary (rejects replay attempts older than the window), while the dedup TTL is an operational courtesy (recognizes a replayed delivery as "already dispatched" without re-invoking the trigger). The default of 1 hour is conservative: Sanity's documented retry window is seconds-to-minutes, so any replay that lands more than an hour after the original success is treated as a fresh delivery. The deploy hook must be idempotent on its own end to make this safe. |
| `NUXT_DEPLOY_HOOK_URL` | Static receiver **and** Node/Nitro endpoint | empty | The provider-agnostic deploy-hook URL. The endpoint POSTs here after a verified Sanity event. NOT named after a specific hosting provider; the operator chooses where it points. Required for the Node/Nitro case; the endpoint returns 503 (`missing_dispatch_config`) until this is set so Sanity retries. |
| `NUXT_DEPLOY_HOOK_AUTH_HEADER` | Only when the receiver requires auth | empty | The full `Authorization` header value (e.g. `Bearer <token>` for Vercel / Netlify, `Token <pat>` for GitHub). The trigger never logs the value. |
| `NUXT_DEPLOY_HOOK_TIMEOUT_MS` | Trigger outer timeout | `5000` (5 seconds) | Bounded AbortController timeout for the deploy-hook POST. Sanity's delivery timeout is 30 seconds; a 5-second receiver timeout leaves headroom for the signature verification + dispatch path. |

### 6.7.4 Operator-side Sanity webhook setup

The operator configures the webhook on the Sanity side:

1. Open the Sanity project at `https://www.sanity.io/manage`.
2. Navigate to **API → Webhooks → Create**.
3. Configure:
   - **Name.** A descriptive name (e.g. `Real Estate Template — production rebuild`).
   - **URL.** The receiver URL (a hosting-provider deploy hook, a small serverless receiver, or — for the Node/Nitro case — the endpoint URL `/api/webhooks/sanity`).
   - **Dataset.** The dataset the webhook listens on (typically `production`).
   - **Trigger on.** The operations to forward. Recommended: `create`, `update`. Optional: `delete` (some operators ignore `delete` events when the agency unpublishes a record).
   - **Filter.** A GROQ filter that narrows the webhook to the agency's relevant document types. The recommended filter: `_type in ['property', 'agent', 'development']`. Without a filter, the webhook fires on every dataset change.
   - **Projection.** Optional. A custom projection can replace the default `_id`, `_type`, `_updatedAt` shape. The receiver does NOT require the full document body.
   - **HTTP method.** `POST` (the documented default; the endpoint pins to POST).
   - **API version.** The current date (Sanity's webhook API is versioned).
   - **Secret.** Generate a fresh 32+ character random string. Copy this into `NUXT_SANITY_WEBHOOK_SECRET` (or the per-tenant override).
4. **Save.** Sanity delivers a test webhook (a no-op) to the URL; the receiver should return 200.

The receiver's contract is documented above (§6.7.1 for static, §6.7.2 for Node/Nitro). The endpoint's status-code mapping is deterministic (§6.7.5).

### 6.7.5 Endpoint status-code contract (Node/Nitro)

The endpoint maps every failure mode to a stable, documented HTTP status. Under the failure-safe retry semantics (§6.7.8), every dispatch failure maps to **503** (retryable) — the endpoint releases the idempotency claim on every failure so a Sanity retry can re-claim and re-dispatch. The four `400-range` rejects (bad signature, missing idempotency key, oversize body, wrong content-type) are permanent; Sanity does NOT retry on 4xx.

| Status | Body | When | Sanity retries? |
| --- | --- | --- | --- |
| `200` | `{ ok: true }` | Signature verified, dispatch accepted by the receiver; cache entry transitioned to `completed`. | n/a (success) |
| `200` | `{ ok: true, duplicate: true }` | Replayed idempotency key — a prior delivery already dispatched and completed successfully. | n/a (success) |
| `400` | `{ ok: false, error: 'missing_idempotency_key' }` | The `idempotency-key` header is missing. | no (4xx) |
| `400` | `{ ok: false, error: 'malformed_payload' }` | The body is empty or the JSON is not parseable after a valid signature. **The cache claim is released** so a corrected replay can re-dispatch. | no (4xx) |
| `401` | `{ ok: false, error: 'invalid_signature' }` | Signature verification failed (missing / malformed / stale / mismatched). | no (4xx) |
| `405` | (h3 default) | Method other than POST. | no (4xx) |
| `413` | `{ ok: false, error: 'payload_too_large' }` | Body > 256 KB. | no (4xx) |
| `415` | `{ ok: false, error: 'unsupported_media_type' }` | Content-Type other than `application/json`. | no (4xx) |
| `503` | `{ ok: false, error: 'dispatch_in_flight' }` | A prior delivery with the same idempotency-key is mid-dispatch. **The endpoint does NOT acknowledge an in-flight duplicate as success** — the retry's outcome depends on the prior dispatch's result (success → markCompleted → next retry is `duplicate` 200; failure → release → next retry is `claimed` + re-dispatch). No event loss. | yes (5xx) |
| `503` | `{ ok: false, error: 'dispatch_missing_config' }` | `NUXT_DEPLOY_HOOK_URL` is not configured. **The cache claim is released** so a Sanity retry can re-claim after the operator wires the hook. | yes (5xx) |
| `503` | `{ ok: false, error: 'dispatch_auth_rejected' }` | The receiver returned 401 or 403. Cache released; retry invokes the trigger again with the (operator-fixed) credential. | yes (5xx) |
| `503` | `{ ok: false, error: 'dispatch_not_found' }` | The receiver returned 404. Cache released; retry invokes the trigger again with the (operator-fixed) URL. | yes (5xx) |
| `503` | `{ ok: false, error: 'dispatch_client_error' }` | The receiver returned a 4xx other than 401 / 403 / 404. Cache released; retry invokes the trigger again. | yes (5xx) |
| `503` | `{ ok: false, error: 'dispatch_server_error' }` | The receiver returned 5xx. Cache released; retry invokes the trigger again. | yes (5xx) |
| `503` | `{ ok: false, error: 'dispatch_redirect_blocked' }` | The receiver returned a 3xx (the trigger does NOT follow arbitrary redirects). Cache released; retry invokes the trigger again with the (operator-fixed) URL. | yes (5xx) |
| `503` | `{ ok: false, error: 'dispatch_timeout' }` | The fetch exceeded the receiver's timeout. Cache released; retry invokes the trigger again. | yes (5xx) |
| `503` | `{ ok: false, error: 'dispatch_network_error' }` | A transport-layer failure (DNS, TCP, TLS). Cache released; retry invokes the trigger again. | yes (5xx) |

Provider response bodies and secrets are never exposed in the response body or in the log line. The endpoint's structured log carries only the documented fields (`webhookId`, `operation`, `documentId`, `idempotencyKey`, `outcome`, `status`, `lifecycle`).

### 6.7.6 Idempotency lifecycle (claim / complete / release)

The endpoint deduplicates on the `idempotency-key` header via an in-memory cache that tracks each entry through three states:

1. **`claimed`** — the endpoint has accepted the delivery and is currently invoking the external rebuild trigger. A second delivery with the same key arriving while the first is still in flight sees the entry in `claimed` state and the endpoint returns **503 `dispatch_in_flight`** — the retry stays in Sanity's queue until the first dispatch's outcome (success or failure) determines what happens next.
2. **`completed`** — the dispatch was accepted by the external receiver (a 2xx response). Subsequent deliveries with the same key see `duplicate` and the endpoint returns **200 + `duplicate: true`** (idempotent ack). The cache entry's TTL bounds the duplicate-detection window.

   **`markCompleted` preserves the original `expiresAt`** — the entry's `state` field transitions from `'claimed'` to `'completed'`; the `expiresAt` timestamp is **NOT refreshed or extended**. The entry lives for the remainder of the original dedup TTL window. This matches the implementation at `server/utils/sanity-webhook-dedup.ts:280-288`: `existing.state = 'completed'`. The `completed` state and the original TTL together answer the question "was this idempotency-key seen in the last `NUXT_SANITY_WEBHOOK_DEDUP_TTL_MS` window?" — a `completed` entry that has not yet expired is a duplicate; a `completed` entry that has expired is treated as a fresh delivery (a re-publish after the TTL elapsed is a new event in Sanity's view).
3. **(released)** — the dispatch failed for any reason (missing config, auth rejected, 4xx, 5xx, redirect blocked, timeout, network error, malformed body after valid signature). The endpoint deletes the cache entry so a Sanity retry can re-claim and re-dispatch. **A failed dispatch NEVER permanently consumes the idempotency key.**

The endpoint's decision tree:

```
tryClaim(key)
  ├─ 'claimed'    → run dispatch → on success markCompleted → 200
  │                                       on failure release       → 503 (retryable)
  ├─ 'in_flight'  → return 503 { ok: false, error: 'dispatch_in_flight' }
  └─ 'duplicate'  → return 200 { ok: true, duplicate: true }
```

**No-event-loss guarantee.** A second delivery arriving while the first is mid-dispatch returns **503 `dispatch_in_flight`** rather than a success ack — the in-flight dispatch's eventual outcome (success → markCompleted → next retry is `duplicate` 200; failure → release → next retry is `claimed` + re-dispatch) determines the eventual delivery status. An ack on an in-flight duplicate could permanently lose the event if the original dispatch later fails.

The cache is documented as **in-memory only** with the following limitations:

- **Multi-instance / serverless.** A deployment with more than one Nitro process (PM2 cluster mode, Cloudflare Workers isolates, multiple containers, edge functions) does NOT share the cache. Two instances that see the same replay will both trigger. The deploy hook should be idempotent on its own end — a `repository_dispatch` with the same commit SHA is a no-op; a hosting-provider deploy hook called twice during the build window is also a no-op. The practical blast radius is bounded.
- **Process restart.** A Nitro process restart clears the cache. A Sanity replay that lands after the restart will re-trigger. Same mitigation as above (deploy-hook idempotency).
- **Bounded size.** The cache holds at most 1024 entries; older entries are evicted under FIFO when the cap is reached.
- **TTL.** Each entry expires after `NUXT_SANITY_WEBHOOK_DEDUP_TTL_MS` (1 hour by default — see §6.7.3). The TTL is deliberately separate from the signature verifier's tolerance (`NUXT_SANITY_WEBHOOK_TOLERANCE_MS`, 5 minutes default). The two env vars measure different things: the signature tolerance is a **security boundary** (rejects replay attempts older than the window); the dedup TTL is an **operational courtesy** (recognizes a replayed delivery as "already dispatched" without re-invoking the trigger). An operator can tighten one without relaxing the other.

Operators who need strict single-trigger semantics across instances must back this cache with a shared store (Redis / KV). The deploy-hook contract is documented above to note this limitation; the endpoint does not enforce it.

### 6.7.7 Sanity's retry semantics & reconciliation

The endpoint is designed against Sanity's documented delivery contract (<https://www.sanity.io/docs/webhooks>):

- **At-least-once delivery.** Sanity may redeliver the same event more than once. The `idempotency-key` header identifies a single event across all attempts — a retry carries the same key as the original delivery. The endpoint's claim / complete / release lifecycle (§6.7.6) uses this key as the dedup unit.
- **Sanity's status-code retry policy (verbatim from the Sanity docs).**
  - **2xx is treated as success** — Sanity marks the delivery successful and does not retry.
  - **4xx (except 429) is treated as undeliverable** — Sanity marks the delivery failed and does **not** retry. The endpoint's `400` mapping (`missing_idempotency_key`, `malformed_payload`), the `401` invalid-signature mapping, the `405` method-guard mapping, the `413` oversize-body mapping, and the `415` wrong-content-type mapping are all **permanent rejects** under this rule.
  - **429 is retried** per Sanity's retry policy.
  - **Any 5xx, including 502 and 503, is retried** per Sanity's retry policy. The endpoint's `503` mapping for every dispatch-failure outcome (`dispatch_in_flight`, `dispatch_missing_config`, `dispatch_auth_rejected`, `dispatch_not_found`, `dispatch_client_error`, `dispatch_server_error`, `dispatch_redirect_blocked`, `dispatch_timeout`, `dispatch_network_error`) is **deliberately in the 5xx family** so Sanity retries the delivery. The previous `502` mapping that pre-dated the failure-safe refactor placed dispatch failures in the 4xx family from Sanity's perspective; that has been corrected to `503` so every dispatch failure is now retryable.
- **Retry cadence.** Sanity currently retries **twice** at approximately **30-second intervals** (per Sanity's docs). The endpoint's `NUXT_DEPLOY_HOOK_TIMEOUT_MS` (default 5 seconds) leaves headroom so a slow receiver can return a retryable 5xx within Sanity's 30-second delivery window rather than the attempt being cancelled.
- **30-second delivery timeout per attempt.** Sanity cancels a single attempt after 30 seconds. The endpoint's 5-second receiver timeout leaves headroom for the signature verification + dispatch path.

**The original Task 129 bug, restated for the operator.** The failure the refactor addressed was that **a failed dispatch left the idempotency-key entry in the cache in a state that prevented a later Sanity retry from re-dispatching**. A Sanity retry after a transient 5xx or `dispatch_*` failure could not re-claim the key, so the rebuild was lost. The fix is the three-state `claim / complete / release` lifecycle (§6.7.6): on every dispatch failure the endpoint calls `cache.release(key)`, which deletes the entry so the next Sanity retry with the same `idempotency-key` sees an empty cache and re-claims + re-dispatches. **The bug was NOT that Sanity does not retry on 502** — Sanity's published policy is that any 5xx (including 502) is retryable. The bug was the dedup cache permanently consuming the entry on failure. The status-code change from `502` to `503` aligns the contract with Sanity's actual retry policy; the lifecycle change is the correctness fix.

**Reconciliation.** Sanity's retry policy does NOT guarantee synchronization outside its retry window. The 30-second retry interval × 2 retries gives a best-case coverage of ~60 seconds from the original publish. Beyond that window — receiver outage, secret rotation, env var misconfiguration, Nitro process restart before the endpoint calls `markCompleted` — the operator must reconcile the production site manually:

- For static deployments: re-run `pnpm install --frozen-lockfile && pnpm generate && deploy` to ship a fresh artifact (or `pnpm generate && deploy` for the cached install).
- For Node/Nitro deployments: re-run the deploy (the next request will refetch from the data source).
- For content correction: republish the affected documents in the Studio (the republish is a fresh event with a new idempotency-key).

**Do not rely on the webhook alone for synchronization.** The webhook is the fast path; reconciliation is the safety net. The deploy hook must be idempotent on its own end so a missed + retried event, or a manual replay, does not cause double-execution (a `repository_dispatch` with the same commit SHA is a no-op; a hosting-provider deploy hook called twice during the build window is also a no-op). The short Sanity retry window (~60 seconds of best-case coverage) is the constraint that makes the reconciliation procedure a **required** part of the contract — webhook processing must include a reconciliation path because the retry window is too short to recover from a long receiver outage.

### 6.7.8 Static deployment security architectures

A `pnpm generate` deployment emits `.output/public/` only — no Nitro runtime, no `server/api/*` endpoints. The static artifact cannot verify `sanity-webhook-signature`. The Nuxt-side webhook endpoint is therefore **not** the Sanity webhook receiver for the static deployment; the receiver is operator-side infrastructure that terminates at runtime.

Two architectures are documented below. The operator chooses the one that matches the agency's threat model and operational preferences.

#### 6.7.8.1 Direct: `Sanity → deploy / CI receiver` (allowed only when the receiver authenticates the request)

Direct flow `Sanity → deploy / CI receiver` is allowed only when the **receiver authenticates the request using a strong mechanism that Sanity can supply**. The two acceptable mechanisms are:

1. **Verification of `sanity-webhook-signature`.** The receiver computes the expected HMAC-SHA256 over `${timestamp}.${rawBody}` with the shared secret, base64url-encodes the result, and compares to the `v1=` field of the `sanity-webhook-signature` header (per Sanity's documented protocol). This is the canonical mechanism.
2. **An explicitly configured custom / shared-secret authorization header that the receiver verifies.** The Sanity Studio's webhook configuration supports the documented `Authorization` header (the operator enters the full `Authorization` value, e.g. `Bearer <token>` or `Token <token>`, and Sanity forwards it verbatim on every delivery). The receiver verifies the header value against a known shared secret stored on the receiver side. This is appropriate when the receiver's stack supports `Authorization`-header-based verification but not the Sanity signature protocol.

**Unauthenticated public POST endpoints are NOT acceptable.** A direct flow where the receiver accepts any POST and triggers a deploy on receipt is **NOT** a documented architecture. An unauthenticated POST endpoint means an attacker who knows the URL can trigger a deploy at will (or, depending on the deploy hook, exfiltrate build secrets). Pointing Sanity at such a URL is rejected by the operator's threat model — the operator must use one of the two mechanisms above, or fall back to the verified-receiver architecture (§6.7.8.2).

If the operator chooses the direct architecture with one of the two mechanisms above:

- The receiving endpoint is responsible for the verification (using the documented Sanity signature protocol, or by comparing the `Authorization` header to a known shared secret stored in the receiver's secret manager).
- The receiver must reject any request that fails the verification with a non-2xx response so Sanity treats it as undeliverable. The receiver's verification logic is the security boundary; the deploy hook's existence on a public URL is not by itself a vulnerability if the verification gate is enforced.
- The Sanity side configures the URL + the secret (signature secret OR `Authorization` value) via the Sanity webhook configuration (Studio → API → Webhooks → Create → set secret / set header). The credential is held by Sanity and the receiver; neither is held by the Nuxt static artifact.
- The provider may additionally authenticate its own deploy hook out-of-band (e.g., the provider requires a signed payload or a server-to-server credential that is not derived from the Sanity secret).

If the operator's chosen provider does NOT support either of the two mechanisms above (no `sanity-webhook-signature` verification AND no `Authorization`-header verification), this architecture is **NOT** appropriate — switch to the verified-receiver architecture (§6.7.8.2). The Nuxt deployment does not document any provider by name; the operator is responsible for verifying the provider's authentication capability.

#### 6.7.8.2 Preferred: `Sanity → signature-verifying receiver → authenticated CI / hosting deploy trigger`

The preferred architecture for any deployment where the receiving provider does NOT verify `sanity-webhook-signature`. The receiver is a small operator-side component (Cloudflare Worker, Lambda, edge function, Vercel edge middleware, GitHub Action via a tiny serverless entry point, etc.) that:

1. Receives the Sanity webhook POST.
2. Verifies `sanity-webhook-signature` against the raw body using the Sanity secret held by the receiver (NOT by the Nuxt artifact).
3. Optionally verifies the `idempotency-key` header against a short-lived dedup store (the receiver's own — independent of the in-memory cache the Nuxt endpoint uses).
4. Authenticates to a CI workflow (`repository_dispatch` with a GitHub PAT) or a hosting-provider deploy hook (Bearer / Token auth) using a credential held by the receiver (NOT by the Nuxt artifact).
5. Triggers the rebuild pipeline.

```
Sanity  ────►  Receiver  ────►  CI / hosting deploy hook
            (verifies           (authenticated
             signature,          trigger)
             holds secret)
                              ▲
                              │ rebuild
                              ▼
                          Static artifact
                          (no secrets,
                           no verification,
                           no webhook logic)
```

**Ownership of secrets.** The verifying receiver owns BOTH the Sanity webhook secret and the deploy-hook credential. The static Nuxt artifact owns neither. The Nuxt artifact is a dumb file server that ships pre-rendered HTML / CSS / JS to a CDN; an attacker who compromises the artifact cannot impersonate Sanity (no Sanity secret) and cannot trigger a rebuild (no deploy-hook credential).

**Provider-agnostic.** The receiver is provider-agnostic — the Nuxt project ships no provider-specific code. The receiver's implementation choice (Cloudflare Workers vs Lambda vs Vercel middleware vs a small Node.js endpoint in a separate repository) is the operator's. The contract between the Nuxt artifact and the rebuild pipeline is "the receiver POSTs to a deploy hook URL the operator chooses"; nothing in the Nuxt artifact depends on which provider the operator selected.

**What Sanity sees.** Sanity only sees an outbound POST to the receiver's URL with the standard webhook headers + the `sanity-webhook-signature` header. Sanity has no awareness of the receiver's downstream actions; the receiver is a black box from Sanity's perspective.

**What the static artifact sees.** The static artifact sees nothing — no inbound webhooks, no Sanity calls, no deploy calls. It just serves pre-rendered files. The webhook flow is entirely outside the artifact's lifecycle.

**Receiver implementation guidance (operator-side, NOT shipped by the Nuxt project).** The receiver can be as simple as ~50 lines of code that:

1. Reads the `sanity-webhook-signature` header.
2. Reads the raw request body via `request.text()`.
3. Computes the expected HMAC-SHA256 over `${timestamp}.${body}`, base64url-encoded, and compares to `v1` via `crypto.timingSafeEqual`.
4. Checks the timestamp tolerance (5 minutes).
5. If valid, POSTs to the deploy hook URL with an `Authorization` header (Bearer / Token / custom) using a credential held in the receiver's secret manager.

The Nuxt project does NOT ship a reference receiver implementation — the operator's receiver is independent of the Nuxt project. The boundary regression tests in `server/utils/sanity-boundary.test.ts` enforce that no Nuxt-shipped code reads `sanity-webhook-signature` outside `server/utils/sanity-webhook.ts` — the signature-verification surface is contained to the verifier module the receiver (NOT the Nuxt project) can re-implement or vendor.

#### 6.7.8.3 Static-deployment third-party receiver (Zapier, Make, n8n, IFTTT, Pipedream)

For deployments that prefer not to run any receiver on the agency's behalf, Sanity's webhook can target a third-party integration the agency already operates. The third-party tool receives the Sanity webhook, performs any fan-out or transformation, and triggers the deploy hook on the platform the agency chose. The trade-offs are:

- **Pro.** No operator-side receiver code to maintain.
- **Con.** The third-party tool's secret-handling and signature-verification capabilities are out of the operator's control. The operator must verify that the chosen tool supports Sanity's signature protocol (most do via documented actions; some do not).
- **Con.** The deploy-hook credential is held by the third-party tool, not by the operator. The operator must trust the tool's secret-handling practices.

This architecture is appropriate when the agency already operates the third-party tool and the operator is satisfied with its security posture.

## 7. Incident / recovery actions

The agency / operator runs the recovery actions below when the content pipeline misbehaves. Each action has a clear owner, a clear entry condition, and a clear exit condition. The recovery actions are **non-destructive by default**; the destructive actions (dataset restore, project delete) require written agency-owner approval.

| Symptom | Likely cause | Recovery action | Owner |
| --- | --- | --- | --- |
| A property / agent / development disappeared from the public site | `status: 'hidden'` flip, or the editor deleted the record by mistake | Open the document in the Studio; if it exists, set `status: 'available'` and publish; if it does not, the agency recreates the record from the latest backup. | The agency editor (status fix) or the operator (restore from backup) |
| The Studio is unreachable at `<projectId>.sanity.studio` | Studio deploy failure or Sanity outage | Re-run `cd studio && pnpm deploy` to redeploy the Studio. If Sanity is down (status.sanity.io), wait for the incident to resolve. | The operator (deploy) or Sanity (outage) |
| The Nuxt app returns a `DataSourceInvalidPayloadError` for a published record | Schema drift: a published record is missing a required field the runtime boundary enforces | Identify the bad record with the Studio's "Validation" panel or `pnpm exec sanity documents query`; fix the record in the Studio; republish. | The agency editor (content fix) or the operator (diagnostic) |
| The Nuxt app returns 5xx on every property / agent / development request | The data-source env vars are misconfigured, or the Sanity project / dataset is gone | Verify the deployment's secret manager holds the correct `NUXT_SANITY_PROJECT_ID` + `NUXT_SANITY_DATASET` + `NUXT_SANITY_API_VERSION` + `NUXT_SANITY_TOKEN` (if any). Check the Sanity project's status page. Roll back the Nuxt deploy if the issue is deploy-related. | The operator |
| The agency published a bad batch of records (wrong prices, wrong status, wrong description) | Editor error | Revert via the Studio's History panel: the panel shows the document's recent published versions; the agency can revert a single document. The window is the plan's revision-retention window (§6.1) — recent rollback, not long-term. For a long-term rollback or a multi-document rollback, use the dataset export. | The agency editor (history revert) or the operator (dataset export + agency approval) |
| The read token (`NUXT_SANITY_TOKEN`) leaked (committed to git, pasted in a public channel) | Operator error or agency error | Rotate the token immediately: create a new token in the project's API settings, update the deployment's secret manager, redeploy the Nuxt app, revoke the old token. The dataset is the agency's; the rotation is the agency's responsibility (or the operator's under a maintenance agreement that names the rotation as in-scope work). | The agency owner (project) or the operator (deploy) |
| The dataset is corrupt (bad import, accidental delete) | Operator error or agency error | Restore from the most recent backup (§6). The restore is destructive; the agency owner must approve in writing. | The agency owner (approval) + the operator (restore) |
| The Sanity project is unavailable for an extended period | Sanity outage | Wait for the incident to resolve (status.sanity.io). The Nuxt app's loader returns 5xx for the duration; a static deploy still serves the most recent build artifact. The agency may switch the data source to `static` temporarily via `NUXT_<FEATURE>_DATA_SOURCE=static` (a re-deploy with the changed env var) until Sanity recovers. The operator runs the re-deploy. | The operator (re-deploy) or Sanity (outage) |

### 7.1 Communication during an incident

The communication channel and the response cadence are **named in the maintenance agreement**, not hard-coded into this guide. A recommended baseline (the kind an agreement typically names) is:

- A single point of contact on each side: the agency owner for the agency; the operator's named representative for the operator.
- A shared channel (email, Slack, a shared incident-response page) for status updates.
- A first response within ~30 minutes of the incident being confirmed by either side.
- Hourly status updates until resolution.

The agreement may name a different cadence (faster for production-critical incidents, slower for non-critical), a different channel, or a different escalation path. The agency's incident-response policy (if no maintenance agreement is in place) is the source of truth for the cadence the agency wants the operator to follow.

### 7.2 Rollback of the Nuxt deploy

The Nuxt-side rollback is in `docs/DEPLOYMENT.md` §11. The 5-step rollback (pin the previous build, promote the previous build, verify, diagnose, forward-fix) is the operator's responsibility. The rollback does not affect the published Sanity dataset — the dataset is independent of the Nuxt build.

### 7.3 Rollback of a content change

The Studio's "History" panel shows a document's recent published versions. The agency editor (or the operator on the agency's request) reverts to a previous version. The revert publishes a new version that the Nuxt app reads on the next request (Node deploy) or the next `pnpm generate` (static deploy). The revert does not affect other documents. The window is the plan's revision-retention window (§6.1) — a recent rollback, not a long-term backup. For a long-term rollback or a multi-document rollback, the agency uses the dataset export (§6.3).

## 8. End-of-contract handoff (access removal)

When the engagement ends (a project-based engagement at the natural end of the work, or an ongoing-maintenance engagement at the end of the contract), the operator's platform access is removed. The agency's platform access is preserved. The **source-code side of the handoff is determined by the commercial agreement** (§1.2) and is not re-stated here.

### 8.1 Access removal steps (Sanity platform side)

1. **Operator Sanity role removed.** The agency owner signs in to <https://www.sanity.io/manage>, picks the project, opens **Members**, and removes the operator's Sanity account. The role-removal cadence and any intermediate downgrades (e.g., to **Viewer** for a read-only audit trail) are named in the maintenance agreement.
2. **Operator API token revoked.** The agency owner opens the project's **API → Tokens** and revokes every token the operator's Sanity account created or was associated with. The active read token is the one the agency's own operations hold; the operator's tokens are removed. The cadence for ongoing token rotation is named in the maintenance agreement (§2.5).
3. **Operator deployment access removed.** The platform's secret manager drops the operator's read / write access to the production env vars. The agency's secret-manager administrator is the sole owner of the production env vars. The cadence for the access removal is named in the maintenance agreement.
4. **Source-code access (if the commercial agreement grants the agency source-code ownership).** When the commercial agreement names the agency as the source-code owner, the operator's read / write / admin role on the Git host is removed (or downgraded to read-only, as the agreement names). When the commercial agreement does not name the agency as the source-code owner, the source-code repository, the license, the transfer rights, and the repository-access cadence are the agreement's concern, not the platform handoff's concern. This step is **conditional on the commercial agreement** — the operations guide does not assert that the agency owns the source code (§1.2).
5. **Operator local working tree cleaned.** The operator deletes the local ignored `.env` files (the local ignored env-var files the operator used during the build) and any operator-owned working copies of the codebase. The committed source tree (when the commercial agreement grants the agency source-code ownership) is the agency's source-of-truth after the handoff.
6. **Operator backups returned or destroyed (as the maintenance agreement names).** The operator's working copy of the most recent dataset export is returned to the agency (the agency's cloud storage, the agency's local archive, or a shared location the agency nominates) **or** destroyed, as the maintenance agreement and the applicable retention policy name. The agency keeps the canonical backup; the operator does not retain a copy beyond the agreement's named retention.
7. **Operator Studio deploy access removed.** The agency's Sanity account is the sole owner of the Studio deploy. The operator's redeploy access is gone with the role removal.
8. **Operator's documentation handed over.** The operator's handoff record (the access table in `docs/CLIENT_ONBOARDING.md` §4.7, the production validation results in `docs/SANITY_VALIDATION.md`, the production smoke-check results in `docs/DEPLOYMENT.md` §10, the post-deploy incident log, the maintenance summaries) is given to the agency. The agency keeps the record; the operator's working tree does not retain a copy.

### 8.2 Access removal cadence

The access removal is the **last step of the engagement**, not a delayed step. A project-based engagement removes the operator's access on the engagement's last day. An ongoing-maintenance engagement removes the operator's access on the contract's last day, not at the end of the next contract. The agency owner is the sole approver of the removal; the operator does not remove their own access.

### 8.3 The agency's post-handoff posture (Sanity platform side)

After the platform access removal, the agency is the sole owner of:

- The Sanity organisation (billing) and the project.
- The Studio deploy at `<projectId>.sanity.studio`.
- The published dataset.
- The read token (if any).
- The deployment's secret manager.
- The dataset backups (per the retention policy in the maintenance agreement and any applicable external policy).
- The post-handoff documentation.

The **source-code side of the agency's post-handoff posture** is determined by the commercial agreement (§1.2). When the agreement grants the agency source-code ownership, the source-code repository is the agency's. When the agreement does not, the source-code repository is the operator's (or whoever the agreement names), and the operations guide does not assert otherwise.

The agency may sign a new contract with the same operator (or a different operator) to re-establish the operator's platform access. The new contract is independent of the prior contract; the handoff documentation is the agency's reference for what the new operator needs.

## 9. References

- `docs/CLIENT_ONBOARDING.md` — the upstream agency-side info checklist; §4.7 is the handoff table that names the platform access split before the implementer leaves the engagement. Source-code terms live in the commercial agreement, not in §4.7.
- `docs/SANITY_VALIDATION.md` — the one-time validation procedure (project creation, dataset, Studio install, real-content round-trip). §0–§13 is the sequence; §14 is the failure-mode table; §16 is the validation results.
- `studio/README.md` — the Studio developer's manual. §1 is the project creation; §2–§3 is the Studio install + configure; §5 is the dataset creation; §6 is the populate-the-dataset workflow; §7 is the Studio deploy; §8 is the access-grant workflow; §9 is the schema tests; §10 is the typecheck; §11 is the wire-the-Nuxt-app env-var table; §12 is the schema contract table; §13 is the explicit "What this Studio does NOT do" list.
- `docs/DEPLOYMENT.md` — the Nuxt-side deploy procedure. §4 is the env-var lifecycle; §5 is the static-vs-Node/Nitro capability matrix; §7 is the lead delivery; §8 is the production validation commands; §9 is the deploy; §10 is the post-deploy smoke checks; §11 is the rollback.
- `docs/MULTI_TENANT.md` — the multi-tenant hostname dispatch. Relevant when one Sanity project serves more than one agency (the multi-tenant host routes to the agency; the Sanity project is the same as the single-tenant case).
- `docs/RELEASE_NOTES_v1.1.md` — the v1.1.0 release notes (the lead-capture pipeline, the static-vs-Nitro trade-off).
- `docs/ROADMAP.md` — the implementation state and the milestone log; M28 (Task 118) and M29 (Task 119) are the Sanity Studio hardening and the Studio UX polish respectively.
- <https://www.sanity.io/docs> — the Sanity documentation. The `datasets` export / import procedures are in the CLI section; the role-management UI is in the project-management section; the history-retention windows are in the plan-management section.
- <https://status.sanity.io> — the Sanity status page. The first stop during a Sanity-side outage.
