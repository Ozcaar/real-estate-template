import { computed, watch } from 'vue'
import {
  COLOR_MODE_COOKIE_KEY,
  COLOR_MODE_STORAGE_KEY,
  detectSystemPrefersDark,
  parseColorModePreference,
  readColorModeFromCookie,
  readColorModeFromStorage,
  resolveColorMode,
  type ColorModePreference,
  type ResolvedColorMode,
} from '~/core/utils/color-mode'

/**
 * Color-mode composable.
 *
 * Owns the in-memory color-mode state for the running Nuxt app and
 * keeps three sources in sync:
 *
 *  1. The `<html data-color-mode>` attribute (via `useHead` in
 *     `plugins/color-mode.ts`). The CSS serializer
 *     (`core/utils/theme-to-css-vars.ts`) emits the dark-mode block
 *     on `[data-color-mode='dark']`, so flipping the attribute is
 *     the only DOM mutation needed to swap palettes.
 *  2. The first-party `color-mode` cookie. Read by the anti-FOUC
 *     inline script in `nuxt.config.ts` so the first paint is
 *     already correct; written by `setMode()` so the choice
 *     survives a full reload and is visible to the server.
 *  3. `localStorage` under the `color-mode` key. A synchronous
 *     client-side cache so a future "reset to system" affordance
 *     or a system-preference indicator can read the last explicit
 *     choice without parsing a cookie string.
 *
 * The composable is registered through Nuxt's auto-import
 * (`~/composables`) so every component can call it without an
 * explicit import. The toggle component (`AppThemeToggle.vue`) is
 * the primary consumer; it cycles the preference `light → dark →
 * system → light → …` and never mutates the DOM directly.
 */

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365 // one year

export interface UseColorModeResult {
  /**
   * The user's explicit preference (`'light'`, `'dark'`, or
   * `'system'`). The value the toggle mutates. `null` on the
   * server before the cookie has been read.
   */
  preference: ReturnType<typeof computed<ColorModePreference>>
  /**
   * The resolved mode actually being displayed. Always
   * `'light'` or `'dark'` on the client. The `<html
   * data-color-mode>` attribute is bound to this.
   */
  resolved: ReturnType<typeof computed<ResolvedColorMode>>
  /**
   * `true` when `preference === 'system'`. Useful for a
   * "(following system)" affordance next to the toggle.
   */
  isSystem: ReturnType<typeof computed<boolean>>
  /**
   * Update the user's preference and persist it. Safe to call on
   * the client only; the server-side render always uses the
   * persisted cookie so the SSR markup and the first client
   * paint agree.
   */
  setMode: (next: ColorModePreference) => void
  /**
   * Cycle the preference through `light → dark → system`. The
   * `AppThemeToggle` calls this on every click; the cycle is the
   * documented v1.1.0 M15 contract.
   */
  cycle: () => void
}

export function useColorMode(): UseColorModeResult {
  /**
   * The shared preference. Backed by `useState` so the SSR and
   * client branches read the same value across components and
   * composables. Seeded lazily on the client from the cookie and
   * `localStorage`; seeded to `'system'` on the server so the
   * first render never shows a dark theme the user did not pick.
   */
  const preference = useState<ColorModePreference>('color-mode', () => 'system')

  /**
   * Track the system preference separately so the resolved mode
   * reacts when the user is in `'system'` and the OS theme
   * changes at runtime (e.g. macOS Auto-Dark at sunset). The
   * client plugin sets this on mount and again inside a
   * `matchMedia.addEventListener` callback.
   */
  const systemPrefersDark = useState<boolean | null>('color-mode-system-prefers-dark', () => null)

  if (import.meta.client) {
    // Seed the preference on the client the first time the
    // composable is called. The `if (preference.value === 'system'
    // && !seeded)` guard below prevents re-reading the cookie on
    // every navigation once the user has made an explicit choice.
    seedPreferenceFromBrowser(preference, systemPrefersDark)
  }

  const resolved = computed<ResolvedColorMode>(() =>
    resolveColorMode(preference.value, systemPrefersDark.value ?? undefined),
  )

  const isSystem = computed(() => preference.value === 'system')

  function persist(next: ColorModePreference): void {
    // Cookie: same Site=Lax defaults the i18n cookie uses; the
    // path is `/` so every route sees it. `max-age` matches the
    // i18n locale cookie (one year).
    try {
      document.cookie = `${COLOR_MODE_COOKIE_KEY}=${encodeURIComponent(next)}; Path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`
    } catch {
      // Cookies disabled — the in-memory state still drives the
      // UI; the choice just will not survive a reload.
    }
    try {
      window.localStorage.setItem(COLOR_MODE_STORAGE_KEY, next)
    } catch {
      // `localStorage` disabled (private mode) — same fallback.
    }
  }

  function setMode(next: ColorModePreference): void {
    preference.value = next
    if (import.meta.client) {
      persist(next)
    }
  }

  function cycle(): void {
    const order: ColorModePreference[] = ['light', 'dark', 'system']
    const currentIndex = order.indexOf(preference.value)
    const next = order[(currentIndex + 1) % order.length] ?? 'system'
    setMode(next)
  }

  return {
    preference,
    resolved,
    isSystem,
    setMode,
    cycle,
  }
}

/**
 * One-shot seeder for the client side. Runs at most once per page
 * load (the `seeded` flag lives in module scope) so subsequent
 * composable invocations do not re-read the cookie or re-write
 * the storage key. The user's explicit choice is preserved
 * across navigations by the persistent `useState` value.
 */
let seeded = false
function seedPreferenceFromBrowser(
  preference: ReturnType<typeof useState<ColorModePreference>>,
  systemPrefersDark: ReturnType<typeof useState<boolean | null>>,
): void {
  if (seeded) return
  seeded = true

  // Detect the system preference first so the resolved value is
  // correct even when the user has never visited before.
  const detected = detectSystemPrefersDark() ?? false
  systemPrefersDark.value = detected

  // Read the explicit preference. The cookie is the source of
  // truth (it is what the anti-FOUC script saw); `localStorage`
  // is a backup. If both are absent, stay on `'system'` so the
  // resolved value follows `prefers-color-scheme`.
  const fromCookie = readColorModeFromCookie(document.cookie)
  const fromStorage = readColorModeFromStorage(window.localStorage)
  const resolved = fromCookie !== 'system' ? fromCookie : fromStorage
  preference.value = parseColorModePreference(resolved)

  // Listen for live changes to the system preference while the
  // user is in `'system'` mode. We re-evaluate `systemPrefersDark`
  // so the computed `resolved` re-derives automatically.
  if (typeof window.matchMedia === 'function') {
    try {
      const mql = window.matchMedia('(prefers-color-scheme: dark)')
      const onChange = (event: MediaQueryListEvent) => {
        systemPrefersDark.value = event.matches
      }
      if (typeof mql.addEventListener === 'function') {
        mql.addEventListener('change', onChange)
      } else if (typeof (mql as MediaQueryList & {
        addListener?: (cb: (e: MediaQueryListEvent) => void) => void
      }).addListener === 'function') {
        // Safari < 14 fallback.
        ;(mql as MediaQueryList & {
          addListener: (cb: (e: MediaQueryListEvent) => void) => void
        }).addListener(onChange)
      }
    } catch {
      // The matchMedia API is unavailable; the resolved value
      // stays at the value detected on mount.
    }
  }

  // Keep the DOM attribute in sync from the very first read so a
  // direct `useColorMode()` call from a component (without the
  // plugin having a chance to run) still applies the right value.
  watch(
    () => resolveColorMode(preference.value, systemPrefersDark.value ?? undefined),
    (mode) => {
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-color-mode', mode)
      }
    },
    { immediate: true },
  )
}
