<script setup lang="ts">
/**
 * Standalone "property search" band for the homepage. Wraps the existing
 * {@link HomeSearchBar} in a proper section with a header so the search entry
 * point reads as its own block (per `docs/DESIGN.md`'s homepage structure)
 * instead of being embedded in the hero. The search form logic and its options
 * stay inside `HomeSearchBar` so it can be reused elsewhere without changes.
 */
const { t } = useI18n()
</script>

<template>
  <BaseSection tone="muted" spacing="lg">
    <SectionHeader
      align="center"
      :eyebrow="t('home.propertySearch.eyebrow')"
      :title="t('home.propertySearch.title')"
      :subtitle="t('home.propertySearch.subtitle')"
    />

    <div class="mt-10 max-w-5xl mx-auto">
      <HomeSearchBar />
    </div>
  </BaseSection>
</template>
