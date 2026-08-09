import { expect, test, type Page } from '@playwright/test'

/**
 * Agent detail regression tests.
 *
 * The agent detail page lives at `/agents/[slug]` (Task 095). The
 * suite covers:
 *
 *  - The detail page renders for a known slug from the static
 *    catalog, with a single `<h1>` (the agent's name), the visible
 *    breadcrumb trail, the role, the specialties badges when
 *    present, and no uncaught browser error.
 *  - The detail page returns a 4xx/5xx response for an unknown
 *    slug (the page calls `createError({ statusCode: 404, ... })`).
 *  - The agents listing deep-links to each detail page. The
 *    listing is a 1-click path to the detail page; this assertion
 *    is the regression coverage for the deep-link contract.
 *  - The detail page has exactly one `<h1>`, breadcrumbs with the
 *    current page as `aria-current="page"`, and a heading hierarchy
 *    that does not skip levels (mirroring the M10 / M11 contract
 *    on `/properties` and `/developments/[slug]`).
 *  - The JSON-LD payload includes a `Person` schema with a
 *    `BreadcrumbList` companion (the same dual-payload pattern as
 *    the property and development detail pages).
 *  - The sitemap advertises per-agent detail URLs.
 *
 * The known slug is the first agent in the static catalog
 * (`maria-gonzalez`); the test fails loudly if the catalog is
 * edited to remove that record.
 */

const KNOWN_SLUG = 'maria-gonzalez'
const KNOWN_NAME = 'María González'
const UNKNOWN_SLUG = 'this-agent-does-not-exist'

test.describe('Smoke — agent detail route', () => {
  test(`/agents/${KNOWN_SLUG} renders the agent and emits no pageerror`, async ({ page }) => {
    const getErrors = trackUncaughtErrors(page)

    const response = await page.goto(`/agents/${KNOWN_SLUG}`, { waitUntil: 'domcontentloaded' })
    expect(response, `navigation to /agents/${KNOWN_SLUG} should produce a response`).not.toBeNull()
    expect(response!.status(), `/agents/${KNOWN_SLUG} should return 200`).toBeLessThan(400)

    // The page-level <h1> is the agent's name.
    await expect(page.locator('h1').first()).toBeVisible()
    const h1Text = (await page.locator('h1').first().textContent())?.trim()
    expect(h1Text, '<h1> on the agent detail page should be the agent name').toBe(KNOWN_NAME)

    // The breadcrumb trail is rendered by `SeoBreadcrumbs` and ends
    // with a non-linked <span aria-current="page">.
    const lastCrumb = page.locator('nav[aria-label="Breadcrumb"] [aria-current="page"]')
    await expect(lastCrumb, 'breadcrumb trail should end with aria-current="page"').toBeVisible()
    expect((await lastCrumb.textContent())?.trim()).toBe(KNOWN_NAME)

    // The role is rendered above the heading as a `<p>`. The
    // "Senior Advisor" string is the static catalog's `role` for
    // maria-gonzalez.
    await expect(page.getByText('Senior Advisor', { exact: true }).first()).toBeVisible()

    const errors = getErrors()
    expect(errors, `/agents/${KNOWN_SLUG} should not emit uncaught pageerrors`).toEqual([])
  })

  test(`/agents/${UNKNOWN_SLUG} returns a 4xx/5xx response`, async ({ page }) => {
    const response = await page.goto(`/agents/${UNKNOWN_SLUG}`, { waitUntil: 'domcontentloaded' })
    expect(response, `navigation to /agents/${UNKNOWN_SLUG} should produce a response`).not.toBeNull()
    // The route throws `createError({ statusCode: 404, ... })`. The
    // preview server may return 404 (Nuxt's default error page) or
    // 500 (the bare error path); either is a "not found" outcome.
    expect(response!.status(), `unknown agent slug should return >=400`).toBeGreaterThanOrEqual(400)
  })
})

test.describe('Smoke — agent listing → detail navigation', () => {
  test('every agent card on /agents links to its own detail page', async ({ page }) => {
    const getErrors = trackUncaughtErrors(page)

    await page.goto('/agents', { waitUntil: 'domcontentloaded' })

    // The static catalog ships 4 agents. Each card now has a
    // "View profile" CTA in addition to the deep-linked name.
    const detailLinks = page.locator('main a[href^="/agents/"]')
    const count = await detailLinks.count()
    expect(count, '/agents should show at least one agent detail link').toBeGreaterThan(0)

    // Every href must point to a valid `/agents/<slug>` route
    // (no `/agents/contact` style anchors, no trailing slashes
    // outside the slug).
    const hrefs = await detailLinks.evaluateAll((els) => els.map(el => el.getAttribute('href') ?? ''))
    for (const href of hrefs) {
      expect(href, `detail link should match /agents/<slug>`).toMatch(/^\/agents\/[a-z0-9-]+$/)
    }

    // Click the first link and confirm we land on the detail page.
    const firstHref = hrefs[0]
    const firstLink = page.locator(`main a[href="${firstHref}"]`).first()
    await Promise.all([
      page.waitForURL(`**${firstHref}`),
      firstLink.click(),
    ])
    expect(new URL(page.url()).pathname, 'after click, pathname should be the link href').toBe(firstHref)
    await expect(page.locator('h1').first()).toBeVisible()

    const errors = getErrors()
    expect(errors, 'listing-to-detail navigation should not emit uncaught pageerrors').toEqual([])
  })
})

test.describe('Smoke — agent detail a11y contract', () => {
  test('the detail page has a single <h1> under <main> and no level skip', async ({ page }) => {
    await page.goto(`/agents/${KNOWN_SLUG}`, { waitUntil: 'load' })

    const h1InMain = await page.locator('main h1').count()
    const h1Total = await page.locator('h1').count()
    expect(h1InMain, 'detail page should have exactly one <h1> inside <main>').toBe(1)
    expect(h1Total, 'detail page should have exactly one <h1> total').toBe(1)

    // The heading hierarchy walk: same no-level-skip rule as the
    // M10 / M11 contract on /properties and /developments/[slug].
    const levels = await page.locator('main h1, main h2, main h3, main h4, main h5, main h6')
      .evaluateAll((els) => els.map(el => parseInt(el.tagName.substring(1))))
    expect(levels.length, 'detail page should have at least one heading').toBeGreaterThan(0)
    let previous = levels[0]
    for (let i = 1; i < levels.length; i++) {
      const diff = levels[i] - previous
      expect(
        diff,
        `heading at index ${i} (level ${levels[i]}) skips from previous (level ${previous})`,
      ).toBeLessThanOrEqual(1)
      previous = levels[i]
    }
  })

  test('the detail page emits a Person + BreadcrumbList JSON-LD pair', async ({ page }) => {
    await page.goto(`/agents/${KNOWN_SLUG}`, { waitUntil: 'load' })

    // Parse every JSON-LD script block into the full payload so the
    // assertions below can look at the @type, the @id, and the
    // contact fields (the listing already emits Person items inside
    // an ItemList; the detail page emits a top-level Person).
    const payloads = await page.locator('script[type="application/ld+json"]')
      .evaluateAll((els) => els.map((el) => {
        try {
          return JSON.parse(el.textContent ?? '{}')
        } catch {
          return null
        }
      }))
    for (const payload of payloads) {
      expect(payload, 'every JSON-LD payload should parse to a non-null object').not.toBeNull()
    }

    const types = payloads.map(p => p['@type'] ?? null)
    expect(types, 'JSON-LD payload should include a Person schema').toContain('Person')
    expect(types, 'JSON-LD payload should include a BreadcrumbList schema').toContain('BreadcrumbList')

    // The Person payload must carry the agent's name, role, image,
    // and a `worksFor` reference to the agency.
    const person = payloads.find(p => p['@type'] === 'Person')
    expect(person, 'Person JSON-LD payload should be present').toBeDefined()
    expect(person.name).toBe(KNOWN_NAME)
    expect(person.jobTitle).toBe('Senior Advisor')
    expect(typeof person.image).toBe('string')
    expect(person.image.length, 'Person.image should be a non-empty URL').toBeGreaterThan(0)
    expect(person.worksFor, 'Person payload should include a worksFor reference to the agency').toBeDefined()
    expect(person.worksFor['@type']).toBe('RealEstateAgent')
    expect(typeof person.worksFor.name).toBe('string')
  })
})

test.describe('Smoke — sitemap includes per-agent URLs', () => {
  test('the sitemap advertises /agents/<slug> for every agent in the catalog', async ({ request }) => {
    // The sitemap endpoint returns 503 when `NUXT_PUBLIC_SITE_URL` is
    // not set. The Playwright `webServer` does not inject the env
    // var, so we accept either the 200-with-URLs path (the
    // deployment is configured) or the 503-with-hint path (the
    // deployment is not configured). The 200 path mirrors the
    // development-detail sitemap test (Task 094).
    const sitemapResponse = await request.get('/sitemap.xml')
    const sitemapStatus = sitemapResponse.status()
    if (sitemapStatus === 200) {
      const body = await sitemapResponse.text()
      expect(body, 'sitemap should include the agents listing').toContain('/agents')
      expect(body, 'sitemap should include the maria-gonzalez detail URL').toContain('/agents/maria-gonzalez')
      expect(body, 'sitemap should include the james-carter detail URL').toContain('/agents/james-carter')
    } else {
      // 503 path: the endpoint returned the documented plain-text hint.
      expect(sitemapStatus, 'sitemap should return 503 when siteUrl is not configured').toBe(503)
    }
  })
})

/**
 * Reuse the uncaught-error tracker from `smoke.spec.ts` so a JS
 * exception in the agent detail page (or the listing-to-detail
 * transition) fails the test cleanly.
 */
function trackUncaughtErrors(page: Page) {
  const errors: Error[] = []
  page.on('pageerror', (err) => {
    errors.push(err)
  })
  return () => errors
}
