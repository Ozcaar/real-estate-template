import type { AgencyConfig } from '~/types/agency.types'

/**
 * Fictional first-client rebrand target (Task 122 dry-run).
 *
 * **Identity.** "Bahía del Mar Propiedades" — a fictional boutique
 * real estate agency on the Mexican Pacific coast (Sayulita /
 * San Pancho / Punta Mita style markets). The agency's market is
 * Spanish-speaking, the default locale is `es`, the currency is
 * `MXN`, the measurement unit is `metric`. The name, slogan,
 * contact information, address, social URLs, and statistics are
 * all fictional placeholder values used to exercise the rebrand
 * workflow end-to-end.
 *
 * **Why this agency exists.** This file is the dry-run target of
 * the first-client rebrand audit (Task 122). The fictional name is
 * intentionally NOT one of the existing fixtures in the test suite
 * (`acme`, `coastal`, `default`) so the dry-run exercises the
 * full onboarding path: create a new agency file, register it in
 * the multi-tenant registry, wire it as the active agency, ship a
 * matching theme + sample data, and validate the result with the
 * shipped test suite. The fictional content here is also the
 * canonical reference of the agency's identity that the data
 * files in `app/features/[feature]/data/*.ts` reference (e.g. the agent
 * phone numbers, the testimonial roles, the location names).
 *
 * **Multi-tenant registration.** The rebrand registers this agency
 * under id `bahia-del-mar` in `app/config/agencies/registry.ts`
 * and lists the production hostnames. The default agency is
 * preserved as the fallback tenant so the existing single-agency
 * `pnpm dev` / `pnpm generate` behavior is unaffected. The
 * rebrand uses `app/config/site.config.ts` to swap the active
 * agency for `pnpm dev` / `pnpm preview` / `pnpm build` runs.
 *
 * **Lead capture.** `leads.enabled: true` is set so the dry-run
 * also exercises the lead-pipeline plumbing (the visible form
 * becomes interactive; the delivery adapter is still selected at
 * the server via `NUXT_LEADS_ADAPTER`). No real destination is
 * configured — the deploy-time env vars in `.env.example` are
 * still placeholders, so the production delivery adapter must be
 * set before the agency actually receives leads.
 *
 * **No real client data.** Every name, address, phone, email and
 * URL in this file is fictional placeholder content. The
 * rebrand-the-template workflow treats this file as the canonical
 * input for the dry-run; a real client engagement replaces every
 * field with the agency's own information.
 */
export const bahiaDelMarAgencyConfig: AgencyConfig = {
  id: 'bahia-del-mar',
  name: 'Bahía del Mar Propiedades',
  slogan: 'Tu hogar frente al Pacífico',
  logo: '/images/logo.svg',
  favicon: '/favicon.ico',
  theme: 'bahia',
  defaultLocale: 'es',
  availableLocales: ['en', 'es'],
  currency: 'MXN',
  measurementUnit: 'metric',
  contact: {
    phone: '+52 322 123 4567',
    whatsapp: '+52 322 123 4567',
    email: 'contacto@bahia-del-mar.test',
    address: 'Av. del Mar 123, Centro, Sayulita, Nayarit 63734, México',
    structuredAddress: {
      streetAddress: 'Av. del Mar 123',
      addressLocality: 'Sayulita',
      addressRegion: 'NAY',
      postalCode: '63734',
      addressCountry: 'MX',
    },
    businessHours: 'Lun-Sáb 9:00-18:00',
  },
  social: {
    facebook: 'https://facebook.com/bahia-del-mar.test',
    instagram: 'https://instagram.com/bahia-del-mar.test',
  },
  modules: {
    properties: true,
    developments: true,
    agents: true,
    blog: false,
    testimonials: true,
    contact: true,
  },
  leads: {
    enabled: true,
  },
}
