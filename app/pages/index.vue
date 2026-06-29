<script setup lang="ts">
import { computed } from 'vue'
import { propertiesService } from '~/features/properties/services/properties.service'
import { PROPERTY_TYPE_OPTIONS } from '~/features/properties/constants/property-types'
import { homeLocations } from '~/features/home/data/locations'
import { homeTestimonials } from '~/features/home/data/testimonials'
import { homeStats } from '~/features/home/data/stats'

/**
 * Home page. Stays thin: it loads route-level data, sets SEO metadata and
 * composes home feature sections. All heavy UI and business logic live in the
 * section components and feature services.
 */
const { t } = useI18n()
const site = useSiteConfig()

const modules = computed(() => site.value.agency.modules)

// Static MVP data, resolved through the feature service so the source can be
// swapped for an API later without touching this page. The featured showcase
// is intentionally small (3 items) so it stays a single, scannable row on
// `xl` screens and aligns with the 3-column grid used by `PropertyGrid`.
const featuredProperties = propertiesService.getFeatured(3)
const categories = PROPERTY_TYPE_OPTIONS

useSeoMeta({
  title: () => site.value.agency.name,
  description: () => t('home.hero.subtitle'),
  ogTitle: () => site.value.agency.name,
  ogDescription: () => t('home.hero.subtitle'),
  ogType: 'website',
})
</script>

<template>
  <div>
    <HomeHero />

    <HomePropertySearch v-if="modules.properties" />

    <HomeFeaturedProperties
      v-if="modules.properties"
      :properties="featuredProperties"
    />

    <HomeServices />

    <HomeCategories v-if="modules.properties" :categories="categories" />

    <HomeLocations v-if="modules.properties" :locations="homeLocations" />

    <HomeAbout :stats="homeStats" />

    <HomeTestimonials
      v-if="modules.testimonials"
      :testimonials="homeTestimonials"
    />

    <HomeContactCta v-if="modules.contact" />
  </div>
</template>
