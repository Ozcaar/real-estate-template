<script setup lang="ts">
import { computed } from 'vue'
import { agentsService } from '~/features/agents/services/agents.service'
import { usePageSeo } from '~/core/composables/usePageSeo'
import { useJsonLd } from '~/core/composables/useJsonLd'
import { buildWhatsAppLink } from '~/core/utils/whatsapp-link'
import type { BreadcrumbItem } from '~/types/breadcrumb.types'

/**
 * Agent detail page (`/agents/[slug]`).
 *
 * Thin route: it loads the agent catalog through the documented
 * async service, looks up the agent by slug, raises a proper 404
 * when the slug is unknown, then composes a clean detail layout
 * from existing primitives. The page follows the property /
 * development detail pages' SEO contract (canonical,
 * `ogType: 'article'`, the agent's own image as the social image,
 * `BreadcrumbList` JSON-LD) and emits a `Person` schema.org node
 * tied back to the agency via `worksFor: RealEstateAgent`. A
 * related-agents section is intentionally omitted: the agent model
 * has no obvious relatedness signal (no `featured` field, no
 * `developmentId` link to the property model, no `team` group),
 * and a curated "Other agents you may like" section would be
 * arbitrary for a 4-record catalog.
 */
const { t } = useI18n()
const site = useSiteConfig()
const route = useRoute()

const slug = computed(() => {
  const raw = route.params.slug
  return Array.isArray(raw) ? raw[0] : raw
})

/**
 * Agent data source. Loaded through Nuxt's `useAsyncData` so
 * SSR awaits the service's `loadAll()` before rendering the
 * markup. The `agents:detail` key is unique to this page; a
 * future per-agent widget that wants its own key should prefix
 * the slug.
 */
const { data: allAgents } = await useAsyncData(
  'agents:detail',
  () => agentsService.loadAll(),
)

const agent = computed(() =>
  allAgents.value && slug.value
    ? agentsService.getBySlug(allAgents.value, slug.value)
    : undefined,
)

if (!agent.value) {
  throw createError({
    statusCode: 404,
    statusMessage: t('agents.detail.notFoundTitle'),
    fatal: true,
  })
}

// `agent` is now guaranteed to be defined for the rest of the setup.
const a = agent.value

const whatsappLink = computed(() => buildWhatsAppLink(a.whatsapp))

/** True when at least one direct contact channel is available. */
const hasContact = computed(
  () => Boolean(a.phone || a.email || whatsappLink.value),
)

/** True when the agent has a non-empty specialties list. */
const hasSpecialties = computed(
  () => Array.isArray(a.specialties) && a.specialties.length > 0,
)

// --- SEO ----------------------------------------------------------------
/**
 * Page-level SEO building blocks come from `usePageSeo`. This page
 * uses the agent's own `image` as the social image so each profile
 * has a unique share preview, and uses `ogType: 'article'` so the
 * social card is marked up correctly (matching the property and
 * development detail pages). The `useSeoMeta` and canonical
 * `useHead` calls stay page-level.
 */
const { canonicalUrl, toAbsoluteUrl, ogImage, twitterImage, twitterCard, ogLocale, siteName } = usePageSeo({
  image: computed(() => a.image),
})

const seoTitle = computed(() => `${a.name} | ${siteName}`)
const seoDescription = computed(() => a.bio)

useSeoMeta({
  title: () => seoTitle.value,
  description: () => seoDescription.value,
  ogTitle: () => a.name,
  ogDescription: () => a.bio,
  ogType: 'article',
  ogImage: () => ogImage.value,
  ogSiteName: () => siteName,
  ogLocale: () => ogLocale.value,
  ogUrl: () => canonicalUrl.value ?? undefined,
  twitterCard,
  twitterTitle: () => a.name,
  twitterDescription: () => a.bio,
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
 * `Person` schema for the agent. Each agent on the team page is
 * already a `Person` (see `app/pages/agents/index.vue`); the
 * detail page promotes the same shape to a top-level payload with
 * a richer set of fields. The `worksFor` reference ties the agent
 * back to the same `RealEstateAgent` node the agency already emits
 * (its `@id` is the agency home page URL — `toAbsoluteUrl('/')`).
 *
 * Optional contact fields (`telephone`, `email`) are emitted only
 * when the source record has them, mirroring the listing page's
 * pattern. The `knowsAbout` property maps `specialties` to the
 * schema.org pattern for "this person has expertise in these
 * topics" — the visible UI keeps the same badges for sighted
 * users.
 */
const personJsonLd = computed(() => ({
  '@context': 'https://schema.org',
  '@type': 'Person',
  ...(canonicalUrl.value ? { '@id': canonicalUrl.value } : {}),
  name: a.name,
  jobTitle: a.role,
  description: a.bio,
  image: toAbsoluteUrl(a.image),
  ...(canonicalUrl.value ? { url: canonicalUrl.value } : {}),
  ...(a.phone ? { telephone: a.phone } : {}),
  ...(a.email ? { email: a.email } : {}),
  ...(hasSpecialties.value
    ? { knowsAbout: a.specialties }
    : {}),
  worksFor: {
    '@type': 'RealEstateAgent',
    name: site.value.agency.name,
    url: toAbsoluteUrl('/'),
  },
}))

useJsonLd(personJsonLd)

// --- Breadcrumb JSON-LD -------------------------------------------------
/**
 * `BreadcrumbList` schema for the visible breadcrumb trail. The list
 * mirrors the order, labels, and URLs of the `<SeoBreadcrumbs>`
 * rendered at the top of the page exactly. Positions are 1-based,
 * ancestor `item` URLs are absolute via `toAbsoluteUrl`, and the
 * current page's `item` is the page's own canonical URL with a
 * defensive fallback to `toAbsoluteUrl('/agents/${a.slug}')` (which
 * itself returns the relative path when `NUXT_PUBLIC_SITE_URL` is
 * empty — matching the `usePageSeo` contract).
 */
const breadcrumbItems = computed<BreadcrumbItem[]>(() => [
  { label: t('nav.home'), to: '/' },
  { label: t('nav.agents'), to: '/agents' },
  { label: a.name },
])

const breadcrumbJsonLd = computed(() => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: breadcrumbItems.value.map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: item.label,
    item: index === breadcrumbItems.value.length - 1
      ? (canonicalUrl.value ?? toAbsoluteUrl(`/agents/${a.slug}`))
      : toAbsoluteUrl(item.to ?? ''),
  })),
}))

useJsonLd(breadcrumbJsonLd)
</script>

<template>
  <article>
    <BaseSection spacing="lg">
      <SeoBreadcrumbs
        :items="breadcrumbItems"
        class="mb-6"
      />

      <div class="grid items-start gap-10 lg:grid-cols-2">
        <ResponsiveImage
          :src="a.image"
          :alt="a.name"
          ratio="1/1"
          rounded="xl"
          sizes="100vw lg:50vw"
          loading="eager"
          fetchpriority="high"
        />

        <div>
          <p class="text-sm font-medium text-[var(--color-primary)]">
            {{ a.role }}
          </p>

          <BaseHeading :level="1" size="3xl" class="mt-2">
            {{ a.name }}
          </BaseHeading>

          <div
            v-if="hasSpecialties"
            class="mt-6"
          >
            <p class="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
              {{ t('agents.detail.specialtiesLabel') }}
            </p>
            <ul class="mt-2 flex flex-wrap gap-2">
              <li v-for="specialty in a.specialties" :key="specialty">
                <BaseBadge variant="neutral" size="sm">
                  {{ specialty }}
                </BaseBadge>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div class="mt-12 grid items-start gap-10 lg:grid-cols-3">
        <div class="lg:col-span-2">
          <BaseHeading :level="2" size="xl" class="mb-4">
            {{ t('agents.detail.about', { name: a.name }) }}
          </BaseHeading>
          <p class="text-base text-[var(--color-foreground)] sm:text-lg">
            {{ a.bio }}
          </p>
        </div>

        <aside v-if="hasContact">
          <BaseCard padding="md" radius="lg" shadow="sm">
            <BaseHeading :level="3" size="md">
              {{ t('agents.detail.contact.title', { name: a.name }) }}
            </BaseHeading>
            <p class="mt-2 text-sm text-[var(--color-muted)]">
              {{ t('agents.detail.contact.description') }}
            </p>
            <ul class="mt-4 flex flex-col gap-2 text-sm">
              <li v-if="a.phone">
                <a
                  :href="`tel:${a.phone}`"
                  :aria-label="`${t('agents.detail.contact.call')}: ${a.name}`"
                  class="inline-flex items-center gap-2 text-[var(--color-foreground)] transition-colors hover:text-[var(--color-primary)]"
                >
                  <BaseIcon name="mdi:phone-outline" size="sm" />
                  <span>{{ a.phone }}</span>
                </a>
              </li>
              <li v-if="a.email">
                <a
                  :href="`mailto:${a.email}`"
                  :aria-label="`${t('agents.detail.contact.email')}: ${a.name}`"
                  class="inline-flex items-center gap-2 text-[var(--color-foreground)] transition-colors hover:text-[var(--color-primary)]"
                >
                  <BaseIcon name="mdi:email-outline" size="sm" />
                  <span>{{ a.email }}</span>
                </a>
              </li>
              <li v-if="whatsappLink">
                <a
                  :href="whatsappLink"
                  target="_blank"
                  rel="noopener noreferrer"
                  :aria-label="`${t('agents.detail.contact.whatsapp')}: ${a.name}`"
                  class="inline-flex items-center gap-2 text-[var(--color-foreground)] transition-colors hover:text-[var(--color-primary)]"
                >
                  <BaseIcon name="mdi:whatsapp" size="sm" />
                  <span>{{ a.whatsapp }}</span>
                </a>
              </li>
            </ul>
            <div class="mt-4">
              <BaseButton to="/contact" size="md" block variant="outline">
                {{ t('agents.cta.primary') }}
              </BaseButton>
            </div>
          </BaseCard>
        </aside>
      </div>
    </BaseSection>
  </article>
</template>
