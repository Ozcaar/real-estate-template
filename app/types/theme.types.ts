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

/**
 * Neutral surface tokens that flip between light and dark mode.
 *
 * Brand tokens (`primary`, `secondary`, `accent`, and their `*-foreground`
 * counterparts, plus `success` / `warning` / `error`) are intentionally
 * defined ONCE on the theme — they keep the agency's identity in both
 * modes. Only the neutral surfaces, borders, and muted text recolor
 * between light and dark. This matches the documented v1.1.0 M15
 * contract in `docs/ROADMAP.md`.
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

/**
 * Dark-mode overrides for the NEUTRAL surface tokens. Brand tokens
 * (primary, secondary, accent) are shared with the light palette so
 * the agency's identity stays consistent across modes.
 *
 * A theme ships its own dark palette; the agency's brand colors do not
 * change between modes. This is the single-override approach the
 * `theme-to-css-vars` serializer expects.
 */
export interface ThemeDarkColors {
  /** Page background in dark mode. */
  background: string
  /** Default text color on the dark background. */
  foreground: string
  /** Raised surface (cards, panels) in dark mode. */
  surface: string
  /** Subtle/muted surface for secondary blocks in dark mode. */
  surfaceMuted: string
  /** Muted text color in dark mode. */
  muted: string
  /** Border / divider color in dark mode. */
  border: string
  /** Card background in dark mode. */
  card: string
  /** Readable text color on top of the dark `card`. */
  cardForeground: string
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
  /**
   * Dark-mode overrides for the neutral surface tokens. Optional — a
   * theme without a `dark` block still ships dark mode (the serializer
   * falls back to a sensible default that complements the agency's
   * light palette), but defining it explicitly is the recommended
   * path for a polished result.
   */
  dark?: ThemeDarkColors
  fonts: ThemeFonts
  radius: ThemeRadius
  shadow: ThemeShadow
  layout: ThemeLayout
}
