import { expect, test, devices, type Page } from '@playwright/test'

/**
 * Mobile-menu accessibility regression tests.
 *
 * The mobile drawer lives in `app/components/layout/AppMobileMenu.vue` and
 * is hidden on `lg+` viewports. These tests use the Pixel 5 device profile
 * so the hamburger button is visible and the drawer is the primary
 * navigation surface.
 *
 * Coverage:
 *  - Opening the drawer moves focus to the close button.
 *  - Closing with Escape restores focus to the opener.
 *  - The layout root is marked `inert` while the drawer is open, so a
 *    keyboard or screen-reader user cannot tab into the background.
 *  - Tabbing inside the drawer never leaves the dialog tree.
 *
 * **Hydration note.** The hamburger button's `@click` handler is only
 * bound after Vue has hydrated. A click that races hydration is dropped
 * silently. The `openMobileMenu` helper below performs a guaranteed
 * click (waiting for hydration, retrying if needed) so the suite is
 * not flaky on the first cold run of the test server.
 */

test.use({ ...devices['Pixel 5'] })

/**
 * Open the mobile drawer and return the dialog locator. Waits for
 * Vue hydration (the `@click` handler is bound after hydration), then
 * clicks the hamburger. Retries the click if the first one was
 * dropped by the hydration race.
 */
async function openMobileMenu(page: Page) {
  const dialog = page.getByRole('dialog', { name: 'Mobile navigation' })
  const opener = page.getByRole('button', { name: 'Open menu' })
  await expect(opener).toBeVisible()
  // First, ensure the page is fully loaded and Vue is hydrated.
  await page.waitForFunction(() => document.readyState === 'complete')
  // The hamburger button's @click handler is bound on hydration.
  // Poll for it: if a click does not open the menu within 1s, the
  // handler was not yet bound — wait and try again.
  for (let attempt = 0; attempt < 5; attempt++) {
    await opener.click()
    try {
      await expect(dialog).toBeVisible({ timeout: 1000 })
      return dialog
    } catch {
      // The click was dropped because Vue had not hydrated yet.
      // Wait briefly and retry.
      await page.waitForTimeout(200)
    }
  }
  // Final attempt: let expect throw a clean error if it still fails.
  await opener.click()
  await expect(dialog).toBeVisible({ timeout: 2000 })
  return dialog
}

test('open → focus moves to close button; Escape → focus restores to the opener', async ({ page }) => {
  await page.goto('/', { waitUntil: 'load' })

  const opener = page.getByRole('button', { name: 'Open menu' })
  await opener.focus()
  const dialog = await openMobileMenu(page)

  const closeButton = dialog.getByRole('button', { name: 'Close menu' })
  await expect(closeButton).toBeFocused()

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(opener).toBeFocused()
})

test('the layout root is inert while the mobile menu is open', async ({ page }) => {
  await page.goto('/', { waitUntil: 'load' })

  const before = await page.evaluate(() =>
    document.querySelector('header')?.parentElement?.hasAttribute('inert') ?? false)
  expect(before, 'inert should not be set before opening the menu').toBe(false)

  await openMobileMenu(page)

  const during = await page.evaluate(() =>
    document.querySelector('header')?.parentElement?.hasAttribute('inert') ?? false)
  expect(during, 'inert should be set on the layout root while the menu is open').toBe(true)

  await page.keyboard.press('Escape')
  const after = await page.evaluate(() =>
    document.querySelector('header')?.parentElement?.hasAttribute('inert') ?? false)
  expect(after, 'inert should be cleared after the menu closes').toBe(false)
})

test('Tab inside the dialog stays inside the dialog', async ({ page }) => {
  await page.goto('/', { waitUntil: 'load' })
  await openMobileMenu(page)

  // The dialog contains the close button + 6 nav links. Tabbing
  // through all of them should never leave the dialog tree.
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('Tab')
    const inside = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null
      return document.querySelector('[role="dialog"]')?.contains(el) ?? false
    })
    expect(inside, `Tab #${i + 1} should keep focus inside the dialog`).toBe(true)
  }
})
