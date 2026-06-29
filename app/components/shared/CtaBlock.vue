<script setup lang="ts">
type CtaTone = 'primary' | 'surface'

/**
 * Generic call-to-action panel. Title/description are passed in already
 * translated; action buttons go in the `actions` slot so the caller picks the
 * appropriate `BaseButton` variants for the chosen tone.
 */
const props = withDefaults(
  defineProps<{
    title: string
    description?: string
    tone?: CtaTone
    align?: 'left' | 'center'
  }>(),
  {
    description: undefined,
    tone: 'primary',
    align: 'center',
  },
)

const toneClasses: Record<CtaTone, string> = {
  primary: 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]',
  surface: 'bg-[var(--color-surface-muted)] text-[var(--color-foreground)]',
}
</script>

<template>
  <div
    class="rounded-[var(--radius-xl)] px-6 py-10 sm:px-10 sm:py-14"
    :class="[toneClasses[props.tone], props.align === 'center' ? 'text-center' : '']"
  >
    <div :class="props.align === 'center' ? 'mx-auto max-w-2xl' : ''">
      <BaseHeading :level="2" size="2xl">
        {{ title }}
      </BaseHeading>
      <p
        v-if="description"
        class="mt-3 text-base sm:text-lg"
        :class="props.tone === 'primary' ? 'opacity-90' : 'text-[var(--color-muted)]'"
      >
        {{ description }}
      </p>
      <div
        v-if="$slots.actions"
        class="mt-6 flex flex-col gap-3 sm:flex-row"
        :class="props.align === 'center' ? 'sm:justify-center' : ''"
      >
        <slot name="actions" />
      </div>
    </div>
  </div>
</template>
