import type { AgencyConfig } from '~/types/agency.types'

/**
 * Default agency configuration.
 *
 * This is the placeholder identity shipped with the template. To rebrand the
 * site for a real agency, copy this file (e.g. `acme.agency.ts`), adjust the
 * values, and point `site.config.ts` at it. No component changes required.
 *
 * @see docs/REBRANDING.md for the step-by-step rebranding workflow.
 */
export const defaultAgencyConfig: AgencyConfig = {
  id: 'default',
  name: 'Real Estate Agency',
  slogan: 'Find your ideal property',
  logo: '/images/logo.svg',
  favicon: '/favicon.ico',
  theme: 'default',
  defaultLocale: 'en',
  availableLocales: ['en', 'es'],
  currency: 'USD',
  measurementUnit: 'metric',
  contact: {
    phone: '1-800-555-1234',
    whatsapp: '1-800-555-1234',
    email: 'example@email.com',
    address: '123 Main Street, Anytown, USA',
    /**
     * Optional `PostalAddress` companion. The free-text `address` above
     * remains the source of truth for the visible footer and contact
     * card. The fields below are only consumed by the JSON-LD builder
     * (`app/core/utils/postal-address.ts`) and are intentionally limited
     * to the three values that can be derived from the existing free-text
     * — `addressRegion` and `postalCode` are not invented.
     */
    structuredAddress: {
      streetAddress: '123 Main Street',
      addressLocality: 'Anytown',
      addressCountry: 'USA',
    },
    businessHours: 'Mon-Fri 9am-5pm',
  },
  social: {
    facebook: 'http://www.facebook.com/youragency',
    instagram: 'http://www.instagram.com/youragency',
    linkedin: 'http://www.linkedin.com/youragency',
    tiktok: 'http://www.tiktok.com/youragency',
    youtube: 'http://www.youtube.com/youragency',
  },
  modules: {
    properties: true,
    developments: true,
    agents: true,
    blog: false,
    testimonials: true,
    contact: true,
  },
  /**
   * Lead capture is intentionally disabled by default in the sample
   * agency. The visible form keeps the historical placeholder
   * behavior (visible notice + permanently disabled submit) until
   * a rebrand explicitly opts in. To enable live lead capture, set
   * `leads.enabled: true` here AND set `NUXT_LEADS_ADAPTER` plus the
   * matching env vars at deploy time. The adapter is server-only
   * operational configuration and never lives in this file.
   *
   * Supported adapter values: `disabled` (default — returns 503 on
   * every submission), `log` (development — writes one redacted
   * `console.info` line per lead), `webhook` (production — POSTs
   * the stamped lead to a configured HTTPS endpoint with HMAC
   * SHA-256 signature), `email` (production — sends a plain-text +
   * HTML email through any configured SMTP server via Nodemailer).
   */
  leads: {
    enabled: false,
  },
}
