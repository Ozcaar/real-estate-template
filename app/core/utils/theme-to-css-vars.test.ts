import { describe, expect, it } from 'vitest'
import type { ThemeConfig } from '~/types/theme.types'
import { themeToCssVars } from './theme-to-css-vars'

/**
 * Vitest coverage for the theme-to-CSS-vars serializer.
 *
 * The serializer is the bridge between the TypeScript source of
 * truth (the active agency's theme) and the CSS variables consumed
 * by every component (`var(--color-primary)`, …). It also emits
 * the dark-mode block (v1.1.0 M15) and the `color-scheme`
 * declaration. A regression here breaks every page.
 */

const SAMPLE_THEME: ThemeConfig = {
  id: 'sample',
  name: 'Sample Theme',
  colors: {
    background: '#FFFFFF',
    foreground: '#111827',
    surface: '#FFFFFF',
    surfaceMuted: '#F5F5F4',
    primary: '#0F766E',
    primaryForeground: '#FFFFFF',
    secondary: '#F5F5F4',
    secondaryForeground: '#111827',
    accent: '#D97706',
    accentForeground: '#FFFFFF',
    muted: '#6B7280',
    border: '#E5E7EB',
    card: '#FFFFFF',
    cardForeground: '#111827',
    success: '#16A34A',
    warning: '#D97706',
    error: '#DC2626',
  },
  fonts: {
    heading: 'Inter, sans-serif',
    body: 'Inter, sans-serif',
    serif: 'Georgia, serif',
  },
  radius: {
    sm: '0.375rem',
    md: '0.75rem',
    lg: '1rem',
    xl: '1.5rem',
    full: '9999px',
  },
  shadow: {
    sm: '0 1px 2px rgb(0 0 0 / 0.08)',
    md: '0 8px 24px rgb(0 0 0 / 0.10)',
    lg: '0 16px 48px rgb(0 0 0 / 0.14)',
  },
  layout: {
    containerMaxWidth: '1280px',
    sectionSpacing: '5rem',
  },
}

describe('themeToCssVars', () => {
  it('emits a :root block with every documented light-mode token', () => {
    const css = themeToCssVars(SAMPLE_THEME)
    expect(css).toContain(':root{')
    for (const token of [
      '--color-background: #FFFFFF',
      '--color-foreground: #111827',
      '--color-primary: #0F766E',
      '--color-accent: #D97706',
      '--color-success: #16A34A',
      '--color-warning: #D97706',
      '--color-error: #DC2626',
      '--radius-sm: 0.375rem',
      '--radius-md: 0.75rem',
      '--shadow-md: 0 8px 24px rgb(0 0 0 / 0.10)',
      '--font-heading: Inter, sans-serif',
      '--container-max-width: 1280px',
    ]) {
      expect(css, `expected ${token}`).toContain(token)
    }
  })

  it('emits a dark-mode block on the [data-color-mode="dark"] selector', () => {
    const css = themeToCssVars(SAMPLE_THEME)
    expect(css).toContain(`html[data-color-mode='dark']{`)
    // The dark block only owns the neutral surfaces, NOT the
    // brand colors. The agency identity is preserved across
    // modes.
    expect(css).toContain('--color-background: #0B1220')
    // Primary is NOT re-declared in the dark block.
    const darkStart = css.indexOf(`html[data-color-mode='dark']{`)
    const darkEnd = css.indexOf('}', darkStart)
    const darkBlock = css.slice(darkStart, darkEnd)
    expect(darkBlock, 'primary should not be re-declared in the dark block').not.toContain('--color-primary')
    expect(darkBlock, 'accent should not be re-declared in the dark block').not.toContain('--color-accent')
  })

  it('emits a color-scheme declaration for both modes so form controls and scrollbars match', () => {
    const css = themeToCssVars(SAMPLE_THEME)
    // The light-mode rule carries both `color-scheme: light;` and
    // the `--mode-tint` token (so components can use a one-line
    // soft-background utility without re-deriving the mode).
    expect(css).toContain(`html[data-color-mode='light']{color-scheme:light;--mode-tint:#FFFFFF;}`)
    expect(css).toContain(`html[data-color-mode='dark']{color-scheme:dark;--mode-tint:#000000;}`)
  })

  it('emits a --mode-tint token for each mode based on background luminance', () => {
    const css = themeToCssVars(SAMPLE_THEME)
    // White background → #FFFFFF tint.
    expect(css).toContain(`html[data-color-mode='light']{color-scheme:light;--mode-tint:#FFFFFF;}`)
    // Dark background → #000000 tint.
    expect(css).toContain(`html[data-color-mode='dark']{color-scheme:dark;--mode-tint:#000000;}`)
  })

  it('uses the theme-provided dark palette when present', () => {
    const theme: ThemeConfig = {
      ...SAMPLE_THEME,
      dark: {
        background: '#000000',
        foreground: '#FAFAFA',
        surface: '#111111',
        surfaceMuted: '#222222',
        muted: '#888888',
        border: '#333333',
        card: '#111111',
        cardForeground: '#FAFAFA',
      },
    }
    const css = themeToCssVars(theme)
    expect(css).toContain('--color-background: #000000')
    expect(css).toContain('--color-foreground: #FAFAFA')
    expect(css).toContain('--color-surface: #111111')
  })

  it('falls back to the documented default dark palette when the theme omits `dark`', () => {
    const theme: ThemeConfig = { ...SAMPLE_THEME }
    delete (theme as { dark?: unknown }).dark
    const css = themeToCssVars(theme)
    expect(css).toContain('--color-background: #0B1220')
    expect(css).toContain('--color-foreground: #F8FAFC')
  })

  it('emits a single root selector (not duplicated) so the CSS parses cleanly', () => {
    const css = themeToCssVars(SAMPLE_THEME)
    const rootCount = (css.match(/:root\{/g) ?? []).length
    expect(rootCount, 'should emit exactly one :root block').toBe(1)
  })

  it('emits the dark block on every supported mode selector', () => {
    const css = themeToCssVars(SAMPLE_THEME)
    const darkBlocks = (css.match(/html\[data-color-mode='dark'\]/g) ?? []).length
    // Two: one for the palette, one for color-scheme + --mode-tint.
    expect(darkBlocks).toBe(2)
  })
})
