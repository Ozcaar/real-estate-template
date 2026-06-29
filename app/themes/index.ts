import type { ThemeConfig } from '~/types/theme.types'
import { defaultTheme } from './default.theme'

/**
 * Theme registry. Register additional themes (luxury, modern, minimal, …) here
 * so an agency can select one by id from its configuration.
 */
export const themes: Record<string, ThemeConfig> = {
  [defaultTheme.id]: defaultTheme,
}

/** Resolve a theme by id, falling back to the default theme. */
export function resolveTheme(id: string): ThemeConfig {
  return themes[id] ?? defaultTheme
}
