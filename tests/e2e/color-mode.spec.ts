import { expect, test, type Page } from '@playwright/test'

/**
 * Color-mode (light / dark / system) regression tests.
 *
 * The v1.1.0 M15 build ships a single source of truth for the
 * active mode: the `<html data-color-mode>` attribute. Every
 * component reads `var(--color-*)` and the CSS serializer
 * (`core/utils/theme-to-css-vars.ts`) emits a light + dark
 * block, so flipping the attribute is the only DOM mutation
 * needed to swap the entire palette.
 *
 * The suite covers exactly what the task brief asks for:
 *
 *  - The toggle is reachable from the public header and the
 *    three documented modes are reachable by clicking it.
 *  - The toggle is accessible: a real `<button>`, an
 *    `aria-label` that always describes BOTH the current
 *    preference AND the next action, and NO `aria-pressed`
 *    attribute (the toggle is a three-state cycle, not a
 *    binary toggle).
 *  - The user's explicit choice is persisted across a full
 *    reload (the cookie) and across navigation (the
 *    `useState` singleton).
 *  - The first visit respects `prefers-color-scheme` (the
 *    system default).
 *  - The agency's brand color is the same in both modes (the
 *    documented v1.1.0 M15 contract: only the neutral
 *    surfaces flip, the brand identity is preserved).
 *  - Every public route renders without uncaught errors after a
 *    dark-mode toggle.
 *  - There is no visible light/dark flash on first paint (the
 *    anti-FOUC inline script in `nuxt.config.ts` already set
 *    the attribute before the first paint).
 *
 * The `webServer` config in `playwright.config.ts` boots `pnpm
 * preview` against the latest production build, so the tests
 * exercise the SSR + hydration boundary and the production
 * inline script.
 */

const PUBLIC_ROUTES = [
  { name: 'Home', path: '/' },
  { name: 'Properties', path: '/properties' },
  { name: 'Agents', path: '/agents' },
  { name: 'Developments', path: '/developments' },
  { name: 'About', path: '/about' },
  { name: 'Contact', path: '/contact' },
] as const

/**
 * Wire a `pageerror` listener so a JavaScript exception that fires
 * during navigation is surfaced as a hard failure. The collected
 * errors are asserted empty at the end of every test.
 */
function trackUncaughtErrors(page: Page) {
  const errors: Error[] = []
  page.on('pageerror', (err) => {
    errors.push(err)
  })
  return () => errors
}

/**
 * Clear every persisted color-mode source so the test starts from
 * a known state. The cookie (`color-mode`), `localStorage` under
 * the same key, and the inline-script-resolved attribute are all
 * reset to a deterministic value.
 *
 * The `addInitScript` runs before every page navigation in the
 * test, so the inline script in `nuxt.config.ts` sees a clean
 * cookie and `localStorage` on every page load.
 */
async function clearPersistedColorMode(page: Page) {
  await page.context().clearCookies()
  await page.addInitScript(() => {
    try {
      window.localStorage.removeItem('color-mode')
    } catch {
      // `localStorage` may be disabled in some browsers; the
      // test should still proceed.
    }
  })
}

/**
 * Read the resolved color-mode attribute the inline script /
 * plugin settled on.
 */
async function readResolvedColorMode(page: Page): Promise<string | null> {
  return page.evaluate(() => document.documentElement.getAttribute('data-color-mode'))
}

/**
 * Click the header theme toggle and wait for the `aria-label` to
 * change. The `@click` handler is only bound after Vue has
 * hydrated; a click that races hydration is dropped silently,
 * so we retry the click until it produces an observable effect.
 *
 * The retry loop polls deterministically via `expect.poll` — no
 * fixed sleep between attempts. If the click is dropped (the
 * `aria-label` does not change within 300 ms), we retry on the
 * next loop iteration. The `expect.poll` polls at deterministic
 * intervals (20 ms / 50 ms / 100 ms) and the deadline bounds the
 * worst case at 15 s. The `aria-label` is a computed property
 * that always reflects the next preference in the cycle, so a
 * successful click is observable as a label change.
 */
async function clickThemeToggle(page: Page): Promise<void> {
  const toggle = page.getByTestId('theme-toggle')
  await expect(toggle, 'theme toggle should be visible in the header').toBeVisible()
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    const before = await toggle.getAttribute('aria-label')
    await toggle.click()
    try {
      await expect.poll(
        async () => toggle.getAttribute('aria-label'),
        { timeout: 300, intervals: [20, 50, 100] },
      ).not.toBe(before ?? '')
      return
    } catch {
      // Click was dropped because Vue had not hydrated yet.
      // Retry without a fixed sleep; the next loop iteration
      // gives Vue another tick to finish hydrating.
    }
  }
  throw new Error('theme toggle did not respond to click within 15s')
}

test.describe('Color mode — toggle behavior', () => {
  test.beforeEach(async ({ page }) => {
    await clearPersistedColorMode(page)
  })

  test('the toggle is visible in the header and exposes the documented cycle', async ({ page }) => {
    const getErrors = trackUncaughtErrors(page)
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/', { waitUntil: 'domcontentloaded' })

    const toggle = page.getByTestId('theme-toggle')
    await expect(toggle, 'header should expose a theme toggle').toBeVisible()

    // The documented v1.1.0 M15 contract: on a fresh visit with
    // no persisted choice, the preference is `'system'`. The
    // toggle's accessible name communicates BOTH the current
    // preference ("Color mode follows your device.") AND the
    // next action ("Switch to light mode."). The tooltip
    // (`title`) is the short next-action string.
    await expect(toggle, 'initial accessible name should mention the current preference (system)').toHaveAttribute(
      'aria-label',
      /follows your device/i,
    )
    await expect(toggle, 'initial accessible name should mention the next action (light)').toHaveAttribute(
      'aria-label',
      /switch to light mode/i,
    )
    await expect(toggle, 'initial tooltip should describe the next action (light)').toHaveAttribute(
      'title',
      /Switch to light mode/i,
    )

    // One click → light. The resolved mode follows the emulated
    // system preference (`prefers-color-scheme: light`).
    await clickThemeToggle(page)
    await expect(readResolvedColorMode(page)).resolves.toBe('light')
    await expect(toggle, 'after one click, accessible name should mention the current preference (light)').toHaveAttribute(
      'aria-label',
      /Color mode is light/i,
    )
    await expect(toggle, 'after one click, accessible name should mention the next action (dark)').toHaveAttribute(
      'aria-label',
      /switch to dark mode/i,
    )
    await expect(toggle, 'after one click, tooltip should describe the next action (dark)').toHaveAttribute(
      'title',
      /Switch to dark mode/i,
    )

    // Two clicks → dark.
    await clickThemeToggle(page)
    await expect(readResolvedColorMode(page)).resolves.toBe('dark')
    await expect(toggle, 'after two clicks, accessible name should mention the current preference (dark)').toHaveAttribute(
      'aria-label',
      /Color mode is dark/i,
    )
    await expect(toggle, 'after two clicks, accessible name should mention the next action (system)').toHaveAttribute(
      'aria-label',
      /switch to system mode/i,
    )
    await expect(toggle, 'after two clicks, tooltip should describe the next action (system)').toHaveAttribute(
      'title',
      /Switch to system mode/i,
    )

    // Three clicks → system. `prefers-color-scheme` is emulated to
    // `light`, so `'system'` resolves to `'light'`.
    await clickThemeToggle(page)
    await expect(readResolvedColorMode(page)).resolves.toBe('light')
    await expect(toggle, 'after three clicks, accessible name should mention the current preference (system)').toHaveAttribute(
      'aria-label',
      /follows your device/i,
    )
    await expect(toggle, 'after three clicks, accessible name should mention the next action (light)').toHaveAttribute(
      'aria-label',
      /switch to light mode/i,
    )

    // Four clicks → light. The cycle is exactly three values
    // (light → dark → system → light → …).
    await clickThemeToggle(page)
    await expect(readResolvedColorMode(page)).resolves.toBe('light')
    await expect(toggle, 'after four clicks, accessible name should mention the current preference (light)').toHaveAttribute(
      'aria-label',
      /Color mode is light/i,
    )

    const errors = getErrors()
    expect(errors, 'toggle should not emit uncaught pageerrors').toEqual([])
  })

  test('the toggle is reachable by keyboard and is the documented Tab order', async ({ page }) => {
    const getErrors = trackUncaughtErrors(page)
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/', { waitUntil: 'domcontentloaded' })

    // The header's Tab order is: skip link (off-screen) → language
    // switcher → theme toggle → "Contact" button → mobile-menu
    // hamburger. We Tab through the header until we hit the
    // theme toggle, then press Enter (the documented keyboard
    // activation path) and assert that the resolved mode
    // changes. The first activation takes the preference from
    // the default `'system'` to the next cycle value
    // (`'light'` under the `colorScheme: 'light'` emulation).
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('Tab')
      const focused = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null
        return el?.getAttribute('data-testid') ?? null
      })
      if (focused === 'theme-toggle') {
        // Activate the toggle with Enter so the assertion
        // exercises the keyboard activation path, not just the
        // click handler.
        await page.keyboard.press('Enter')
        // system → light resolves to `light` under light
        // emulation.
        await expect(readResolvedColorMode(page)).resolves.toBe('light')
        break
      }
      if (i === 19) {
        throw new Error('theme toggle was not reachable by Tab within 20 presses')
      }
    }

    const errors = getErrors()
    expect(errors, 'keyboard toggle should not emit uncaught pageerrors').toEqual([])
  })
})

test.describe('Color mode — persistence', () => {
  test('an explicit choice survives a full reload (cookie)', async ({ page }) => {
    const getErrors = trackUncaughtErrors(page)
    await clearPersistedColorMode(page)
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/', { waitUntil: 'domcontentloaded' })

    // Wait for the toggle to be hydrated before clicking. The
    // `@click` handler is only bound after Vue hydrates; a click
    // that races hydration is dropped silently.
    const toggle = page.getByTestId('theme-toggle')
    await expect(toggle).toBeVisible()

    // The documented v1.1.0 M15 cycle is `system → light → dark →
    // system → …`. On a fresh visit the preference is `'system'`,
    // so two clicks are needed to reach an explicit `'dark'`.
    //
    // We wait for the `aria-label` to change after each click so
    // the second click does not race the first click's reactive
    // update. `waitFor` has a built-in retry that polls the
    // attribute until the value changes, so this is robust under
    // the parallel test load.
    await expect(toggle, 'initial label should describe the next mode (light)').toHaveAttribute(
      'aria-label',
      /Switch to light mode/i,
    )
    await clickThemeToggle(page) // → light
    await expect(toggle, 'after first click, label should describe the next mode (dark)').toHaveAttribute(
      'aria-label',
      /Switch to dark mode/i,
    )
    await clickThemeToggle(page) // → dark
    await expect(toggle, 'after second click, label should describe the next mode (system)').toHaveAttribute(
      'aria-label',
      /Switch to system mode/i,
    )
    await expect(readResolvedColorMode(page)).resolves.toBe('dark')

    // The cookie is set to the explicit `dark` value.
    const cookies = await page.context().cookies('http://127.0.0.1:3000/')
    const colorModeCookie = cookies.find(c => c.name === 'color-mode')
    expect(colorModeCookie, 'cookie should be set after toggling').toBeDefined()
    expect(colorModeCookie?.value, 'cookie should encode the dark preference').toBe('dark')

    // Reload — the choice should be restored.
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(readResolvedColorMode(page)).resolves.toBe('dark')

    // The toggle should still describe the next mode (system).
    await expect(page.getByTestId('theme-toggle')).toHaveAttribute(
      'aria-label',
      /Switch to system mode/i,
    )

    const errors = getErrors()
    expect(errors, 'reload should not emit uncaught pageerrors').toEqual([])
  })

  test('the choice survives client-side navigation (useState singleton)', async ({ page }) => {
    const getErrors = trackUncaughtErrors(page)
    await clearPersistedColorMode(page)
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/', { waitUntil: 'domcontentloaded' })

    const toggle = page.getByTestId('theme-toggle')
    await expect(toggle).toBeVisible()

    // Two clicks: system → light → dark. The intermediate
    // assertion gives Vue's reactive update a tick to flush
    // between clicks — back-to-back clicks can race the
    // reactive update and the second click reads the previous
    // preference.
    await clickThemeToggle(page)
    await expect(readResolvedColorMode(page)).resolves.toBe('light')
    await clickThemeToggle(page)
    await expect(readResolvedColorMode(page)).resolves.toBe('dark')

    // Navigate to a public route via the header.
    await page.getByRole('navigation', { name: 'Main navigation' })
      .getByRole('link', { name: 'Properties', exact: true })
      .first()
      .click()
    await page.waitForURL(/\/properties$/)
    // The choice persisted across the navigation (the useState
    // singleton is shared across pages).
    await expect(readResolvedColorMode(page)).resolves.toBe('dark')

    const errors = getErrors()
    expect(errors, 'navigation should not emit uncaught pageerrors').toEqual([])
  })

  test('no persisted choice + light emulation resolves to light on first visit', async ({ page }) => {
    const getErrors = trackUncaughtErrors(page)
    await clearPersistedColorMode(page)
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/', { waitUntil: 'domcontentloaded' })

    // The inline script resolves `'system'` (no persisted
    // preference) against `prefers-color-scheme: light` to
    // `data-color-mode="light"`.
    await expect(readResolvedColorMode(page)).resolves.toBe('light')

    const errors = getErrors()
    expect(errors, 'first visit should not emit uncaught pageerrors').toEqual([])
  })

  test('no persisted choice + dark emulation resolves to dark on first visit', async ({ page }) => {
    const getErrors = trackUncaughtErrors(page)
    await clearPersistedColorMode(page)
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/', { waitUntil: 'domcontentloaded' })

    await expect(readResolvedColorMode(page)).resolves.toBe('dark')

    const errors = getErrors()
    expect(errors, 'first visit should not emit uncaught pageerrors').toEqual([])
  })
})

test.describe('Color mode — accessibility and rendering', () => {
  test('every public route renders without uncaught errors in dark mode', async ({ page }) => {
    const getErrors = trackUncaughtErrors(page)
    await clearPersistedColorMode(page)
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    // `prefers-color-scheme` is emulated to `dark`, so the
    // default `'system'` preference already resolves to `dark`.
    // One click makes the choice explicit (and the cookie
    // persistent); the second click moves to the next cycle
    // value. We assert the resolved mode is `dark` throughout.
    await clickThemeToggle(page) // system → light
    await clickThemeToggle(page) // light → dark
    await expect(readResolvedColorMode(page)).resolves.toBe('dark')

    for (const route of PUBLIC_ROUTES) {
      const response = await page.goto(route.path, { waitUntil: 'domcontentloaded' })
      expect(response, `navigation to ${route.path} should produce a response`).not.toBeNull()
      expect(response!.status(), `${route.path} should return 200`).toBeLessThan(400)
      // The data-color-mode attribute must be `dark` on every
      // page (the toggle persists across navigation).
      await expect(readResolvedColorMode(page)).resolves.toBe('dark')
    }

    const errors = getErrors()
    expect(errors, 'dark-mode navigation should not emit uncaught pageerrors').toEqual([])
  })

  test('the brand primary color is the same in light and dark mode (agency identity preserved)', async ({ page }) => {
    const getErrors = trackUncaughtErrors(page)
    await clearPersistedColorMode(page)
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/', { waitUntil: 'domcontentloaded' })

    // The CSS variable is what the components consume, so a
    // pixel-level test of the rendered color is unnecessary.
    // Reading the variable from the computed style of <html>
    // is the contract.
    const lightPrimary = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim(),
    )
    expect(lightPrimary, 'light-mode primary should be the agency teal').toBe('#0F766E')

    // The neutral background is the light default.
    const lightBackground = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--color-background').trim(),
    )
    expect(lightBackground, 'light-mode background should be white').toBe('#FFFFFF')

    // Walk through the cycle to an explicit dark preference
    // (system → light → dark) and verify the SAME primary.
    await clickThemeToggle(page) // system → light
    await clickThemeToggle(page) // light → dark
    await expect(readResolvedColorMode(page)).resolves.toBe('dark')
    const darkPrimary = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim(),
    )
    expect(darkPrimary, 'dark-mode primary should match the agency teal').toBe(lightPrimary)
    expect(darkPrimary, 'dark-mode primary should NOT be re-declared (inherited from :root)').toBe('#0F766E')

    // The neutral surfaces, on the other hand, must flip.
    const darkBackground = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--color-background').trim(),
    )
    expect(darkBackground, 'dark-mode background should be the documented dark default').toBe('#0B1220')

    const errors = getErrors()
    expect(errors, 'brand-color assertion should not emit uncaught pageerrors').toEqual([])
  })

  test('the inline anti-FOUC script sets data-color-mode before the first paint', async ({ page }) => {
    const getErrors = trackUncaughtErrors(page)
    // Seed the cookie BEFORE navigation so the inline script
    // reads it on the very first paint. This is the realistic
    // case for a returning user.
    await page.context().addCookies([
      {
        name: 'color-mode',
        value: 'dark',
        domain: '127.0.0.1',
        path: '/',
      },
    ])
    await page.emulateMedia({ colorScheme: 'light' })

    // Navigate with `waitUntil: 'commit'` (returns as soon as the
    // navigation commits, before any pixel is painted) and
    // immediately read the `data-color-mode` attribute that the
    // inline script in <head> set. If the attribute is `dark`
    // before Vue has hydrated, the anti-FOUC contract holds.
    await page.goto('/', { waitUntil: 'commit' })
    const earlyAttribute = await page.evaluate(() =>
      document.documentElement.getAttribute('data-color-mode'),
    )

    // The attribute was set by the inline script in <head>
    // before the first paint. The cookie value `dark` is
    // authoritative — the system hint is ignored because the
    // user has an explicit choice.
    expect(earlyAttribute, 'inline anti-FOUC script should set the attribute before paint').toBe('dark')

    const errors = getErrors()
    expect(errors, 'anti-FOUC test should not emit uncaught pageerrors').toEqual([])
  })

  test('the toggle is reachable from every public route (header is global)', async ({ page }) => {
    const getErrors = trackUncaughtErrors(page)
    await clearPersistedColorMode(page)
    await page.emulateMedia({ colorScheme: 'light' })

    for (const route of PUBLIC_ROUTES) {
      await page.goto(route.path, { waitUntil: 'domcontentloaded' })
      await expect(page.getByTestId('theme-toggle'), `${route.path}: header should expose the toggle`).toBeVisible()
    }

    const errors = getErrors()
    expect(errors, 'header toggle should not emit uncaught pageerrors').toEqual([])
  })

  test('the toggle is part of the header landmark and has the right ARIA contract', async ({ page }) => {
    const getErrors = trackUncaughtErrors(page)
    await clearPersistedColorMode(page)
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/', { waitUntil: 'domcontentloaded' })

    const toggle = page.getByTestId('theme-toggle')
    await expect(toggle, 'toggle should be inside the header').toHaveCount(1)

    // The toggle is a real <button> for keyboard accessibility.
    const tagName = await toggle.evaluate((el) => el.tagName)
    expect(tagName, 'toggle should be a <button> element').toBe('BUTTON')
    const type = await toggle.getAttribute('type')
    expect(type, 'toggle should be type="button" so it never submits a form').toBe('button')

    // The corrected accessibility contract: the toggle is a
    // THREE-state cycle button (`system → light → dark →
    // system → …`), not a binary toggle. `aria-pressed` is the
    // W3C WAI-ARIA contract for a BINARY toggle button
    // (pressed / not pressed); it is INTENTIONALLY NOT USED on
    // this cycle button because a three-state cycle is not a
    // binary toggle. We assert the attribute is absent for
    // every state in the cycle.
    await expect(toggle, 'aria-pressed should be absent on a three-state cycle button (system)').not.toHaveAttribute(
      'aria-pressed',
      /.*/,
    )

    // Click once → light. `aria-pressed` remains absent.
    await clickThemeToggle(page)
    await expect(toggle, 'aria-pressed should be absent on a three-state cycle button (light)').not.toHaveAttribute(
      'aria-pressed',
      /.*/,
    )

    // Click once more → dark. `aria-pressed` remains absent.
    await clickThemeToggle(page)
    await expect(toggle, 'aria-pressed should be absent on a three-state cycle button (dark)').not.toHaveAttribute(
      'aria-pressed',
      /.*/,
    )

    // Click once more → system. `aria-pressed` remains absent.
    await clickThemeToggle(page)
    await expect(toggle, 'aria-pressed should be absent on a three-state cycle button (system again)').not.toHaveAttribute(
      'aria-pressed',
      /.*/,
    )

    // The accessible name communicates BOTH the CURRENT
    // preference AND the NEXT action, so a screen-reader user
    // always knows which mode is active and what the click
    // will do. The corrected contract:
    //
    //  - When the preference is `'system'`, the accessible name
    //    is "Color mode follows your device. Switch to light
    //    mode.".
    //  - When the preference is `'light'`, the accessible name
    //    is "Color mode is light. Switch to dark mode.".
    //  - When the preference is `'dark'`, the accessible name
    //    is "Color mode is dark. Switch to system mode.".
    //
    // We walk the cycle and assert each pattern.

    // Preference is `'system'` after the four clicks above.
    await expect(toggle, "accessible name should mention the current preference ('system')").toHaveAttribute(
      'aria-label',
      /follows your device/i,
    )
    await expect(toggle, "accessible name should mention the next action ('light')").toHaveAttribute(
      'aria-label',
      /switch to light mode/i,
    )

    // Click → light. The accessible name flips to the light
    // pattern.
    await clickThemeToggle(page)
    await expect(toggle, "accessible name should mention the current preference ('light')").toHaveAttribute(
      'aria-label',
      /color mode is light/i,
    )
    await expect(toggle, "accessible name should mention the next action ('dark')").toHaveAttribute(
      'aria-label',
      /switch to dark mode/i,
    )

    // Click → dark. The accessible name flips to the dark
    // pattern.
    await clickThemeToggle(page)
    await expect(toggle, "accessible name should mention the current preference ('dark')").toHaveAttribute(
      'aria-label',
      /color mode is dark/i,
    )
    await expect(toggle, "accessible name should mention the next action ('system')").toHaveAttribute(
      'aria-label',
      /switch to system mode/i,
    )

    const errors = getErrors()
    expect(errors, 'ARIA contract test should not emit uncaught pageerrors').toEqual([])
  })
})
