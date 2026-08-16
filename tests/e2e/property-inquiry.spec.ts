import { expect, test } from '@playwright/test'

/**
 * Property inquiry section — Playwright integration tests.
 *
 * The property detail page (`/properties/[slug]`) embeds the
 * `LeadForm` component below the description+sidebar section so
 * users can inquire about the listing. The form is the same
 * component the `/contact` page uses; the difference is the
 * `propertySlug` prop, which carries the slug to the server in the
 * body's `property` block so the server can stamp the delivered
 * lead with a verified `PropertyReference` (see the server-only
 * loader at `server/utils/properties.ts` and the contact endpoint
 * at `server/api/contact.post.ts`).
 *
 * **Why disabled-state tests.** The default agency config
 * (`app/config/agencies/default.agency.ts`) ships with
 * `leads.enabled: false`, so a `pnpm preview` build runs the
 * form in the documented placeholder state. A live submission
 * test would require either flipping the agency flag (a
 * production change) or stubbing the runtime config (not
 * supported by the current Nitro setup). The Vitest unit suite
 * (`server/api/contact.post.test.ts`,
 * `server/services/leads/lead.service.test.ts`, and the new
 * `app/features/leads/schemas/lead.schema.test.ts` cases)
 * already covers the actual submission logic — server-side
 * lookup of the slug, the `PropertyReference` stamping, and
 * the four adapter branches. This Playwright suite focuses on
 * the **integration surface**: the form is wired into the
 * property page, the i18n keys render, the form structure is
 * correct, and the documented disabled state is honored.
 */
const PROPERTY_DETAIL_PATH = '/properties/modern-hillside-villa'

/**
 * Wire a `pageerror` listener to every page so a JavaScript
 * exception that fires during navigation is captured and
 * surfaced at the end of the test as a hard failure. The
 * collected errors are asserted empty before the test ends.
 */
function trackUncaughtErrors(page: import('@playwright/test').Page) {
  const errors: Error[] = []
  page.on('pageerror', (err) => {
    errors.push(err)
  })
  return () => errors
}

test.describe('Property inquiry — page structure', () => {
  test('the property detail page renders the inquiry section heading and description', async ({ page }) => {
    const getErrors = trackUncaughtErrors(page)

    await page.goto(PROPERTY_DETAIL_PATH, { waitUntil: 'domcontentloaded' })

    // The inquiry section heading is documented in
    // `properties.detail.inquiryTitle` (en + es). The default
    // locale is `en`, so we assert the English text. A future
    // i18n change can update this assertion; the heading id
    // (`#inquiry-heading`) is the structural contract.
    const heading = page.locator('#inquiry-heading')
    await expect(heading, 'inquiry section heading should be visible').toBeVisible()
    await expect(heading, 'inquiry section heading should carry the documented English copy').toHaveText(/inquire about this property/i)

    // The description is `properties.detail.inquiryDescription`
    // and interpolates the property title so the user sees
    // which listing they are inquiring about.
    const description = page.getByText(/our team will get back to you with more information about/i).first()
    await expect(description, 'inquiry description should mention the property title').toBeVisible()
    // The property title from the bundled static catalog is
    // "Modern Hillside Villa"; assert the description names it.
    await expect(description, 'inquiry description should name the property').toContainText('Modern Hillside Villa')

    const errors = getErrors()
    expect(errors, 'property detail page should not emit uncaught pageerrors').toEqual([])
  })

  test('the inquiry section renders the LeadForm with the four text inputs', async ({ page }) => {
    const getErrors = trackUncaughtErrors(page)

    await page.goto(PROPERTY_DETAIL_PATH, { waitUntil: 'domcontentloaded' })

    // The form is in the inquiry section, which sits below the
    // description+sidebar section. The form's `name` attributes
    // are the most stable assertion (the labels are i18n-bound).
    // Restrict the locator to the inquiry section by scoping to
    // `<section aria-labelledby="inquiry-heading">` so we do
    // not match any other form on the page (e.g. the contact
    // card sidebar is anchor-only and has no form, but a future
    // task could add one).
    const inquirySection = page.locator('section[aria-labelledby="inquiry-heading"]')
    await expect(inquirySection, 'inquiry section should be rendered').toBeVisible()

    const inputs = ['name', 'email', 'phone', 'message']
    for (const fieldName of inputs) {
      const input = inquirySection.locator(`input[name="${fieldName}"], textarea[name="${fieldName}"]`)
      await expect(input, `${fieldName} field should be visible inside the inquiry section`).toBeVisible()
    }

    // The submit button is the only `<button type="submit">`
    // inside the inquiry section.
    const submit = inquirySection.locator('button[type="submit"]')
    await expect(submit, 'submit button should be visible inside the inquiry section').toBeVisible()

    const errors = getErrors()
    expect(errors, 'property detail page should not emit uncaught pageerrors').toEqual([])
  })
})

test.describe('Property inquiry — default disabled state', () => {
  test('the inquiry form is in the documented disabled state when leads.enabled is false', async ({ page }) => {
    const getErrors = trackUncaughtErrors(page)

    await page.goto(PROPERTY_DETAIL_PATH, { waitUntil: 'domcontentloaded' })

    // The visible placeholder notice is shown when
    // `leads.enabled === false`. The text comes from
    // `contact.form.placeholderNotice` (i18n key) — the same
    // key the `/contact` page uses, since the inquiry form is
    // the same `LeadForm` component.
    const notice = page.getByText(/form submission is not enabled/i).first()
    await expect(notice, 'placeholder notice should be visible in the inquiry section when leads.enabled is false').toBeVisible()

    // Scope to the inquiry section so we do not match other
    // inputs on the page (e.g. a future property filter form).
    const inquirySection = page.locator('section[aria-labelledby="inquiry-heading"]')
    const inputs = ['name', 'email', 'phone', 'message']
    for (const fieldName of inputs) {
      const input = inquirySection.locator(`input[name="${fieldName}"], textarea[name="${fieldName}"]`)
      await expect(input, `${fieldName} field should be visible`).toBeVisible()
      await expect(input, `${fieldName} field should be disabled when leads.enabled is false`).toBeDisabled()
    }

    const submit = inquirySection.locator('button[type="submit"]')
    await expect(submit, 'submit button should be disabled when leads.enabled is false').toBeDisabled()

    const errors = getErrors()
    expect(errors, 'property detail page should not emit uncaught pageerrors').toEqual([])
  })
})

test.describe('Property inquiry — accessibility wiring', () => {
  test('the inquiry section heading is associated with the section via aria-labelledby', async ({ page }) => {
    await page.goto(PROPERTY_DETAIL_PATH, { waitUntil: 'domcontentloaded' })

    // The section uses `aria-labelledby="inquiry-heading"` to
    // point at the heading id. The structural association is
    // the accessibility contract — a future i18n change can
    // swap the heading text without touching the wiring.
    const section = page.locator('section[aria-labelledby="inquiry-heading"]')
    await expect(section, 'inquiry section should be rendered with aria-labelledby').toBeVisible()

    // The heading must carry the `id="inquiry-heading"` so the
    // aria-labelledby reference resolves to a real DOM node.
    const heading = page.locator('#inquiry-heading')
    await expect(heading, 'inquiry heading should carry id="inquiry-heading"').toBeVisible()
  })

  test('the inquiry form labels are associated with their inputs via for/id', async ({ page }) => {
    await page.goto(PROPERTY_DETAIL_PATH, { waitUntil: 'domcontentloaded' })

    // The `LeadForm` component renders each `<label :for="nameId">`
    // with a `useId()`-derived id, and the corresponding input
    // carries the matching `id`. A regression that breaks the
    // for/id pairing would fail this assertion.
    //
    // The form also ships a honeypot label (the `website` field
    // is `aria-hidden` so real users never reach it, but it
    // still carries a `<label for=...>` for screen readers). The
    // structural contract is that EVERY input the user sees has
    // a matching label — we assert each visible input by name
    // (the form's stable contract) and resolve its label.
    const inquirySection = page.locator('section[aria-labelledby="inquiry-heading"]')
    const inputs = ['name', 'email', 'phone', 'message']
    for (const fieldName of inputs) {
      const input = inquirySection.locator(`input[name="${fieldName}"], textarea[name="${fieldName}"]`)
      await expect(input, `${fieldName} field should be visible inside the inquiry section`).toBeAttached()
      const inputId = await input.getAttribute('id')
      expect(inputId, `${fieldName} field should carry an id (the useId() pairing)`).toBeTruthy()
      const matchingLabel = inquirySection.locator(`label[for="${inputId}"]`)
      await expect(matchingLabel, `${fieldName} field's id="${inputId}" should resolve to a real <label for=...>`).toBeAttached()
    }
  })
})
