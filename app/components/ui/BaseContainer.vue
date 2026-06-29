<script setup lang="ts">
/**
 * Centered, responsive content container constrained to the theme's
 * `--container-max-width`. Renders as a `<div>` by default; pass `as` to use a
 * semantic element (e.g. `section`, `header`, `footer`).
 */
withDefaults(
  defineProps<{
    as?: string
  }>(),
  { as: 'div' },
)
</script>

<template>
  <component
    :is="as"
    class="mx-auto w-full max-w-[var(--container-max-width)] px-4 sm:px-6 lg:px-8"
  >
    <slot />
  </component>
</template>
