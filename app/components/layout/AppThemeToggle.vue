<script setup lang="ts">
import { computed } from 'vue'
import { useColorMode } from '~/composables/useColorMode'

/**
 * Theme toggle in the public header.
 *
 * Cycles the user's explicit color-mode preference through the
 * documented v1.1.0 M15 order:
 *
 *   `light → dark → system → light → ...`
 *
 * "System" means "follow the `prefers-color-scheme` media query";
 * the resolved value (the actual `data-color-mode` attribute on
 * `<html>`) is always `'light'` or `'dark'`.
 *
 * Accessibility contract:
 *
 *  - The button is a native `<button type="button">` for keyboard
 *    accessibility (Enter / Space activate it; Tab focuses it).
 *  - `aria-pressed` is INTENTIONALLY NOT USED. The cycle walks
 *    through THREE states (`system` / `light` / `dark`), and
 *    `aria-pressed` is the W3C WAI-ARIA contract for a BINARY
 *    toggle button (pressed / not pressed). A three-state cycle
 *    button is not a binary toggle; using `aria-pressed` here
 *    would tell assistive tech "this is a 2-state switch" and
 *    leak a false binary view of the state.
 *  - The accessible name (`aria-label`) communicates BOTH the
 *    CURRENT preference AND the NEXT action, so a screen-reader
 *    user always knows which mode is active and what the click
 *    will do. For example: "Color mode is light. Switch to dark
 *    mode." The i18n keys `common.themeToggle.{light,dark,
 *    system}ModeAriaLabel` provide the translated strings; the
 *    key is selected by the CURRENT preference (not the next one).
 *  - The `title` attribute (the tooltip for sighted users)
 *    remains the short "Switch to X mode" string so the tooltip
 *    stays concise. The icon names the current preference, so
 *    sighted users get the current state from the icon and the
 *    next action from the tooltip; screen-reader users get both
 *    from the accessible name.
 *
 * The visible UI is unchanged from the documented v1.1.0 M15
 * build — same icon, same tooltip, same data-testid, same
 * data-testid placement in `AppHeader`.
 */
const { preference, cycle } = useColorMode()

/**
 * Map a preference to the NEXT preference in the cycle. The
 * cycle is the documented v1.1.0 M15 contract and is
 * intentionally short (three values) so the toggle is easy to
 * discover.
 */
const nextPreference = computed(() => {
  switch (preference.value) {
    case 'light':
      return 'dark'
    case 'dark':
      return 'system'
    case 'system':
    default:
      return 'light'
  }
})

/**
 * The visible tooltip (`title` attribute). The `common.themeToggle.*`
 * i18n keys provide the translated strings; the key is selected by
 * the NEXT preference, not the current one, so the tooltip tells
 * the sighted user what the click will do.
 */
const labelKey = computed(() => {
  switch (nextPreference.value) {
    case 'light':
      return 'common.themeToggle.switchToLight'
    case 'dark':
      return 'common.themeToggle.switchToDark'
    case 'system':
    default:
      return 'common.themeToggle.switchToSystem'
  }
})

/**
 * The accessible name (`aria-label`). The key is selected by the
 * CURRENT preference, not the next one, so the string tells the
 * screen-reader user which mode is active AND what the click will
 * do. Each translated string is two sentences:
 *
 *   1. The current preference ("Color mode is light.").
 *   2. The next action ("Switch to dark mode.").
 *
 * This is the documented accessibility contract for a multi-state
 * cycle button.
 */
const ariaLabelKey = computed(() => {
  switch (preference.value) {
    case 'light':
      return 'common.themeToggle.lightModeAriaLabel'
    case 'dark':
      return 'common.themeToggle.darkModeAriaLabel'
    case 'system':
    default:
      return 'common.themeToggle.systemModeAriaLabel'
  }
})

/**
 * Icon choice. Each preference gets a distinct icon so sighted
 * users can recognize the current state at a glance. The icons
 * are from `@nuxt/icon` (MDI), which is already a project
 * dependency; no new dependency is added.
 */
const iconName = computed(() => {
  switch (preference.value) {
    case 'light':
      return 'mdi:weather-sunny'
    case 'dark':
      return 'mdi:weather-night'
    case 'system':
    default:
      return 'mdi:laptop'
  }
})
</script>

<template>
  <button
    type="button"
    class="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-muted)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
    :aria-label="$t(ariaLabelKey)"
    :title="$t(labelKey)"
    data-testid="theme-toggle"
    @click="cycle"
  >
    <BaseIcon :name="iconName" size="sm" />
  </button>
</template>