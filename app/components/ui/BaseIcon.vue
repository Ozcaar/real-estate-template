<script setup lang="ts">
type IconSize = 'sm' | 'md' | 'lg' | 'xl'

/**
 * Thin wrapper over Nuxt Icon that standardizes sizing and accessibility.
 * When `label` is provided the icon is exposed to assistive tech
 * (`role="img"`); otherwise it is hidden as decorative.
 */
const props = withDefaults(
  defineProps<{
    name: string
    size?: IconSize
    label?: string
  }>(),
  {
    size: 'md',
    label: undefined,
  },
)

const sizeClasses: Record<IconSize, string> = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
  xl: 'h-8 w-8',
}
</script>

<template>
  <Icon
    :name="name"
    :class="sizeClasses[props.size]"
    :aria-label="label"
    :aria-hidden="label ? undefined : 'true'"
    :role="label ? 'img' : undefined"
  />
</template>
