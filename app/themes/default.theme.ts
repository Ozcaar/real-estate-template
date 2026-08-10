import type { ThemeConfig } from '~/types/theme.types'

/**
 * Default theme — clean, neutral and flexible. Best for general agencies and
 * used as the baseline other themes can override.
 *
 * **Dark mode.** The `dark` block overrides only the NEUTRAL surface
 * tokens (background, foreground, surface, surface-muted, muted,
 * border, card, card-foreground). The agency's brand colors
 * (`primary`, `secondary`, `accent`, and their `*-foreground`
 * counterparts, plus the `success` / `warning` / `error` state
 * colors) are intentionally shared between light and dark mode so
 * the brand identity stays consistent. A future rebrand updates
 * `colors` once and the dark palette adapts only the surfaces.
 */
export const defaultTheme: ThemeConfig = {
  id: 'default',
  name: 'Default Theme',
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
  /**
   * Dark-mode palette. Values follow the documented v1.1.0 M15
   * contract: `#0B1220` background, `#F8FAFC` foreground, deep
   * neutrals for the surfaces, and a slightly lighter `border` so
   * cards stay readable. The teal primary (`#0F766E`) keeps the
   * agency identity unchanged.
   */
  dark: {
    background: '#0B1220',
    foreground: '#F8FAFC',
    surface: '#111827',
    surfaceMuted: '#1F2937',
    muted: '#9CA3AF',
    border: '#1F2937',
    card: '#111827',
    cardForeground: '#F8FAFC',
  },
  fonts: {
    heading: 'Inter, system-ui, sans-serif',
    body: 'Inter, system-ui, sans-serif',
    serif: 'Georgia, "Times New Roman", serif',
  },
  radius: {
    sm: '0.375rem',
    md: '0.75rem',
    lg: '1rem',
    xl: '1.5rem',
    full: '9999px',
  },
  shadow: {
    sm: '0 1px 2px rgb(0 0 0 / 0.30)',
    md: '0 8px 24px rgb(0 0 0 / 0.36)',
    lg: '0 16px 48px rgb(0 0 0 / 0.44)',
  },
  layout: {
    containerMaxWidth: '1280px',
    sectionSpacing: '5rem',
  },
}
