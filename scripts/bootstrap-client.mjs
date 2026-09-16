/**
 * Bootstrap a new client — `pnpm bootstrap:client`.
 *
 * The script is also directly executable via `node scripts/bootstrap-client.mjs`
 * (no shebang line; Vitest's import-analysis plugin does not accept the
 * shebang). `pnpm bootstrap:client` is the documented operator entry point.
 *
 * This command creates the project-level agency / theme / tenant
 * scaffolding required for a new real-estate client without
 * modifying any generic application behavior. The Bootstrap is
 * the automation of the Task 123 first-client rebrand dry-run
 * (Bahía del Mar).
 *
 * **What the Bootstrap creates / modifies.**
 *
 *  - `app/config/agencies/<id>.agency.ts` (CREATE) — a new agency
 *    config file with the agency's identity, contact, modules, and
 *    lead-capture flag. Safe placeholders for the operator to fill
 *    in.
 *  - `app/themes/<id>.theme.ts` (CREATE) — a new theme file copied
 *    from the default theme's palette. The operator customizes the
 *    brand colors.
 *  - `app/config/agencies/registry.ts` (MODIFY) — adds one
 *    `import { <id>AgencyConfig } from './<id>.agency'` line + one
 *    `<id>: buildEntry(<id>AgencyConfig, [hostnames])` entry in the
 *    frozen registry.
 *  - `app/themes/index.ts` (MODIFY) — adds one
 *    `import { <id>Theme } from './<id>.theme'` line + one
 *    `[<id>Theme.id]: <id>Theme` entry in the frozen themes map.
 *
 * **Insertion anchors are structural, not literal.** The registry +
 * themes-index patches derive their insertion points from the
 * current source shape — the last import line of the form
 * `import { xAgencyConfig } from './x.agency'` (or `xTheme` for
 * themes) and the closing of the `Object.freeze({...})` (or the
 * closing `}` of the themes map). The Bootstrap does NOT depend
 * on any specific previously-generated tenant id; a future client
 * works whether `bahia-del-mar` is present or absent.
 *
 * **What the Bootstrap does NOT touch.**
 *
 *  - Generic application code (pages, components, layouts,
 *    composables).
 *  - Bundled sample data under `app/features/<feature>/data/` — the
 *    operator populates the catalog after Bootstrap finishes.
 *  - CMS project setup (Sanity / Contentful / Strapi) — see
 *    `docs/SANITY_OPERATIONS.md`.
 *  - Lead-delivery env vars (`NUXT_LEADS_*`) — the visible form's
 *    interactivity is set via `agency.leads.enabled`; the actual
 *    delivery adapter is selected at the server via env vars, not
 *    by the Bootstrap.
 *  - `.env` files — the Bootstrap emits no `.env` changes. The
 *    operator sets the deploy-time env vars separately.
 *  - Lead-capture behavior — the Bootstrap only flips the
 *    `agency.leads.enabled` flag; it does NOT change the lead
 *    pipeline, the adapters, or the endpoint.
 *
 * **`--lead-adapter` decision.** The flag only changes one
 * `AgencyConfig` boolean field (`leads.enabled`). It introduces
 * no secrets, no runtime env vars, and no additional coupling
 * outside the generated agency file. The brief's criteria for
 * keeping the flag are satisfied; the flag stays in this v1.3
 * build. The actual delivery adapter is selected at the server
 * via `NUXT_LEADS_ADAPTER` (deployment-time env), so the
 * `--lead-adapter` choice only affects whether the visible form
 * is interactive. A future v1.x can remove the flag if the
 * on-by-default placeholder behavior becomes the convention.
 *
 * **Safety.**
 *
 *  - Inputs are validated before any write.
 *  - Conflicts are detected before any write (existing tenant id,
 *    existing theme id, existing target files, existing hostname
 *    in any registry entry's `hosts` list).
 *  - `--dry-run` prints the plan and exits without writing.
 *  - Files are written in the order the dependencies need them
 *    (agency + theme files first, then registry). If any check
 *    fails, no file is written.
 *  - Repeated execution with the same `--id` fails safely with a
 *    clear error message.
 *  - **Rollback.** On any mid-write failure, the Bootstrap rolls
 *    back every successful write: new files (steps 1 / 2) are
 *    deleted; modified files (steps 3 / 4) are restored from a
 *    pre-write snapshot captured before each write. The mutation
 *    surface is empty on rollback.
 *  - The Bootstrap does NOT run `pnpm install`, `pnpm lint`,
 *    `pnpm test`, `pnpm build`, or `pnpm test:e2e`. The
 *    operator runs the validation pipeline after the Bootstrap
 *    finishes.
 *
 * **Testability.** `applyPlan` accepts an optional `fsOps`
 * dependency-injection seam (defaults to the real `node:fs/promises`
 * bindings). Tests inject a mock `fsOps` that throws on a specific
 * write to exercise the rollback path without monkey-patching
 * immutable ESM imports.
 *
 * **CLI.**
 *
 * ```
 * pnpm bootstrap:client --id=<tenant-id> --name="<display name>" --hostname=<host>
 *   [--hostname=<additional-host> ...]
 *   [--theme-name="<theme display name>"]
 *   [--currency=<ISO-4217-code>]
 *   [--default-locale=<locale-code>]
 *   [--available-locales=<csv-list>]
 *   [--measurement-unit=<metric|imperial>]
 *   [--lead-adapter=<disabled|log|webhook|email>]
 *   [--dry-run] [-h|--help]
 * ```
 *
 * The `--root <dir>` flag is **hidden** (not in `--help`) and is
 * used by the bootstrap's own test suite to point the script at a
 * scratch directory. In normal operator use, the project root is
 * derived from the script's location.
 */

import { parseArgs } from 'node:util'
import {
  readFile,
  writeFile,
  mkdir,
  access,
  unlink,
  constants,
} from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join, sep } from 'node:path'

/* ------------------------------------------------------------------ *
 * Constants & defaults
 * ------------------------------------------------------------------ */

/**
 * Lowercase letters, digits, and hyphens. Must start and end with
 * an alphanumeric character. Max 64 characters. Same shape as the
 * tenant-id constraint documented in `docs/MULTI_TENANT.md`.
 */
export const TENANT_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$/

/** Reserved tenant ids that the Bootstrap must never overwrite. */
export const RESERVED_TENANT_IDS = ['default']

/** ISO 4217 currency code shape. */
export const ISO_4217_PATTERN = /^[A-Z]{3}$/

/** i18n locale codes wired into `app/config/i18n.ts`. */
export const KNOWN_LOCALES = ['en', 'es']

/** Lead delivery adapter values (the runtime env var accepts these). */
export const VALID_LEAD_ADAPTERS = ['disabled', 'log', 'webhook', 'email']

/** Measurement unit enum (matches `app/types/agency.types.ts`). */
export const VALID_MEASUREMENT_UNITS = ['metric', 'imperial']

/** Reserved camelCase suffix avoided in the generated export name. */
export const RESERVED_CAMEL_SUFFIXES = new Set(['default', 'theme', 'config'])

/* ------------------------------------------------------------------ *
 * Pure helpers (exported for tests + reuse)
 * ------------------------------------------------------------------ */

/** Convert a kebab-case id to camelCase. */
export function kebabToCamel(input) {
  if (typeof input !== 'string' || input.length === 0) return ''
  const head = input[0]
  const tail = input.slice(1).replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase())
  return head + tail
}

/** The export name for the agency file (`acme` -> `acmeAgencyConfig`). */
export function getAgencyExportName(tenantId) {
  return `${kebabToCamel(tenantId)}AgencyConfig`
}

/** The export name for the theme file (`acme` -> `acmeTheme`). */
export function getThemeExportName(tenantId) {
  return `${kebabToCamel(tenantId)}Theme`
}

/** Normalize a hostname for conflict-detection. Mirrors `app/config/agencies/registry.ts → normalizeHostname`. */
export function normalizeHostname(raw) {
  if (raw === null || raw === undefined) return ''
  const trimmed = String(raw).trim()
  if (trimmed === '') return ''
  const colonIndex = trimmed.indexOf(':')
  const hostPart = colonIndex === -1 ? trimmed : trimmed.slice(0, colonIndex)
  return hostPart.toLowerCase()
}

/**
 * Parse a CSV string into a non-empty, trimmed, deduplicated array.
 *
 * Locale codes are stored lowercase (the convention everywhere else
 * in the project — see `app/config/i18n.ts`); this function
 * lowercases each entry so the caller does not have to.
 */
export function parseCsvList(raw) {
  if (raw === null || raw === undefined) return []
  return Array.from(
    new Set(
      String(raw)
        .split(',')
        .map(part => part.trim().toLowerCase())
        .filter(part => part !== ''),
    ),
  )
}

/* ------------------------------------------------------------------ *
 * Input validation
 * ------------------------------------------------------------------ */

/**
 * @typedef {Object} BootstrapInput
 * @property {string} id
 * @property {string} name
 * @property {string[]} hostnames
 * @property {string} [themeName]
 * @property {string} [currency]
 * @property {string} [defaultLocale]
 * @property {string[]} [availableLocales]
 * @property {'metric'|'imperial'} [measurementUnit]
 * @property {'disabled'|'log'|'webhook'|'email'} [leadAdapter]
 */

/**
 * Validate a parsed CLI input. Returns `{ ok: true, value }` with
 * the normalized input, or `{ ok: false, errors: string[] }`.
 *
 * Pure (no I/O). Conflict-detection against the existing project
 * state is a separate step (`detectConflicts`).
 */
export function validateInputs(input) {
  /** @type {string[]} */
  const errors = []

  const id = typeof input.id === 'string' ? input.id.trim() : ''
  if (id === '') {
    errors.push('--id is required')
  } else if (!TENANT_ID_PATTERN.test(id)) {
    errors.push(
      `--id "${id}" is not a valid tenant id. Allowed: lowercase letters, digits, and dashes; must start and end with an alphanumeric character; 2–64 characters.`,
    )
  } else if (RESERVED_TENANT_IDS.includes(id)) {
    errors.push(`--id "${id}" is reserved and cannot be used by the bootstrap.`)
  } else if (id.startsWith('-') || id.endsWith('-')) {
    errors.push(`--id "${id}" must not start or end with a dash.`)
  }

  const name = typeof input.name === 'string' ? input.name.trim() : ''
  if (name === '') {
    errors.push('--name is required and must be non-empty')
  } else if (name.length > 120) {
    errors.push(`--name must be at most 120 characters (got ${name.length}).`)
  } else if (!/\S/.test(name)) {
    errors.push('--name must contain at least one non-whitespace character.')
  }

  /** @type {string[]} */
  const rawHostnames = Array.isArray(input.hostnames) ? input.hostnames : []
  /** @type {string[]} */
  const hostnames = []
  for (const raw of rawHostnames) {
    const normalized = normalizeHostname(raw)
    if (normalized === '') {
      errors.push(`--hostname "${raw}" is empty or invalid.`)
    } else if (!hostnames.includes(normalized)) {
      hostnames.push(normalized)
    }
  }
  if (hostnames.length === 0) {
    errors.push('At least one --hostname is required.')
  }

  const currency =
    typeof input.currency === 'string' && input.currency !== ''
      ? input.currency.toUpperCase()
      : 'USD'
  if (!ISO_4217_PATTERN.test(currency)) {
    errors.push(
      `--currency "${currency}" is not a valid ISO 4217 code (3 uppercase letters).`,
    )
  }

  const availableLocales = Array.isArray(input.availableLocales)
    ? input.availableLocales
    : ['en', 'es']
  if (availableLocales.length === 0) {
    errors.push('--available-locales must contain at least one locale.')
  }
  for (const locale of availableLocales) {
    if (!KNOWN_LOCALES.includes(locale)) {
      errors.push(
        `--available-locales contains "${locale}" which is not a registered i18n locale (registered: ${KNOWN_LOCALES.join(', ')}).`,
      )
    }
  }

  const defaultLocale =
    typeof input.defaultLocale === 'string' && input.defaultLocale !== ''
      ? input.defaultLocale
      : availableLocales[0]
  if (!availableLocales.includes(defaultLocale)) {
    errors.push(
      `--default-locale "${defaultLocale}" must be included in --available-locales (${availableLocales.join(', ')}).`,
    )
  }
  if (!KNOWN_LOCALES.includes(defaultLocale)) {
    errors.push(
      `--default-locale "${defaultLocale}" is not a registered i18n locale (registered: ${KNOWN_LOCALES.join(', ')}).`,
    )
  }

  const measurementUnit = input.measurementUnit ?? 'metric'
  if (!VALID_MEASUREMENT_UNITS.includes(measurementUnit)) {
    errors.push(
      `--measurement-unit "${measurementUnit}" must be one of: ${VALID_MEASUREMENT_UNITS.join(', ')}.`,
    )
  }

  const leadAdapter = input.leadAdapter ?? 'disabled'
  if (!VALID_LEAD_ADAPTERS.includes(leadAdapter)) {
    errors.push(
      `--lead-adapter "${leadAdapter}" must be one of: ${VALID_LEAD_ADAPTERS.join(', ')}.`,
    )
  }

  const themeName =
    typeof input.themeName === 'string' && input.themeName.trim() !== ''
      ? input.themeName.trim()
      : `${name.trim()} Theme`

  // Defensive: avoid generated export names that collide with `default`
  // / `theme` / `config`. (Already prevented by the TENANT_ID_PATTERN
  // disallowing the reserved ids, but kept explicit for future-proofing.)
  if (RESERVED_CAMEL_SUFFIXES.has(getAgencyExportName(id))) {
    errors.push(
      `Generated agency export name "${getAgencyExportName(id)}" collides with a reserved identifier; choose a different --id.`,
    )
  }
  if (RESERVED_CAMEL_SUFFIXES.has(getThemeExportName(id))) {
    errors.push(
      `Generated theme export name "${getThemeExportName(id)}" collides with a reserved identifier; choose a different --id.`,
    )
  }

  if (errors.length > 0) {
    return { ok: false, errors }
  }

  return {
    ok: true,
    value: {
      id,
      name,
      hostnames,
      themeName,
      currency,
      availableLocales,
      defaultLocale,
      measurementUnit,
      leadAdapter,
    },
  }
}

/* ------------------------------------------------------------------ *
 * Content generators
 * ------------------------------------------------------------------ */

/**
 * Generate the agency file content. Pure (no I/O).
 *
 * The generated file mirrors the shape of any rebranded agency
 * config file (Task 123's `bahia-del-mar` was the first example,
 * but the shape is generic — every field is named identically to
 * the template's `AgencyConfig` type). Placeholder values are
 * clearly marked with `[TODO]` so the operator cannot ship the
 * file unchanged.
 */
export function generateAgencyFileContent(input, now = new Date()) {
  const exportName = getAgencyExportName(input.id)
  const today = now.toISOString().slice(0, 10)
  const leadEnabled = input.leadAdapter !== 'disabled'

  return [
    `import type { AgencyConfig } from '~/types/agency.types'`,
    ``,
    `/**`,
    ` * ${input.name} agency configuration.`,
    ` *`,
    ` * Generated by \`pnpm bootstrap:client\` on ${today}. Every field`,
    ` * marked \`[TODO]\` is a safe placeholder that the operator MUST`,
    ` * replace with the agency's real information before deploy.`,
    ` *`,
    ` * \`leads.enabled\` reflects the operator's chosen`,
    ` * \`--lead-adapter\` flag at generation time. The actual delivery`,
    ` * adapter (disabled / log / webhook / email) is selected at the`,
    ` * server via the \`NUXT_LEADS_ADAPTER\` env var — see`,
    ` * \`docs/CLIENT_ONBOARDING.md\` §2.1 for the adapter selection and`,
    ` * \`docs/REBRANDING.md\` §12 for the deploy-time env-var table.`,
    ` *`,
    ` * @see docs/REBRANDING.md for the rebranding workflow.`,
    ` */`,
    `export const ${exportName}: AgencyConfig = {`,
    `  id: ${JSON.stringify(input.id)},`,
    `  name: ${JSON.stringify(input.name)},`,
    `  slogan: ${JSON.stringify(input.name)},`,
    `  logo: '/images/logo.svg',`,
    `  favicon: '/favicon.ico',`,
    `  theme: ${JSON.stringify(input.id)},`,
    `  defaultLocale: ${JSON.stringify(input.defaultLocale)},`,
    `  availableLocales: ${JSON.stringify(input.availableLocales)},`,
    `  currency: ${JSON.stringify(input.currency)},`,
    `  measurementUnit: ${JSON.stringify(input.measurementUnit)},`,
    `  contact: {`,
    `    // [TODO] Replace with the agency's real contact information.`,
    `    phone: '+1 555 000 0000',`,
    `    whatsapp: '+1 555 000 0000',`,
    `    email: 'contact@example.test',`,
    `    address: '[TODO: agency street address, city, state, country]',`,
    `    businessHours: 'Mon-Fri 9am-5pm', // [TODO]`,
    `  },`,
    `  // [TODO] Populate the social URLs with the agency's real handles.`,
    `  // The shipped default uses 'www.' prefixes that the format`,
    `  // warnings accept; use 'https://' to avoid the warning.`,
    `  social: {},`,
    `  modules: {`,
    `    properties: true,`,
    `    developments: true,`,
    `    agents: true,`,
    `    // The blog module is not part of the MVP. See docs/REBRANDING.md.`,
    `    blog: false,`,
    `    testimonials: true,`,
    `    contact: true,`,
    `  },`,
    `  leads: {`,
    `    // Set by the bootstrap from the --lead-adapter flag.`,
    `    // Server-side delivery adapter (NUXT_LEADS_ADAPTER) is configured`,
    `    // at deploy time; see docs/CLIENT_ONBOARDING.md §2.1.`,
    `    enabled: ${leadEnabled ? 'true' : 'false'},`,
    `  },`,
    `}`,
    ``,
  ].join('\n')
}

/**
 * Generate the theme file content. The colors are a copy of the
 * default theme's neutral palette so the operator has a starting
 * point; the brand colors are flagged as `[TODO]` in the comment.
 */
export function generateThemeFileContent(input, now = new Date()) {
  const exportName = getThemeExportName(input.id)
  const today = now.toISOString().slice(0, 10)

  // Colors copied verbatim from `app/themes/default.theme.ts`. The
  // operator customizes the brand palette before deploy.
  const lightColors = {
    background: '#FFFFFF',
    foreground: '#111827',
    surface: '#FFFFFF',
    surfaceMuted: '#F5F5F4',
    primary: '#0F766E', // [TODO] Agency brand primary.
    primaryForeground: '#FFFFFF',
    secondary: '#F5F5F4',
    secondaryForeground: '#111827',
    accent: '#D97706', // [TODO] Agency brand accent.
    accentForeground: '#FFFFFF',
    muted: '#6B7280',
    border: '#E5E7EB',
    card: '#FFFFFF',
    cardForeground: '#111827',
    success: '#16A34A',
    warning: '#D97706',
    error: '#DC2626',
  }

  const darkColors = {
    background: '#0B1220',
    foreground: '#F8FAFC',
    surface: '#111827',
    surfaceMuted: '#1F2937',
    muted: '#9CA3AF',
    border: '#1F2937',
    card: '#111827',
    cardForeground: '#F8FAFC',
  }

  return [
    `import type { ThemeConfig } from '~/types/theme.types'`,
    ``,
    `/**`,
    ` * ${input.themeName}.`,
    ` *`,
    ` * Generated by \`pnpm bootstrap:client\` on ${today}. The colors`,
    ` * below are a copy of the default theme's neutral palette; replace`,
    ` * the brand colors (the comments mark each one) before deploy.`,
    ` *`,
    ` * The dark-mode palette mirrors the default theme's neutrals. The`,
    ` * brand colors (\`primary\`, \`secondary\`, \`accent\`) are shared`,
    ` * between modes so the agency identity stays consistent.`,
    ` *`,
    ` * @see docs/REBRANDING.md`,
    ` */`,
    `export const ${exportName}: ThemeConfig = {`,
    `  id: ${JSON.stringify(input.id)},`,
    `  name: ${JSON.stringify(input.themeName)},`,
    `  colors: ${JSON.stringify(lightColors, null, 2).replace(/\n/g, '\n  ').replace(/^ {2}/, '')},`,
    `  dark: ${JSON.stringify(darkColors, null, 2).replace(/\n/g, '\n  ').replace(/^ {2}/, '')},`,
    `  fonts: {`,
    `    heading: 'Inter, system-ui, sans-serif',`,
    `    body: 'Inter, system-ui, sans-serif',`,
    `    serif: 'Georgia, "Times New Roman", serif',`,
    `  },`,
    `  radius: {`,
    `    sm: '0.375rem',`,
    `    md: '0.75rem',`,
    `    lg: '1rem',`,
    `    xl: '1.5rem',`,
    `    full: '9999px',`,
    `  },`,
    `  shadow: {`,
    `    sm: '0 1px 2px rgb(0 0 0 / 0.30)',`,
    `    md: '0 8px 24px rgb(0 0 0 / 0.36)',`,
    `    lg: '0 16px 48px rgb(0 0 0 / 0.44)',`,
    `  },`,
    `  layout: {`,
    `    containerMaxWidth: '1280px',`,
    `    sectionSpacing: '5rem',`,
    `  },`,
    `}`,
    ``,
  ].join('\n')
}

/** Insert text at the first occurrence of `anchor` in `text`. */
function insertAfter(text, anchor, insertion) {
  const idx = text.indexOf(anchor)
  if (idx === -1) {
    throw new Error(`Anchor not found: ${anchor.slice(0, 80)}`)
  }
  return (
    text.slice(0, idx + anchor.length) +
    insertion +
    text.slice(idx + anchor.length)
  )
}

/**
 * Build the two strings to insert into `app/config/agencies/registry.ts`:
 * the import line and the registry entry. Caller is responsible for
 * concatenating them at the right anchors.
 *
 * The registry file uses single-quoted string literals for tenant
 * ids and hostnames (matching every existing entry the template
 * ships today — the bundled `default` plus any prior rebrand), so
 * the patch keeps that convention. The insertion anchors are
 * **structural** (see `applyRegistryPatch` below) and do not
 * depend on any specific previously-generated tenant id.
 */
export function generateRegistryPatch(tenantId, hostnames) {
  const exportName = getAgencyExportName(tenantId)
  const importLine = `import { ${exportName} } from './${tenantId}.agency'\n`
  const quote = (s) => `'${String(s).replace(/'/g, "\\'")}'`
  const hostList = hostnames.map(h => `    ${quote(h)}`).join(',\n')
  const hostsBlock =
    hostnames.length === 1
      ? `    ${quote(hostnames[0])}`
      : `[\n${hostList}\n  ]`
  const entryBlock =
    hostnames.length === 1
      ? `  ${quote(tenantId)}: buildEntry(${exportName}, [${quote(hostnames[0])}]),\n`
      : `  ${quote(tenantId)}: buildEntry(${exportName}, ${hostsBlock}),\n`
  return { importLine, entryBlock }
}

/* ------------------------------------------------------------------ *
 * Registry + themes-index patching — structural anchors
 * ------------------------------------------------------------------ */

/**
 * Structural anchor for the registry's agency-config import block.
 *
 * Matches every line of the form
 * `import { xAgencyConfig } from './x.agency'`. The Bootstrap
 * anchors on the LAST such line so the patch is independent of
 * which tenants are currently registered. The Bootstrap does NOT
 * depend on any specific previously-generated tenant id (e.g.
 * `bahia-del-mar`); the anchor only depends on the import-block
 * shape produced by the project's own rebrand workflow.
 */
const AGENCY_CONFIG_IMPORT_LINE_PATTERN = /^import \{ \w+AgencyConfig \} from '\.\/[\w-]+\.agency'\s*$/gm

/**
 * Structural anchor for the registry's `Object.freeze({...})`
 * closing. The close `})` appears in multiple places in the
 * file (the close of `validateAgencyConfig(...)` inside
 * `buildEntry`, and the close of `Object.freeze(...)` at the end
 * of the file). We anchor on the LAST `\n})\s*$` match — the
 * `\n}` is the line break before the registry close, and the `\s*$`
 * anchors it at end of file. The other `})` occurrences inside
 * the file are NOT followed by `$` (they appear mid-file), so
 * the pattern uniquely identifies the registry's close.
 */
const REGISTRY_END_PATTERN = /\n\}\)\s*$/

/**
 * Structural anchor for the themes-index import block. Matches
 * every line of the form
 * `import { xTheme } from './x.theme'`. The Bootstrap anchors on
 * the LAST such line.
 */
const THEME_IMPORT_LINE_PATTERN = /^import \{ \w+Theme \} from '\.\/[\w-]+\.theme'\s*$/gm

/**
 * Structural anchor for the themes map's last entry line. The
 * themes map entries have the shape `  [<themeId>.id]: <themeId>,\n`.
 * We anchor on the LAST such line and insert AFTER it (so the new
 * entry sits between the last existing entry and the themes map's
 * closing `}`). This avoids the ambiguity of multiple `}` lines in
 * the themes file (the themes map close vs. the resolveTheme
 * function close).
 */
const THEME_ENTRY_LINE_PATTERN = /^ {2}\[\w+\.id\]: {1}\w+,\n/gm

/**
 * Insert the registry patch into the existing registry.ts content.
 *
 * The patch is **structural**: it anchors on (a) the last agency
 * config import line in the import block and (b) the registry's
 * closing `})`. The patch is independent of which tenants are
 * currently registered.
 *
 * The entry is inserted right BEFORE the registry's closing `})`
 * (i.e., after the leading `\n` of the `\n})\n` close pattern).
 * The entry itself ends with a newline, so the result is:
 * `...previous entry...,\n  'new-tenant': buildEntry(...),\n})`.
 */
export function applyRegistryPatch(registryContent, tenantId, hostnames) {
  const { importLine, entryBlock } = generateRegistryPatch(tenantId, hostnames)

  const importMatches = [
    ...registryContent.matchAll(AGENCY_CONFIG_IMPORT_LINE_PATTERN),
  ]
  if (importMatches.length === 0) {
    throw new Error(
      `Could not find any agency-config import line matching ${AGENCY_CONFIG_IMPORT_LINE_PATTERN}. `
      + `The registry file shape may have changed; the bootstrap needs an update.`,
    )
  }
  const lastImportMatch = importMatches[importMatches.length - 1]

  // Insert the new import line AFTER the last agency-config import.
  const patched = insertAfter(
    registryContent,
    lastImportMatch[0],
    '\n' + importLine,
  )

  // Find the closing `\n})\n` in the PATCHED content (the
  // import-line insertion above may have shifted it). Insert the
  // new entry right before the closing `}` — the entryBlock itself
  // ends with a newline, so the result keeps the existing
  // structure (each entry on its own line, no spurious blank
  // lines).
  const patchedCloseMatch = patched.match(REGISTRY_END_PATTERN)
  if (!patchedCloseMatch) {
    throw new Error(
      `Could not find the registry's closing \`})\` at end of file. `
      + `The registry file shape may have changed; the bootstrap needs an update.`,
    )
  }
  // patchedCloseMatch.index is the offset of the leading `\n` of
  // `\n})\n`. We insert right after that `\n` and before the `}`.
  const finalInsertPoint = patchedCloseMatch.index + 1
  return (
    patched.slice(0, finalInsertPoint) +
    entryBlock +
    patched.slice(finalInsertPoint)
  )
}

/** Build the patch strings for `app/themes/index.ts`. */
export function generateThemesIndexPatch(tenantId) {
  const exportName = getThemeExportName(tenantId)
  const importLine = `import { ${exportName} } from './${tenantId}.theme'\n`
  const entryLine = `  [${exportName}.id]: ${exportName},\n`
  return { importLine, entryLine }
}

/**
 * Insert the themes-index patch into the existing themes/index.ts
 * content.
 *
 * The patch is **structural**: it anchors on (a) the last theme
 * import line in the import block and (b) the last theme entry
 * line in the themes map. The patch is independent of which themes
 * are currently registered.
 *
 * The new entry is inserted immediately AFTER the last existing
 * entry's trailing `\n`. The entryLine itself ends with a
 * newline, so the result keeps the existing structure (each entry
 * on its own line, no spurious blank lines). The insertion point
 * is computed from the PATCHED content's last entry match so a
 * second bootstrap on the same file (registering a third tenant)
 * continues to work correctly — the prior bug inserted 1
 * character too early, putting the new entry on the same line as
 * the previous one and breaking the structural anchor on the
 * second run.
 */
export function applyThemesIndexPatch(themesIndexContent, tenantId) {
  const { importLine, entryLine } = generateThemesIndexPatch(tenantId)

  const importMatches = [
    ...themesIndexContent.matchAll(THEME_IMPORT_LINE_PATTERN),
  ]
  if (importMatches.length === 0) {
    throw new Error(
      `Could not find any theme import line matching ${THEME_IMPORT_LINE_PATTERN}. `
      + `The themes index file shape may have changed; the bootstrap needs an update.`,
    )
  }
  const lastImportMatch = importMatches[importMatches.length - 1]

  // The first `entryMatches` pass validates that the structural
  // anchor exists in the source content. The patched-content
  // pass below recomputes the matches after the import insertion
  // shifts the source; the original `lastEntry` reference is
  // therefore no longer used (the recomputed
  // `patchedEntryMatches` / `patchedLastEntry` below is the one
  // that drives the entry insertion). We keep the validation
  // pass for its clear error message but discard its output.
  {
    const entryMatches = [
      ...themesIndexContent.matchAll(THEME_ENTRY_LINE_PATTERN),
    ]
    if (entryMatches.length === 0) {
      throw new Error(
        `Could not find any theme entry line matching ${THEME_ENTRY_LINE_PATTERN}. `
        + `The themes index file shape may have changed; the bootstrap needs an update.`,
      )
    }
  }

  // Insert the new import line AFTER the last theme import.
  const patched = insertAfter(
    themesIndexContent,
    lastImportMatch[0],
    '\n' + importLine,
  )

  // Recompute the entry matches in the PATCHED content (the
  // import-line insertion above shifted everything after it).
  // Insert the new entry right after the patched last entry's
  // trailing newline.
  const patchedEntryMatches = [
    ...patched.matchAll(THEME_ENTRY_LINE_PATTERN),
  ]
  if (patchedEntryMatches.length === 0) {
    throw new Error(
      `Could not find any theme entry line matching ${THEME_ENTRY_LINE_PATTERN} in the patched themes index. `
      + `The themes index file shape may have changed; the bootstrap needs an update.`,
    )
  }
  const patchedLastEntry = patchedEntryMatches[patchedEntryMatches.length - 1]
  const finalInsertPoint = patchedLastEntry.index + patchedLastEntry[0].length
  return (
    patched.slice(0, finalInsertPoint) +
    entryLine +
    patched.slice(finalInsertPoint)
  )
}

/* ------------------------------------------------------------------ *
 * Project state (read-only I/O)
 * ------------------------------------------------------------------ */

/**
 * Read the project's current state from the two registry files.
 * The Bootstrap never modifies the project's `default.agency.ts`,
 * `default.theme.ts`, or any pre-existing rebrand's agency / theme
 * files — those are owned by the template (and by whichever prior
 * rebrand already shipped). The state we care about is which
 * tenants + themes are already registered and which hostnames
 * are taken.
 *
 * Returns:
 *
 *   - `existingTenants: string[]` — tenant ids already registered
 *     in `app/config/agencies/registry.ts` (both `[DEFAULT_TENANT_ID]`
 *     and `'literal'` forms are collected).
 *   - `existingThemes: string[]` — theme ids already registered in
 *     `app/themes/index.ts`.
 *   - `existingHostnames: string[]` — hostnames already in use
 *     inside the registry's `Object.freeze({...})` block (both
 *     per-line and inline-bracket forms are collected).
 *   - `registryPath: string` — absolute path to the registry file;
 *     consumed by `buildPlan` and the summary.
 *   - `themesIndexPath: string` — absolute path to the themes
 *     index file; consumed by `buildPlan` and the summary.
 *   - `_registryContent: string` — the raw registry source, kept
 *     so `buildPlan` can patch it without a second `readFile`.
 *   - `_themesIndexContent: string` — the raw themes-index source,
 *     same role for the themes side.
 *
 * The underscore-prefixed fields are internal handoff to
 * `buildPlan`; they are not part of the conflict-detection
 * contract.
 */
export async function readProjectState(root) {
  const agenciesDir = join(root, 'app/config/agencies')
  const themesDir = join(root, 'app/themes')

  /** @type {string[]} */
  const existingTenants = []
  /** @type {string[]} */
  const existingThemes = []
  /** @type {string[]} */
  const existingHostnames = []

  // Registry
  const registryPath = join(agenciesDir, 'registry.ts')
  const registryContent = await readFile(registryPath, 'utf8').catch(() => {
    throw new Error(
      `Could not read ${registryPath}. Is the project root "${root}" a valid checkout of the template?`,
    )
  })

  // Extract tenant ids and hostnames via documented patterns.
  // Tenant ids appear as either `[DEFAULT_TENANT_ID]` or `'literal'`.
  // We collect both forms; the Bootstrap's own validation filters
  // against the canonical id later.
  const tenantIdMatches = registryContent.matchAll(/^\s*(?:\[(\w+)\]|'([\w-]+)'):/gm)
  for (const match of tenantIdMatches) {
    const id = match[1] ?? match[2]
    if (id && !existingTenants.includes(id)) existingTenants.push(id)
  }

  // Hostnames appear in two forms inside the registry's
  // `Object.freeze({...})` block:
  //
  //   1. Multi-line hosts array (the bootstrap's `--hostname` flag
  //      with 2+ entries):
  //        'bahia-del-mar': buildEntry(bahiaDelMarAgencyConfig, [
  //          'bahia-del-mar.test',
  //          'www.bahia-del-mar.test',
  //        ]),
  //
  //   2. Single-line inline hosts array (the bootstrap's
  //      `--hostname` flag with a single entry):
  //        'alpha-co': buildEntry(alphaCoAgencyConfig, ['alpha.example.com']),
  //
  // Both forms are matched. The inline form is the one that gets
  // generated by `generateRegistryPatch` when the operator passes
  // exactly one `--hostname`. Missing it would let a second
  // tenant reuse the same hostname silently.
  //
  // Form 1 (per-line): each match is a single quoted hostname on
  // its own line. The regex is line-anchored, so a hostname that
  // appears as part of a longer expression (e.g. inside an
  // `Object.freeze({...})` body) does not match.
  //
  // Form 2 (inline bracket): the regex requires the `[...]` to be
  // preceded by `buildEntry(` (with optional whitespace), which
  // rules out false positives from TypeScript doc comments like
  // `// ['example.com']` or unrelated array literals.
  const hostnameMatches = [
    ...registryContent.matchAll(/^\s*'([^']+)',?\s*$/gm),
    ...registryContent.matchAll(/buildEntry\(\s*\w+AgencyConfig\s*,\s*\[\s*((?:'[^']+'\s*,\s*)*'[^']+')\s*\]/g),
  ]
  for (const match of hostnameMatches) {
    // `match[1]` for form 1 is the bare hostname (no quotes — the
    // outer regex captures the content between the quotes). For
    // form 2 the capturing group includes the surrounding quotes,
    // so we always pass `match[1]` through the `stripQuote`-style
    // helper below for the single-entry case and split-strip for
    // the multi-entry case.
    const raw = match[1]
    if (!raw) continue
    let candidates
    if (raw.startsWith("'")) {
      // Form 2 capture — outer quotes included.
      candidates = raw.includes(',')
        ? raw.match(/'([^']+)'/g)?.map(s => s.slice(1, -1)) ?? []
        : [raw.slice(1, -1)]
    } else {
      // Form 1 capture — outer quotes already stripped.
      candidates = [raw]
    }
    for (const candidate of candidates) {
      if (!candidate.includes('.') && !candidate.startsWith('[')) continue
      if (!existingHostnames.includes(candidate)) {
        existingHostnames.push(candidate)
      }
    }
  }

  // Themes index
  const themesIndexPath = join(themesDir, 'index.ts')
  const themesIndexContent = await readFile(themesIndexPath, 'utf8').catch(() => {
    throw new Error(
      `Could not read ${themesIndexPath}. Is the project root "${root}" a valid checkout of the template?`,
    )
  })
  const themeIdMatches = themesIndexContent.matchAll(/^\s*\[(\w+)\]:/gm)
  for (const match of themeIdMatches) {
    if (match[1] && !existingThemes.includes(match[1])) {
      existingThemes.push(match[1])
    }
  }

  return {
    existingTenants,
    existingThemes,
    existingHostnames,
    registryPath,
    themesIndexPath,
    _registryContent: registryContent,
    _themesIndexContent: themesIndexContent,
  }
}

/**
 * Detect conflicts between the planned Bootstrap and the current
 * project state. Returns a `string[]` of human-readable conflict
 * descriptions. An empty array means the Bootstrap is safe to run.
 */
export async function detectConflicts(validated, root, projectState) {
  /** @type {string[]} */
  const conflicts = []

  if (projectState.existingTenants.includes(validated.id)) {
    conflicts.push(
      `Tenant id "${validated.id}" is already registered in \`app/config/agencies/registry.ts\`. `
      + `The Bootstrap refuses to overwrite an existing entry. Delete the existing entry or choose a different --id.`,
    )
  }

  const agencyFilePath = join(root, `app/config/agencies/${validated.id}.agency.ts`)
  try {
    await access(agencyFilePath, constants.F_OK)
    conflicts.push(
      `Target file already exists: \`${agencyFilePath}\`. `
      + `The Bootstrap refuses to overwrite. Delete the file or choose a different --id.`,
    )
  } catch {
    // file does not exist; safe to create
  }

  const themeFilePath = join(root, `app/themes/${validated.id}.theme.ts`)
  try {
    await access(themeFilePath, constants.F_OK)
    conflicts.push(
      `Target file already exists: \`${themeFilePath}\`. `
      + `The Bootstrap refuses to overwrite. Delete the file or choose a different --id.`,
    )
  } catch {
    // file does not exist; safe to create
  }

  if (projectState.existingThemes.includes(validated.id)) {
    conflicts.push(
      `Theme id "${validated.id}" is already registered in \`app/themes/index.ts\`. `
      + `The Bootstrap refuses to register a duplicate theme id. Delete the existing theme entry or choose a different --id.`,
    )
  }

  for (const host of validated.hostnames) {
    if (projectState.existingHostnames.includes(host)) {
      conflicts.push(
        `Hostname "${host}" is already in use by another tenant in \`app/config/agencies/registry.ts\`. `
        + `The Bootstrap refuses to register a duplicate hostname.`,
      )
    }
  }

  return conflicts
}

/* ------------------------------------------------------------------ *
 * Plan + apply
 * ------------------------------------------------------------------ */

/**
 * Build the full plan for a Bootstrap run. Pure given the validated
 * input and the read project state.
 */
export function buildPlan(validated, projectState, root) {
  return {
    validated,
    projectState,
    root,
    agencyFilePath: join(root, `app/config/agencies/${validated.id}.agency.ts`),
    themeFilePath: join(root, `app/themes/${validated.id}.theme.ts`),
    registryPath: join(root, 'app/config/agencies/registry.ts'),
    themesIndexPath: join(root, 'app/themes/index.ts'),
    agencyContent: generateAgencyFileContent(validated),
    themeContent: generateThemeFileContent(validated),
    patchedRegistry: applyRegistryPatch(
      projectState._registryContent,
      validated.id,
      validated.hostnames,
    ),
    patchedThemesIndex: applyThemesIndexPatch(
      projectState._themesIndexContent,
      validated.id,
    ),
  }
}

/**
  * Apply the plan with best-effort write ordering: the two new
 * files are created first, then the two existing files are modified.
 *
 * **Rollback safety.** For every file that already exists, this
 * function captures the pre-write content before the write. If
 * any later write fails, every successful write is rolled back —
 * existing files are restored to their original content, and new
 * files (created in steps 1 / 2) are deleted. The caller sees the
 * original failure; the mutation surface is empty on rollback.
 *
 * The function is **not** atomic in the strictest sense
 * (`writeFile` is not atomic on any platform). The "atomic" label
 * in the user-facing summary refers to the best-effort ordering
 * and the rollback guarantee, not to a single-transaction
 * commit.
 *
 * **Testability.** `fsOps` is a small dependency-injection seam
 * that defaults to the real `node:fs/promises` bindings
 * (`createDefaultFsOps`). Tests inject a mock that throws on a
 * specific write to exercise the rollback path without
 * monkey-patching immutable ESM imports.
 */
export async function applyPlan(plan, fsOps = createDefaultFsOps()) {
  /** @type {Array<{ filePath: string, backup: string | null }>} */
  const writes = []

  /**
   * Capture pre-write content (or `null` for a new file), then write.
   * On failure the caller rolls back every entry in `writes`.
   */
  const tryWrite = async (filePath, contents) => {
    await fsOps.mkdir(dirname(filePath), { recursive: true })
    /** @type {string | null} */
    let backup
    try {
      backup = await fsOps.readFile(filePath, 'utf8')
    } catch {
      backup = null // new file
    }
    await fsOps.writeFile(filePath, contents, 'utf8')
    writes.push({ filePath, backup })
  }

  try {
    // 1. Create the agency file (no dependencies).
    await tryWrite(plan.agencyFilePath, plan.agencyContent)

    // 2. Create the theme file (no dependencies).
    await tryWrite(plan.themeFilePath, plan.themeContent)

    // 3. Patch the registry (depends on the agency file being valid
    //    TypeScript — the editor / build agent validates it next).
    await tryWrite(plan.registryPath, plan.patchedRegistry)

    // 4. Patch the themes index.
    await tryWrite(plan.themesIndexPath, plan.patchedThemesIndex)
  } catch (error) {
    await rollback(writes, fsOps)
    throw error
  }

  return writes.map(w => w.filePath)
}

/**
 * Build the default `fsOps` binding the production `applyPlan`
 * uses. The same four `node:fs/promises` operations the script
 * already imports are wrapped in a thin object so tests can
 * substitute a mock without monkey-patching the immutable ESM
 * imports.
 */
export function createDefaultFsOps() {
  return { mkdir, readFile, writeFile, unlink }
}

/**
 * Restore every captured write to its pre-write state. New files
 * are deleted; modified files are restored from the backup.
 * Errors during rollback are swallowed (the original error is the
 * one the caller cares about); they are returned for diagnostics.
 */
async function rollback(writes, fsOps = createDefaultFsOps()) {
  /** @type {Array<{ filePath: string, error: unknown }>} */
  const errors = []
  for (const { filePath, backup } of writes) {
    try {
      if (backup === null) {
        // New file — remove the partial write.
        await fsOps.unlink(filePath)
      } else {
        // Existing file — restore the original content.
        await fsOps.writeFile(filePath, backup, 'utf8')
      }
    } catch (error) {
      errors.push({ filePath, error })
    }
  }
  return errors
}

/* ------------------------------------------------------------------ *
 * CLI
 * ------------------------------------------------------------------ */

const HELP_TEXT = `\
Usage:
  pnpm bootstrap:client --id=<tenant> --name="<agency display name>" --hostname=<host>
    [--hostname=<additional-host> ...]
    [--theme-name="<theme display name>"]
    [--currency=<ISO-4217-code>]
    [--default-locale=<locale-code>]
    [--available-locales=<csv-list>]
    [--measurement-unit=<metric|imperial>]
    [--lead-adapter=<disabled|log|webhook|email>]
    [--dry-run]
    [-h|--help]

Options:
  --id <tenant>           Required. Tenant id (lowercase letters, digits, dashes).
                          Used as the registry key, the agency + theme filename stem,
                          and the theme id.
  --name "<name>"         Required. Agency display name. Used as the visible agency
                          name on every page and in the JSON-LD.
  --hostname <host>       Required (one or more). Production hostname(s).
                          Normalized (lowercased, port stripped) for conflict
                          detection.
  --theme-name "<name>"   Optional. Human-readable theme name. Defaults to "<name> Theme".
  --currency <code>       Optional. ISO 4217 currency code. Defaults to USD.
  --default-locale <code> Optional. Defaults to the first entry of --available-locales.
  --available-locales <list>
                          Optional. Comma-separated. Defaults to "en,es".
  --measurement-unit <u>  Optional. "metric" or "imperial". Defaults to metric.
  --lead-adapter <name>   Optional. disabled / log / webhook / email. Defaults to
                          disabled. Drives agency.leads.enabled only; the
                          actual delivery adapter is selected at the server
                          via the NUXT_LEADS_ADAPTER env var.
  --dry-run               Print the plan and exit without writing.
  -h, --help              Print this help.

Examples:
  # Plan only (no writes).
  pnpm bootstrap:client --id=acme --name="Acme Real Estate" \\
    --hostname=acme.example.com --dry-run

  # Generate the agency + theme + registry updates.
  pnpm bootstrap:client --id=acme --name="Acme Real Estate" \\
    --hostname=acme.example.com --hostname=www.acme.example.com \\
    --currency=USD --default-locale=en --available-locales=en,es \\
    --measurement-unit=imperial --lead-adapter=webhook

After generation, the operator runs the standard validation pipeline:
  pnpm install --frozen-lockfile && pnpm lint && pnpm test && pnpm build && pnpm test:e2e
`

/**
 * Parse the process argv into a `BootstrapInput`-shape object
 * (CLI-parsed; not yet validated).
 */
export function parseCliArgs(argv) {
  let parsed
  try {
    parsed = parseArgs({
      args: argv,
      options: {
        id: { type: 'string' },
        name: { type: 'string' },
        hostname: { type: 'string', multiple: true },
        'theme-name': { type: 'string' },
        currency: { type: 'string' },
        'default-locale': { type: 'string' },
        'available-locales': { type: 'string' },
        'measurement-unit': { type: 'string' },
        'lead-adapter': { type: 'string' },
        'dry-run': { type: 'boolean' },
        help: { type: 'boolean', short: 'h' },
        // Hidden flag used by the bootstrap's test suite to point the
        // script at a scratch directory. Not in --help output.
        root: { type: 'string' },
      },
      strict: true,
      allowPositionals: false,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new BootstrapCliError(
      `Invalid CLI arguments: ${message}\n\n${HELP_TEXT}`,
      2,
    )
  }

  const values = parsed.values

  if (values.help) {
    return { kind: 'help' }
  }

  return {
    kind: 'run',
    input: {
      id: values.id,
      name: values.name,
      hostnames: values.hostname ?? [],
      themeName: values['theme-name'],
      currency: values.currency,
      // Lowercase locale codes so `--default-locale=EN` is normalized
      // to `en` (the same lowercase convention `parseCsvList` already
      // applies to `--available-locales`). Bail out of the CLI default
      // (the validator picks the first `availableLocales` entry) only
      // when the operator omitted the flag entirely (`undefined`).
      defaultLocale:
        values['default-locale'] !== undefined
          ? values['default-locale'].toLowerCase()
          : undefined,
      availableLocales:
        values['available-locales'] !== undefined
          ? parseCsvList(values['available-locales'])
          : undefined,
      measurementUnit: values['measurement-unit'],
      leadAdapter: values['lead-adapter'],
    },
    dryRun: Boolean(values['dry-run']),
    root: values.root,
  }
}

/**
 * CLI error wrapper. Carries a process exit code.
 */
export class BootstrapCliError extends Error {
  constructor(message, exitCode = 1) {
    super(message)
    this.name = 'BootstrapCliError'
    this.exitCode = exitCode
  }
}

/**
 * Resolve the project root the Bootstrap operates on. The default
 * is the parent directory of the `scripts/` folder; the hidden
 * `--root <dir>` flag overrides it (used by tests).
 */
export function resolveProjectRoot(scriptPath, overrideRoot) {
  if (overrideRoot) {
    return resolve(overrideRoot)
  }
  // scripts/bootstrap-client.mjs → repo root
  return resolve(dirname(scriptPath), '..')
}

/**
 * Run the bootstrap end-to-end. Returns
 * `{ kind: 'success'|'dry-run', plan, written }` or
 * `{ kind: 'error', phase, message }`.
 *
 * The function does not call `process.exit`; the CLI entry point
 * translates the result into the appropriate exit code.
 */
export async function runBootstrap(argv, scriptPath) {
  const parsed = parseCliArgs(argv)
  if (parsed.kind === 'help') {
    return { kind: 'help', helpText: HELP_TEXT }
  }

  const inputValidation = validateInputs(parsed.input)
  if (!inputValidation.ok) {
    return {
      kind: 'error',
      phase: 'input-validation',
      message:
        'Input validation failed:\n'
        + inputValidation.errors.map(e => `  - ${e}`).join('\n')
        + `\n\n${HELP_TEXT}`,
    }
  }

  const root = resolveProjectRoot(scriptPath, parsed.root)
  const projectState = await readProjectState(root)
  const conflicts = await detectConflicts(inputValidation.value, root, projectState)
  if (conflicts.length > 0) {
    return {
      kind: 'error',
      phase: 'conflict-detection',
      message:
        'Conflicts detected — the bootstrap did not modify any file:\n'
        + conflicts.map(c => `  - ${c}`).join('\n'),
    }
  }

  const plan = buildPlan(inputValidation.value, projectState, root)

  if (parsed.dryRun) {
    return { kind: 'dry-run', plan }
  }

  const written = await applyPlan(plan)
  return { kind: 'success', plan, written }
}

/* ------------------------------------------------------------------ *
 * CLI entry point
 * ------------------------------------------------------------------ */

/**
 * Print a one-section summary of a Bootstrap result.
 *
 * The summary is structured for operator review: a small table of
 * planned or written files, followed by a one-line reminder of the
 * remaining manual steps.
 */
export function formatSummary(result) {
  if (result.kind === 'help') {
    return result.helpText
  }
  if (result.kind === 'error') {
    return result.message
  }
  const { plan } = result
  const action = result.kind === 'dry-run' ? 'Would write' : 'Wrote'
  const mode = result.kind === 'dry-run' ? 'DRY RUN' : 'GENERATED'
  const lines = [
    `[bootstrap] ${mode}`,
    '',
    `${action}:`,
    `  + ${relPath(plan.agencyFilePath, plan.root)}  (${bytes(plan.agencyContent)} bytes, new file)`,
    `  + ${relPath(plan.themeFilePath, plan.root)}  (${bytes(plan.themeContent)} bytes, new file)`,
    `  ~ ${relPath(plan.registryPath, plan.root)}  (patched: added "${plan.validated.id}" entry + import)`,
    `  ~ ${relPath(plan.themesIndexPath, plan.root)}  (patched: added "${plan.validated.id}" theme entry + import)`,
    '',
    `Tenant id:          ${plan.validated.id}`,
    `Agency name:        ${plan.validated.id}AgencyConfig`,
    `Theme id / name:    ${plan.validated.id} / ${plan.validated.themeName}`,
    `Production hosts:   ${plan.validated.hostnames.join(', ')}`,
    `Default locale:     ${plan.validated.defaultLocale}`,
    `Available locales:  ${plan.validated.availableLocales.join(', ')}`,
    `Currency:           ${plan.validated.currency}`,
    `Measurement unit:   ${plan.validated.measurementUnit}`,
    `Lead adapter flag:  ${plan.validated.leadAdapter} (agency.leads.enabled = ${plan.validated.leadAdapter !== 'disabled'})`,
    '',
    'Remaining manual steps (operator):',
    '  1. Replace every [TODO] in app/config/agencies/' + plan.validated.id + '.agency.ts with the agency\'s real identity, contact, and social information.',
    '  2. Update the brand colors (primary / secondary / accent) in app/themes/' + plan.validated.id + '.theme.ts.',
    '  3. Replace the 22 placeholder assets under public/images/ (logo, favicon, hero, about, 4 locations, 6 properties, 4 agents, 4 developments). See docs/REBRANDING.md §4.',
    '  4. Replace the bundled sample data in app/features/{properties,agents,developments,home,testimonials,locations,stats}/data/*.ts with the agency\'s catalog.',
    '  5. If a CMS is in use (Sanity / Contentful / Strapi), set NUXT_<FEATURE>_DATA_SOURCE=cms + the provider-specific env vars per docs/SANITY_OPERATIONS.md (Sanity) or docs/CLIENT_ONBOARDING.md §2.1 (provider-agnostic).',
    '  6. If --lead-adapter is not "disabled", set the matching NUXT_LEADS_* env vars at deploy time (NUXT_LEADS_ADAPTER, NUXT_LEADS_WEBHOOK_URL/SECRET or NUXT_LEADS_SMTP_*/_EMAIL_*). See docs/CLIENT_ONBOARDING.md §2.1.',
    '  7. Run the validation pipeline: pnpm install --frozen-lockfile && pnpm lint && pnpm test && pnpm build && pnpm test:e2e.',
    '  8. Set NUXT_PUBLIC_SITE_URL to the agency\'s canonical hostname before deploy.',
  ]
  return lines.join('\n')
}

function relPath(absolutePath, root) {
  return absolutePath.startsWith(root + sep)
    ? absolutePath.slice(root.length + 1).replace(/\\/g, '/')
    : absolutePath
}

function bytes(text) {
  return Buffer.byteLength(text, 'utf8').toString()
}

async function main() {
  const scriptPath = fileURLToPath(import.meta.url)
  const argv = process.argv.slice(2)

  let result
  try {
    result = await runBootstrap(argv, scriptPath)
  } catch (error) {
    if (error instanceof BootstrapCliError) {
      console.error(error.message)
      process.exit(error.exitCode)
    }
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[bootstrap] unexpected error: ${message}`)
    process.exit(1)
  }

  if (result.kind === 'help') {
    console.log(formatSummary(result))
    process.exit(0)
  }

  console.log(formatSummary(result))

  if (result.kind === 'error') {
    process.exit(1)
  }
  process.exit(0)
}

// Run only when invoked directly (not when imported by tests).
const invokedDirectly = process.argv[1]
  ? fileURLToPath(import.meta.url) === resolve(process.argv[1])
  : false

if (invokedDirectly) {
  main()
}
