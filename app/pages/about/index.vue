<script setup lang="ts">
import { computed } from 'vue'
import { homeStats } from '~/features/home/data/stats'
import { usePageSeo } from '~/core/composables/usePageSeo'
import { useJsonLd } from '~/core/composables/useJsonLd'
import { agencyPostalAddress } from '~/core/utils/postal-address'

/**
 * About page (`/about`).
 *
 * Thin route: it composes the existing `SectionHeader`, `FeatureItem` and
 * `CtaBlock` primitives, reuses the home trust-stat numbers from
 * `features/home/data/stats.ts`, and sets page-level SEO metadata. No
 * agent/team preview, no developments preview — those are out of scope
 * until the corresponding features land.
 */
const { t } = useI18n()
const site = useSiteConfig()

// --- Story --------------------------------------------------------------
/**
 * The page title and SEO title both interpolate the agency name so a
 * rebrand is a single-file change.
 */
const { siteName } = usePageSeo()
const seoTitle = computed(() =>
  t('about.seo.title', { agencyName: siteName }),
)
const seoDescription = computed(() => t('about.seo.description'))
const pageTitle = computed(() =>
  t('about.page.title', { agencyName: siteName }),
)

// --- Values -------------------------------------------------------------
/**
 * The 4 values are content-only; the icons are presentational and the
 * titles/descriptions come from i18n. Adding a new value is a one-key
 * change in each locale file.
 */
const values = computed(() => [
  {
    icon: 'mdi:shield-check-outline',
    key: 'trust',
    titleKey: 'about.values.items.trust.title',
    descriptionKey: 'about.values.items.trust.description',
  },
  {
    icon: 'mdi:map-marker-radius-outline',
    key: 'expertise',
    titleKey: 'about.values.items.expertise.title',
    descriptionKey: 'about.values.items.expertise.description',
  },
  {
    icon: 'mdi:account-heart-outline',
    key: 'care',
    titleKey: 'about.values.items.care.title',
    descriptionKey: 'about.values.items.care.description',
  },
  {
    icon: 'mdi:trophy-outline',
    key: 'results',
    titleKey: 'about.values.items.results.title',
    descriptionKey: 'about.values.items.results.description',
  },
])

// --- Stats --------------------------------------------------------------
/**
 * The trust statistics are sourced from the existing `homeStats` data file
 * (same set used by the home page's `HomeAbout` section) so a rebrand is
 * a single edit. The labels resolve through `properties.features.*` so
 * they are localized for free.
 */
const stats = computed(() =>
  homeStats.map(stat => ({
    id: stat.id,
    icon: stat.icon,
    value: stat.value,
    labelKey: stat.labelKey,
  })),
)

// --- SEO ----------------------------------------------------------------
/**
 * Page-level SEO building blocks come from `usePageSeo`. This page owns
 * the `useSeoMeta` call (for the page-specific title/description) and
 * the canonical `useHead` call.
 */
const { canonicalUrl, toAbsoluteUrl, ogImage, twitterImage, twitterCard, ogLocale } = usePageSeo()

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
 * `AboutPage` schema for the about page. The `mainEntity` reuses the same
 * agency fields the home page emits so the agency node is consistent
 * across the site. The `@id` matches the home page's `RealEstateAgent.@id`
 * (and the contact page's `mainEntity.@id`) so Google treats all three
 * nodes as a single agency entity in its knowledge graph. The `address`
 * field stays a plain string to match the existing home/contact schemas;
 * a future task can upgrade all three to `PostalAddress`.
 */
const jsonLd = computed(() => ({
  '@context': 'https://schema.org',
  '@type': 'AboutPage',
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
  <div>
    <BaseSection spacing="lg">
      <SectionHeader
        align="center"
        :eyebrow="t('about.story.eyebrow')"
        :title="pageTitle"
        :subtitle="t('about.page.subtitle')"
      />
    </BaseSection>

    <BaseSection spacing="lg">
      <div class="mx-auto grid max-w-5xl items-start gap-10 lg:grid-cols-[1fr_2fr]">
        <div>
          <BaseBadge variant="accent" size="md">
            {{ t('about.story.eyebrow') }}
          </BaseBadge>
        </div>
        <div>
          <BaseHeading :level="2" size="2xl">
            {{ t('about.story.title') }}
          </BaseHeading>
          <p class="mt-4 text-base text-[var(--color-foreground)] sm:text-lg">
            {{ t('about.story.description') }}
          </p>
        </div>
      </div>
    </BaseSection>

    <BaseSection spacing="lg">
      <SectionHeader
        align="center"
        :eyebrow="t('about.values.eyebrow')"
        :title="t('about.values.title')"
        :subtitle="t('about.values.subtitle')"
      />

      <div class="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <BaseCard
          v-for="value in values"
          :key="value.key"
          padding="lg"
        >
          <FeatureItem
            :icon="value.icon"
            :title="t(value.titleKey)"
            :description="t(value.descriptionKey)"
            :align="'center'"
          />
        </BaseCard>
      </div>
    </BaseSection>

    <BaseSection spacing="lg" tone="muted">
      <SectionHeader
        align="center"
        :eyebrow="t('about.stats.eyebrow')"
        :title="t('about.stats.title')"
      />

      <dl class="mx-auto mt-10 grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div
          v-for="stat in stats"
          :key="stat.id"
          class="flex flex-col items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-card)] p-6 text-center"
        >
          <span
            class="inline-flex h-12 w-12 items-center justify-center rounded-[var(--radius-full)] bg-[var(--color-surface-muted)] text-[var(--color-primary)]"
            aria-hidden="true"
          >
            <BaseIcon :name="stat.icon" size="lg" />
          </span>
          <dt class="text-3xl font-bold text-[var(--color-foreground)]">
            {{ stat.value }}
          </dt>
          <dd class="text-sm font-medium text-[var(--color-muted)]">
            {{ t(stat.labelKey) }}
          </dd>
        </div>
      </dl>
    </BaseSection>

    <BaseSection spacing="md">
      <CtaBlock
        :title="t('about.cta.title')"
        :description="t('about.cta.description')"
        tone="primary"
      >
        <template #actions>
          <BaseButton to="/contact" size="lg" variant="secondary">
            {{ t('about.cta.primary') }}
          </BaseButton>
          <BaseButton to="/properties" size="lg" variant="ghost">
            {{ t('about.cta.secondary') }}
          </BaseButton>
        </template>
      </CtaBlock>
    </BaseSection>
  </div>
</template>
