<script setup lang="ts">
/**
 * Homepage hero: image-split layout with eyebrow, heading, supporting copy and
 * primary/secondary CTAs. Text comes from i18n and the image is configurable
 * via a prop (defaults to a local placeholder) so an agency can rebrand without
 * editing the component. The dedicated search form lives in its own homepage
 * section (`HomePropertySearch`) — it is not embedded here to keep the hero
 * focused on the brand message and avoid a duplicate search entry point.
 */
withDefaults(
  defineProps<{
    image?: string
  }>(),
  {
    image: '/images/home/hero.svg',
  },
)

const { t } = useI18n()
</script>

<template>
  <BaseSection tone="muted" spacing="lg" class="relative overflow-hidden">
    <div class="grid items-center gap-10 lg:grid-cols-2">
      <div>
        <BaseBadge variant="accent" size="md">
          {{ t('home.hero.eyebrow') }}
        </BaseBadge>

        <BaseHeading :level="1" size="3xl" class="mt-4">
          {{ t('home.hero.title') }}
        </BaseHeading>

        <p class="mt-4 max-w-xl text-lg text-[var(--color-muted)]">
          {{ t('home.hero.subtitle') }}
        </p>

        <div class="mt-6 flex flex-col gap-3 sm:flex-row">
          <BaseButton to="/properties" size="lg">
            {{ t('home.hero.ctaPrimary') }}
          </BaseButton>
          <BaseButton to="/contact" size="lg" variant="outline">
            {{ t('home.hero.ctaSecondary') }}
          </BaseButton>
        </div>
      </div>

      <div class="relative">
        <ResponsiveImage
          :src="image"
          :alt="t('home.hero.imageAlt')"
          ratio="4/3"
          rounded="xl"
          loading="eager"
          sizes="100vw lg:50vw"
        />
      </div>
    </div>
  </BaseSection>
</template>
