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
}
