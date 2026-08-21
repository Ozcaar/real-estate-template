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
