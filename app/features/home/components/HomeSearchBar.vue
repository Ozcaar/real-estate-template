<script setup lang="ts">
import { ref } from 'vue'
import {
  OPERATION_TYPE_OPTIONS,
  PROPERTY_TYPE_OPTIONS,
} from '~/features/properties/constants/property-types'

/**
 * Lightweight search entry point for the homepage hero. This is a *preview*: it
 * only collects the most common criteria and forwards them to the properties
 * listing via the query string. The actual filtering lives in the properties
 * feature, so no heavy filter logic is duplicated here.
 */
const { t } = useI18n()

const operation = ref('')
const type = ref('')
const location = ref('')

function onSubmit() {
  const query: Record<string, string> = {}
  if (operation.value) query.operation = operation.value
  if (type.value) query.type = type.value
  if (location.value.trim()) query.location = location.value.trim()

  return navigateTo({ path: '/properties', query })
}

const fieldClass
  = 'h-12 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-background)] px-3 text-sm text-[var(--color-foreground)]'
</script>

<template>
  <form
    class="grid grid-cols-1 gap-3 rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-card)] p-3 shadow-[var(--shadow-md)] sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.4fr_auto] lg:items-end"
    role="search"
    @submit.prevent="onSubmit"
  >
    <div>
      <label class="mb-1 block text-xs font-medium text-[var(--color-muted)]" for="search-operation">
        {{ t('home.search.operationLabel') }}
      </label>
      <select id="search-operation" v-model="operation" :class="fieldClass">
        <option value="">{{ t('home.search.anyOperation') }}</option>
        <option v-for="option in OPERATION_TYPE_OPTIONS" :key="option.value" :value="option.value">
          {{ t(option.labelKey) }}
        </option>
      </select>
    </div>

    <div>
      <label class="mb-1 block text-xs font-medium text-[var(--color-muted)]" for="search-type">
        {{ t('home.search.typeLabel') }}
      </label>
      <select id="search-type" v-model="type" :class="fieldClass">
        <option value="">{{ t('home.search.anyType') }}</option>
        <option v-for="option in PROPERTY_TYPE_OPTIONS" :key="option.value" :value="option.value">
          {{ t(option.labelKey) }}
        </option>
      </select>
    </div>

    <div>
      <label class="mb-1 block text-xs font-medium text-[var(--color-muted)]" for="search-location">
        {{ t('home.search.locationLabel') }}
      </label>
      <input
        id="search-location"
        v-model="location"
        type="text"
        :class="fieldClass"
        :placeholder="t('home.search.locationPlaceholder')"
      >
    </div>

    <BaseButton type="submit" size="lg" block class="lg:w-auto">
      <BaseIcon name="mdi:magnify" size="sm" />
      {{ t('home.search.submit') }}
    </BaseButton>
  </form>
</template>
