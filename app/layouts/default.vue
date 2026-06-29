<script setup lang="ts">
/** Default public layout: header, page content and footer. */
</script>

<template>
  <div class="flex min-h-screen flex-col bg-[var(--color-background)] text-[var(--color-foreground)]">
    <a
      href="#main-content"
      class="sr-only rounded-[var(--radius-md)] bg-[var(--color-primary)] px-4 py-2 text-[var(--color-primary-foreground)] focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50"
    >
      {{ $t('common.skipToContent') }}
    </a>

    <AppHeader />

    <main id="main-content" class="flex-1">
      <slot />
    </main>

    <AppFooter />
  </div>
</template>
