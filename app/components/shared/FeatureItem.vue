<script setup lang="ts">
/**
 * Icon + title + description block, used for "why choose us" / benefit lists.
 * Text is passed in already translated by the caller.
 */
const props = withDefaults(
  defineProps<{
    icon: string
    title: string
    description?: string
    align?: 'left' | 'center'
  }>(),
  {
    description: undefined,
    align: 'left',
  },
)
</script>

<template>
  <div :class="props.align === 'center' ? 'flex flex-col items-center text-center' : ''">
    <span
      class="inline-flex h-12 w-12 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-surface-muted)] text-[var(--color-primary)]"
    >
      <BaseIcon :name="icon" size="lg" />
    </span>
    <BaseHeading :level="3" size="md" class="mt-4">
      {{ title }}
    </BaseHeading>
    <p v-if="description" class="mt-2 text-sm text-[var(--color-muted)]">
      {{ description }}
    </p>
  </div>
</template>
