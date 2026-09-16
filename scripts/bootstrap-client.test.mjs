/**
 * Tests for `scripts/bootstrap-client.mjs`.
 *
 * The tests are split into three layers:
 *
 *  - **Pure unit tests** — exercise the validators and content
 *    generators. No I/O. Fast and deterministic.
 *
 *  - **Conflict-detection tests** — run the script against a
 *    scratch project root and assert that the conflict-detection
 *    pass surfaces existing tenants, hostnames, theme ids, and
 *    existing target files.
 *
 *  - **End-to-end tests** — run the script against a scratch
 *    project root and assert the planned files are written with the
 *    expected content. The test uses the hidden `--root` flag
 *    documented in the script so the real project tree is not
 *    touched.
 *
 * **No I/O on the real project tree.** Every test sets up its own
 * minimal project structure in a tmp directory and points the
 * script at it via `--root`. The test cleans up the tmp directory
 * in `afterEach`.
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from 'vitest'
import {
  mkdtemp,
  rm,
  writeFile,
  readFile,
  readdir,
  mkdir,
  access,
  constants,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import {
  kebabToCamel,
  getAgencyExportName,
  getThemeExportName,
  normalizeHostname,
  parseCsvList,
  validateInputs,
  generateAgencyFileContent,
  generateThemeFileContent,
  generateRegistryPatch,
  applyRegistryPatch,
  generateThemesIndexPatch,
  applyThemesIndexPatch,
  buildPlan,
  parseCliArgs,
  resolveProjectRoot,
  formatSummary,
} from './bootstrap-client.mjs'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const BOOTSTRAP = join(__dirname, 'bootstrap-client.mjs')

/* ------------------------------------------------------------------ *
 * Test fixtures
 * ------------------------------------------------------------------ */

/**
 * Minimal baseline registry.ts that mirrors the real shape after
 * the Task 123 first-client rebrand (`bahia-del-mar` was the
 * example rebrand used to measure the friction surface; the
 * bootstrap is decoupled from any specific tenant id). This is
 * the smallest file that the bootstrap can patch without its
 * anchor search throwing, and it doubles as a realistic
 * integration fixture: the `bahia-del-mar` entry stands in for
 * "any previously-generated rebrand".
 */
const BASELINE_REGISTRY = `import type { SiteConfig } from '~/types/site.types'
import { defaultAgencyConfig } from './default.agency'
import { bahiaDelMarAgencyConfig } from './bahia-del-mar.agency'
import { validateAgencyConfig } from './agency.schema'
import { defaultI18nLocales } from '../i18n'
import { resolveTheme, themes } from '../../themes'
import type { AgencyConfig } from '~/types/agency.types'

export const DEFAULT_TENANT_ID = 'default'

function buildEntry(raw: AgencyConfig, hosts: readonly string[]) {
  const { agency } = validateAgencyConfig(raw, {
    themes,
    i18nLocales: defaultI18nLocales,
  })
  return { id: agency.id, config: agency, hosts }
}

export const agencyRegistry = Object.freeze({
  [DEFAULT_TENANT_ID]: buildEntry(defaultAgencyConfig, []),
  'bahia-del-mar': buildEntry(bahiaDelMarAgencyConfig, [
    'bahia-del-mar.test',
    'www.bahia-del-mar.test',
  ]),
})
`

const BASELINE_THEMES = `import type { ThemeConfig } from '~/types/theme.types'
import { defaultTheme } from './default.theme'
import { bahiaTheme } from './bahia.theme'

export const themes: Record<string, ThemeConfig> = {
  [defaultTheme.id]: defaultTheme,
  [bahiaTheme.id]: bahiaTheme,
}

export function resolveTheme(id: string): ThemeConfig {
  return themes[id] ?? defaultTheme
}
`

/**
 * Minimal registry.ts / themes-index.ts that contain ONLY the
 * template's `default` tenant + theme. This is the
 * `no-bahia-del-mar` baseline the structural-anchor coverage
 * tests against (and what a fresh template checkout would look
 * like before any rebrand has run). The Bootstrap's structural
 * anchors are designed to work against this fixture identically
 * to the BASELINE_REGISTRY fixture above.
 */
const DEFAULT_ONLY_REGISTRY = `import type { SiteConfig } from '~/types/site.types'
import { defaultAgencyConfig } from './default.agency'
import { validateAgencyConfig } from './agency.schema'
import { defaultI18nLocales } from '../i18n'
import { resolveTheme, themes } from '../../themes'
import type { AgencyConfig } from '~/types/agency.types'

export const DEFAULT_TENANT_ID = 'default'

function buildEntry(raw: AgencyConfig, hosts: readonly string[]) {
  const { agency } = validateAgencyConfig(raw, {
    themes,
    i18nLocales: defaultI18nLocales,
  })
  return { id: agency.id, config: agency, hosts }
}

export const agencyRegistry = Object.freeze({
  [DEFAULT_TENANT_ID]: buildEntry(defaultAgencyConfig, []),
})
`

const DEFAULT_ONLY_THEMES = `import type { ThemeConfig } from '~/types/theme.types'
import { defaultTheme } from './default.theme'

export const themes: Record<string, ThemeConfig> = {
  [defaultTheme.id]: defaultTheme,
}

export function resolveTheme(id: string): ThemeConfig {
  return themes[id] ?? defaultTheme
}
`

/** Build a minimal scratch project root with the baseline registries. */
async function setupProjectRoot() {
  const root = await mkdtemp(join(tmpdir(), 'bootstrap-test-'))
  const agenciesDir = join(root, 'app/config/agencies')
  const themesDir = join(root, 'app/themes')
  await mkdir(agenciesDir, { recursive: true })
  await mkdir(themesDir, { recursive: true })
  await writeFile(join(agenciesDir, 'registry.ts'), BASELINE_REGISTRY, 'utf8')
  await writeFile(join(themesDir, 'index.ts'), BASELINE_THEMES, 'utf8')
  return root
}

/**
 * Build a scratch project root whose registries contain ONLY the
 * template's `default` tenant + theme (no `bahia-del-mar`). This
 * is the structural-anchor-coverage fixture: it proves the
 * bootstrap is decoupled from any specific previously-generated
 * tenant id.
 */
async function setupDefaultOnlyProjectRoot() {
  const root = await mkdtemp(join(tmpdir(), 'bootstrap-default-only-'))
  const agenciesDir = join(root, 'app/config/agencies')
  const themesDir = join(root, 'app/themes')
  await mkdir(agenciesDir, { recursive: true })
  await mkdir(themesDir, { recursive: true })
  await writeFile(join(agenciesDir, 'registry.ts'), DEFAULT_ONLY_REGISTRY, 'utf8')
  await writeFile(join(themesDir, 'index.ts'), DEFAULT_ONLY_THEMES, 'utf8')
  return root
}

/** Run the bootstrap CLI against the given project root. */
function runCli(root, args) {
  return spawnSync(process.execPath, [BOOTSTRAP, '--root', root, ...args], {
    encoding: 'utf8',
  })
}

/** A minimal valid bootstrap input. Tests mutate copies of this. */
function validInput(overrides = {}) {
  return {
    id: 'acme-realty',
    name: 'Acme Real Estate',
    hostnames: ['acme.example.com'],
    themeName: 'Acme Real Estate Theme',
    currency: 'USD',
    defaultLocale: 'en',
    availableLocales: ['en', 'es'],
    measurementUnit: 'metric',
    leadAdapter: 'disabled',
    ...overrides,
  }
}

/* ------------------------------------------------------------------ *
 * Pure unit tests — kebabToCamel / export-name helpers
 * ------------------------------------------------------------------ */

describe('kebabToCamel', () => {
  it('converts simple kebab-case identifiers', () => {
    expect(kebabToCamel('acme')).toBe('acme')
    expect(kebabToCamel('acme-realty')).toBe('acmeRealty')
    expect(kebabToCamel('my-cool-agency')).toBe('myCoolAgency')
    expect(kebabToCamel('a-b-c-d')).toBe('aBCD')
  })

  it('returns empty string for empty input', () => {
    expect(kebabToCamel('')).toBe('')
    expect(kebabToCamel(null)).toBe('')
    expect(kebabToCamel(undefined)).toBe('')
    expect(kebabToCamel(42)).toBe('')
  })
})

describe('export-name helpers', () => {
  it('produces the agency / theme export names', () => {
    expect(getAgencyExportName('acme')).toBe('acmeAgencyConfig')
    expect(getAgencyExportName('acme-realty')).toBe('acmeRealtyAgencyConfig')
    expect(getThemeExportName('acme')).toBe('acmeTheme')
    expect(getThemeExportName('my-cool-agency')).toBe('myCoolAgencyTheme')
  })
})

describe('normalizeHostname', () => {
  it('handles the canonical cases', () => {
    expect(normalizeHostname('acme.example.com')).toBe('acme.example.com')
    expect(normalizeHostname('Acme.Example.Com')).toBe('acme.example.com')
    expect(normalizeHostname('  acme.example.com  ')).toBe('acme.example.com')
    expect(normalizeHostname('acme.example.com:443')).toBe('acme.example.com')
    expect(normalizeHostname('')).toBe('')
    expect(normalizeHostname(null)).toBe('')
    expect(normalizeHostname(undefined)).toBe('')
  })
})

describe('parseCsvList', () => {
  it('parses, trims, and deduplicates', () => {
    expect(parseCsvList('en,es,EN')).toEqual(['en', 'es'])
    expect(parseCsvList('en, es , en')).toEqual(['en', 'es'])
    expect(parseCsvList('')).toEqual([])
    expect(parseCsvList(null)).toEqual([])
    expect(parseCsvList('en')).toEqual(['en'])
  })
})

/* ------------------------------------------------------------------ *
 * Pure unit tests — validateInputs
 * ------------------------------------------------------------------ */

describe('validateInputs', () => {
  it('accepts the canonical valid input', () => {
    const result = validateInputs(validInput())
    expect(result.ok).toBe(true)
    expect(result.value.id).toBe('acme-realty')
    expect(result.value.hostnames).toEqual(['acme.example.com'])
  })

  it('rejects an empty id', () => {
    const result = validateInputs(validInput({ id: '' }))
    expect(result.ok).toBe(false)
    expect(result.errors.some(e => e.includes('--id is required'))).toBe(true)
  })

  it('rejects an id with uppercase letters', () => {
    const result = validateInputs(validInput({ id: 'Acme' }))
    expect(result.ok).toBe(false)
    expect(result.errors.some(e => e.includes('not a valid tenant id'))).toBe(true)
  })

  it('rejects an id with special characters', () => {
    const result = validateInputs(validInput({ id: 'acme_realty' }))
    expect(result.ok).toBe(false)
  })

  it('rejects an id that is too short', () => {
    const result = validateInputs(validInput({ id: 'a' }))
    expect(result.ok).toBe(false)
  })

  it('rejects the reserved `default` id', () => {
    const result = validateInputs(validInput({ id: 'default' }))
    expect(result.ok).toBe(false)
    expect(result.errors.some(e => e.includes('reserved'))).toBe(true)
  })

  it('rejects an id starting or ending with a dash', () => {
    expect(validateInputs(validInput({ id: '-acme' })).ok).toBe(false)
    expect(validateInputs(validInput({ id: 'acme-' })).ok).toBe(false)
  })

  it('rejects an empty / whitespace-only name', () => {
    const result = validateInputs(validInput({ name: '' }))
    expect(result.ok).toBe(false)
    expect(result.errors.some(e => e.includes('--name is required'))).toBe(true)

    const wsResult = validateInputs(validInput({ name: '   ' }))
    expect(wsResult.ok).toBe(false)
  })

  it('rejects a name longer than 120 characters', () => {
    const result = validateInputs(validInput({ name: 'A'.repeat(121) }))
    expect(result.ok).toBe(false)
    expect(result.errors.some(e => e.includes('120 characters'))).toBe(true)
  })

  it('rejects an empty hostname list', () => {
    const result = validateInputs(validInput({ hostnames: [] }))
    expect(result.ok).toBe(false)
  })

  it('rejects a malformed currency', () => {
    const result = validateInputs(validInput({ currency: 'us' }))
    expect(result.ok).toBe(false)
    expect(result.errors.some(e => e.includes('ISO 4217'))).toBe(true)
  })

  it('rejects an unknown locale', () => {
    const result = validateInputs(
      validInput({ availableLocales: ['en', 'fr'], defaultLocale: 'en' }),
    )
    expect(result.ok).toBe(false)
    expect(result.errors.some(e => e.includes('not a registered i18n locale'))).toBe(true)
  })

  it('rejects a defaultLocale not in availableLocales', () => {
    const result = validateInputs(
      validInput({ availableLocales: ['en'], defaultLocale: 'es' }),
    )
    expect(result.ok).toBe(false)
    expect(result.errors.some(e => e.includes('must be included'))).toBe(true)
  })

  it('rejects an unknown measurement unit', () => {
    const result = validateInputs(validInput({ measurementUnit: 'imperials' }))
    expect(result.ok).toBe(false)
  })

  it('rejects an unknown lead adapter', () => {
    const result = validateInputs(validInput({ leadAdapter: 'sms' }))
    expect(result.ok).toBe(false)
  })

  it('normalizes hostnames (lowercases, trims, deduplicates)', () => {
    const result = validateInputs(
      validInput({ hostnames: ['Acme.Example.Com', 'acme.example.com'] }),
    )
    expect(result.ok).toBe(true)
    expect(result.value.hostnames).toEqual(['acme.example.com'])
  })

  it('strips the port from hostnames', () => {
    const result = validateInputs(
      validInput({ hostnames: ['localhost:3000'] }),
    )
    expect(result.ok).toBe(true)
    expect(result.value.hostnames).toEqual(['localhost'])
  })

  it('collects multiple errors at once', () => {
    const result = validateInputs(
      validInput({ id: 'A!', name: '', hostnames: [], currency: 'x' }),
    )
    expect(result.ok).toBe(false)
    expect(result.errors.length).toBeGreaterThanOrEqual(4)
  })
})

/* ------------------------------------------------------------------ *
 * Pure unit tests — content generators
 * ------------------------------------------------------------------ */

describe('generateAgencyFileContent', () => {
  it('emits a syntactically reasonable agency file', () => {
    const input = validInput()
    const content = generateAgencyFileContent(input, new Date('2026-01-15T12:00:00Z'))
    expect(content).toContain('import type { AgencyConfig }')
    expect(content).toContain('export const acmeRealtyAgencyConfig: AgencyConfig')
    expect(content).toContain(`id: ${JSON.stringify('acme-realty')}`)
    expect(content).toContain(`name: ${JSON.stringify('Acme Real Estate')}`)
    expect(content).toContain(`theme: ${JSON.stringify('acme-realty')}`)
    expect(content).toContain("[TODO]")
    expect(content).toContain('enabled: false') // leadAdapter: 'disabled'
  })

  it('marks leads.enabled = true for non-disabled adapter', () => {
    const input = validInput({ leadAdapter: 'webhook' })
    const content = generateAgencyFileContent(input)
    expect(content).toContain('enabled: true')
  })

  it('honors the theme-name override in the generated file', () => {
    const input = validInput({ themeName: 'Custom Theme' })
    const content = generateAgencyFileContent(input)
    // The theme file (not the agency file) shows the themeName; the
    // agency file references the theme id, not the theme name.
    expect(content).toContain(`theme: ${JSON.stringify('acme-realty')}`)
  })
})

describe('generateThemeFileContent', () => {
  it('emits a syntactically reasonable theme file', () => {
    const input = validInput()
    const content = generateThemeFileContent(input, new Date('2026-01-15T12:00:00Z'))
    expect(content).toContain('import type { ThemeConfig }')
    expect(content).toContain('export const acmeRealtyTheme: ThemeConfig')
    expect(content).toContain(`id: ${JSON.stringify('acme-realty')}`)
    expect(content).toContain(`name: ${JSON.stringify(input.themeName)}`)
    // Default-theme palette tokens present.
    expect(content).toContain('#FFFFFF')
    expect(content).toContain('#0B1220') // dark-mode background
  })
})

describe('registry + themes patch helpers', () => {
  it('produces registry import + entry snippets', () => {
    const { importLine, entryBlock } = generateRegistryPatch('acme-realty', ['acme.example.com'])
    expect(importLine).toBe("import { acmeRealtyAgencyConfig } from './acme-realty.agency'\n")
    expect(entryBlock).toContain("'acme-realty':")
    expect(entryBlock).toContain('acmeRealtyAgencyConfig')
    expect(entryBlock).toContain("'acme.example.com'")
  })

  it('patches a registry that only contains the default tenant (no bahia-del-mar)', () => {
    // Build a minimal registry that only contains the `default` tenant.
    const MINIMAL_REGISTRY = `import type { SiteConfig } from '~/types/site.types'
import { defaultAgencyConfig } from './default.agency'
import { validateAgencyConfig } from './agency.schema'
import { defaultI18nLocales } from '../i18n'
import { resolveTheme, themes } from '../../themes'
import type { AgencyConfig } from '~/types/agency.types'

export const DEFAULT_TENANT_ID = 'default'

function buildEntry(raw: AgencyConfig, hosts: readonly string[]) {
  return { id: agency.id, config: agency, hosts }
}

export const agencyRegistry = Object.freeze({
  [DEFAULT_TENANT_ID]: buildEntry(defaultAgencyConfig, []),
})
`
    const patched = applyRegistryPatch(MINIMAL_REGISTRY, 'acme-realty', ['acme.example.com'])
    expect(patched).toContain("import { acmeRealtyAgencyConfig } from './acme-realty.agency'")
    expect(patched).toContain("'acme-realty':")
    // The structural anchor works regardless of which tenants are
    // currently registered. The patch is placed correctly between
    // the existing default entry and the Object.freeze close.
    expect(patched).toMatch(/'acme-realty':[\s\S]*\}\)/)
  })

  it('patches a themes index that only contains the default theme (no bahia)', () => {
    const MINIMAL_THEMES = `import type { ThemeConfig } from '~/types/theme.types'
import { defaultTheme } from './default.theme'

export const themes: Record<string, ThemeConfig> = {
  [defaultTheme.id]: defaultTheme,
}

export function resolveTheme(id: string): ThemeConfig {
  return themes[id] ?? defaultTheme
}
`
    const patched = applyThemesIndexPatch(MINIMAL_THEMES, 'acme-realty')
    expect(patched).toContain("import { acmeRealtyTheme } from './acme-realty.theme'")
    expect(patched).toContain('[acmeRealtyTheme.id]: acmeRealtyTheme')
  })

  it('produces themes-index import + entry snippets', () => {
    const { importLine, entryLine } = generateThemesIndexPatch('acme-realty')
    expect(importLine).toBe("import { acmeRealtyTheme } from './acme-realty.theme'\n")
    expect(entryLine).toContain('[acmeRealtyTheme.id]: acmeRealtyTheme')
  })

  it('applies the registry patch to the baseline', () => {
    const patched = applyRegistryPatch(BASELINE_REGISTRY, 'acme-realty', ['acme.example.com'])
    expect(patched).toContain("import { acmeRealtyAgencyConfig } from './acme-realty.agency'")
    expect(patched).toContain("'acme-realty': buildEntry(acmeRealtyAgencyConfig, ['acme.example.com'])")
  })

  it('applies the themes-index patch to the baseline', () => {
    const patched = applyThemesIndexPatch(BASELINE_THEMES, 'acme-realty')
    expect(patched).toContain("import { acmeRealtyTheme } from './acme-realty.theme'")
    expect(patched).toContain('[acmeRealtyTheme.id]: acmeRealtyTheme')
  })

  it('keeps every registry entry on its own line after a patch (no off-by-one co-location)', () => {
    // Regression: a prior version of `applyRegistryPatch` inserted
    // 1 character too early, putting the new entry on the same
    // physical line as the previous entry. The structural anchor
    // would then fail on a subsequent patch (the new entry is no
    // longer at the start of a line, so the per-line regex misses
    // it). This test pins the structural invariant: every entry
    // sits on its own line.
    //
    // The regex matches both `[DEFAULT_TENANT_ID]: buildEntry(...)`
    // (bracket key, single line) and `'acme-realty': buildEntry(...)`
    // (literal key, single line) but NOT the inner lines of a
    // multi-line hosts array (`'bahia-del-mar.test',`) — those are
    // hostname literals, not entries.
    const patched = applyRegistryPatch(BASELINE_REGISTRY, 'acme-realty', ['acme.example.com'])
    const lines = patched.split('\n')
    const entryLines = lines.filter(line =>
      /^\s*(?:\[[\w]+\]|'[\w-]+')\s*:\s*buildEntry\(/.test(line),
    )
    // The baseline has 2 entries (default + bahia-del-mar); after
    // the patch we expect 3.
    expect(entryLines.length).toBe(3)
    // No entry line should contain a SECOND `buildEntry(` call —
    // that would mean two entries were co-located on one line.
    for (const line of entryLines) {
      expect((line.match(/buildEntry\(/g) ?? []).length).toBe(1)
    }
  })

  it('keeps every theme entry on its own line after a patch (no off-by-one co-location)', () => {
    // Regression counterpart to the registry test above: the prior
    // `applyThemesIndexPatch` had the same off-by-one bug, putting
    // the new theme entry on the same line as the previous one
    // and breaking the per-line entry regex on the next patch.
    const patched = applyThemesIndexPatch(BASELINE_THEMES, 'acme-realty')
    const lines = patched.split('\n')
    const entryLines = lines.filter(line =>
      /^\s*\[[\w-]+\.id\]:\s+[\w-]+,/.test(line),
    )
    // The baseline has 2 entries; after the patch we expect 3.
    expect(entryLines.length).toBe(3)
    // Each entry line contains exactly one `[id]: ` mapping.
    for (const line of entryLines) {
      expect((line.match(/\[\w+\.id\]:/g) ?? []).length).toBe(1)
    }
  })

  it('applies a second registry patch on top of the first without breaking the structural anchor', () => {
    // End-to-end of the multi-tenant path: register `acme-realty`,
    // then register `beta-co` on top of the patched output. The
    // second patch must continue to anchor correctly — the
    // off-by-one bug would break this because the inserted entry
    // would no longer match the per-line regex.
    const firstPatch = applyRegistryPatch(BASELINE_REGISTRY, 'acme-realty', ['acme.example.com'])
    const secondPatch = applyRegistryPatch(firstPatch, 'beta-co', ['beta.example.com'])

    // The patched output contains both entries.
    expect(secondPatch).toContain("'acme-realty': buildEntry(acmeRealtyAgencyConfig, ['acme.example.com'])")
    expect(secondPatch).toContain("'beta-co': buildEntry(betaCoAgencyConfig, ['beta.example.com'])")

    // Every entry is on its own line (default + bahia-del-mar +
    // acme-realty + beta-co = 4).
    const entryLines = secondPatch.split('\n').filter(line =>
      /^\s*(?:\[[\w]+\]|'[\w-]+')\s*:\s*buildEntry\(/.test(line),
    )
    expect(entryLines.length).toBe(4)
  })

  it('applies a second themes-index patch on top of the first without breaking the structural anchor', () => {
    // Counterpart to the multi-tenant registry test above.
    const firstPatch = applyThemesIndexPatch(BASELINE_THEMES, 'acme-realty')
    const secondPatch = applyThemesIndexPatch(firstPatch, 'beta-co')

    expect(secondPatch).toContain('[acmeRealtyTheme.id]: acmeRealtyTheme')
    expect(secondPatch).toContain('[betaCoTheme.id]: betaCoTheme')

    const entryLines = secondPatch.split('\n').filter(line =>
      /^\s*\[[\w-]+\.id\]:\s+[\w-]+,/.test(line),
    )
    // BASELINE_THEMES ships with default + bahia themes; after
    // two patches we have default + bahia + acme-realty + beta-co.
    expect(entryLines.length).toBe(4)
  })

  it('inline-bracket hostname extraction is anchored on `buildEntry(` (no doc-comment false positives)', async () => {
    // Regression: the prior Form 2 regex
    // `/\[\s*((?:'[^']+'\s*,\s*)*'[^']+')\s*\]/g` matched any
    // `[...]` array containing quoted strings anywhere in the
    // registry, including a doc comment like `// ['example.com']`.
    // The fix requires `buildEntry(` immediately before the
    // bracket; this test pins that invariant.
    const { readProjectState } = await import('./bootstrap-client.mjs')
    const { mkdtemp, mkdir, writeFile } = await import('node:fs/promises')
    const { join } = await import('node:path')
    const { tmpdir } = await import('node:os')

    const root = await mkdtemp(join(tmpdir(), 'host-extract-'))
    const agenciesDir = join(root, 'app/config/agencies')
    const themesDir = join(root, 'app/themes')
    await mkdir(agenciesDir, { recursive: true })
    await mkdir(themesDir, { recursive: true })

    // A registry whose body contains both a real `buildEntry(...)`
    // inline hostname AND a doc-comment array of example
    // hostnames. The extraction must pick up the real one and
    // skip the comment.
    const registry = `import type { AgencyConfig } from '~/types/agency.types'
import { defaultAgencyConfig } from './default.agency'

// Example of what a hosts array looks like:
//   ['example.com', 'www.example.com']

export const agencyRegistry = Object.freeze({
  [DEFAULT_TENANT_ID]: buildEntry(defaultAgencyConfig, []),
  'real-tenant': buildEntry(realTenantAgencyConfig, ['real.example.com']),
})
`
    await writeFile(join(agenciesDir, 'registry.ts'), registry, 'utf8')
    await writeFile(join(themesDir, 'index.ts'), 'export const themes = {}\n', 'utf8')

    const state = await readProjectState(root)
    expect(state.existingHostnames).toContain('real.example.com')
    expect(state.existingHostnames).not.toContain('example.com')
    expect(state.existingHostnames).not.toContain('www.example.com')
  })

  it('throws a clear error when the registry import anchor is missing', () => {
    // Remove EVERY AgencyConfig import line so the structural anchor
    // (which matches `import { xAgencyConfig } from './x.agency'`) has
    // no target. The structural anchor is independent of which
    // specific agency file is present; the test must clear all of them.
    const brokenRegistry = BASELINE_REGISTRY
      .replace(/import \{ \w+AgencyConfig \} from '\.\/[\w-]+\.agency'\n?/g, '// missing\n')
    // The test regex must match the structural anchor pattern (which
    // requires the `from './x.agency'` suffix), NOT a looser pattern
    // that would also match `validateAgencyConfig` or `AgencyConfig`
    // type imports — those are not what the anchor searches for.
    expect(brokenRegistry).not.toMatch(
      /^import \{ \w+AgencyConfig \} from '\.\/[\w-]+\.agency'$/m,
    )
    expect(() => applyRegistryPatch(brokenRegistry, 'acme-realty', ['acme.example.com']))
      .toThrow(/registry file shape may have changed/)
  })

  it('throws a clear error when the registry closing is missing', () => {
    // Remove the closing `})` so the closing anchor has no target.
    const brokenRegistry = BASELINE_REGISTRY.replace(/\n\}\)\s*$/, '')
    expect(() => applyRegistryPatch(brokenRegistry, 'acme-realty', ['acme.example.com']))
      .toThrow(/registry file shape may have changed/)
  })

  it('throws a clear error when the themes index import anchor is missing', () => {
    // Remove EVERY Theme import line so the structural anchor
    // (which matches `import { xTheme } from './x.theme'`) has no
    // target. The structural anchor is independent of which specific
    // theme file is present; the test must clear all of them.
    const brokenThemes = BASELINE_THEMES
      .replace(/import \{ \w+Theme \} from '\.\/[\w-]+\.theme'\n?/g, '// missing\n')
    expect(brokenThemes).not.toMatch(/^import \{ \w+Theme \}/m)
    expect(() => applyThemesIndexPatch(brokenThemes, 'acme-realty'))
      .toThrow(/themes index file shape may have changed/)
  })

  it('throws a clear error when the themes entry anchor is missing', () => {
    // Remove EVERY theme entry line so the structural anchor (which
    // matches `  [<themeId>.id]: <themeId>,\n`) has no target. The
    // structural anchor is independent of which specific theme file
    // is present; the test must clear all of them.
    const brokenThemes = BASELINE_THEMES
      .replace(/^ {2}\[\w+\.id\]: {1}\w+,\n/gm, '')
    expect(brokenThemes).not.toMatch(/^ {2}\[\w+\.id\]:/m)
    expect(() => applyThemesIndexPatch(brokenThemes, 'acme-realty'))
      .toThrow(/themes index file shape may have changed/)
  })
})

/* ------------------------------------------------------------------ *
 * Conflict-detection + end-to-end CLI tests
 * ------------------------------------------------------------------ */

describe('CLI: end-to-end behaviour', () => {
  let root
  beforeEach(async () => {
    root = await setupProjectRoot()
  })
  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('writes the planned files when the input is valid', async () => {
    const result = runCli(root, [
      '--id', 'acme-realty',
      '--name', 'Acme Real Estate',
      '--hostname', 'acme.example.com',
      '--hostname', 'www.acme.example.com',
      '--currency', 'USD',
      '--default-locale', 'en',
      '--available-locales', 'en,es',
      '--measurement-unit', 'metric',
      '--lead-adapter', 'webhook',
    ])
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('[bootstrap] GENERATED')
    expect(result.stdout).toContain('Wrote:')

    // Verify the four files exist and have the expected shape.
    const agencyContent = await readFile(
      join(root, 'app/config/agencies/acme-realty.agency.ts'),
      'utf8',
    )
    expect(agencyContent).toContain('export const acmeRealtyAgencyConfig')
    expect(agencyContent).toContain('id: "acme-realty"')
    expect(agencyContent).toContain('name: "Acme Real Estate"')
    expect(agencyContent).toContain('enabled: true') // webhook adapter

    const themeContent = await readFile(
      join(root, 'app/themes/acme-realty.theme.ts'),
      'utf8',
    )
    expect(themeContent).toContain('export const acmeRealtyTheme')

    const registry = await readFile(
      join(root, 'app/config/agencies/registry.ts'),
      'utf8',
    )
    expect(registry).toContain("import { acmeRealtyAgencyConfig } from './acme-realty.agency'")
    expect(registry).toContain("'acme-realty': buildEntry(acmeRealtyAgencyConfig,")
    expect(registry).toContain("'acme.example.com'")
    expect(registry).toContain("'www.acme.example.com'")

    const themesIndex = await readFile(
      join(root, 'app/themes/index.ts'),
      'utf8',
    )
    expect(themesIndex).toContain("import { acmeRealtyTheme } from './acme-realty.theme'")
    expect(themesIndex).toContain('[acmeRealtyTheme.id]: acmeRealtyTheme')
  })

  it('--dry-run performs no writes', async () => {
    const result = runCli(root, [
      '--id', 'dryrun-co',
      '--name', 'Dryrun Co',
      '--hostname', 'dryrun.example.com',
      '--dry-run',
    ])
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('[bootstrap] DRY RUN')
    expect(result.stdout).toContain('Would write:')

    // No files should exist.
    const agencyExists = await access(
      join(root, 'app/config/agencies/dryrun-co.agency.ts'),
      constants.F_OK,
    ).then(() => true, () => false)
    expect(agencyExists).toBe(false)

    const themeExists = await access(
      join(root, 'app/themes/dryrun-co.theme.ts'),
      constants.F_OK,
    ).then(() => true, () => false)
    expect(themeExists).toBe(false)

    // The registries must remain unchanged.
    const registry = await readFile(
      join(root, 'app/config/agencies/registry.ts'),
      'utf8',
    )
    expect(registry).not.toContain('dryrunCoAgencyConfig')
    expect(registry).not.toContain('"dryrun-co"')

    const themesIndex = await readFile(
      join(root, 'app/themes/index.ts'),
      'utf8',
    )
    expect(themesIndex).not.toContain('dryrunCoTheme')
  })

  it('rejects a duplicate tenant id', async () => {
    const result = runCli(root, [
      '--id', 'bahia-del-mar', // already in baseline registry
      '--name', 'Bahia Copy',
      '--hostname', 'bahia-copy.example.com',
    ])
    expect(result.status).toBe(1)
    expect(result.stderr + result.stdout).toContain('already registered')
    expect(result.stderr + result.stdout).toContain('bahia-del-mar')

    // No files should be written.
    const copied = await access(
      join(root, 'app/config/agencies/bahia-del-mar-copy.agency.ts'),
      constants.F_OK,
    ).then(() => true, () => false)
    expect(copied).toBe(false)
  })

  it('rejects a duplicate hostname', async () => {
    const result = runCli(root, [
      '--id', 'copy-co',
      '--name', 'Copy Co',
      '--hostname', 'bahia-del-mar.test', // already in baseline registry hosts
    ])
    expect(result.status).toBe(1)
    expect(result.stderr + result.stdout).toContain('already in use')
    expect(result.stderr + result.stdout).toContain('bahia-del-mar.test')

    // The registries must remain unchanged.
    const registry = await readFile(
      join(root, 'app/config/agencies/registry.ts'),
      'utf8',
    )
    expect(registry).not.toContain('copyCoAgencyConfig')
  })

  it('rejects an existing target file', async () => {
    // Pre-create a file with the same id.
    await writeFile(
      join(root, 'app/config/agencies/existing.agency.ts'),
      '// pre-existing\n',
      'utf8',
    )

    const result = runCli(root, [
      '--id', 'existing',
      '--name', 'Existing Co',
      '--hostname', 'existing.example.com',
    ])
    expect(result.status).toBe(1)
    expect(result.stderr + result.stdout).toContain('Target file already exists')

    // The pre-existing file should still be its original content.
    const existing = await readFile(
      join(root, 'app/config/agencies/existing.agency.ts'),
      'utf8',
    )
    expect(existing).toBe('// pre-existing\n')
  })

  it('leaves the registries unchanged when input validation fails (no partial writes)', async () => {
    const registryBefore = await readFile(
      join(root, 'app/config/agencies/registry.ts'),
      'utf8',
    )
    const themesIndexBefore = await readFile(
      join(root, 'app/themes/index.ts'),
      'utf8',
    )

    const result = runCli(root, [
      '--id', 'bad id!', // invalid tenant id
      '--name', 'Bad Co',
      '--hostname', 'bad.example.com',
    ])
    expect(result.status).toBeGreaterThan(0)

    // No new files.
    const agencyExists = await access(
      join(root, 'app/config/agencies/bad id!.agency.ts'),
      constants.F_OK,
    ).then(() => true, () => false)
    expect(agencyExists).toBe(false)

    // Registries unchanged.
    const registryAfter = await readFile(
      join(root, 'app/config/agencies/registry.ts'),
      'utf8',
    )
    expect(registryAfter).toBe(registryBefore)

    const themesIndexAfter = await readFile(
      join(root, 'app/themes/index.ts'),
      'utf8',
    )
    expect(themesIndexAfter).toBe(themesIndexBefore)
  })

  it('repeated execution with the same id fails safely (no duplicate registry entries)', async () => {
    // First run succeeds.
    const first = runCli(root, [
      '--id', 'repeat-co',
      '--name', 'Repeat Co',
      '--hostname', 'repeat.example.com',
    ])
    expect(first.status).toBe(0)

    // Verify the registry contains the new tenant after the first run.
    const registryAfterFirst = await readFile(
      join(root, 'app/config/agencies/registry.ts'),
      'utf8',
    )
    expect(registryAfterFirst).toContain("'repeat-co'")

    // Second run with the same id fails.
    const second = runCli(root, [
      '--id', 'repeat-co',
      '--name', 'Repeat Co',
      '--hostname', 'repeat.example.com',
    ])
    expect(second.status).toBe(1)
    expect(second.stderr + second.stdout).toContain('already registered')

    // The registry must contain exactly one entry for repeat-co.
    const registry = await readFile(
      join(root, 'app/config/agencies/registry.ts'),
      'utf8',
    )
    const matches = registry.match(/'repeat-co':/g) ?? []
    expect(matches.length).toBe(1)
  })

  it('--help prints the usage', () => {
    const result = runCli(root, ['--help'])
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('Usage:')
    expect(result.stdout).toContain('--id <tenant>')
  })

  it('rejects unknown CLI flags', () => {
    const result = runCli(root, [
      '--id', 'unknown-flag-co',
      '--name', 'Unknown Flag Co',
      '--hostname', 'unknown-flag.example.com',
      '--no-such-flag',
    ])
    expect(result.status).toBeGreaterThan(0)
  })
})

/* ------------------------------------------------------------------ *
 * Structural-anchor coverage — generation works WITHOUT `bahia-del-mar`
 *
 * The Bootstrap's registry / themes-index patches derive their
 * insertion points from the **shape** of the file (the last
 * import line, the closing brace, the last entry line) — not
 * from any specific tenant id. The fixtures and tests in this
 * describe block use a registry / themes-index that contain
 * ONLY the template's `default` tenant + theme. They prove the
 * bootstrap can register a new tenant on a fresh template
 * checkout that has never seen `bahia-del-mar`.
 * ------------------------------------------------------------------ */

describe('CLI: generation works without `bahia-del-mar` (structural anchors)', () => {
  let root
  beforeEach(async () => {
    root = await setupDefaultOnlyProjectRoot()
  })
  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('writes the planned files when the baseline registry has no prior rebrand', async () => {
    const result = runCli(root, [
      '--id', 'first-rebrand-co',
      '--name', 'First Rebrand Co',
      '--hostname', 'first-rebrand.example.com',
      '--hostname', 'www.first-rebrand.example.com',
      '--currency', 'USD',
      '--default-locale', 'en',
      '--available-locales', 'en,es',
      '--measurement-unit', 'metric',
      '--lead-adapter', 'webhook',
    ])
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('[bootstrap] GENERATED')
    expect(result.stdout).toContain('Wrote:')

    // The four expected files exist with the expected shape.
    const agencyContent = await readFile(
      join(root, 'app/config/agencies/first-rebrand-co.agency.ts'),
      'utf8',
    )
    expect(agencyContent).toContain('export const firstRebrandCoAgencyConfig')
    expect(agencyContent).toContain('id: "first-rebrand-co"')
    expect(agencyContent).toContain('enabled: true') // webhook adapter

    const themeContent = await readFile(
      join(root, 'app/themes/first-rebrand-co.theme.ts'),
      'utf8',
    )
    expect(themeContent).toContain('export const firstRebrandCoTheme')

    // The registry now has THREE entries: default, first-rebrand-co,
    // and (importantly) NO `bahia-del-mar`. The structural anchor
    // anchored on the `defaultAgencyConfig` import and inserted the
    // new entry before the Object.freeze close.
    const registry = await readFile(
      join(root, 'app/config/agencies/registry.ts'),
      'utf8',
    )
    expect(registry).toContain("import { firstRebrandCoAgencyConfig } from './first-rebrand-co.agency'")
    expect(registry).toContain("'first-rebrand-co': buildEntry(firstRebrandCoAgencyConfig,")
    expect(registry).toContain("'first-rebrand.example.com'")
    expect(registry).toContain("'www.first-rebrand.example.com'")
    // `bahia-del-mar` was never in the baseline; it must still not
    // be present after the bootstrap ran.
    expect(registry).not.toContain('bahia-del-mar')
    expect(registry).not.toContain('bahiaDelMarAgencyConfig')

    // The themes index now has TWO entries: default + first-rebrand-co.
    const themesIndex = await readFile(
      join(root, 'app/themes/index.ts'),
      'utf8',
    )
    expect(themesIndex).toContain("import { firstRebrandCoTheme } from './first-rebrand-co.theme'")
    expect(themesIndex).toContain('[firstRebrandCoTheme.id]: firstRebrandCoTheme')
    // No `bahia` theme was ever in the baseline; the bootstrap did
    // not invent one.
    expect(themesIndex).not.toContain('bahiaTheme')
  })

  it('registers two consecutive tenants without a `bahia-del-mar` baseline (anchor independence)', async () => {
    // First tenant.
    const first = runCli(root, [
      '--id', 'alpha-co',
      '--name', 'Alpha Co',
      '--hostname', 'alpha.example.com',
    ])
    expect(first.status).toBe(0)

    // Second tenant against the same root (no `bahia-del-mar` ever).
    // The structural anchor MUST continue to work after the first
    // patch has shifted the registry's bytes.
    const second = runCli(root, [
      '--id', 'beta-co',
      '--name', 'Beta Co',
      '--hostname', 'beta.example.com',
    ])
    expect(second.status).toBe(0)

    const registry = await readFile(
      join(root, 'app/config/agencies/registry.ts'),
      'utf8',
    )
    expect(registry).toContain("'alpha-co':")
    expect(registry).toContain("'beta-co':")
    expect(registry).not.toContain('bahia-del-mar')
    // Exactly one entry each (no duplicates from a stale anchor).
    expect((registry.match(/'alpha-co':/g) ?? []).length).toBe(1)
    expect((registry.match(/'beta-co':/g) ?? []).length).toBe(1)

    const themesIndex = await readFile(
      join(root, 'app/themes/index.ts'),
      'utf8',
    )
    expect(themesIndex).toContain('[alphaCoTheme.id]: alphaCoTheme')
    expect(themesIndex).toContain('[betaCoTheme.id]: betaCoTheme')
    expect(themesIndex).not.toContain('bahiaTheme')
    expect((themesIndex.match(/\[alphaCoTheme\.id\]:/g) ?? []).length).toBe(1)
    expect((themesIndex.match(/\[betaCoTheme\.id\]:/g) ?? []).length).toBe(1)
  })

  it('rejects conflict against a hostname registered without `bahia-del-mar`', async () => {
    // Pre-register a tenant via the bootstrap itself; the registry
    // will then own `alpha.example.com`.
    const setup = runCli(root, [
      '--id', 'alpha-co',
      '--name', 'Alpha Co',
      '--hostname', 'alpha.example.com',
    ])
    expect(setup.status).toBe(0)

    // A second tenant that tries to reuse `alpha.example.com` must be
    // rejected, even though `bahia-del-mar` was never part of the
    // baseline. The conflict-detection path is independent of any
    // specific tenant id.
    const dup = runCli(root, [
      '--id', 'beta-co',
      '--name', 'Beta Co',
      '--hostname', 'alpha.example.com',
    ])
    expect(dup.status).toBe(1)
    expect(dup.stderr + dup.stdout).toContain('already in use')
    expect(dup.stderr + dup.stdout).toContain('alpha.example.com')

    // The registry should still contain exactly the entries from the
    // first run; the second run wrote nothing.
    const registry = await readFile(
      join(root, 'app/config/agencies/registry.ts'),
      'utf8',
    )
    expect((registry.match(/'alpha-co':/g) ?? []).length).toBe(1)
    expect((registry.match(/'beta-co':/g) ?? []).length).toBe(0)
  })
})

describe('parseCliArgs', () => {
  it('parses a complete invocation', () => {
    const result = parseCliArgs([
      '--id', 'acme-realty',
      '--name', 'Acme Real Estate',
      '--hostname', 'acme.example.com',
      '--hostname', 'www.acme.example.com',
      '--currency', 'USD',
      '--default-locale', 'en',
      '--available-locales', 'en,es',
      '--measurement-unit', 'metric',
      '--lead-adapter', 'webhook',
      '--theme-name', 'Acme Theme',
      '--dry-run',
    ])
    expect(result.kind).toBe('run')
    expect(result.input.id).toBe('acme-realty')
    expect(result.input.hostnames).toEqual(['acme.example.com', 'www.acme.example.com'])
    expect(result.input.leadAdapter).toBe('webhook')
    expect(result.dryRun).toBe(true)
  })

  it('returns help kind on --help', () => {
    expect(parseCliArgs(['--help']).kind).toBe('help')
    expect(parseCliArgs(['-h']).kind).toBe('help')
  })
})

describe('resolveProjectRoot', () => {
  it('returns the override when supplied (canonicalizes platform-style)', () => {
    const scriptPath = join('/anywhere', 'scripts', 'bootstrap-client.mjs')
    expect(resolveProjectRoot(scriptPath, '/tmp/foo')).toBe(resolve('/tmp/foo'))
  })

  it('defaults to the parent of the script directory', () => {
    const scriptPath = join('repo', 'scripts', 'bootstrap-client.mjs')
    expect(resolveProjectRoot(scriptPath, undefined)).toBe(resolve('repo'))
  })
})

describe('formatSummary', () => {
  it('renders a structured summary for a successful run', () => {
    const result = {
      kind: 'success',
      plan: buildPlan(
        validInput(),
        {
          _registryContent: BASELINE_REGISTRY,
          _themesIndexContent: BASELINE_THEMES,
          existingTenants: ['default', 'bahia-del-mar'],
          existingThemes: ['default', 'bahia'],
          existingHostnames: ['bahia-del-mar.test', 'www.bahia-del-mar.test'],
          existingFiles: [],
          registryPath: '/tmp/x/app/config/agencies/registry.ts',
          themesIndexPath: '/tmp/x/app/themes/index.ts',
        },
        '/tmp/x',
      ),
      written: ['/tmp/x/app/config/agencies/acme-realty.agency.ts'],
    }
    const text = formatSummary(result)
    expect(text).toContain('GENERATED')
    expect(text).toContain('Wrote:')
    expect(text).toContain('Tenant id:          acme-realty')
    expect(text).toContain('Remaining manual steps')
  })

  it('renders a structured summary for a dry run', () => {
    const result = {
      kind: 'dry-run',
      plan: buildPlan(
        validInput(),
        {
          _registryContent: BASELINE_REGISTRY,
          _themesIndexContent: BASELINE_THEMES,
          existingTenants: ['default', 'bahia-del-mar'],
          existingThemes: ['default', 'bahia'],
          existingHostnames: [],
          existingFiles: [],
          registryPath: '/tmp/x/app/config/agencies/registry.ts',
          themesIndexPath: '/tmp/x/app/themes/index.ts',
        },
        '/tmp/x',
      ),
    }
    const text = formatSummary(result)
    expect(text).toContain('DRY RUN')
    expect(text).toContain('Would write:')
  })
})

describe('runBootstrap end-to-end (programmatic)', () => {
  let root
  beforeEach(async () => {
    root = await setupProjectRoot()
  })
  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('produces a success result for a valid invocation', async () => {
    const { runBootstrap } = await import('./bootstrap-client.mjs')
    const result = await runBootstrap(
      [
        '--root', root,
        '--id', 'prog-co',
        '--name', 'Programmatic Co',
        '--hostname', 'prog.example.com',
      ],
      join(__dirname, 'bootstrap-client.mjs'),
    )
    expect(result.kind).toBe('success')
    expect(result.written.length).toBe(4)
  })

  it('produces a dry-run result for --dry-run', async () => {
    const { runBootstrap } = await import('./bootstrap-client.mjs')
    const result = await runBootstrap(
      [
        '--root', root,
        '--id', 'dryrun-prog-co',
        '--name', 'Dryrun Prog Co',
        '--hostname', 'dryrun-prog.example.com',
        '--dry-run',
      ],
      join(__dirname, 'bootstrap-client.mjs'),
    )
    expect(result.kind).toBe('dry-run')

    // Verify no files were written.
    const exists = await access(
      join(root, 'app/config/agencies/dryrun-prog-co.agency.ts'),
      constants.F_OK,
    ).then(() => true, () => false)
    expect(exists).toBe(false)
  })

  it('produces an error result for invalid input', async () => {
    const { runBootstrap } = await import('./bootstrap-client.mjs')
    const result = await runBootstrap(
      ['--root', root, '--id', 'Bad Id!', '--name', 'X', '--hostname', 'x.com'],
      join(__dirname, 'bootstrap-client.mjs'),
    )
    expect(result.kind).toBe('error')
    expect(result.phase).toBe('input-validation')
  })

  it('produces an error result for a duplicate tenant', async () => {
    const { runBootstrap } = await import('./bootstrap-client.mjs')
    const result = await runBootstrap(
      [
        '--root', root,
        '--id', 'bahia-del-mar', '--name', 'X', '--hostname', 'x.example.com',
      ],
      join(__dirname, 'bootstrap-client.mjs'),
    )
    expect(result.kind).toBe('error')
    expect(result.phase).toBe('conflict-detection')
  })

  it('produces an error result for a duplicate hostname', async () => {
    const { runBootstrap } = await import('./bootstrap-client.mjs')
    const result = await runBootstrap(
      [
        '--root', root,
        '--id', 'host-dup-co', '--name', 'Host Dup Co', '--hostname', 'bahia-del-mar.test',
      ],
      join(__dirname, 'bootstrap-client.mjs'),
    )
    expect(result.kind).toBe('error')
    expect(result.phase).toBe('conflict-detection')
  })

  it('produces an error result for an existing target file', async () => {
    // Pre-create a target file.
    await writeFile(
      join(root, 'app/config/agencies/existing-target.agency.ts'),
      '// pre-existing\n',
      'utf8',
    )

    const { runBootstrap } = await import('./bootstrap-client.mjs')
    const result = await runBootstrap(
      [
        '--root', root,
        '--id', 'existing-target', '--name', 'Existing Target', '--hostname', 'existing-target.example.com',
      ],
      join(__dirname, 'bootstrap-client.mjs'),
    )
    expect(result.kind).toBe('error')
    expect(result.phase).toBe('conflict-detection')

    // The pre-existing file is unchanged.
    const content = await readFile(
      join(root, 'app/config/agencies/existing-target.agency.ts'),
      'utf8',
    )
    expect(content).toBe('// pre-existing\n')
  })

  // Note: the rollback failure path is tested via `fsOps`
  // dependency injection (see the rollback describe block below).
  // The `existing-target` test above proves the script never reaches
  // the write path when conflict detection fails, so no partial-write
  // state ever exists in the operator-facing failure mode. The
  // `dry-run` test proves the write path is skipped entirely on
  // `--dry-run`.
})

/* ------------------------------------------------------------------ *
 * Rollback failure path — fsOps dependency injection
 * ------------------------------------------------------------------ */

describe('applyPlan rollback on mid-write failure (fsOps DI seam)', () => {
  let root
  beforeEach(async () => {
    root = await setupProjectRoot()
  })
  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('removes newly-created files, restores existing files byte-for-byte, no partial scaffold', async () => {
    // Capture the on-disk registry + themes-index BEFORE the bootstrap
    // so we can assert they are byte-identical after rollback.
    const registryBefore = await readFile(
      join(root, 'app/config/agencies/registry.ts'),
      'utf8',
    )
    const themesIndexBefore = await readFile(
      join(root, 'app/themes/index.ts'),
      'utf8',
    )

    const fsPromises = await import('node:fs/promises')

    // Build an fsOps mock that throws on the third writeFile call
    // (the registry patch). The first two writes (agency + theme
    // files) succeed; the third (the registry patch) fails; the
    // fourth (themes-index patch) is never reached.
    let writeCount = 0
    const writes = []
    const mockFsOps = {
      mkdir: async (path, opts) => fsPromises.mkdir(path, opts),
      readFile: async (path, enc) => fsPromises.readFile(path, enc),
      writeFile: async (path, contents) => {
        writeCount++
        writes.push({ path, contents })
        if (writeCount === 3) {
          throw new Error('simulated mid-write failure')
        }
        return fsPromises.writeFile(path, contents, 'utf8')
      },
      unlink: async (path) => fsPromises.unlink(path),
    }

    // Plan a bootstrap and inject the mock fsOps into applyPlan.
    const { applyPlan, buildPlan, readProjectState, validateInputs } = await import('./bootstrap-client.mjs')
    const projectState = await readProjectState(root)
    const validation = validateInputs({
      id: 'rollback-co',
      name: 'Rollback Co',
      hostnames: ['rollback.example.com'],
      themeName: 'Rollback Co Theme',
      currency: 'USD',
      defaultLocale: 'en',
      availableLocales: ['en', 'es'],
      measurementUnit: 'metric',
      leadAdapter: 'disabled',
    })
    if (!validation.ok) {
      throw new Error('test setup: validateInputs returned errors: ' + JSON.stringify(validation.errors))
    }
    const plan = buildPlan(validation.value, projectState, root)

    // applyPlan should throw with our simulated error.
    let thrown
    try {
      await applyPlan(plan, mockFsOps)
    } catch (error) {
      thrown = error
    }
    expect(thrown).toBeDefined()
    expect(thrown.message).toContain('simulated mid-write failure')

    // The first two writes (agency + theme files) succeeded.
    expect(writeCount).toBe(3) // 2 successful + 1 failed
    expect(writes.length).toBe(3)

    // (1) The newly-created agency file should have been REMOVED by
    // the rollback (it was a new file, so the rollback deleted it).
    const agencyExists = await access(
      join(root, 'app/config/agencies/rollback-co.agency.ts'),
      constants.F_OK,
    ).then(() => true, () => false)
    expect(agencyExists).toBe(false)

    // (2) The newly-created theme file should have been REMOVED by
    // the rollback.
    const themeExists = await access(
      join(root, 'app/themes/rollback-co.theme.ts'),
      constants.F_OK,
    ).then(() => true, () => false)
    expect(themeExists).toBe(false)

    // (3) The previously-existing registry.ts should have been
    // RESTORED byte-for-byte (the third write failed, so the
    // rollback restored the original content).
    const registryAfter = await readFile(
      join(root, 'app/config/agencies/registry.ts'),
      'utf8',
    )
    expect(registryAfter).toBe(registryBefore)

    // (4) The previously-existing themes/index.ts should have been
    // RESTORED byte-for-byte (the fourth write was never reached).
    const themesIndexAfter = await readFile(
      join(root, 'app/themes/index.ts'),
      'utf8',
    )
    expect(themesIndexAfter).toBe(themesIndexBefore)

    // No partial client scaffold remains: the two new files were
    // deleted, the two existing files were restored. The tree is
    // exactly as it was before applyPlan ran.
    const finalDir = await readdir(root, { recursive: true })
    // The baseline root has exactly: app/config/agencies/registry.ts,
    // app/themes/index.ts, app/config/agencies/, app/themes/,
    // app/config/, app/. No rollback-co.agency.ts or
    // rollback-co.theme.ts should appear.
    const rollbackLeakage = finalDir.filter(p =>
      p.includes('rollback-co'),
    )
    expect(rollbackLeakage).toEqual([])
  })
})
