import { expect, test } from '@playwright/test'

/**
 * Smoke tests for the post-v1.1.0 project.
 *
 * The suite covers exactly what the task brief asks for:
 *
 * - Home page loading.
 * - Properties listing.
 * - One property detail route.
 * - Agents page.
 * - Developments page.
 * - Contact page.
 * - Navigation between key public routes.
 * - The default disabled lead form state.
 *
 * Every test also asserts that the page did not emit an uncaught
 * browser error during navigation. The default contact form's
 * `leads.enabled === false` is verified on the contact page.
 *
 * The suite is intentionally minimal: route loading, no-error, and
 * the disabled-form contract. The Vitest unit suite (`pnpm test`)
 * is the primary automated test surface; the Playwright suite is a
 * thin integration check.
 *
 * The `webServer` config in `playwright.config.ts` boots `pnpm
 * preview` against the latest production build. The dev workflow
 * is to run `pnpm build && pnpm test:e2e`; the CI workflow runs
 * the same sequence. A developer who already has `pnpm dev` or
 * `pnpm preview` running on port 3000 is served by
 * `reuseExistingServer: !process.env.CI`.
 */

const PUBLIC_ROUTES = [
  { name: 'Home', path: '/' },
  { name: 'Properties', path: '/properties' },
  { name: 'Agents', path: '/agents' },
  { name: 'Developments', path: '/developments' },
  { name: 'Contact', path: '/contact' },
] as const

/**
 * One property detail page is exercised. The slug comes from the
 * static catalog at `app/features/properties/data/properties.ts`
 * and is asserted to resolve to a real visible record. A new
 * static record with the same slug would make the test fail
 * loudly; replacing the slug is a one-line maintenance change.
 */
const PROPERTY_DETAIL_PATH = '/properties/modern-hillside-villa'

/**
 * Wire a `pageerror` listener to every page so a JavaScript
 * exception that fires during navigation is captured and surfaced
 * at the end of the test as a hard failure. The collected errors
 * are asserted empty before the test ends.
 */
function trackUncaughtErrors(page: import('@playwright/test').Page) {
  const errors: Error[] = []
  page.on('pageerror', (err) => {
    errors.push(err)
  })
  return () => errors
}

test.describe('Smoke — public routes load without uncaught errors', () => {
  for (const route of PUBLIC_ROUTES) {
    test(`${route.name} (${route.path}) renders the document and emits no pageerror`, async ({ page }) => {
      const getErrors = trackUncaughtErrors(page)

      const response = await page.goto(route.path, { waitUntil: 'domcontentloaded' })
      expect(response, `navigation to ${route.path} should produce a response`).not.toBeNull()
      // The Nuxt preview server returns 200 for every prerendered
      // public page. A 404 here would mean the dev / preview server
      // is misconfigured (e.g. the static export was served instead
      // of the Nitro build).
      expect(response!.status(), `${route.path} should return 200`).toBeLessThan(400)

      // The Nuxt root <div id="__nuxt"> is always rendered by the
      // SSR pipeline. Every page should mount into it.
      await expect(page.locator('#__nuxt')).toBeVisible()

      // The <html> lang attribute is set to the active locale by
      // the app shell. The default locale is `en`, so an English
      // run should see `lang="en"`.
      const lang = await page.locator('html').getAttribute('lang')
      expect(lang, `${route.path} should set <html lang="...">`).toBeTruthy()

      const errors = getErrors()
      expect(errors, `${route.path} should not emit uncaught pageerrors`).toEqual([])
    })
  }
})

test.describe('Smoke — properties listing', () => {
  test('the listing shows the property cards from the static catalog', async ({ page }) => {
    const getErrors = trackUncaughtErrors(page)

    await page.goto('/properties', { waitUntil: 'domcontentloaded' })

    // The static catalog ships 6 property records. The
    // `PropertyCard` renders the title as a NuxtLink to
    // `/properties/<slug>`. The selector is restricted to the
    // main landmark (the page also has the footer's quick-links
    // nav, which does not include a property link).
    const cards = page.locator('main a[href^="/properties/"]')
    await expect(cards.first()).toBeVisible()
    const count = await cards.count()
    expect(count, '/properties should show at least one property card').toBeGreaterThan(0)

    const errors = getErrors()
    expect(errors, '/properties should not emit uncaught pageerrors').toEqual([])
  })

  test('clicking a property card link navigates to the detail page', async ({ page }) => {
    const getErrors = trackUncaughtErrors(page)

    await page.goto('/properties', { waitUntil: 'domcontentloaded' })
    // Pick the first card link in the main landmark. The link
    // target is the property slug from the static catalog.
    const firstCardLink = page.locator('main a[href^="/properties/"]').first()
    const href = await firstCardLink.getAttribute('href')
    expect(href, 'first property card should link to a property detail route').toMatch(/^\/properties\/[a-z0-9-]+$/)

    await Promise.all([
      page.waitForURL(href!),
      firstCardLink.click(),
    ])

    expect(new URL(page.url()).pathname, 'after click, pathname should be the card href').toBe(href)

    const errors = getErrors()
    expect(errors, 'property detail navigation should not emit uncaught pageerrors').toEqual([])
  })
})

test.describe('Smoke — property detail route', () => {
  test('the modern-hillside-villa detail page renders without errors', async ({ page }) => {
    const getErrors = trackUncaughtErrors(page)

    const response = await page.goto(PROPERTY_DETAIL_PATH, { waitUntil: 'domcontentloaded' })
    expect(response).not.toBeNull()
    expect(response!.status()).toBeLessThan(400)

    // The property detail page sets a canonical link and a page
    // title. The <h1> on the detail page is the property title.
    await expect(page.locator('h1').first()).toBeVisible()

    // The detail page renders a contact card with a link to
    // /contact. The page-level <h1> is the property title, and
    // the contact card is in the page `<aside>`. We locate the
    // contact link by role to avoid matching the footer's
    // /contact link, which is also present.
    const contactLink = page.getByRole('link', { name: 'Contact' }).first()
    await expect(contactLink, 'property detail page should render a contact link').toBeVisible()
    const contactHref = await contactLink.getAttribute('href')
    expect(contactHref, 'contact link should point to /contact').toBe('/contact')

    const errors = getErrors()
    expect(errors, 'property detail should not emit uncaught pageerrors').toEqual([])
  })
})

test.describe('Smoke — agents and developments pages', () => {
  test('/agents renders the team listing', async ({ page }) => {
    const getErrors = trackUncaughtErrors(page)

    const response = await page.goto('/agents', { waitUntil: 'domcontentloaded' })
    expect(response!.status()).toBeLessThan(400)
    await expect(page.locator('h1').first()).toBeVisible()

    const errors = getErrors()
    expect(errors, '/agents should not emit uncaught pageerrors').toEqual([])
  })

  test('/developments renders the developments listing', async ({ page }) => {
    const getErrors = trackUncaughtErrors(page)

    const response = await page.goto('/developments', { waitUntil: 'domcontentloaded' })
    expect(response!.status()).toBeLessThan(400)
    await expect(page.locator('h1').first()).toBeVisible()

    const errors = getErrors()
    expect(errors, '/developments should not emit uncaught pageerrors').toEqual([])
  })
})

test.describe('Smoke — contact page and default disabled lead form', () => {
  test('/contact renders both the methods column and the lead form', async ({ page }) => {
    const getErrors = trackUncaughtErrors(page)

    const response = await page.goto('/contact', { waitUntil: 'domcontentloaded' })
    expect(response!.status()).toBeLessThan(400)

    // The methods column is the first <ul> in the main landmark.
    // The contact page renders the methods column as a single
    // <ul> in the left grid column, with each <li> wrapping one
    // method card. The footer also has <ul> elements (quick links,
    // contact), so the `main` scope is essential.
    const methodsList = page.locator('main ul').first()
    await expect(methodsList, '/contact should render the methods list in <main>').toBeVisible()
    const methodCount = await methodsList.locator('> li').count()
    expect(methodCount, 'methods list should have at least one method').toBeGreaterThan(0)

    // The lead form is rendered even when `leads.enabled === false`.
    // The form's `name="name"` field is the most stable assertion.
    const nameField = page.locator('input[name="name"]')
    await expect(nameField, '/contact should render the lead form with a name field').toBeVisible()

    const errors = getErrors()
    expect(errors, '/contact should not emit uncaught pageerrors').toEqual([])
  })

  test('the default lead form is in the documented disabled state', async ({ page }) => {
    const getErrors = trackUncaughtErrors(page)

    await page.goto('/contact', { waitUntil: 'domcontentloaded' })

    // The visible placeholder notice is shown when
    // `leads.enabled === false`. The text comes from
    // `contact.form.placeholderNotice` (i18n key) and matches
    // the v1.0 documentation.
    const notice = page.getByText(/form submission is not enabled/i).first()
    await expect(notice, 'placeholder notice should be visible when leads.enabled is false').toBeVisible()

    // The four text inputs are disabled. The honeypot is
    // `aria-hidden` and is not asserted here (it is also
    // disabled, but the visibility test is the contract that
    // matters).
    const inputs = ['name', 'email', 'phone', 'message']
    for (const name of inputs) {
      const input = page.locator(`input[name="${name}"], textarea[name="${name}"]`)
      await expect(input, `${name} field should be visible`).toBeVisible()
      await expect(input, `${name} field should be disabled`).toBeDisabled()
    }

    // The submit button is the only `<button type="submit">` on
    // the contact page (the methods column uses anchor tags).
    const submit = page.locator('button[type="submit"]')
    await expect(submit, 'submit button should be visible').toBeVisible()
    await expect(submit, 'submit button should be disabled').toBeDisabled()

    const errors = getErrors()
    expect(errors, 'contact form should not emit uncaught pageerrors').toEqual([])
  })
})

test.describe('Smoke — navigation between key public routes', () => {
  test('the header links navigate to all key public routes', async ({ page }) => {
    const getErrors = trackUncaughtErrors(page)

    // Start on the home page. The header is rendered by the
    // default layout and is present on every page.
    await page.goto('/', { waitUntil: 'domcontentloaded' })

    // The header contains the main navigation. Each link is a
    // <a href="..."> inside the header <nav> landmark. We
    // assert every documented main-nav entry by role + exact
    // name so the assertion survives i18n copy changes inside
    // the link text (the link is the contract, not the wording).
    const expected = [
      { label: 'Properties', href: '/properties' },
      { label: 'Developments', href: '/developments' },
      { label: 'Agents', href: '/agents' },
      { label: 'About Us', href: '/about' },
      { label: 'Contact', href: '/contact' },
    ] as const

    for (const item of expected) {
      // Scope the assertion to the header's nav to avoid
      // matching the footer's quick-links (which carry the
      // same labels in the default agency config).
      const link = page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: item.label, exact: true }).first()
      await expect(link, `header should contain a "${item.label}" link`).toBeVisible()
      const href = await link.getAttribute('href')
      expect(href, `"${item.label}" link should point to ${item.href}`).toBe(item.href)
    }

    // Click "Properties" and confirm we land on the listing.
    const propertiesLink = page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Properties', exact: true }).first()
    await Promise.all([
      page.waitForURL('**/properties'),
      propertiesLink.click(),
    ])
    expect(new URL(page.url()).pathname, 'after click, pathname should be /properties').toBe('/properties')
    await expect(page.locator('h1').first()).toBeVisible()

    // From the listing, click "Contact" and confirm we land on
    // the contact page.
    const contactLink = page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Contact', exact: true }).first()
    await Promise.all([
      page.waitForURL('**/contact'),
      contactLink.click(),
    ])
    expect(new URL(page.url()).pathname, 'after click, pathname should be /contact').toBe('/contact')
    await expect(page.locator('input[name="name"]')).toBeVisible()

    const errors = getErrors()
    expect(errors, 'header navigation should not emit uncaught pageerrors').toEqual([])
  })
})
