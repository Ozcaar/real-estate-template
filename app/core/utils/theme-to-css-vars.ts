import type { ThemeConfig } from '~/types/theme.types'

/**
 * Serialize a {@link ThemeConfig} into a CSS string that declares all
 * theme tokens as CSS custom properties.
 *
 * The result is a sequence of CSS rules that is safe to drop into a
 * `<style>` tag during SSR. It contains:
 *
 *  1. The light-mode tokens on `:root` (brand + neutral surfaces).
 *  2. The dark-mode overrides on `[data-color-mode='dark']` — only the
 *     neutral surfaces flip; the agency's brand colors
 *     (`--color-primary`, `--color-accent`, etc.) stay the same.
 *  3. A `color-scheme` declaration on each mode so the browser's
 *     form controls and scrollbars match.
 *
 * This is the bridge between the TypeScript source of truth (theme
 * objects) and the CSS variables consumed by components
 * (`var(--color-primary)`, …). Injecting it during SSR guarantees the
 * correct branding renders with no flash of unstyled / default theme.
 *
 * The dark block is optional. A theme without a `dark` block still
 * ships dark mode (the serializer falls back to a sensible default
 * that complements the agency's light palette), but defining it
 * explicitly is the recommended path for a polished result.
 */
export function themeToCssVars(theme: ThemeConfig): string {
  const c = theme.colors
  const r = theme.radius
  const s = theme.shadow
  const f = theme.fonts
  const l = theme.layout

  // Light-mode block — brand + neutral surfaces, declared on `:root`.
  const lightVars: Record<string, string> = {
    '--color-background': c.background,
    '--color-foreground': c.foreground,
    '--color-surface': c.surface,
    '--color-surface-muted': c.surfaceMuted,
    '--color-primary': c.primary,
    '--color-primary-foreground': c.primaryForeground,
    '--color-secondary': c.secondary,
    '--color-secondary-foreground': c.secondaryForeground,
    '--color-accent': c.accent,
    '--color-accent-foreground': c.accentForeground,
    '--color-muted': c.muted,
    '--color-border': c.border,
    '--color-card': c.card,
    '--color-card-foreground': c.cardForeground,
    '--color-success': c.success,
    '--color-warning': c.warning,
    '--color-error': c.error,

    '--radius-sm': r.sm,
    '--radius-md': r.md,
    '--radius-lg': r.lg,
    '--radius-xl': r.xl,
    '--radius-full': r.full,

    '--shadow-sm': s.sm,
    '--shadow-md': s.md,
    '--shadow-lg': s.lg,

    '--font-heading': f.heading,
    '--font-body': f.body,
    '--font-serif': f.serif,

    '--container-max-width': l.containerMaxWidth,
    '--section-spacing': l.sectionSpacing,
  }

  // Dark-mode block — neutral surfaces only. Brand tokens are
  // inherited from `:root` so the agency's identity is preserved.
  // The `color-scheme` declaration keeps the browser's native
  // form controls and scrollbars in sync with the active mode.
  const dark = theme.dark ?? defaultDarkPalette(c)
  const darkVars: Record<string, string> = {
    '--color-background': dark.background,
    '--color-foreground': dark.foreground,
    '--color-surface': dark.surface,
    '--color-surface-muted': dark.surfaceMuted,
    '--color-muted': dark.muted,
    '--color-border': dark.border,
    '--color-card': dark.card,
    '--color-card-foreground': dark.cardForeground,
  }

  const lightBody = Object.entries(lightVars)
    .map(([key, value]) => `${key}: ${value};`)
    .join('')
  const darkBody = Object.entries(darkVars)
    .map(([key, value]) => `${key}: ${value};`)
    .join('')

  return (
    `:root{${lightBody}}` +
    `html[data-color-mode='dark']{${darkBody}}` +
    `html[data-color-mode='light']{color-scheme:light;--mode-tint:${lightTint(c.background)};}` +
    `html[data-color-mode='dark']{color-scheme:dark;--mode-tint:${lightTint(dark.background)};}`
  )
}

/**
 * Sensible dark-mode default when a theme does not ship a `dark`
 * block. Inverts the light surfaces with the documented v1.1.0 M15
 * defaults: a near-black background, near-white foreground, and a
 * slightly lighter surface for cards. Brand colors are not
 * duplicated — the dark block only owns the neutral surfaces.
 */
function defaultDarkPalette(_c: ThemeConfig['colors']): NonNullable<ThemeConfig['dark']> {
  return {
    background: '#0B1220',
    foreground: '#F8FAFC',
    surface: '#111827',
    surfaceMuted: '#1F2937',
    muted: '#9CA3AF',
    border: '#1F2937',
    card: '#111827',
    cardForeground: '#F8FAFC',
  }
}

/**
 * Detect whether a hex color is "light" or "dark" by relative
 * luminance. Used to compute the `--mode-tint` token that lets
 * components write a one-line "soft background" without re-deriving
 * the mode themselves. Returns the documented v1.1.0 M15 contract:
 * `'#FFFFFF'` for a light background, `'#000000'` for a dark one.
 *
 * The calculation is the WCAG 2.x relative-luminance formula; the
 * threshold is the conventional 0.5 midpoint that 0..1 normalized
 * luminance crosses between the two outputs.
 */
function lightTint(hex: string): string {
  const normalized = hex.trim().replace(/^#/, '')
  if (normalized.length !== 6 && normalized.length !== 3) {
    return '#FFFFFF'
  }
  const expand = (value: string) =>
    normalized.length === 3
      ? value.split('').map(ch => ch + ch).join('')
      : value
  const full = expand(normalized)
  const r = parseInt(full.slice(0, 2), 16) / 255
  const g = parseInt(full.slice(2, 4), 16) / 255
  const b = parseInt(full.slice(4, 6), 16) / 255
  const linear = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  const luminance = 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
  return luminance > 0.5 ? '#FFFFFF' : '#000000'
}
