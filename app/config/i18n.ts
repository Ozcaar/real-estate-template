/**
 * Supported locale codes — single source of truth.
 *
 * Both the Nuxt i18n configuration in `nuxt.config.ts` and the agency
 * configuration validation in `app/config/agencies/agency.schema.ts` import
 * from this file so the agency config cannot drift away from the locales
 * actually wired into `@nuxtjs/i18n`.
 *
 * Adding a new locale:
 *   1. Append the new `code` to `defaultI18nLocales`.
 *   2. Add the matching entry to `nuxt.config.ts` → `i18n.locales`
 *      (with `code`, `language`, `name`, `file`).
 *   3. Add `i18n/locales/<code>.json`.
 * The agency schema will then automatically accept agencies that declare
 * the new locale in `availableLocales`.
 */
export const defaultI18nLocales = ['en', 'es'] as const

export type I18nLocaleCode = typeof defaultI18nLocales[number]
