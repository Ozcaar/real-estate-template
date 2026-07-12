<script setup lang="ts">
import { computed } from 'vue'
import { buildWhatsAppLink } from '~/core/utils/whatsapp-link'
import { usePageSeo } from '~/core/composables/usePageSeo'
import { useJsonLd } from '~/core/composables/useJsonLd'
import { agencyPostalAddress } from '~/core/utils/postal-address'

/**
 * Contact page (`/contact`).
 *
 * Thin route: it reads every contact channel from the documented agency
 * config (no hardcoded phone, email, WhatsApp or address), renders a
 * contact-methods card column, and embeds the `LeadForm` component for
 * the message column. The lead form is **driven by
 * `agency.leads.enabled`** — when the agency has opted in, the form is
 * fully interactive and posts to `POST /api/contact`; when the agency has
 * not opted in, the form keeps the historical placeholder behavior
 * (visible notice + permanently disabled submit) and the contact
 * methods column remains the canonical completion path.
 *
 * **Fallback.** The contact methods column (tel / mailto / WhatsApp) is
 * always available regardless of the form's state. A user whose form
 * submission fails, who has JavaScript disabled, or who is browsing a
 * pure-static deployment that does not run the `/api/contact` endpoint
 * can complete the contact journey in 1 click from this page.
 */
const { t, locale } = useI18n()
const site = useSiteConfig()

const contact = computed(() => site.value.agency.contact)
const whatsappLink = computed(() => buildWhatsAppLink(contact.value.whatsapp))
const leadsEnabled = computed(() => site.value.agency.leads.enabled)

// Methods rendered as cards. Each entry is only shown when the
// corresponding config field is non-empty, so an agency can enable or
// disable channels purely from `app/config/agencies/*.agency.ts`.
const methods = computed(() => {
  const c = contact.value
  return [
    {
      key: 'phone',
      icon: 'mdi:phone-outline',
      label: t('contact.methods.phone'),
      value: c.phone,
      href: c.phone ? `tel:${c.phone}` : null,
      external: false,
    },
    {
      key: 'whatsapp',
      icon: 'mdi:whatsapp',
      label: t('contact.methods.whatsapp'),
      value: c.whatsapp,
      href: whatsappLink.value,
      external: true,
    },
    {
      key: 'email',
      icon: 'mdi:email-outline',
      label: t('contact.methods.email'),
      value: c.email,
      href: c.email ? `mailto:${c.email}` : null,
      external: false,
    },
    {
      key: 'address',
      icon: 'mdi:map-marker-outline',
      label: t('contact.methods.address'),
      value: c.address,
      href: null,
      external: false,
    },
    {
      key: 'businessHours',
      icon: 'mdi:clock-outline',
      label: t('contact.methods.businessHours'),
      value: c.businessHours,
      href: null,
      external: false,
    },
  ].filter(m => Boolean(m.value))
})

// --- SEO ----------------------------------------------------------------
/**
 * Page-level SEO building blocks (siteUrl, canonicalUrl, og/twitter image,
 * twitterCard, ogLocale, siteName) come from the shared `usePageSeo`
 * composable. This page still owns the `useSeoMeta` call (for the
 * page-specific title/description) and the canonical `useHead` call.
 */
const { canonicalUrl, toAbsoluteUrl, ogImage, twitterImage, twitterCard, ogLocale, siteName } = usePageSeo()

const seoTitle = computed(() =>
  t('contact.seo.title', { agencyName: siteName }),
)
const seoDescription = computed(() => t('contact.seo.description'))

useSeoMeta({
  title: () => seoTitle.value,
  description: () => seoDescription.value,
  ogTitle: () => seoTitle.value,
  ogDescription: () => seoDescription.value,
  ogType: 'website',
  ogImage: () => ogImage.value,
  ogSiteName: () => siteName,
  ogLocale: () => ogLocale.value,
  ogUrl: () => canonicalUrl.value ?? undefined,
  twitterCard,
  twitterTitle: () => seoTitle.value,
  twitterDescription: () => seoDescription.value,
  twitterImage: () => twitterImage.value,
})

useHead({
  link: [
    ...(canonicalUrl.value
      ? [{ rel: 'canonical', href: canonicalUrl.value }]
      : []),
  ],
})

// --- JSON-LD ------------------------------------------------------------
/**
 * `ContactPage` schema. The `mainEntity` reuses the same agency fields
 * the home page emits so the agency node is consistent across the site.
 * The `@id` matches the home page's `RealEstateAgent.@id` so Google
 * treats both nodes as a single agency entity in its knowledge graph.
 * The `address` field stays a plain string to match the home page's
 * existing schema; a future task can upgrade both to `PostalAddress`.
 */
const jsonLd = computed(() => ({
  '@context': 'https://schema.org',
  '@type': 'ContactPage',
  name: seoTitle.value,
  description: seoDescription.value,
  ...(canonicalUrl.value ? { url: canonicalUrl.value } : {}),
  mainEntity: {
    '@type': 'RealEstateAgent',
    '@id': toAbsoluteUrl('/'),
    name: site.value.agency.name,
    telephone: site.value.agency.contact.phone,
    email: site.value.agency.contact.email,
    address: agencyPostalAddress(site.value.agency),
    ...(canonicalUrl.value ? { url: canonicalUrl.value } : {}),
  },
}))

useJsonLd(jsonLd)
</script>

<template>
  <BaseSection spacing="lg">
    <SectionHeader
      :level="1"
      align="center"
      :eyebrow="t('nav.contact')"
      :title="t('contact.page.title')"
      :subtitle="t('contact.page.subtitle')"
    />

    <div class="mt-12 grid items-start gap-8 lg:grid-cols-5">
      <div class="lg:col-span-2">
        <ul class="flex flex-col gap-4">
          <li v-for="method in methods" :key="method.key">
            <BaseCard padding="lg" radius="lg" shadow="sm" class="h-full">
              <div class="flex items-start gap-3">
                <span
                  class="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-surface-muted)] text-[var(--color-primary)]"
                  aria-hidden="true"
                >
                  <BaseIcon :name="method.icon" size="lg" />
                </span>
                <div class="min-w-0">
                  <p class="text-sm font-semibold text-[var(--color-foreground)]">
                    {{ method.label }}
                  </p>
                  <a
                    v-if="method.href"
                    :href="method.href"
                    :target="method.external ? '_blank' : undefined"
                    :rel="method.external ? 'noopener noreferrer' : undefined"
                    class="break-all text-sm text-[var(--color-muted)] transition-colors hover:text-[var(--color-primary)]"
                  >
                    {{ method.value }}
                  </a>
                  <p
                    v-else
                    class="text-sm text-[var(--color-muted)]"
                  >
                    {{ method.value }}
                  </p>
                </div>
              </div>
            </BaseCard>
          </li>
        </ul>
      </div>

      <div class="lg:col-span-3">
        <BaseCard padding="lg" radius="lg" shadow="sm">
          <BaseHeading :level="2" size="xl">
            {{ t('contact.form.title') }}
          </BaseHeading>
          <p class="mt-2 text-sm text-[var(--color-muted)]">
            {{ t('contact.form.description') }}
          </p>

          <LeadForm
            class="mt-6"
            :enabled="leadsEnabled"
            :locale="String(locale)"
          />
        </BaseCard>
      </div>
    </div>
  </BaseSection>
</template>
