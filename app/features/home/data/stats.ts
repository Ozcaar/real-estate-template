import type { HomeStat } from '../types/home.types'

/**
 * Headline trust statistics for the homepage "about" band. Values are agency
 * content (pre-formatted strings); labels are i18n keys.
 */
export const homeStats: HomeStat[] = [
  { id: 'stat-experience', value: '15+', labelKey: 'home.about.stats.experience', icon: 'mdi:calendar-clock' },
  { id: 'stat-properties', value: '1,200+', labelKey: 'home.about.stats.properties', icon: 'mdi:home-city-outline' },
  { id: 'stat-clients', value: '3,500+', labelKey: 'home.about.stats.clients', icon: 'mdi:account-group-outline' },
  { id: 'stat-areas', value: '20+', labelKey: 'home.about.stats.areas', icon: 'mdi:map-marker-radius-outline' },
]
