import type { NavItem } from '~/types/site.types'

/**
 * Primary navigation. Labels are i18n keys (never raw text). The optional
 * `module` field lets layout components hide entries for disabled modules.
 */
export const mainNavigation: NavItem[] = [
  { labelKey: 'nav.home', to: '/' },
  { labelKey: 'nav.properties', to: '/properties', module: 'properties' },
  { labelKey: 'nav.developments', to: '/developments', module: 'developments' },
  { labelKey: 'nav.agents', to: '/agents', module: 'agents' },
  { labelKey: 'nav.about', to: '/about' },
  { labelKey: 'nav.contact', to: '/contact', module: 'contact' },
]
