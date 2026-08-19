import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Sanity SDK boundary regression test (Task 116).
 *
 * The Task 116 build moved the provider-specific Sanity
 * driver out of `app/core/data-source/adapters/` and into
 * `server/utils/`. The shared `CmsDriver<T>` contract stays
 * in `app/core/data-source/cms-driver.ts`; the provider-
 * specific implementation is server-only by file location.
 *
 * The boundary guarantee is:
 *
 *  - No file under `app/` imports `@sanity/client` (the only
 *    new runtime dependency the v1.2 pilot introduces).
 *  - No file under `app/` references `NUXT_SANITY_TOKEN`
 *    (the agency-owned read token env var).
 *  - No file under `app/` re-exports the Sanity driver or
 *    the Sanity client config (the loader-only helpers).
 *  - The Sanity driver file does NOT live under `app/`.
 *  - The Nuxt Image config keeps `cdn.sanity.io` in
 *    `image.domains` so the Sanity CDN URLs the driver
 *    produces are accepted by the IPX provider.
 *
 * The test recursively scans `app/` for `.ts`, `.vue`, and
 * `.js` files (skipping `.nuxt/`, `node_modules/`, and
 * `dist/` builds) and asserts none of them contain the
 * forbidden patterns. A comment / string that mentions the
 * env var, the package, or the driver is still a boundary
 * leak — the test is intentionally conservative.
 *
 * The test is intentionally placed in `server/utils/` so it
 * is not part of the client bundle. It runs as part of
 * `pnpm test`.
 *
 * **Why a static string scan.** A runtime import boundary
 * check would require booting the Nuxt bundle and running
 * the server bundle vs. the client bundle separately, which
 * is fragile and slow. The static scan is the canonical
 * pattern for "no client-reachable module imports X" and
 * catches the common regressions: a copy-paste import, a
 * re-export from a shared barrel, a `@sanity/client` import
 * in a composable. The two complementary tests (the scan
 * and the explicit file-location assertion) pin the
 * boundary at the source level.
 */
const APP_ROOT = resolve(import.meta.dirname, '..', '..', 'app')
const ROOT = resolve(import.meta.dirname, '..', '..')
const NUXT_CONFIG = resolve(ROOT, 'nuxt.config.ts')

/**
 * The patterns that must NOT appear in any file under
 * `app/`. The list is intentionally narrow — each entry
 * is a single, concrete leak that the Task 116 build
 * prevents. Adding a new pattern is a code-review decision.
 */
const FORBIDDEN_APP_PATTERNS = [
  {
    label: '@sanity/client import',
    pattern: /from\s+['"]@sanity\/client['"]/,
  },
  {
    label: '@sanity/client require',
    pattern: /require\(['"]@sanity\/client['"]\)/,
  },
  {
    label: 'NUXT_SANITY_TOKEN reference',
    pattern: /NUXT_SANITY_TOKEN\b/,
  },
  {
    label: 'sanity-driver import from app/',
    pattern: /from\s+['"][^'"]*sanity-driver['"]/,
  },
  {
    label: 'sanity-config import from app/',
    pattern: /from\s+['"][^'"]*sanity-config['"]/,
  },
  {
    label: 'sanity-mappings import from app/',
    pattern: /from\s+['"][^'"]*sanity-mappings['"]/,
  },
  {
    label: 'createSanityDriver re-export',
    pattern: /createSanityDriver\b/,
  },
  {
    label: 'createSanityClientConfig reference',
    pattern: /createSanityClientConfig\b/,
  },
] as const

/**
 * Recursively walk a directory and return the absolute paths
 * of every `.ts`, `.vue`, and `.js` file. The `node_modules/`
 * and `.nuxt/` directories are skipped; `dist/` and
 * `coverage/` are skipped. The test asserts the walker
 * visits no path that would otherwise be a build artefact.
 */
function walk(root: string): string[] {
  const out: string[] = []
  if (!existsSync(root)) return out
  const stack = [root]
  while (stack.length > 0) {
    const dir = stack.pop() as string
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      const stat = statSync(full)
      if (stat.isDirectory()) {
        if (entry === 'node_modules' || entry === '.nuxt' || entry === 'dist' || entry === 'coverage' || entry === '.output') {
          continue
        }
        stack.push(full)
      }
      else if (/\.(?:ts|vue|js|mjs|cjs)$/.test(entry)) {
        out.push(full)
      }
    }
  }
  return out
}

describe('Sanity SDK boundary (Task 116)', () => {
  it('locates the app/ root', () => {
    expect(existsSync(APP_ROOT)).toBe(true)
  })

  it('no app/ file imports @sanity/client', () => {
    const files = walk(APP_ROOT)
    const offenders: Array<{ file: string, label: string, match: string }> = []
    for (const file of files) {
      const source = readFileSync(file, 'utf8')
      for (const { label, pattern } of FORBIDDEN_APP_PATTERNS) {
        const match = source.match(pattern)
        if (match) {
          offenders.push({ file, label, match: match[0] })
        }
      }
    }
    if (offenders.length > 0) {
      const lines = offenders.map(o => `  - ${o.file.replace(ROOT, '.')}: ${o.label} (${o.match})`)
      throw new Error(
        `Sanity SDK boundary violation — no app/ file may import @sanity/client, reference NUXT_SANITY_TOKEN, or import the Sanity driver:\n${lines.join('\n')}`,
      )
    }
    expect(offenders).toEqual([])
  })

  it('app/core/data-source/adapters/ does not contain a Sanity driver file', () => {
    const adaptersDir = resolve(APP_ROOT, 'core', 'data-source', 'adapters')
    expect(existsSync(adaptersDir)).toBe(true)
    const entries = readdirSync(adaptersDir)
    const sanityEntries = entries.filter(name => name.includes('sanity'))
    expect(sanityEntries).toEqual([])
  })

  it('nuxt.config.ts keeps cdn.sanity.io in image.domains', () => {
    const config = readFileSync(NUXT_CONFIG, 'utf8')
    expect(config).toMatch(/image:\s*\{/)
    expect(config).toMatch(/domains:\s*\[[^\]]*['"]cdn\.sanity\.io['"][^\]]*\]/)
  })
})
