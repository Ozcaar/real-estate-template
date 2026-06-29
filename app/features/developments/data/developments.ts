import type { Development } from '../types/development.types'

/**
 * Sample developments for the MVP showcase page.
 *
 * This is placeholder agency content (names, locations, descriptions,
 * delivery dates are intentionally raw strings, not i18n keys). In a
 * later phase a service can fetch the same shape from an API without
 * changing components. Images point to local SVG placeholders under
 * `public/images` so the template renders offline; agencies replace them
 * with real renderings.
 */
export const sampleDevelopments: Development[] = [
  {
    id: 'dev-001',
    name: 'Mirador del Valle',
    slug: 'mirador-del-valle',
    status: 'pre-sale',
    location: 'Valle Oriente, Monterrey',
    description:
      'A boutique pre-sale of 24 apartments with panoramic views, two-bedroom layouts and shared rooftop amenities.',
    image: '/images/developments/development-01.svg',
    priceFrom: 285000,
    priceTo: 420000,
    currency: 'USD',
    units: 24,
    bedrooms: 2,
    sizeUnit: 'metric',
    areaFrom: 78,
    areaTo: 112,
    deliveryDate: '2026-06',
    featured: true,
  },
  {
    id: 'dev-002',
    name: 'Parque Residencial Lomas',
    slug: 'parque-residencial-lomas',
    status: 'under-construction',
    location: 'Las Lomas, Guadalajara',
    description:
      'Three-bedroom family homes arranged around a central park, with private gardens and community pool.',
    image: '/images/developments/development-02.svg',
    priceFrom: 195000,
    priceTo: 310000,
    currency: 'USD',
    units: 48,
    bedrooms: 3,
    sizeUnit: 'metric',
    areaFrom: 120,
    areaTo: 165,
    deliveryDate: '2025-12',
    featured: true,
  },
  {
    id: 'dev-003',
    name: 'CostaMar Towers',
    slug: 'costamar-towers',
    status: 'ready-to-deliver',
    location: 'Costa Azul, Mazatlán',
    description:
      'Two beachfront towers with one- and two-bedroom units, ready for immediate move-in.',
    image: '/images/developments/development-03.svg',
    priceFrom: 165000,
    priceTo: 285000,
    currency: 'USD',
    units: 60,
    bedrooms: 2,
    sizeUnit: 'metric',
    areaFrom: 65,
    areaTo: 98,
    deliveryDate: '2025-03',
    featured: false,
  },
  {
    id: 'dev-004',
    name: 'Quinta Industrial Lofts',
    slug: 'quinta-industrial-lofts',
    status: 'sold-out',
    location: 'Distrito Empresarial, Monterrey',
    description:
      'Adaptive-reuse lofts in a converted warehouse. All units sold; waiting list open for the next phase.',
    image: '/images/developments/development-04.svg',
    priceFrom: 145000,
    priceTo: 240000,
    currency: 'USD',
    units: 32,
    bedrooms: 1,
    sizeUnit: 'metric',
    areaFrom: 55,
    areaTo: 90,
    deliveryDate: '2024-09',
    featured: false,
  },
]
