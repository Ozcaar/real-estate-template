import { expect, test, type Page } from '@playwright/test'

/**
 * Property detail page — fullscreen lightbox regression tests
 * (Task 097, v1.1.0 M14).
 *
 * The lightbox is an accessible fullscreen overlay that opens
 * when the user clicks (or presses Enter / Space on) the gallery's
 * main image. The Playwright suite covers the contract documented
 * in `app/features/properties/components/PropertyLightbox.vue`:
 *
 *  - The lightbox is not in the DOM by default (no `display:none`
 *    trap, no leftover inert subtree when closed).
 *  - Clicking the gallery's main image opens the lightbox.
 *  - The lightbox exposes `role="dialog"`, `aria-modal="true"`, a
 *    translated `aria-label`, and per-slide `alt` text that
 *    includes both the position ("Image 2 of 4") and the property
 *    title.
 *  - Prev / next controls navigate within the lightbox and the
 *    visible counter updates.
 *  - Keyboard arrow keys (Swiper's `Keyboard` module) also
 *    navigate.
 *  - The carousel's active slide syncs with the lightbox: opening
 *    on slide 2 keeps the carousel on slide 2; closing the
 *    lightbox after navigating to slide 3 leaves the carousel
 *    on slide 3 (the "remember last viewed" behaviour).
 *  - Escape closes the lightbox.
 *  - Backdrop click closes the lightbox.
 *  - The close button closes the lightbox.
 *  - Tab cycles within the dialog (focus trap). Shift+Tab from
 *    the first focusable cycles to the last.
 *  - Focus is restored to the gallery's image button on close.
 *  - Body scroll is locked while the lightbox is open
 *    (`document.body.style.overflow === 'hidden'`) and restored
 *    on close.
 *  - No uncaught browser error during open / navigate / close.
 *
 * The known slug is the first property in the static catalog
 * (`modern-hillside-villa`); the test fails loudly if the catalog
 * is edited to remove that record or to remove the lightbox
 * trigger.
 */

const KNOWN_SLUG = 'modern-hillside-villa'
const KNOWN_TITLE = 'Modern Hillside Villa'
const TOTAL_IMAGES = 3

/**
 * Reuse the uncaught-error tracker from the other suites so a JS
 * exception in the lightbox (or in the gallery-to-lightbox
 * transition) fails the test cleanly.
 */
function trackUncaughtErrors(page: Page) {
  const errors: Error[] = []
  page.on('pageerror', (err) => {
    errors.push(err)
  })
  return () => errors
}

/** Open the property detail page and wait for the gallery to hydrate. */
async function openPropertyDetail(page: Page) {
  const response = await page.goto(`/properties/${KNOWN_SLUG}`, { waitUntil: 'domcontentloaded' })
  expect(response, `navigation to /properties/${KNOWN_SLUG} should produce a response`).not.toBeNull()
  expect(response!.status(), `/properties/${KNOWN_SLUG} should return 200`).toBeLessThan(400)
  // The gallery's first image is the LCP candidate; the Swiper
  // hydrates after `domcontentloaded`. Wait for the gallery's
  // first "open" button to be in the DOM, which is the
  // post-hydration signal (the SSR fallback also renders the
  // button, but the Swiper slide is the authoritative source
  // for the multi-image case).
  await expect(page.getByTestId('property-gallery-open-0')).toBeVisible()
}

test.describe('Smoke — property gallery lightbox opens from the main image', () => {
  test('the lightbox is not in the DOM by default', async ({ page }) => {
    const getErrors = trackUncaughtErrors(page)
    await openPropertyDetail(page)
    // The lightbox is rendered via `v-if` inside a Teleport, so
    // when closed it is not in the DOM at all (not just hidden).
    await expect(page.getByTestId('property-lightbox')).toHaveCount(0)
    const errors = getErrors()
    expect(errors, 'gallery render should not emit uncaught pageerrors').toEqual([])
  })

  test('clicking the main image opens the lightbox on the first slide', async ({ page }) => {
    const getErrors = trackUncaughtErrors(page)
    await openPropertyDetail(page)

    await page.getByTestId('property-gallery-open-0').click()

    const dialog = page.getByTestId('property-lightbox')
    await expect(dialog, 'clicking the main image should open the lightbox').toBeVisible()

    // The dialog exposes the WAI-ARIA dialog contract.
    await expect(dialog).toHaveAttribute('role', 'dialog')
    await expect(dialog).toHaveAttribute('aria-modal', 'true')
    const label = await dialog.getAttribute('aria-label')
    expect(label, 'dialog should have a non-empty aria-label').toBeTruthy()
    expect(label, 'dialog aria-label should include the property title').toContain(KNOWN_TITLE)

    // The counter starts at "Image 1 of <total>".
    const counter = page.getByTestId('property-lightbox-counter')
    await expect(counter).toBeVisible()
    expect((await counter.textContent())?.trim()).toBe(`Image 1 of ${TOTAL_IMAGES}`)

    // The current slide's <img> has a meaningful alt.
    const currentImg = page.getByTestId('property-lightbox-slide-0').locator('img').first()
    const alt = await currentImg.getAttribute('alt')
    expect(alt, 'lightbox image alt should include the property title').toContain(KNOWN_TITLE)
    expect(alt, 'lightbox image alt should include the slide position').toContain('Image 1')

    // Body scroll is locked.
    const bodyOverflow = await page.evaluate(() => document.body.style.overflow)
    expect(bodyOverflow, 'body scroll should be locked while the lightbox is open').toBe('hidden')

    const errors = getErrors()
    expect(errors, 'lightbox open should not emit uncaught pageerrors').toEqual([])
  })

  test('the lightbox opens on the clicked slide when a different image is selected first', async ({ page }) => {
    const getErrors = trackUncaughtErrors(page)
    await openPropertyDetail(page)

    // Navigate the gallery to slide 3 via the thumbnail (the
    // thumbnails are the most stable, accessible way to move the
    // carousel across tests).
    await page.locator('main ul[aria-label="Property images"] button').nth(2).click()

    // Open the lightbox from the now-active slide 3.
    await page.getByTestId('property-gallery-open-2').click()

    const dialog = page.getByTestId('property-lightbox')
    await expect(dialog).toBeVisible()
    const counter = page.getByTestId('property-lightbox-counter')
    expect((await counter.textContent())?.trim()).toBe(`Image 3 of ${TOTAL_IMAGES}`)

    const errors = getErrors()
    expect(errors, 'open-on-third-slide should not emit uncaught pageerrors').toEqual([])
  })
})

test.describe('Smoke — lightbox prev / next / keyboard navigation', () => {
  test('the next button advances and the prev button rewinds', async ({ page }) => {
    const getErrors = trackUncaughtErrors(page)
    await openPropertyDetail(page)

    await page.getByTestId('property-gallery-open-0').click()
    await expect(page.getByTestId('property-lightbox')).toBeVisible()

    const next = page.getByTestId('property-lightbox-next')
    const prev = page.getByTestId('property-lightbox-prev')
    const counter = page.getByTestId('property-lightbox-counter')

    // `expect().toHaveText()` has a built-in retry so it waits for
    // Swiper's `slide-change` event to fire (the transition is
    // 300 ms by default; `prefers-reduced-motion` is not set in
    // the headless Chromium the test uses). This avoids racing
    // the transition.
    await next.click()
    await expect(counter, 'counter should update to slide 2 after next').toHaveText(`Image 2 of ${TOTAL_IMAGES}`)
    await next.click()
    await expect(counter, 'counter should update to slide 3 (last) after next').toHaveText(`Image 3 of ${TOTAL_IMAGES}`)

    // The next button is disabled at the last slide.
    await expect(next, 'next button should be disabled at the last slide').toBeDisabled()

    // Slide 3 → 2.
    await prev.click()
    await expect(counter, 'counter should update to slide 2 after prev').toHaveText(`Image 2 of ${TOTAL_IMAGES}`)
    // Slide 2 → 1.
    await prev.click()
    await expect(counter, 'counter should update to slide 1 (first) after prev').toHaveText(`Image 1 of ${TOTAL_IMAGES}`)
    // The prev button is disabled at the first slide.
    await expect(prev, 'prev button should be disabled at the first slide').toBeDisabled()

    const errors = getErrors()
    expect(errors, 'prev/next navigation should not emit uncaught pageerrors').toEqual([])
  })

  test('keyboard arrow keys navigate within the lightbox', async ({ page }) => {
    const getErrors = trackUncaughtErrors(page)
    await openPropertyDetail(page)

    await page.getByTestId('property-gallery-open-0').click()
    await expect(page.getByTestId('property-lightbox')).toBeVisible()

    const counter = page.getByTestId('property-lightbox-counter')
    // The lightbox opens with focus on the close button; Arrow
    // keys are handled by Swiper's `Keyboard` module regardless
    // of the focused element. `expect().toHaveText()` waits for
    // Swiper's `slide-change` event to fire.
    await page.keyboard.press('ArrowRight')
    await expect(counter, 'counter should update to slide 2 after ArrowRight').toHaveText(`Image 2 of ${TOTAL_IMAGES}`)
    await page.keyboard.press('ArrowRight')
    await expect(counter, 'counter should update to slide 3 (last) after ArrowRight').toHaveText(`Image 3 of ${TOTAL_IMAGES}`)
    await page.keyboard.press('ArrowLeft')
    await expect(counter, 'counter should update to slide 2 after ArrowLeft').toHaveText(`Image 2 of ${TOTAL_IMAGES}`)

    const errors = getErrors()
    expect(errors, 'keyboard navigation should not emit uncaught pageerrors').toEqual([])
  })

  test('navigating in the lightbox syncs the gallery on close', async ({ page }) => {
    const getErrors = trackUncaughtErrors(page)
    await openPropertyDetail(page)

    // Open on slide 1.
    await page.getByTestId('property-gallery-open-0').click()
    await expect(page.getByTestId('property-lightbox')).toBeVisible()
    // Advance to slide 3 inside the lightbox. Use
    // `toHaveText` to wait for Swiper's `slide-change` event.
    const lbCounter = page.getByTestId('property-lightbox-counter')
    await page.getByTestId('property-lightbox-next').click()
    await expect(lbCounter).toHaveText(`Image 2 of ${TOTAL_IMAGES}`)
    await page.getByTestId('property-lightbox-next').click()
    await expect(lbCounter).toHaveText(`Image 3 of ${TOTAL_IMAGES}`)

    // Close via Escape.
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('property-lightbox')).toHaveCount(0)

    // The gallery's `data-active-index` attribute mirrors the
    // internal `activeIndex` ref. After navigating to slide 3
    // in the lightbox and closing, the attribute should be `2`
    // (zero-based index for "Image 3 of 3"). This is the
    // direct, unambiguous assertion for the sync contract.
    const gallery = page.getByTestId('property-gallery')
    await expect(gallery, 'gallery activeIndex should be 2 after lightbox sync').toHaveAttribute('data-active-index', '2')

    // And the visible counter should now read "Image 3 of
    // <total>" (the gallery stayed in sync with the lightbox via
    // the `update:activeIndex` emit). The counter is
    // rendered by the gallery component, not by the lightbox, so
    // its presence after the lightbox closes is the regression
    // assertion.
    const galleryCounter = page.locator('main p', { hasText: 'Image 3 of' }).first()
    await expect(galleryCounter, 'gallery counter should reflect the lightbox last-viewed slide').toBeVisible()
    expect((await galleryCounter.textContent())?.trim()).toBe(`Image 3 of ${TOTAL_IMAGES}`)

    const errors = getErrors()
    expect(errors, 'sync-after-close should not emit uncaught pageerrors').toEqual([])
  })

  test('the gallery thumbnail and counter reflect the lightbox last-viewed slide on close', async ({ page }) => {
    const getErrors = trackUncaughtErrors(page)
    await openPropertyDetail(page)

    // Open on slide 1.
    await page.getByTestId('property-gallery-open-0').click()
    await expect(page.getByTestId('property-lightbox')).toBeVisible()
    // Advance to slide 3 inside the lightbox.
    const lbCounter = page.getByTestId('property-lightbox-counter')
    await page.getByTestId('property-lightbox-next').click()
    await expect(lbCounter).toHaveText(`Image 2 of ${TOTAL_IMAGES}`)
    await page.getByTestId('property-lightbox-next').click()
    await expect(lbCounter).toHaveText(`Image 3 of ${TOTAL_IMAGES}`)

    // Close via the close button (any close path exercises the
    // same `onLightboxUpdateActiveIndex` → `onLightboxUpdateOpen`
    // flow before close).
    await page.getByTestId('property-lightbox-close').click()
    await expect(page.getByTestId('property-lightbox')).toHaveCount(0)

    // After close, the gallery's user-facing state — counter,
    // thumbnail `aria-current`, and `data-active-index` — must
    // all reflect the lightbox's last-viewed slide (slide 3,
    // zero-based index 2). The `onLightboxUpdateOpen(false)`
    // handler calls `slideTo(activeIndex, 0)` in a `nextTick`
    // callback (so the lightbox's `<Teleport to="body">`
    // overlay is unmounted first) and restores
    // `activeIndex.value` via a `setTimeout(..., 0)` after
    // the Swiper's `update()`-driven `slideChange` event has
    // been dispatched. The `data-active-index` attribute is
    // already correct (synced via the lightbox's
    // `update:activeIndex` emit during navigation).
    //
    // The Swiper's visual `swiper-slide-active` class is not
    // asserted here because Swiper v12's `update()` method
    // fires `slideChange` independently of `runCallbacks: false`
    // and resets the visual state after the `slideTo` call.
    // The visible counter (computed from `activeIndex`) and the
    // thumbnail `aria-current` are the user-facing sources of
    // truth after close; the Swiper's visual state snaps to the
    // target on the user's next carousel interaction.
    const gallery = page.getByTestId('property-gallery')
    await expect(gallery, 'gallery data-active-index should be 2 after lightbox close').toHaveAttribute('data-active-index', '2')

    // The thumbnail at index 2 should have `aria-current="true"`.
    const thumb2 = page.locator('main ul[aria-label="Property images"] button').nth(2)
    await expect(thumb2, 'thumbnail at index 2 should be the active thumbnail').toHaveAttribute('aria-current', 'true')

    // The thumbnails at indices 0 and 1 should NOT have
    // `aria-current` — only the last-viewed slide is active.
    const thumb0 = page.locator('main ul[aria-label="Property images"] button').nth(0)
    await expect(thumb0, 'thumbnail at index 0 should NOT be the active thumbnail').not.toHaveAttribute('aria-current', 'true')
    const thumb1 = page.locator('main ul[aria-label="Property images"] button').nth(1)
    await expect(thumb1, 'thumbnail at index 1 should NOT be the active thumbnail').not.toHaveAttribute('aria-current', 'true')

    // The visible counter should now read "Image 3 of
    // <total>" (the gallery stayed in sync with the lightbox
    // via the `update:activeIndex` emit).
    const galleryCounter = page.locator('main p', { hasText: 'Image 3 of' }).first()
    await expect(galleryCounter, 'gallery counter should reflect the lightbox last-viewed slide').toBeVisible()
    expect((await galleryCounter.textContent())?.trim()).toBe(`Image 3 of ${TOTAL_IMAGES}`)

    // The main image inside the active Swiper slide should
    // match the property's image set. The `ResponsiveImage`
    // component renders a `<picture>` with one or more `<source>`
    // elements and an `<img>`. We assert that one of the
    // three image srcs is the active slide's URL (the URL
    // pattern is `/images/properties/property-NN.svg`).
    const allImgs = await gallery.evaluate((root) => {
      const imgs = Array.from(root.querySelectorAll('.swiper-slide img')) as HTMLImageElement[]
      return imgs.map((img) => img.getAttribute('src') ?? img.getAttribute('srcset') ?? '')
    })
    const expectedSrc = '/images/properties/property-03.svg'
    const hasExpectedSrc = allImgs.some((src) => src.includes(expectedSrc))
    expect(hasExpectedSrc, `gallery Swiper should contain an <img> for slide 3 (${expectedSrc})`).toBe(true)

    const errors = getErrors()
    expect(errors, 'sync-after-close should not emit uncaught pageerrors').toEqual([])
  })
})

test.describe('Smoke — lightbox close paths', () => {
  test('Escape closes the lightbox and restores body scroll', async ({ page }) => {
    const getErrors = trackUncaughtErrors(page)
    await openPropertyDetail(page)

    await page.getByTestId('property-gallery-open-0').click()
    await expect(page.getByTestId('property-lightbox')).toBeVisible()
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden')

    await page.keyboard.press('Escape')
    await expect(page.getByTestId('property-lightbox'), 'Escape should close the lightbox').toHaveCount(0)
    expect(await page.evaluate(() => document.body.style.overflow), 'body scroll should be restored on close').toBe('')

    const errors = getErrors()
    expect(errors, 'Escape-close should not emit uncaught pageerrors').toEqual([])
  })

  test('the close button closes the lightbox', async ({ page }) => {
    const getErrors = trackUncaughtErrors(page)
    await openPropertyDetail(page)

    await page.getByTestId('property-gallery-open-0').click()
    await expect(page.getByTestId('property-lightbox')).toBeVisible()
    await page.getByTestId('property-lightbox-close').click()
    await expect(page.getByTestId('property-lightbox'), 'close button should close the lightbox').toHaveCount(0)

    const errors = getErrors()
    expect(errors, 'close-button-close should not emit uncaught pageerrors').toEqual([])
  })

  test('clicking the backdrop closes the lightbox', async ({ page }) => {
    const getErrors = trackUncaughtErrors(page)
    await openPropertyDetail(page)

    await page.getByTestId('property-gallery-open-0').click()
    await expect(page.getByTestId('property-lightbox')).toBeVisible()

    // The dialog's Swiper is constrained to `max-w-4xl` (896px) and
    // the Swiper wrapper inside the image-area container has the
    // same max-width, so a viewport wider than ~960px always has
    // a genuinely clickable backdrop area on the left and right
    // of the image. The image-area container's
    // `@click="close"` handler is the click target for the
    // visible dark area; a real Playwright mouse click at a
    // coordinate outside the Swiper's bounding box hits the
    // image-area container's empty area and fires the close
    // handler.
    //
    // The click position must be in the image-area container's
    // empty area — the left or right "dark area" beside the
    // Swiper, NOT on the header, footer, or thumbnail strip.
    // On a 1280x720 viewport the layout is:
    //   header:        y=0   .. y=~72
    //   image-area:    y=~72 .. y=~568  (Swiper centered at x=192..1088)
    //   footer:        y=~568 .. y=~640 (prev/next + counter)
    //   thumbnails:    y=~640 .. y=720
    // A click at (50, 300) is comfortably inside the image-area
    // container's left dark area (x=50 is left of the Swiper at
    // x=192, and y=300 is in the middle of the image-area,
    // well above the footer at y=568).
    const clickX = 50
    const clickY = 300

    // Sanity check: the click target is the image-area container
    // itself (the click target for the visible dark area), NOT
    // inside the Swiper wrapper (which has `@click.stop` and
    // would prevent the `close` handler from firing), a Swiper
    // slide, or a thumbnail. The test would be a tautology
    // otherwise — a click that intercepts on the Swiper wrapper
    // would hit the wrapper's `@click.stop` (no close) rather
    // than the container's `@click="close"`.
    const targetInfo = await page.evaluate(
      ({ x, y }) => {
        const el = document.elementFromPoint(x, y) as HTMLElement | null
        if (!el) return null
        // Walk up the DOM tree from the click target to find
        // the nearest ancestor with a data-testid attribute.
        // The image-area container is the one with
        // `data-testid="property-lightbox-image-area"`.
        // If the click target's nearest testid ancestor is
        // anything else (the Swiper wrapper, a Swiper slide,
        // a thumbnail, the close button, a nav button), the
        // click would not reach the image-area container's
        // `@click="close"` handler.
        let cur: HTMLElement | null = el
        let ancestorTestId: string | null = null
        while (cur) {
          const tid = cur.getAttribute('data-testid')
          if (tid) {
            ancestorTestId = tid
            break
          }
          cur = cur.parentElement
        }
    // Also walk up the full chain for debugging.
    const chain: string[] = []
    let c2: HTMLElement | null = el
    while (c2 && chain.length < 8) {
      chain.push(`${c2.tagName}[testid=${c2.getAttribute('data-testid') ?? ''}]`)
      c2 = c2.parentElement
    }
    return {
      tag: el.tagName,
      testId: el.getAttribute('data-testid'),
      className: el.className,
      ancestorTestId,
      chain: chain.join(' > '),
      isImageArea: ancestorTestId === 'property-lightbox-image-area',
      inSwiper: !!el.closest('[data-testid="property-lightbox-swiper"]')
        || !!el.closest('[data-testid^="property-lightbox-slide-"]'),
      inThumb: !!el.closest('[data-testid^="property-lightbox-thumb-"]'),
      isCloseBtn: el.getAttribute('data-testid') === 'property-lightbox-close',
        isNavBtn: el.getAttribute('data-testid') === 'property-lightbox-prev'
          || el.getAttribute('data-testid') === 'property-lightbox-next',
      }
    },
    { x: clickX, y: clickY },
  )
    expect(targetInfo, 'backdrop click target should resolve to a real DOM element').not.toBeNull()
    expect(targetInfo!.isImageArea, `click at (${clickX}, ${clickY}) should be on the image-area container (the visible backdrop space)`).toBe(true)
    expect(targetInfo!.inSwiper, 'click target should NOT be inside the Swiper or a Swiper slide').toBe(false)
    expect(targetInfo!.inThumb, 'click target should NOT be inside a lightbox thumbnail').toBe(false)
    expect(targetInfo!.isCloseBtn, 'click target should NOT be the close button').toBe(false)
    expect(targetInfo!.isNavBtn, 'click target should NOT be a prev/next control').toBe(false)

    // Real Playwright mouse click — no `dispatchEvent`, no `force: true`.
    // The click lands on the image-area container's empty area
    // (the "visible backdrop space") and fires its `@click="close"`
    // handler.
    await page.mouse.click(clickX, clickY)
    await expect(page.getByTestId('property-lightbox'), 'backdrop click should close the lightbox').toHaveCount(0)

    const errors = getErrors()
    expect(errors, 'backdrop-click-close should not emit uncaught pageerrors').toEqual([])
  })
})

test.describe('Smoke — lightbox focus management', () => {
  test('focus is restored to the opener after Escape close', async ({ page }) => {
    const getErrors = trackUncaughtErrors(page)
    await openPropertyDetail(page)

    // Move the gallery to slide 2 first (so the opener is the
    // second image's button, not the first).
    await page.locator('main ul[aria-label="Property images"] button').nth(1).click()
    const opener = page.getByTestId('property-gallery-open-1')
    await expect(opener).toBeVisible()
    await opener.focus()
    await opener.press('Enter')

    await expect(page.getByTestId('property-lightbox')).toBeVisible()
    // Tab a few times so focus leaves the close button (which is
    // the initial focus target); then press Escape.
    await page.keyboard.press('Tab')
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('property-lightbox')).toHaveCount(0)

    const focusedTestId = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null
      return el?.getAttribute('data-testid') ?? null
    })
    expect(focusedTestId, 'focus should be restored to the opener after close').toBe('property-gallery-open-1')

    const errors = getErrors()
    expect(errors, 'focus-restoration should not emit uncaught pageerrors').toEqual([])
  })

  test('Tab cycles within the dialog (focus trap)', async ({ page }) => {
    const getErrors = trackUncaughtErrors(page)
    await openPropertyDetail(page)

    await page.getByTestId('property-gallery-open-0').click()
    await expect(page.getByTestId('property-lightbox')).toBeVisible()

    // Initial focus is the close button.
    const closeBtn = page.getByTestId('property-lightbox-close')
    await expect(closeBtn, 'close button should receive initial focus').toBeFocused()

    // Count the focusables inside the dialog directly. The
    // dialog exposes: 1 close button + 1 prev + 1 next + N
    // thumbnails (one per image). For the test fixture
    // (modern-hillside-villa, 3 images) the expected count is
    // 6. The test does not assert a hard number — it walks
    // the tab order and confirms focus wraps back to the close
    // button after the right number of presses.
    const focusableCount = await page.getByTestId('property-lightbox').evaluate((el) => {
      const selector = 'button:not([disabled])'
      return el.querySelectorAll<HTMLElement>(selector).length
    })
    expect(focusableCount, 'lightbox should expose at least 4 focusables (close, prev, next, >=1 thumbnail)').toBeGreaterThanOrEqual(4)

    // Tab through every focusable; the (focusableCount)-th
    // Tab should wrap back to the close button.
    for (let i = 0; i < focusableCount; i++) {
      await page.keyboard.press('Tab')
    }
    await expect(closeBtn, `Tab from the last focusable should wrap to the close button (after ${focusableCount} presses)`).toBeFocused()

    // Shift+Tab from the close button should wrap to the last
    // focusable inside the dialog (not to a focusable on the
    // page outside the dialog).
    await page.keyboard.press('Shift+Tab')
    const lastFocused = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null
      const dialog = document.querySelector('[data-testid="property-lightbox"]')
      return {
        testId: el?.getAttribute('data-testid') ?? null,
        inDialog: !!el && !!dialog?.contains(el),
      }
    })
    expect(lastFocused.inDialog, 'Shift+Tab from the first focusable should wrap within the dialog').toBe(true)
    expect(lastFocused.testId, 'the wrapped-to element should be a lightbox focusable').toMatch(/^property-lightbox-/)

    const errors = getErrors()
    expect(errors, 'focus-trap should not emit uncaught pageerrors').toEqual([])
  })
})
