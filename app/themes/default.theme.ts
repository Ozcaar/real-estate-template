import type { ThemeConfig } from '~/types/theme.types'

/**
 * Default theme — clean, neutral and flexible. Best for general agencies and
 * used as the baseline other themes can override.
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
    sm: '0 1px 2px rgb(0 0 0 / 0.08)',
    md: '0 8px 24px rgb(0 0 0 / 0.10)',
    lg: '0 16px 48px rgb(0 0 0 / 0.14)',
  },
  layout: {
    containerMaxWidth: '1280px',
    sectionSpacing: '5rem',
  },
}
