import { expect, test } from '@playwright/test'

/**
 * Task 118 — real Sanity end-to-end validation.
 *
 * **This spec is opt-in.** The 9 cases below are skipped
 * unless the `SANITY_REAL_E2E=1` environment variable is
 * set. The default `pnpm test:e2e` does NOT set this
 * variable; the real Sanity spec is excluded from the
 * default Playwright run.
 *
 * **Why opt-in.** The real Sanity spec requires:
 *  - a real Sanity test project at <https://sanity.io/manage>;
 *  - the public `production` dataset;
 *  - the three published documents (one Agent, one
 *    Development, one Property) with the slugs
 *    `test-agent`, `test-development`, `test-sanity-property`;
 *  - local `NUXT_SANITY_*` env vars pointing at the test
 *    project (excluded by the root `.gitignore`);
 *  - a running Nuxt dev server that has loaded those env
 *    vars (or `pnpm preview` with the env vars set).
 *
 * The default `pnpm test:e2e` must NOT depend on any of
 * those preconditions — it is the deterministic static-data
 * suite. The opt-in flag is the cleanest way to keep the
 * two suites independent.
 *
 * **How the operator runs the real validation.** From the
 * repo root:
 *
 *   - Linux / macOS:
 *       SANITY_REAL_E2E=1 pnpm test:e2e
 *   - Windows PowerShell:
 *       $env:SANITY_REAL_E2E = "1"; pnpm test:e2e
 *
 * When the flag is set, the 9 cases below run against the
 * operator's locally configured real Sanity project. When
 * the flag is not set, the entire spec is skipped
 * (`skipped` in the Playwright report).
 *
 * The deterministic unit-test suite (`pnpm test`) is the
 * canonical regression net. The fixtures-based Sanity
 * integration test (`server/utils/sanity-integration.test.ts`,
 * 14 cases) covers the GROQ → mapping → Zod pipeline with
 * mocked `@sanity/client`. The real Sanity spec exercises
 * the same pipeline against a real dataset.
 *
 * **No real Sanity project IDs, tokens, or credentials are
 * referenced in this spec.** The slugs are abstract test
 * data; the env vars live in the operator's local ignored
 * `.env` files.
 */

const SANITY_PROPERTY_SLUG = 'test-sanity-property'
const SANITY_AGENT_SLUG = 'test-agent'
const SANITY_DEVELOPMENT_SLUG = 'test-development'

const SANITY_REAL_E2E_FLAG = 'SANITY_REAL_E2E'
const skipReason = `${SANITY_REAL_E2E_FLAG}=1 not set; skipping real Sanity E2E. Set the env var to run this spec against a configured real Sanity project.`

test.describe('Task 118 — real Sanity validation', () => {
  test.skip(process.env[SANITY_REAL_E2E_FLAG] !== '1', skipReason)

  test('real /api/properties returns the published Sanity record', async ({ request }) => {
    const response = await request.get('http://localhost:3000/api/properties')
    expect(response.status()).toBe(200)
    const properties = await response.json()
    expect(Array.isArray(properties)).toBe(true)
    expect(properties.length).toBeGreaterThanOrEqual(1)
    const property = properties[0]
    // The boundary schema requires non-empty `id`, `title`,
    // `slug`, `description`, `coverImage`, and the documented
    // enums. The published record carries every required field.
    expect(typeof property.id).toBe('string')
    expect(property.id.length).toBeGreaterThan(0)
    expect(property.title).toBe('Test Sanity Property')
    expect(property.slug).toBe(SANITY_PROPERTY_SLUG)
    expect(property.description.length).toBeGreaterThan(0)
    expect(property.coverImage).toMatch(/^https:\/\/cdn\.sanity\.io\//)
    expect(['sale', 'rent']).toContain(property.operationType)
    expect(['house', 'apartment', 'land', 'commercial', 'office']).toContain(property.propertyType)
    expect(['available', 'sold', 'rented', 'reserved', 'hidden']).toContain(property.status)
  })

  test('real /api/agents returns the published Sanity record', async ({ request }) => {
    const response = await request.get('http://localhost:3000/api/agents')
    expect(response.status()).toBe(200)
    const agents = await response.json()
    expect(agents.length).toBeGreaterThanOrEqual(1)
    const agent = agents[0]
    expect(agent.name).toBe('Test Agent')
    expect(agent.slug).toBe(SANITY_AGENT_SLUG)
    expect(agent.image).toMatch(/^https:\/\/cdn\.sanity\.io\//)
  })

  test('real /api/developments returns the published Sanity record', async ({ request }) => {
    const response = await request.get('http://localhost:3000/api/developments')
    expect(response.status()).toBe(200)
    const developments = await response.json()
    expect(developments.length).toBeGreaterThanOrEqual(1)
    const development = developments[0]
    expect(development.name).toBe('Test Development')
    expect(development.slug).toBe(SANITY_DEVELOPMENT_SLUG)
    expect(development.image).toMatch(/^https:\/\/cdn\.sanity\.io\//)
    expect(['pre-sale', 'under-construction', 'ready-to-deliver', 'sold-out']).toContain(development.status)
  })

  test('the real Property → Agent reference resolves to the real agent', async ({ request }) => {
    const properties = await (await request.get('http://localhost:3000/api/properties')).json()
    const agents = await (await request.get('http://localhost:3000/api/agents')).json()
    const property = properties[0]
    expect(typeof property.agentId).toBe('string')
    const referencedAgent = agents.find((a: { id: string }) => a.id === property.agentId)
    expect(referencedAgent).toBeDefined()
    expect(referencedAgent.name).toBe('Test Agent')
  })

  test('the real Property → Development reference resolves to the real development', async ({ request }) => {
    const properties = await (await request.get('http://localhost:3000/api/properties')).json()
    const developments = await (await request.get('http://localhost:3000/api/developments')).json()
    const property = properties[0]
    expect(typeof property.developmentId).toBe('string')
    const referencedDevelopment = developments.find((d: { id: string }) => d.id === property.developmentId)
    expect(referencedDevelopment).toBeDefined()
    expect(referencedDevelopment.name).toBe('Test Development')
  })

  test('/properties renders the published Sanity record and the cover image', async ({ page, request }) => {
    await page.goto('http://localhost:3000/properties')
    await expect(page.getByRole('heading', { name: 'Test Sanity Property', exact: true }).first()).toBeVisible()
    // The cover image is rendered through the IPX pipeline;
    // the rendered DOM carries a `srcset` whose first URL is
    // an `/_ipx/...` URL (the IPX provider), and the source
    // URL is a `cdn.sanity.io/...` URL. Scope the locator to
    // `main img` to skip the header logo (the first `<img>`
    // on the page is the logo, not the property card).
    const img = page.locator('main img').first()
    const src = await img.getAttribute('src') ?? ''
    const srcset = await img.getAttribute('srcset') ?? ''
    const usesSanity = src.includes('cdn.sanity.io') || srcset.includes('cdn.sanity.io')
    const usesIpx = src.includes('/_ipx/') || srcset.includes('/_ipx/')
    expect(usesSanity || usesIpx).toBe(true)
    // **Actual image loading** — resolve the relative IPX
    // URL (`/_ipx/w_<width>/<encoded source>`) against the
    // page origin, fetch it, and assert the response is
    // `200`. This detects the IPX/sharp failure mode (where
    // the IPX provider returns `500` because the `sharp`
    // native binary is missing). The test is not a pure
    // URL-shape check; it verifies the browser receives a
    // successful image response. The regression assertion
    // catches the documented `@nuxt/image` Windows `sharp`
    // limitation (see `docs/REBRANDING.md` §13).
    const imageUrl = new URL(src, 'http://localhost:3000').toString()
    const imageResponse = await request.get(imageUrl)
    expect(imageResponse.status(), `expected image to load successfully: ${imageUrl}`).toBe(200)
  })

  test('the real Property detail route renders the published record and images load', async ({ page, request }) => {
    const response = await page.goto(`http://localhost:3000/properties/${SANITY_PROPERTY_SLUG}`)
    expect(response?.status()).toBe(200)
    await expect(page.getByRole('heading', { name: 'Test Sanity Property', exact: true })).toBeVisible()
    // The detail page renders the cover image and at least
    // one gallery image. The cover image is the first `<img>`
    // on the page.
    const imgs = page.locator('main img')
    expect(await imgs.count()).toBeGreaterThanOrEqual(2)
    // The first image's source URL contains the Sanity CDN
    // host (the IPX provider rewrites the URL to /_ipx/...).
    const firstSrc = await imgs.first().getAttribute('src') ?? ''
    expect(firstSrc).toMatch(/cdn\.sanity\.io|IPX|_ipx|ipx=|cdn=sanity/)
    // **Actual image loading for all visible images** —
    // resolve each relative IPX URL against the page
    // origin, fetch it, and assert the response is `200`.
    // This is the focused regression assertion that detects
    // the IPX/sharp failure mode. The test exercises the
    // cover image and the gallery images (the property
    // ships with a 3-image gallery per the operator's
    // real-content set).
    const imageCount = await imgs.count()
    for (let i = 0; i < imageCount; i++) {
      const src = await imgs.nth(i).getAttribute('src') ?? ''
      const imageUrl = new URL(src, 'http://localhost:3000').toString()
      const imageResponse = await request.get(imageUrl)
      expect(imageResponse.status(), `image ${i} failed to load: ${imageUrl}`).toBe(200)
    }
  })

  test('the real Agent detail route renders the published record and the portrait loads', async ({ page, request }) => {
    const response = await page.goto(`http://localhost:3000/agents/${SANITY_AGENT_SLUG}`)
    expect(response?.status()).toBe(200)
    await expect(page.getByRole('heading', { name: 'Test Agent', exact: true })).toBeVisible()
    await expect(page.getByText('Real Estate Advisor', { exact: true })).toBeVisible()
    // **Actual image loading for the agent portrait** —
    // resolve the relative IPX URL against the page origin
    // and assert the response is `200`.
    const portrait = page.locator('main img').first()
    const src = await portrait.getAttribute('src') ?? ''
    const imageUrl = new URL(src, 'http://localhost:3000').toString()
    const imageResponse = await request.get(imageUrl)
    expect(imageResponse.status(), `agent portrait failed to load: ${imageUrl}`).toBe(200)
  })

  test('the real Development detail route renders the published record and the cover loads', async ({ page, request }) => {
    const response = await page.goto(`http://localhost:3000/developments/${SANITY_DEVELOPMENT_SLUG}`)
    expect(response?.status()).toBe(200)
    await expect(page.getByRole('heading', { name: 'Test Development', exact: true })).toBeVisible()
    await expect(page.getByText('Monterrey', { exact: false })).toBeVisible()
    // **Actual image loading for the development cover image**
    // — resolve the relative IPX URL against the page origin
    // and assert the response is `200`.
    const cover = page.locator('main img').first()
    const src = await cover.getAttribute('src') ?? ''
    const imageUrl = new URL(src, 'http://localhost:3000').toString()
    const imageResponse = await request.get(imageUrl)
    expect(imageResponse.status(), `development cover failed to load: ${imageUrl}`).toBe(200)
  })

  test('the real Agent detail route renders the published record', async ({ page }) => {
    const response = await page.goto(`http://localhost:3000/agents/${SANITY_AGENT_SLUG}`)
    expect(response?.status()).toBe(200)
    await expect(page.getByRole('heading', { name: 'Test Agent', exact: true })).toBeVisible()
    await expect(page.getByText('Real Estate Advisor', { exact: true })).toBeVisible()
  })

  test('the real Development detail route renders the published record', async ({ page }) => {
    const response = await page.goto(`http://localhost:3000/developments/${SANITY_DEVELOPMENT_SLUG}`)
    expect(response?.status()).toBe(200)
    await expect(page.getByRole('heading', { name: 'Test Development', exact: true })).toBeVisible()
    await expect(page.getByText('Monterrey', { exact: false })).toBeVisible()
  })
})
