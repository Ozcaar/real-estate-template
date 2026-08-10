/**
 * Color-mode persistence helpers.
 *
 * The user's explicit color-mode choice is persisted in two places so it
 * survives the SSR boundary AND the initial-paint anti-FOUC script:
 *
 *  1. A first-party cookie (`color-mode`). Read by the anti-FOUC
 *     inline script in `nuxt.config.ts` (which runs before Vue
 *     hydrates) so the `<html data-color-mode="...">` attribute is
 *     already correct on the first paint.
 *  2. `localStorage` (`color-mode`). Read by the client plugin and
 *     written alongside the cookie so future enhancements (a system-
 *     preference indicator, a "reset to system" affordance) can read
 *     the user's last explicit choice synchronously without parsing
 *     a cookie string.
 *
 * **No `useState` is used here.** The composable `useColorMode` is
 * the single source of truth for the in-memory value; the helpers
 * in this file are pure DOM reads / writes and are safe to call
 * from the anti-FOUC inline script (the script does not have access
 * to `useState`).
 *
 * The valid values are the three documented v1.1.0 M15 modes:
 * `'light'`, `'dark'`, `'system'`. Any other value (a stale cookie
 * from a future schema, a hand-edited `localStorage` entry, …) is
 * treated as `'system'` by the readers.
 */

export const COLOR_MODE_STORAGE_KEY = 'color-mode'
export const COLOR_MODE_COOKIE_KEY = 'color-mode'

/**
 * The three valid color-mode values. `'system'` means "follow
 * `prefers-color-scheme`"; the other two are explicit user
 * choices. The order is the documented toggle cycle in
 * `AppThemeToggle.vue`.
 */
export type ColorModePreference = 'light' | 'dark' | 'system'

/**
 * The resolved (non-`system`) mode currently being displayed. The
 * toggle and the `<html data-color-mode>` attribute are always set
 * to a resolved value — `'system'` is an internal preference that
 * is resolved against `prefers-color-scheme` before any DOM
 * mutation.
 */
export type ResolvedColorMode = 'light' | 'dark'

/**
 * Parse a stored color-mode value. Returns the input as a known
 * preference when it matches one of the three valid values;
 * otherwise returns `'system'` (the safe default that never
 * surprises the user with a dark or light theme they did not pick).
 */
export function parseColorModePreference(raw: string | null | undefined): ColorModePreference {
  if (raw === 'light' || raw === 'dark' || raw === 'system') {
    return raw
  }
  return 'system'
}

/**
 * Read the user's explicit color-mode preference from a cookie
 * string. `document.cookie` is the input; the function is pure so
 * the same logic can run in the anti-FOUC inline script (where
 * `useCookie` is not available) and in the client plugin.
 */
export function readColorModeFromCookie(cookieString: string | undefined | null): ColorModePreference {
  if (!cookieString) return 'system'
  const target = `${COLOR_MODE_COOKIE_KEY}=`
  const parts = cookieString.split(';')
  for (const part of parts) {
    const trimmed = part.trim()
    if (trimmed.startsWith(target)) {
      return parseColorModePreference(decodeURIComponent(trimmed.slice(target.length)))
    }
  }
  return 'system'
}

/**
 * Read the user's explicit color-mode preference from
 * `localStorage`. Safe to call in SSR (returns `'system'` when
 * `window` is not defined).
 */
export function readColorModeFromStorage(storage: Storage | undefined | null): ColorModePreference {
  if (!storage) return 'system'
  try {
    return parseColorModePreference(storage.getItem(COLOR_MODE_STORAGE_KEY))
  } catch {
    // Some browsers throw on `localStorage` access in private mode
    // or when storage is disabled. Treat as no preference and
    // fall back to the system value.
    return 'system'
  }
}

/**
 * Resolve a preference to a concrete `'light'` or `'dark'` value
 * using the `prefers-color-scheme` media query. Safe to call in
 * SSR (returns `'light'` when `window` is not defined and no
 * `prefersDark` hint is provided). The `prefersDark` parameter
 * lets callers that already evaluated `matchMedia` (the client
 * plugin does) avoid a second DOM lookup.
 */
export function resolveColorMode(
  preference: ColorModePreference,
  prefersDark: boolean | undefined,
): ResolvedColorMode {
  if (preference === 'dark') return 'dark'
  if (preference === 'light') return 'light'
  // `system` — use the hint or default to light when no DOM is
  // available (SSR paints the light default; the client plugin
  // upgrades to the resolved value on mount).
  return prefersDark === true ? 'dark' : 'light'
}

/**
 * Detect `prefers-color-scheme: dark` against the current
 * `window.matchMedia`. Returns `undefined` in SSR.
 */
export function detectSystemPrefersDark(): boolean | undefined {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return undefined
  }
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  } catch {
    return undefined
  }
}
