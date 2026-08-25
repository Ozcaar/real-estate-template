import type { HomeLocation } from '../types/home.types'

/**
 * Bahía del Mar fictional rebrand locations (Task 122 dry-run).
 *
 * Four fictional Pacific-coast locations served by the agency.
 * Names are fictional / common Mexican Pacific coast place names;
 * property counts are placeholder values.
 */
export const homeLocations: HomeLocation[] = [
  {
    id: 'bdm-loc-sayulita',
    name: 'Sayulita',
    slug: 'sayulita',
    image: '/images/locations/location-01.svg',
    propertyCount: 18,
  },
  {
    id: 'bdm-loc-san-pancho',
    name: 'San Pancho',
    slug: 'san-pancho',
    image: '/images/locations/location-02.svg',
    propertyCount: 11,
  },
  {
    id: 'bdm-loc-punta-mita',
    name: 'Punta Mita',
    slug: 'punta-mita',
    image: '/images/locations/location-03.svg',
    propertyCount: 24,
  },
  {
    id: 'bdm-loc-bucerias',
    name: 'Bucerías',
    slug: 'bucerias',
    image: '/images/locations/location-04.svg',
    propertyCount: 14,
  },
]
