<script setup lang="ts">
import { computed } from 'vue'

/** Locale switcher backed by `@nuxtjs/i18n`. */
const { locale, locales, setLocale } = useI18n()

const options = computed(() =>
  locales.value.map(item =>
    typeof item === 'string'
      ? { code: item, name: item }
      : { code: item.code, name: item.name ?? item.code },
  ),
)

function onChange(event: Event) {
  const code = (event.target as HTMLSelectElement).value
  setLocale(code as Parameters<typeof setLocale>[0])
}
</script>

<template>
  <label class="inline-flex items-center">
    <span class="sr-only">{{ $t('common.selectLanguage') }}</span>
    <select
      :value="locale"
      class="h-9 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-sm text-[var(--color-foreground)]"
      @change="onChange"
    >
      <option v-for="option in options" :key="option.code" :value="option.code">
        {{ option.name }}
      </option>
    </select>
  </label>
</template>
