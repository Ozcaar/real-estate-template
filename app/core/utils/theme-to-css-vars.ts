import type { ThemeConfig } from '~/types/theme.types'

/**
 * Serialize a {@link ThemeConfig} into a CSS rule that declares all theme
 * tokens as CSS custom properties on `:root`.
 *
 * This is the bridge between the TypeScript source of truth (theme objects)
 * and the CSS variables consumed by components (`var(--color-primary)`, …).
 * Injecting it during SSR guarantees the correct branding renders with no
 * flash of unstyled / default theme.
 */
export function themeToCssVars(theme: ThemeConfig): string {
  const c = theme.colors
  const r = theme.radius
  const s = theme.shadow
  const f = theme.fonts
  const l = theme.layout

  const vars: Record<string, string> = {
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

  const body = Object.entries(vars)
    .map(([key, value]) => `${key}: ${value};`)
    .join('')

  return `:root{${body}}`
}
