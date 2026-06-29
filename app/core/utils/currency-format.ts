/**
 * Currency formatting helpers.
 *
 * Business-agnostic infrastructure (no agency branding): callers pass the
 * currency code (from the property or agency config) and the active locale so
 * prices are formatted consistently across the app and easy to localize.
 */

export interface FormatCurrencyOptions {
  /** ISO 4217 currency code, e.g. `USD`, `MXN`, `EUR`. */
  currency: string
  /** BCP 47 locale, e.g. `en-US`, `es-ES`. Defaults to `en-US`. */
  locale?: string
  /** Maximum fraction digits. Defaults to `0` (whole-unit prices). */
  maximumFractionDigits?: number
}

export function formatCurrency(
  amount: number,
  { currency, locale = 'en-US', maximumFractionDigits = 0 }: FormatCurrencyOptions,
): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits,
    }).format(amount)
  }
  catch {
    // Unknown currency code or locale: fall back to a plain number so the UI
    // never crashes on misconfiguration.
    return `${amount.toLocaleString(locale)} ${currency}`
  }
}
