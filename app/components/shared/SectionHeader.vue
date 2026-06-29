<script setup lang="ts">
type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6

/**
 * Reusable section heading block: optional eyebrow, a title and an optional
 * subtitle. Text is passed in already translated by the caller (via `$t`), so
 * the component stays generic and i18n-friendly.
 */
const props = withDefaults(
  defineProps<{
    title: string
    eyebrow?: string
    subtitle?: string
    align?: 'left' | 'center'
    level?: HeadingLevel
  }>(),
  {
    eyebrow: undefined,
    subtitle: undefined,
    align: 'left',
    level: 2,
  },
)
</script>

<template>
  <div :class="props.align === 'center' ? 'mx-auto max-w-2xl text-center' : ''">
    <p
      v-if="eyebrow"
      class="mb-2 text-sm font-semibold tracking-wide text-[var(--color-accent)] uppercase"
    >
      {{ eyebrow }}
    </p>
    <BaseHeading :level="level" size="2xl">
      {{ title }}
    </BaseHeading>
    <p v-if="subtitle" class="mt-3 text-base text-[var(--color-muted)] sm:text-lg">
      {{ subtitle }}
    </p>
  </div>
</template>
