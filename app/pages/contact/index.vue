<script setup lang="ts">
import { computed, ref } from 'vue'
import { buildWhatsAppLink } from '~/core/utils/whatsapp-link'
import { usePageSeo } from '~/core/composables/usePageSeo'

/**
 * Contact page (`/contact`).
 *
 * Thin route: it reads every contact channel from the documented agency
 * config (no hardcoded phone, email, WhatsApp or address), renders a
 * contact-methods card column and a static contact-form column. The form
 * is intentionally non-functional for the MVP — a `placeholderNotice` and
 * `disabled` submit make that clear without inventing a backend. Wiring a
 * real submission is a future-phase task.
 */
const { t } = useI18n()
const site = useSiteConfig()

const contact = computed(() => site.value.agency.contact)
const whatsappLink = computed(() => buildWhatsAppLink(contact.value.whatsapp))

// Form UI state. The form is a placeholder; values are kept in refs so the
// UI is fully interactive (labels, validation hints, disabled submit) even
// though nothing is sent.
const form = ref({
  name: '',
  email: '',
  phone: '',
  message: '',
})

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
const { canonicalUrl, ogImage, twitterImage, twitterCard, ogLocale, siteName } = usePageSeo()

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
</script>

<template>
  <BaseSection spacing="lg">
    <SectionHeader
      align="center"
      :eyebrow="t('nav.contact')"
      :title="t('contact.page.title')"
      :subtitle="t('contact.page.subtitle')"
    />

    <div class="mt-12 grid items-start gap-8 lg:grid-cols-5">
      <div class="lg:col-span-2">
        <ul class="flex flex-col gap-4">
          <li v-for="method in methods" :key="method.key">
            <BaseCard padding="md" radius="lg" shadow="sm" class="h-full">
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

          <form
            class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2"
            @submit.prevent
          >
            <div class="sm:col-span-2">
              <label
                for="contact-name"
                class="mb-1 block text-xs font-medium text-[var(--color-muted)]"
              >
                {{ t('contact.form.nameLabel') }}
              </label>
              <input
                id="contact-name"
                v-model="form.name"
                type="text"
                autocomplete="name"
                :placeholder="t('contact.form.namePlaceholder')"
                class="h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-background)] px-3 text-sm text-[var(--color-foreground)]"
              >
            </div>

            <div>
              <label
                for="contact-email"
                class="mb-1 block text-xs font-medium text-[var(--color-muted)]"
              >
                {{ t('contact.form.emailLabel') }}
              </label>
              <input
                id="contact-email"
                v-model="form.email"
                type="email"
                autocomplete="email"
                :placeholder="t('contact.form.emailPlaceholder')"
                class="h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-background)] px-3 text-sm text-[var(--color-foreground)]"
              >
            </div>

            <div>
              <label
                for="contact-phone"
                class="mb-1 block text-xs font-medium text-[var(--color-muted)]"
              >
                {{ t('contact.form.phoneLabel') }}
              </label>
              <input
                id="contact-phone"
                v-model="form.phone"
                type="tel"
                autocomplete="tel"
                :placeholder="t('contact.form.phonePlaceholder')"
                class="h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-background)] px-3 text-sm text-[var(--color-foreground)]"
              >
            </div>

            <div class="sm:col-span-2">
              <label
                for="contact-message"
                class="mb-1 block text-xs font-medium text-[var(--color-muted)]"
              >
                {{ t('contact.form.messageLabel') }}
              </label>
              <textarea
                id="contact-message"
                v-model="form.message"
                rows="5"
                :placeholder="t('contact.form.messagePlaceholder')"
                class="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)]"
              />
            </div>

            <div class="sm:col-span-2">
              <p class="mb-4 rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3 text-xs text-[var(--color-muted)]">
                {{ t('contact.form.placeholderNotice') }}
              </p>
              <BaseButton
                type="submit"
                size="lg"
                disabled
                block
              >
                {{ t('contact.form.submit') }}
              </BaseButton>
            </div>
          </form>
        </BaseCard>
      </div>
    </div>
  </BaseSection>
</template>
