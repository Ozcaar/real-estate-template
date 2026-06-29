import type { HomeLocation } from '../types/home.types'

/**
 * Sample areas served, shown in the homepage "locations" section. Names are
 * agency content (raw strings); images point to local SVG placeholders.
 */
export const homeLocations: HomeLocation[] = [
  {
    id: 'loc-monterrey',
    name: 'Monterrey',
    slug: 'monterrey',
    image: '/images/locations/location-01.svg',
    propertyCount: 48,
  },
  {
    id: 'loc-guadalajara',
    name: 'Guadalajara',
    slug: 'guadalajara',
    image: '/images/locations/location-02.svg',
    propertyCount: 36,
  },
  {
    id: 'loc-mexico-city',
    name: 'Mexico City',
    slug: 'mexico-city',
    image: '/images/locations/location-03.svg',
    propertyCount: 62,
  },
  {
    id: 'loc-mazatlan',
    name: 'Mazatlán',
    slug: 'mazatlan',
    image: '/images/locations/location-04.svg',
    propertyCount: 21,
  },
]
