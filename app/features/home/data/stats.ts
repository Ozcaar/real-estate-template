import type { HomeStat } from '../types/home.types'

/**
 * Headline trust statistics for the Bahía del Mar fictional
 * rebrand (Task 122 dry-run). The numeric values are placeholder
 * content; the label keys reference the shipped
 * `home.about.stats.*` i18n keys (so the visible labels stay in
 * sync with the agency's locale without an i18n edit).
 */
export const homeStats: HomeStat[] = [
  { id: 'bdm-stat-experience', value: '10+', labelKey: 'home.about.stats.experience', icon: 'mdi:calendar-clock' },
  { id: 'bdm-stat-properties', value: '450+', labelKey: 'home.about.stats.properties', icon: 'mdi:home-city-outline' },
  { id: 'bdm-stat-clients', value: '1,800+', labelKey: 'home.about.stats.clients', icon: 'mdi:account-group-outline' },
  { id: 'bdm-stat-areas', value: '8+', labelKey: 'home.about.stats.areas', icon: 'mdi:map-marker-radius-outline' },
]
