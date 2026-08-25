import type { ThemeConfig } from '~/types/theme.types'

/**
 * Bahía theme — warm Pacific-coast palette for the Bahía del Mar
 * fictional rebrand (Task 122 dry-run).
 *
 * **Palette rationale.** The agency's market is the Mexican Pacific
 * coast, so the brand colors draw from the region's natural
 * palette: a deep ocean-blue primary, a warm sand-beige secondary,
 * and a coral-sunset accent for the call-to-action surfaces.
 * Surface neutrals stay in the documented default-token range so
 * the dark-mode block in the default theme continues to apply.
 *
 * **Contrast / readability.** The `primaryForeground` is white so
 * any element with `bg-primary text-primary-foreground` is
 * WCAG AA-compliant against the deep ocean-blue background. The
 * `accentForeground` is also white; the accent is reserved for
 * call-to-action buttons and the visible price chip.
 *
 * **Dark-mode adaptation.** The agency colors (`primary`,
 * `secondary`, `accent`, plus the `success` / `warning` / `error`
 * state colors) are intentionally shared between light and dark
 * mode so the brand identity stays consistent. A rebrand updates
 * `colors` once and the dark palette adapts only the surfaces.
 * The dark block overrides only the NEUTRAL surface tokens.
 */
export const bahiaTheme: ThemeConfig = {
  id: 'bahia',
  name: 'Bahía del Mar Theme',
  colors: {
    background: '#FBF8F3',
    foreground: '#1B2A3A',
    surface: '#FFFFFF',
    surfaceMuted: '#F1ECE2',
    primary: '#0E5C7E',
    primaryForeground: '#FFFFFF',
    secondary: '#E8DCC4',
    secondaryForeground: '#1B2A3A',
    accent: '#E36C4A',
    accentForeground: '#FFFFFF',
    muted: '#6B7280',
    border: '#D6CFC1',
    card: '#FFFFFF',
    cardForeground: '#1B2A3A',
    success: '#16A34A',
    warning: '#D97706',
    error: '#DC2626',
  },
  dark: {
    background: '#0B1A2A',
    foreground: '#F8FAFC',
    surface: '#0F2235',
    surfaceMuted: '#162B40',
    muted: '#9CA3AF',
    border: '#1E3650',
    card: '#0F2235',
    cardForeground: '#F8FAFC',
  },
  fonts: {
    heading: '"DM Serif Display", Georgia, serif',
    body: 'Inter, system-ui, sans-serif',
    serif: '"DM Serif Display", Georgia, serif',
  },
  radius: {
    sm: '0.25rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    full: '9999px',
  },
  shadow: {
    sm: '0 1px 2px rgb(11 26 42 / 0.08)',
    md: '0 8px 24px rgb(11 26 42 / 0.12)',
    lg: '0 16px 48px rgb(11 26 42 / 0.18)',
  },
  layout: {
    containerMaxWidth: '1280px',
    sectionSpacing: '5rem',
  },
}
