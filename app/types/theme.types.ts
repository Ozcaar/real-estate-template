/**
 * Theme design tokens.
 *
 * These TypeScript objects are the single source of truth for the visual
 * identity of an agency. At runtime the active theme is serialized into CSS
 * variables (see `core/utils/theme-to-css-vars.ts`) so components can consume
 * `var(--color-primary)`, `var(--radius-md)`, etc. without code changes.
 *
 * The token set reconciles `docs/THEMING.md`, `docs/DATA_MODELS.md` and the
 * superset required by `docs/DESIGN.md`.
 */

export interface ThemeColors {
  /** Page background. */
  background: string
  /** Default text color on the background. */
  foreground: string
  /** Raised surface (cards, panels). */
  surface: string
  /** Subtle/muted surface for secondary blocks. */
  surfaceMuted: string
  /** Brand primary color. */
  primary: string
  /** Readable text/icon color on top of `primary`. */
  primaryForeground: string
  /** Brand secondary color. */
  secondary: string
  /** Readable text/icon color on top of `secondary`. */
  secondaryForeground: string
  /** Accent color for highlights and emphasis. */
  accent: string
  /** Readable text/icon color on top of `accent`. */
  accentForeground: string
  /** Muted text color (metadata, captions). */
  muted: string
  /** Border / divider color. */
  border: string
  /** Card background. */
  card: string
  /** Readable text color on top of `card`. */
  cardForeground: string
  /** Success state color. */
  success: string
  /** Warning state color. */
  warning: string
  /** Error / danger state color. */
  error: string
}

export interface ThemeFonts {
  /** Font stack for headings. */
  heading: string
  /** Font stack for body text. */
  body: string
  /** Optional serif stack for editorial / luxury themes. */
  serif: string
}

export interface ThemeRadius {
  sm: string
  md: string
  lg: string
  xl: string
  full: string
}

export interface ThemeShadow {
  sm: string
  md: string
  lg: string
}

export interface ThemeLayout {
  containerMaxWidth: string
  sectionSpacing: string
}

export interface ThemeConfig {
  /** Unique theme identifier, also used as the `data-theme` attribute value. */
  id: string
  /** Human readable theme name. */
  name: string
  colors: ThemeColors
  fonts: ThemeFonts
  radius: ThemeRadius
  shadow: ThemeShadow
  layout: ThemeLayout
}
