<script setup lang="ts">
// Keep the document language in sync with the active locale.
const { locale } = useI18n()
useHead({
  htmlAttrs: { lang: locale },
})
</script>

<template>
  <div>
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>
