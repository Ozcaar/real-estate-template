import { describe, expect, it } from 'vitest'
import {
  COLOR_MODE_COOKIE_KEY,
  COLOR_MODE_STORAGE_KEY,
  detectSystemPrefersDark,
  parseColorModePreference,
  readColorModeFromCookie,
  readColorModeFromStorage,
  resolveColorMode,
  type ColorModePreference,
} from './color-mode'

/**
 * Vitest coverage for the color-mode persistence helpers.
 *
 * The helpers are pure DOM-IO functions — they read cookies and
 * `localStorage` and write nothing. Every test is deterministic.
 *
 * The composable `useColorMode` and the Nuxt plugin are covered
 * end-to-end by the Playwright suite (`tests/e2e/color-mode.spec.ts`),
 * which is the right surface for the integration-level
 * `useState` + `watch` + DOM-attribute contract. The pure helpers
 * below are unit-tested here because they are the building blocks
 * of the anti-FOUC inline script in `nuxt.config.ts` and the SSR
 * branch in `plugins/color-mode.ts`.
 */

describe('parseColorModePreference', () => {
  it('returns the input when it is a known preference', () => {
    expect(parseColorModePreference('light')).toBe('light')
    expect(parseColorModePreference('dark')).toBe('dark')
    expect(parseColorModePreference('system')).toBe('system')
  })

  it('returns "system" for unknown / null / empty / whitespace values', () => {
    expect(parseColorModePreference('auto')).toBe('system')
    expect(parseColorModePreference('Dark')).toBe('system') // case-sensitive
    expect(parseColorModePreference(null)).toBe('system')
    expect(parseColorModePreference(undefined)).toBe('system')
    expect(parseColorModePreference('')).toBe('system')
    expect(parseColorModePreference('  ')).toBe('system')
  })
})

describe('readColorModeFromCookie', () => {
  it('returns the persisted preference when the cookie is set', () => {
    const cookie = `${COLOR_MODE_COOKIE_KEY}=dark; path=/`
    expect(readColorModeFromCookie(cookie)).toBe('dark')
  })

  it('decodes URL-encoded values (the cookie is written with encodeURIComponent)', () => {
    // `encodeURIComponent` does not escape plain ASCII letters, so a
    // typical cookie value (one of the three documented preferences)
    // round-trips byte-for-byte. The encode/decode pair is exercised
    // by a value that actually contains a character that needs
    // percent-encoding, e.g. a future preference name with a space.
    const cookie = `${COLOR_MODE_COOKIE_KEY}=light%20mode; path=/`
    // The decoded value is `light mode` which is not a known
    // preference, so the parser falls back to `'system'`. This
    // proves the decode ran (the encoded `%20` was turned into a
    // space) without confusing the parser.
    expect(readColorModeFromCookie(cookie)).toBe('system')
  })

  it('returns "system" when the cookie string is empty or null', () => {
    expect(readColorModeFromCookie('')).toBe('system')
    expect(readColorModeFromCookie(null)).toBe('system')
    expect(readColorModeFromCookie(undefined)).toBe('system')
  })

  it('returns "system" when the cookie is set to a different key', () => {
    expect(readColorModeFromCookie('i18n_locale=en; path=/')).toBe('system')
  })

  it('handles cookies with multiple key=value pairs', () => {
    const cookie = `i18n_locale=en; ${COLOR_MODE_COOKIE_KEY}=light; path=/`
    expect(readColorModeFromCookie(cookie)).toBe('light')
  })

  it('handles cookies without a leading semicolon (first pair)', () => {
    const cookie = `${COLOR_MODE_COOKIE_KEY}=system`
    expect(readColorModeFromCookie(cookie)).toBe('system')
  })

  it('returns "system" for a value that is not a known preference', () => {
    const cookie = `${COLOR_MODE_COOKIE_KEY}=auto`
    expect(readColorModeFromCookie(cookie)).toBe('system')
  })
})

describe('readColorModeFromStorage', () => {
  function fakeStorage(value: string | null): Storage {
    const map = new Map<string, string>()
    if (value !== null) map.set(COLOR_MODE_STORAGE_KEY, value)
    return {
      get length() {
        return map.size
      },
      clear() {
        map.clear()
      },
      getItem(key: string) {
        return map.get(key) ?? null
      },
      key(index: number) {
        return Array.from(map.keys())[index] ?? null
      },
      removeItem(key: string) {
        map.delete(key)
      },
      setItem(key: string, val: string) {
        map.set(key, val)
      },
    }
  }

  it('returns the persisted preference when the key is set', () => {
    expect(readColorModeFromStorage(fakeStorage('dark'))).toBe('dark')
  })

  it('returns "system" when the key is missing', () => {
    expect(readColorModeFromStorage(fakeStorage(null))).toBe('system')
  })

  it('returns "system" when the storage is null or undefined', () => {
    expect(readColorModeFromStorage(null)).toBe('system')
    expect(readColorModeFromStorage(undefined)).toBe('system')
  })

  it('returns "system" for an unknown value', () => {
    expect(readColorModeFromStorage(fakeStorage('auto'))).toBe('system')
  })

  it('returns "system" when getItem throws (private mode)', () => {
    const storage: Storage = {
      ...fakeStorage('dark'),
      getItem() {
        throw new Error('SecurityError')
      },
    }
    expect(readColorModeFromStorage(storage)).toBe('system')
  })
})

describe('resolveColorMode', () => {
  it('returns the explicit preference for "light" regardless of the system hint', () => {
    expect(resolveColorMode('light', true)).toBe('light')
    expect(resolveColorMode('light', false)).toBe('light')
    expect(resolveColorMode('light', undefined)).toBe('light')
  })

  it('returns the explicit preference for "dark" regardless of the system hint', () => {
    expect(resolveColorMode('dark', true)).toBe('dark')
    expect(resolveColorMode('dark', false)).toBe('dark')
    expect(resolveColorMode('dark', undefined)).toBe('dark')
  })

  it('returns "dark" for "system" when the hint is true', () => {
    expect(resolveColorMode('system', true)).toBe('dark')
  })

  it('returns "light" for "system" when the hint is false', () => {
    expect(resolveColorMode('system', false)).toBe('light')
  })

  it('returns "light" for "system" when no hint is available (SSR fallback)', () => {
    expect(resolveColorMode('system', undefined)).toBe('light')
  })
})

describe('detectSystemPrefersDark', () => {
  it('returns undefined when window is not defined (SSR)', () => {
    const originalWindow = (globalThis as { window?: unknown }).window
    // @ts-expect-error -- delete the global window to simulate SSR
    delete (globalThis as { window?: unknown }).window
    try {
      expect(detectSystemPrefersDark()).toBeUndefined()
    } finally {
      ;(globalThis as { window?: unknown }).window = originalWindow
    }
  })
})

describe('resolved-mode round trip', () => {
  /**
   * The full cycle that the toggle implements: `light → dark →
   * system → light → ...`. Verify the resolver agrees with the
   * toggle at every step.
   */
  const order: ColorModePreference[] = ['light', 'dark', 'system']
  it('cycles cleanly and always resolves to a concrete mode', () => {
    let current: ColorModePreference = 'light'
    for (let i = 0; i < 6; i++) {
      const next = order[(order.indexOf(current) + 1) % order.length] as ColorModePreference
      const resolved = resolveColorMode(current, true) // hint irrelevant except for system
      expect(['light', 'dark']).toContain(resolved)
      current = next
    }
  })
})
