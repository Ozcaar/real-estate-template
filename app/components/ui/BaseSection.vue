<script setup lang="ts">
type SectionTone = 'default' | 'muted' | 'primary'
type SectionSpacing = 'none' | 'sm' | 'md' | 'lg'

/**
 * Page section wrapper providing consistent vertical rhythm and background
 * tones from theme tokens. By default it wraps its content in a
 * `BaseContainer`; set `container` to `false` for full-bleed content.
 */
const props = withDefaults(
  defineProps<{
    as?: string
    tone?: SectionTone
    spacing?: SectionSpacing
    container?: boolean
  }>(),
  {
    as: 'section',
    tone: 'default',
    spacing: 'lg',
    container: true,
  },
)

const toneClasses: Record<SectionTone, string> = {
  default: '',
  muted: 'bg-[var(--color-surface-muted)]',
  primary: 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]',
}

const spacingClasses: Record<SectionSpacing, string> = {
  none: '',
  sm: 'py-8 sm:py-10',
  md: 'py-12 sm:py-16',
  lg: 'py-12 sm:py-16 lg:py-24',
}
</script>

<template>
  <component :is="as" :class="[toneClasses[props.tone], spacingClasses[props.spacing]]">
    <BaseContainer v-if="container">
      <slot />
    </BaseContainer>
    <slot v-else />
  </component>
</template>
