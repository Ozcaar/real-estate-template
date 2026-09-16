# AGENTS.md — Real Estate Website Template

## Project state

The application shell in `app/app.vue` is wired up. It renders `<NuxtRouteAnnouncer />` inside `<NuxtLayout>`, which hosts `<NuxtPage />` for the route tree. The shell also keeps the document language in sync with the active locale via `useHead({ htmlAttrs: { lang: locale } })`.

The architecture, folder layout, data models, theme system, branding strategy, and component conventions are specified in `docs/`.

**Read `docs/OPENCODE.md` first**, then the relevant document for the task.

If there is any conflict between this file, docs, and actual project files, use this priority order:

1. `package.json` and existing source code
2. `docs/OPENCODE.md`
3. Task-specific docs inside `docs/`
4. This `AGENTS.md`

## Stack

* **Nuxt 4** using the `app/` directory convention, not root-level `pages/`
* **Vue 3**
* **TypeScript**
* **Tailwind CSS v4** via `@tailwindcss/vite`
* **Pinia**
* **Zod v4**
* **i18n** with `@nuxtjs/i18n` using English and Spanish
* **UI libraries**: Swiper, VueUse, Nuxt Image, Nuxt Icon

Always check `package.json` before assuming exact dependency versions.

## Package manager

Use `pnpm`. The project pins `pnpm@10.12.1` in the top-level `packageManager` field; CI's `corepack enable` + `pnpm install --frozen-lockfile` reads that field and resolves to 10.12.1. Local development should follow the same path — once `corepack` is enabled (see below), `pnpm --version` reports `10.12.1` from any checkout of this repository.

```bash
pnpm install         # install + postinstall → nuxt prepare
pnpm dev             # dev server on localhost:3000
pnpm build           # production build
pnpm generate        # static export
pnpm preview         # preview production build
pnpm lint            # eslint .
pnpm lint:fix        # eslint . --fix
pnpm test            # vitest run (single-shot, CI-friendly)
pnpm test:watch      # vitest (interactive watch mode)
pnpm test:e2e        # playwright test (Chromium smoke tests)
pnpm test:e2e:install  # playwright install --with-deps chromium (one-time setup)
```

`postinstall` runs `nuxt prepare` automatically — no manual step needed.

The `corepack enable` step installs the `pnpm` / `pnpm.cmd` / `pnpm.ps1` shims that read the `packageManager` field. On a fresh machine where `corepack enable` cannot write to its default location (`<node-install-dir>`), pass `--install-directory` to a writable directory on `PATH` (for example, the user-level npm-global directory) so the shims are picked up by the existing `pnpm` lookup. Do NOT install pnpm directly with `npm install -g pnpm@...` — that bypasses the `packageManager` pin and the CI pinning will silently disagree with the local install.

## Multi-agent workflow (OpenCode)

This project ships an override of the built-in `build` primary agent plus three project-level agent files in `.opencode/agents/` — the project-specific `reviewer` and `tester` subagents, and a project-level override of the built-in `explore` subagent that tightens its `bash` permission.

| Agent | Mode | Source | Permission-layer contract | Purpose |
| --- | --- | --- | --- | --- |
| `build` | primary | built-in (overridden) | `task` scoped to `{explore, reviewer, tester}` only | The sole modifying/orchestrating agent. Edits files, runs the build / install / test pipeline, writes the final answer. |
| `explore` | subagent | built-in (project-level override) | `bash: deny`, `webfetch: allow`, `websearch: allow`; `edit: deny`, `write: deny`, `task: deny` | Read-only codebase research + web research. Use when the task needs repo discovery before any edit. Shell commands cannot mutate project or system state at the permission layer. |
| `reviewer` | subagent | project-specific | `bash` is read-only-Git allowlist (catch-all `*`: deny, then `git status` / `git status *` / `git diff` / `git diff *` / `git show` / `git show *` / `git ls-files` / `git ls-files *` / `git log *` / `git rev-parse *` allow); `edit: deny`, `write: deny`, `webfetch: deny`, `task: deny` | Read-only diff + `AGENTS.md` compliance review. Inspects the task brief + the working-tree diff itself (via the Git allowlist above) and reports severity-ranked findings. |
| `tester` | subagent | project-specific | `bash` is command-pattern gated (catch-all `*`: deny, then explicit allow rules for the validation surface and explicit deny rules for state-changing commands); `edit: deny`, `write: deny`, `task: deny`; `node -e *` is rejected at the permission layer | Validation-only. Runs the non-persistent validation commands (`pnpm test`, `pnpm lint`, `pnpm build`, `pnpm install --frozen-lockfile`, `pnpm ignored-builds`, `git diff --check`, `node --version`, …) and reports results. **Cannot modify files, cannot mutate the working tree, cannot fix failures itself, cannot run arbitrary `node -e`.** |

**Build is the only agent with a state-changing capability.** The resolved `tools` block confirms this:
- `build`: `edit: allow`, `write: allow`, `bash: allow`, `task: allow` (scoped to `{explore, reviewer, tester}`)
- `explore`: `edit: false`, `write: false`, `bash: false`, `task: false` (only `read`, `glob`, `grep`, `list`, `lsp`, `webfetch`, `websearch` are enabled)
- `reviewer`: `edit: false`, `write: false`, `task: false`, `webfetch: false`; `bash: true` (tool enabled) but the bash allowlist admits only the eight read-only Git inspection commands
- `tester`: `edit: false`, `write: false`, `task: false`, `webfetch: false`; `bash: true` (tool enabled) but the bash allowlist admits only the validation surface; `node -e *` is rejected

**Build's delegation rules.** Build's `permission.task` is restricted to:
```yaml
task:
  "*": deny
  explore: allow
  reviewer: allow
  tester: allow
```
The catch-all `*: deny` removes every other subagent (`general`, `scout`, `compaction`, `title`, `summary`) from the Task tool description; the three named agents are the only delegation targets.

**Bash command-pattern enforcement (OpenCode 1.18.30).** OpenCode 1.18.30 supports per-command bash permission patterns (glob-style: `*` matches zero-or-more characters, `?` matches exactly one; last matching rule wins). The project uses this for both `reviewer` and `tester`:

- **Reviewer's bash allowlist** — only the read-only Git inspection commands. Eight patterns cover the canonical four commands with and without trailing arguments, plus `git log *` and `git rev-parse *` for branch / commit resolution when the brief names a specific ref. Catch-all `*: deny` rejects every other shell command at the permission layer.
- **Tester's bash allowlist** — the project's validation surface. Allow rules cover `pnpm --version *`, `pnpm install --frozen-lockfile *`, `pnpm test *`, `pnpm lint *`, `pnpm build *`, `pnpm generate *`, `pnpm ignored-builds *`, `pnpm test:e2e *`, `pnpm studio:typecheck *`, `pnpm list *`, `git status *`, `git diff *`, `git log *`, `git show *`, `git ls-files *`, `git rev-parse *`, `cat *`, `head *`, `tail *`, `wc *`, `find *`, `ls *`, `node --version`, `node -v`. Explicit deny rules cover every state-changing Git / pnpm command plus the PowerShell `remove-item` / `move-item` / `rename-item` / `new-item` / `set-content` / `add-content` / `clear-content` / `out-file` / `copy-item` / `tee` / `touch` / `mkdir` / `new-directory` and the POSIX `rm` / `del` filesystem-mutating commands. `node -e *` is caught by the `*: deny` catch-all; arbitrary Node one-liner smoke tests are **Build-only operations** (Build has `bash: allow` and can run the exact one-liner Tester reports).
- **Explore's bash** — `bash: deny` at the permission layer. The built-in Explore's `bash: allow` (relying on prompt restrictions) is removed. Read-only directory listings, globbing, file reads, and LSP queries are still available via `list`, `glob`, `read`, and `lsp` — none of the tasks Explore handles actually require shell commands.

**Preferred flow.**
1. **Explore before implementation** when the task needs repo discovery (which file owns X, where the canonical schema lives, what the existing tests for this area are). Explore returns pointers; Build writes code.
2. **Build implements** the change and runs the local validation commands.
3. **Reviewer + Tester after implementation**, in parallel when they are independent. Reviewer inspects the diff (via its Git allowlist); Tester runs the validation suite (via its bash command-pattern allowlist). Both return to Build.
4. **Build receives their findings**, performs any fixes, owns the final answer.

**Subagent delegation rules (native Task tool only).** Build delegates
work to `explore`, `reviewer`, and `tester` **exclusively through
OpenCode's native Task / subagent mechanism** declared in
`.opencode/agents/build.md`. The hard prohibitions (must follow):

- **Never invoke the OpenCode CLI from bash** to delegate work. No
  `opencode`, `opencode run`, `opencode --session`, `opencode exec`,
  `opencode serve`, `opencode attach`. The CLI launches a brand-new
  unrelated primary session, not a child subagent.
- **Never launch another Build / OpenCode process** in order to reach
  a subagent. A child OpenCode process inherits none of this
  session's permissions, `permission.task` rules, working-tree state,
  or model context.
- **Never create temporary prompt files** for subagent delegation.
  No `/tmp/agent-prompt.md`, no `.opencode/prompts/*.md`, no
  `--prompt-file <path>` indirection. Subagents are invoked
  directly through the Task tool with the brief inline.
- **Never spawn, poll, inspect, or terminate nested OpenCode
  processes.** No `ps aux | grep opencode`, no `wait $PID`, no
  signalling, no `kill <child>`. The child session's lifecycle is
  the Task tool's responsibility — Build has no business reaching
  into it.
- **Never use PowerShell process management** (`Get-Process`,
  `Stop-Process`, `Wait-Process`, `Start-Process opencode`,
  `Start-Job { opencode … }`) or POSIX equivalents (`kill`,
  `pkill`, `pgrep`, `nohup opencode … &`) as part of subagent
  orchestration.
- **Never run detached background jobs** that wrap a subagent. No
  `nohup`, no `Start-Job`, no `(... &)`, no `disown`.
- **Reviewer, Tester, and Explore must be invoked directly from the
  current Build session through the native Task tool** — never
  through a shell wrapper, never through a different OpenCode
  process, never through a temporary prompt file.
- **Subagent results must return to the current Build session.**
  When `explore` / `reviewer` / `tester` complete, their final
  message lands inline in this Build session. Build treats it as
  the authoritative input for the next step.

> **Why nested `opencode run` is prohibited.** `opencode run` (and
> every other CLI entrypoint — `serve`, `attach`, `exec`, ...)
> starts a brand-new **unrelated primary session** with its own
> model context, its own permission resolution, and no link back to
> the requesting Build session. Each invocation: (1) bypasses this
> session's `permission.task` allowlist (the child resolves its own
> subagent set independently); (2) loses this session's
> working-tree state, conversation context, and DOOM-loop /
> interruption handling; (3) is invisible to the parent's
> tool-permission layer — the parent cannot enforce read-only
> roles on a free-standing child primary session; (4) spawns an
> independent conversation the parent cannot steer, cancel, or
> recover results from without hand-rolled stdout / file plumbing
> that the Task tool already provides in-session. The intended
> child-session workflow is the Task tool, which keeps the child
> under this session's permission contract and returns its result
> inline to Build. Nested `opencode run` is therefore explicitly
> out of scope for this project. The full prose version of these
> rules lives in `.opencode/agents/build.md`.
>
> **Dual-layer enforcement.** The nested-OpenCode prohibition is
> enforced by **both** (a) Build's prose-level instructions in
> `.opencode/agents/build.md` (the body of the agent file lists
> every prohibited mechanism) **and** (b) Build's bash permission
> layer — the `permission.bash` block at the top of that file
> carries an explicit `opencode: deny` / `opencode *: deny` pair so
> a prompt that tries to spawn a nested primary session is rejected
> at the permission layer before it can ever execute. Normal Build
> shell access (`git`, `pnpm`, `node`, `ls`, ...) is preserved: the
> safeguard only denies the two `opencode` patterns, with no
> catch-all `*: deny` on bash.
>
> **Git repository-state operations are operator-controlled.** The
> long-standing project policy is that Git state changes are
> operator-controlled: the operator stages, commits, tags, pushes,
> restores, resets, cleans, rebases, merges, cherry-picks, reverts,
> switches, checks out, branches, manages remotes, updates refs,
> and removes tracked files via Git only when a human is in the
> loop. Build edits files (its `edit` / `write` tools are not
> restricted); Build does NOT run Git state-change subcommands
> through its `bash` tool. The same `permission.bash` block at
> the top of `.opencode/agents/build.md` carries an explicit deny
> for every Git state-change subcommand family — `git add`,
> `git commit`, `git tag`, `git push`, `git stash`, `git checkout`,
> `git switch`, `git restore`, `git reset`, `git clean`,
> `git rebase`, `git merge`, `git cherry-pick`, `git revert`,
> `git branch`, `git remote`, `git update-ref`, and `git rm` —
> each in both the bare (`git <subcommand>`) and the
> with-trailing-arguments (`git <subcommand> *`) forms. Read-only
> Git inspection (`git status`, `git diff`, `git log`, `git show`,
> `git ls-files`, `git rev-parse`) remains allowed by default so
> Build can describe the working tree, attach diff context to a
> Reviewer brief, and inspect commit / tag refs without leaving
> the agent's permission contract. A prompt that asks Build to
> "commit and push the changes" is rejected at the permission
> layer before it can ever execute — even if the prose-level
> prohibition were absent, the runtime guarantee holds.

**Hard constraints (enforced by permissions, not just prompt):**
- `build` is the only agent with a state-changing capability. The Tester, Reviewer, and Explore subagents all resolve with `edit: false` / `write: false` / `task: false`.
- `build` is the only agent allowed to delegate. The Task tool is the sole delegation channel; shell-based or nested-process delegation is explicitly prohibited (see the "Subagent delegation rules (native Task tool only)" subsection above and `.opencode/agents/build.md`).
- `build`'s `bash` permission layer has two explicit safeguard blocks: (a) `opencode: deny` / `opencode *: deny` blocks nested OpenCode execution, and (b) a per-subcommand deny list for every Git state-change family (see the "Git repository-state operations are operator-controlled" blockquote above) blocks repository-state mutations. Normal shell access is preserved (no `*: deny` on bash); only the listed patterns are forbidden, so a prompt that tries to spawn a nested primary session or perform an unattended Git operation is rejected at the permission layer before it can ever execute.
- `explore` is the only subagent with `bash: deny`. `webfetch: allow` / `websearch: allow` are preserved for external documentation lookup; `read`, `glob`, `grep`, `list`, `lsp` cover the in-workspace research surface without any shell command.
- `reviewer` has `bash` command-pattern gated to the eight read-only Git inspection commands. It can independently read the real working-tree diff; every other shell command is rejected at the permission layer.
- `tester` has `bash` command-pattern gated to the validation surface. `node -e *` is rejected — any Node smoke test is a Build-only operation.
- All three subagents have `task: deny` (no recursive delegation). They are leaf nodes — they produce findings / results directly back to Build, which is the only agent that modifies files.

## Architecture

The project uses a **feature-first architecture**.

Every business module lives under `features/` and owns its own:

* `api/`
* `components/`
* `composables/`
* `stores/`
* `types/`
* `schemas/`
* `services/`
* `data/`
* `constants/`
* `utils/`

Shared app infrastructure belongs outside features.

| Directory                | Purpose                                                            |
| ------------------------ | ------------------------------------------------------------------ |
| `components/ui/`         | Generic UI primitives — prefix with `Base`                         |
| `components/layout/`     | Layout shells — prefix with `App`                                  |
| `components/shared/`     | Cross-feature reusable components                                  |
| `features/*/components/` | Domain-specific components                                         |
| `core/`                  | Business-agnostic infrastructure such as API client, currency, SEO |
| `config/`                | Agency config, navigation, SEO                                     |
| `themes/`                | Design tokens per theme                                            |
| `i18n/locales/`          | `en.json`, `es.json`                                               |

The project-root `scripts/` directory holds **operator tooling** —
dependency-free Node ESM CLI utilities that run against the
runtime source tree (e.g. `pnpm bootstrap:client` →
`scripts/bootstrap-client.mjs`) plus their Vitest suite at
`scripts/*.test.mjs`. `scripts/` is intentionally NOT part of
the Nuxt application bundle: it runs under Node directly, has no
Vue / Nuxt runtime, and is loaded by `pnpm <script-name>` from
`package.json`'s `scripts:` block, not by the page components,
the Nitro endpoints, or the Studio. The `scripts/` directory is
distinct from `app/` (runtime) and from `server/` (Nitro
server-only code).

## Core conventions

### i18n

No hardcoded visible text.

All UI strings must use translation keys with `$t('key')`.

When adding or changing a visible string, update both:

* `i18n/locales/en.json`
* `i18n/locales/es.json`

### Branding and themes

No hardcoded brand colors.

Use CSS variables such as:

```css
var(--color-primary)
var(--color-secondary)
var(--color-accent)
var(--radius-md)
```

Tailwind utility classes are allowed for:

* layout
* spacing
* responsiveness
* typography structure
* flex/grid behavior

Do not use Tailwind color classes for brand colors unless they are mapped to theme tokens.

### Components

Components should receive data via props.

Do not fetch data directly inside presentational components.

API calls and business logic belong in:

* services
* composables
* stores, when state is needed

### Stores

Global stores are only for app-wide state.

Feature-specific stores must live inside their feature folder.

### Pages

Pages should stay thin.

A page may:

* compose feature components
* load route-level data
* set SEO metadata
* pass props to components

A page should not contain heavy business logic or large UI implementations.

## Naming conventions

* UI primitives: `BaseButton.vue`, `BaseInput.vue`, `BaseCard.vue`
* Layout components: `AppHeader.vue`, `AppFooter.vue`, `AppShell.vue`
* Composables: `useProperties.ts`, `useAgencyTheme.ts`
* Pinia stores: `usePropertyStore.ts`, `useFavoritesStore.ts`
* Zod schemas: `property.schema.ts`, `contact.schema.ts`
* Types: `property.types.ts`, `agency.types.ts`
* Services: `property.service.ts`, `lead.service.ts`

## Current gaps

MVP scope and task order are defined in `docs/ROADMAP.md`. The roadmap is the canonical list of completed milestones, the active task, and the upcoming sequence — do not duplicate that list here. This section is the short list of verified current gaps a new session needs to know about.

The folder structure, Tailwind setup, i18n locale files, agency config, theme tokens, components, pages, layouts, and SEO config all exist. Do not reimplement them.

Verified current gaps:

* **Property gallery fullscreen lightbox** — intentionally deferred (audit decision recorded in `docs/ROADMAP.md` M20, build decisions in M21). The Swiper carousel MVP shipped in M21 covers the three real gaps the audit identified (mobile swipe, keyboard arrow navigation, desktop prev/next) without the complexity cost of a generic modal system. A fullscreen lightbox with focus trap, body-scroll lock, Escape handler, and backdrop click remains a future task; a real-estate user wanting a larger view can use the browser's built-in image controls on the current main image.
* **Real lead capture** — v1.1.0 is released (tag `v1.1.0` at `e49597f` on `feature/lead-capture-v1.1`). v1.0.0 is released on the `release/v1.0.0` branch (tag `v1.0.0` at `456284c`) and ships a documented placeholder form. v1.1.0 ships a real `POST /api/contact` endpoint with **four** pluggable server-only delivery adapters (`disabled`, `log`, `webhook`, `email`), a shared Zod schema (`app/features/leads/schemas/lead.schema.ts`), a 16 KB body limit, a 5-per-10-minute **per-process** rate limit (`server/services/leads/lead.service.ts`), a `website` honeypot, a PII-redacted `log` adapter, an HMAC-SHA-256 signed webhook adapter, and a Nodemailer-backed SMTP email adapter with full HTML escaping. The visible form on `/contact` is gated by `agency.leads.enabled` and defaults to `false` in the sample agency (`app/config/agencies/default.agency.ts`), so a rebrand ships the same v1.0.0 placeholder behavior until it explicitly opts in. The contact-methods column (`tel:`, `mailto:`, `https://wa.me/`) is always available as the no-JS and failed-delivery fallback.   The v1.1.0 branch also ships a Vitest foundation (`vitest.config.ts`, **47 test
 files, 1230 tests** at HEAD) covering the lead-capture Zod schema, all four adapters, the adapter selector, the lead service pipeline (including the rate-limit window expiry), the `POST /api/contact` endpoint transport guards, the property / agent / development services (filter / sort / isPropertySort / getAll / getBySlug / getFeatured / getRelated), the data-source adapter foundation (static / api / cms — `DataSourceKind` set, `DataSourceAdapter<T>` contract, the selector, the five error classes, the static / api / cms adapters, the shared `server/utils/server-data-source.ts` utility), the tenant context + multi-tenant leads resolver (`resolveTenantContext`, `resolveTenantLeadsConfig`), the per-tenant sitemap + robots routes, the `paginate` / `parsePageParam` utilities, the `buildWhatsAppLink` helper, the `agencyPostalAddress` JSON-LD builder, and the agency configuration schema.  The v1.1.0 branch additionally ships a Playwright smoke-test foundation (`playwright.config.ts`
+ **8 spec files, 62 cases** at HEAD in default deterministic mode) covering the public-route no-error contract, the gallery lightbox + Swiper
 integration, the color-mode toggle + persistence + anti-FOUC, the mobile menu dialog + `inert` + focus management, the
 property inquiry form labelling, the multi-tenant fallback, and the agent / development detail pages, and a
 single-platform GitHub Actions CI workflow (`.github/workflows/ci.yml`) that runs `pnpm lint`, `pnpm test`, `pnpm
build`, and `pnpm test:e2e` (Chromium only, no matrix). An **opt-in** Sanity round-trip is available via
 `pnpm test:e2e:sanity` (11 cases, requires `SANITY_REAL_E2E=1` against a running dev server), which exercises the
 real Sanity dataset through the same GROQ → mapping → Zod → Nitro endpoint → Nuxt page render pipeline. The Sanity
 Studio ships `studio/vitest.config.ts` (41 schemas.test.ts cases + 6 sanity.config.test.ts cases = 47 Studio tests, run
 via `pnpm studio:typecheck`).
* **Individual development detail page** (`/developments/[slug]`) — post-v1.0. The `Development.slug` field is reserved in the type definition; v1.0 ships the `/developments` listing only. A future v1.x release can add the route without changing the data shape.
* **Real external data integration** — the data-source foundation (v1.1.0 M13) shipped the `DataSourceKind` set (`'static'` / `'api'` / `'cms'`), the async-first `DataSourceAdapter<T>` contract (`loadAll()` + `getAll()`), the selector, the five error classes, and the static adapter. The v1.1.0 M17 build ships the real HTTP API adapter (`createApiDataSource` at `app/core/data-source/adapters/api-adapter.ts`) and wires the property service to it through a same-origin Nitro endpoint: setting `NUXT_PROPERTIES_DATA_SOURCE=api` + `NUXT_PROPERTIES_API_URL=https://example.test/properties` switches the source at runtime. The v1.1.0 M20 build ships the CMS adapter (`createCmsDataSource` + `createHttpJsonCmsDriver` in `app/core/data-source/cms-driver.ts` and `app/core/data-source/adapters/http-json-cms-driver.ts`) and wires the property service to it through the same loader: setting `NUXT_PROPERTIES_DATA_SOURCE=cms` + `NUXT_PROPERTIES_CMS_URL=https://cms.example.test/properties` switches the source at runtime; the empty / whitespace URL still raises `DataSourceMissingConfigError`. **Final architecture (M20).** The api-adapter module, the cms-driver + http-json-cms-driver modules, and the five `NUXT_PROPERTIES_*` env vars are owned exclusively by the server-only property loader at `server/utils/properties.ts` (the canonical Nuxt 4 location for server-only utilities). The loader reads the env vars, constructs the appropriate adapter (static by default; api, or cms when configured), eagerly fetches the remote list on the server, and exposes the resolved public list through `loadPropertiesServer()`. **No permanent process-lifetime cache is retained for successful remote results.** Each call to `loadPropertiesServer()` constructs a fresh adapter and awaits its `loadAll()`; a later request observes the latest upstream data, not a stale snapshot. Concurrent in-flight calls share a single fetch via an in-flight `pending` promise that is cleared on settle (success or failure), so the next call performs a new fetch. The remote source is therefore fetched on every call, not "at most once per server lifetime". The loader is consumed by two surfaces: (1) the same-origin Nitro endpoint at `server/api/properties.get.ts`, which the app-side property service calls via `$fetch('/api/properties')` (loopback on the server, same-origin HTTP on the client); (2) the sitemap at `server/routes/sitemap.xml.ts`, which imports the loader directly. The property service (`app/features/properties/services/properties.service.ts`) is bundled to both server and client; it references only the same-origin path `/api/properties` (no external api or cms URL, no env-var name string, no adapter module import). Routes that do not need properties (`/about`, `/contact`, `/agents/*`, `/developments/*`) do not call `propertiesService.loadAll()` and do not trigger the remote fetch. The service's `loadAll()` returns the data the Nitro endpoint emits; the pure helpers (`getAll(data)` / `getBySlug(data, slug)` / `filter(data, filters, sort)` / `getFeatured(data, limit?)` / `getRelated(data, current, limit = 3)`) take the loaded data as their first argument. The boundary regression test (`app/features/properties/services/properties.service.boundary.test.ts`) pins the contract: the service's source must not import the api-adapter module, the cms-driver / http-json-cms-driver modules, the data-source contract runtime exports, any `NUXT_PROPERTIES_*` env-var name string, or any `process.env` / `typeof window` reference. The loader tests in `server/utils/properties.test.ts`, the endpoint tests in `server/api/properties.get.test.ts`, and the sitemap tests in `server/routes/sitemap.xml.test.ts` pin the server-side contract: the loader owns the env-var reads, the endpoint is a thin transport, and the sitemap does not import the app-side property service or any Nuxt app composable. **CMS provider-driver boundary (M20).** The CMS path splits provider-specific knowledge from the data-source contract. `createCmsDataSource<T>({ driver, schema, source? })` is the provider-agnostic adapter (validates the driver's output with the supplied boundary schema, memoise the array). `CmsDriver<T>` is the contract (`{ id, dispatch(): Promise<readonly T[]> }`); `createHttpJsonCmsDriver<T>({ endpoint, source?, timeoutMs?, fetchImpl? })` is the shipped provider (simple HTTP/JSON, identity mapping, platform `fetch` + `AbortController`-based timeout, four-class error mapping mirroring the api adapter). A future Sanity / Contentful / Strapi adapter would carry a per-record `mapRecord` step that converts the provider's native document shape into `Property`; the contract stays the same. The CMS adapter (and api adapter) remain intentionally a thin transport — no retries, no response cache, no pagination protocol — and a future task can add a shared `$fetch` retry policy + a response-cache layer without changing the service-layer contract. bundled to both server and client; it references only the same-origin path `/api/properties` (no external api URL, no env-var name string, no api-adapter import). Routes that do not need properties (`/about`, `/contact`, `/agents/*`, `/developments/*`) do not call `propertiesService.loadAll()` and do not trigger the api fetch. The service's `loadAll()` returns the data the Nitro endpoint emits; the pure helpers (`getAll(data)` / `getBySlug(data, slug)` / `filter(data, filters, sort)` / `getFeatured(data, limit?)` / `getRelated(data, current, limit = 3)`) take the loaded data as their first argument. The boundary regression test (`app/features/properties/services/properties.service.boundary.test.ts`) pins the contract: the service's source must not import the api-adapter module, the static-adapter module, the data-source contract runtime exports, any `NUXT_PROPERTIES_*` env-var name string, or any `process.env` / `typeof window` reference. The loader tests in `server/utils/properties.test.ts`, the endpoint tests in `server/api/properties.get.test.ts`, and the sitemap tests in `server/routes/sitemap.xml.test.ts` pin the server-side contract: the loader owns the env-var reads, the endpoint is a thin transport, and the sitemap does not import the app-side property service or any Nuxt app composable. The CMS adapter (Sanity, Contentful, Strapi, …) remains intentionally deferred to a future task and follows the same pattern (one file in `app/core/data-source/adapters/` plus a service-level registry entry).
* **Real Sanity CMS integration** - the v1.2 pilot shipped the first provider-specific CMS driver. The `@sanity/client` driver at `server/utils/sanity-driver.ts` is wired through the existing `cms` data-source branch via a per-feature `NUXT_<FEATURE>_CMS_PROVIDER=sanity` env var; the shared `NUXT_SANITY_*` env vars (`NUXT_SANITY_PROJECT_ID`, `NUXT_SANITY_DATASET`, `NUXT_SANITY_API_VERSION`, optional `NUXT_SANITY_TOKEN`) cover the three features (Property / Agent / Development). The GROQ → mapping → Zod boundary pipeline lives at `server/utils/sanity-mappings.ts`; the boundary regression test at `server/utils/sanity-boundary.test.ts` pins no `app/` file imports `@sanity/client`, references `NUXT_SANITY_TOKEN`, or re-exports the provider driver. The Sanity Studio at `studio/` is a separate project with its own `package.json` / `pnpm-lock.yaml` / `node_modules` and ships the Property / Agent / Development document schemas (`studio/schemas/{property,agent,development}.ts`); `pnpm studio:typecheck` runs `cd studio && pnpm install --frozen-lockfile && pnpm typecheck && pnpm test`. Studio deploys with `cd studio && pnpm deploy` to Sanity's managed hosting at `<projectId>.sanity.studio`. The real-Sanity end-to-end validation procedure is documented at `docs/SANITY_VALIDATION.md` (the fixtures-based integration test at `server/utils/sanity-integration.test.ts` is the deterministic 14-case coverage; the opt-in `pnpm test:e2e:sanity` (11 cases) is the live round-trip — the default `pnpm test:e2e` is the deterministic static-data suite and does not require a real Sanity project). The Sanity first-client operations guide (agency-owned project model, one-time setup, client editing, operator / maintenance workflow, smoke validation, export / backup, incident / recovery, end-of-contract handoff) is at `docs/SANITY_OPERATIONS.md`. The Studio UX polish (human-readable enum titles, in-line field descriptions, helpful required-field error messages, conditional relevance for the `land` property type, human-readable preview subtitles, focused Studio tests) shipped in v1.2 pilot 5 (Task 119).

ESLint config is auto-resolved by `@nuxt/eslint`; do not add a manual ESLint config unless the existing setup requires it.

## Validation

Form validation uses Zod schemas inside:

```txt
features/*/schemas/
```

Do not duplicate validation rules inside components.

## Before changing code

Before implementing a task:

1. Read `docs/OPENCODE.md`.
2. Read the task-specific doc in `docs/`.
3. Check existing folders and files.
4. Follow the feature-first structure.
5. Reuse existing types, schemas, services, composables, and theme tokens when available.

## After changing code

When relevant, run:

```bash
pnpm lint
pnpm build
```

If the build cannot be run or fails because of unrelated existing issues, mention it clearly.

## Do not

* Do not hardcode visible UI text.
* Do not hardcode brand colors.
* Do not place business logic inside presentational components.
* Do not create global stores for feature-only state.
* Do not add files outside the agreed architecture without a strong reason.
* Do not change the architecture without updating the related docs.
* Do not assume missing data models, routes, or theme tokens — check the docs first.
