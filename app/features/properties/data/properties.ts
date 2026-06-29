import type { Property } from '../types/property.types'
import { propertyListSchema } from '../schemas/property.schema'

/**
 * Static sample properties for the MVP.
 *
 * This is placeholder agency content (titles, descriptions and locations are
 * intentionally raw strings, not i18n keys). In a later phase the
 * `properties.service` can fetch this same shape from an API without changing
 * any component. Images point to local SVG placeholders under `public/images`
 * so the template renders offline; agencies replace them with real photos.
 */
const rawProperties: Property[] = [
  {
    id: 'prop-001',
    title: 'Modern Hillside Villa',
    slug: 'modern-hillside-villa',
    description:
      'A bright, contemporary villa with floor-to-ceiling windows, an open-plan living area and panoramic views over the valley.',
    operationType: 'sale',
    propertyType: 'house',
    price: 685000,
    currency: 'USD',
    location: 'Las Lomas',
    city: 'Monterrey',
    state: 'Nuevo León',
    country: 'Mexico',
    bedrooms: 4,
    bathrooms: 3,
    parkingSpaces: 2,
    sizeUnit: 'metric',
    constructionSize: 320,
    landSize: 480,
    images: ['/images/properties/property-01.svg'],
    coverImage: '/images/properties/property-01.svg',
    amenities: ['garden', 'terrace', 'security'],
    status: 'available',
    featured: true,
  },
  {
    id: 'prop-002',
    title: 'Downtown Skyline Apartment',
    slug: 'downtown-skyline-apartment',
    description:
      'A stylish two-bedroom apartment in the heart of the city, steps away from restaurants, parks and public transit.',
    operationType: 'rent',
    propertyType: 'apartment',
    price: 1850,
    currency: 'USD',
    location: 'Centro',
    city: 'Guadalajara',
    state: 'Jalisco',
    country: 'Mexico',
    bedrooms: 2,
    bathrooms: 2,
    parkingSpaces: 1,
    sizeUnit: 'metric',
    constructionSize: 96,
    images: ['/images/properties/property-02.svg'],
    coverImage: '/images/properties/property-02.svg',
    amenities: ['gym', 'pool', 'elevator'],
    status: 'available',
    featured: true,
  },
  {
    id: 'prop-003',
    title: 'Coastal Family Home',
    slug: 'coastal-family-home',
    description:
      'Spacious family home a short walk from the beach, with a generous backyard, covered patio and plenty of natural light.',
    operationType: 'sale',
    propertyType: 'house',
    price: 432000,
    currency: 'USD',
    location: 'Costa Azul',
    city: 'Mazatlán',
    state: 'Sinaloa',
    country: 'Mexico',
    bedrooms: 3,
    bathrooms: 2,
    parkingSpaces: 2,
    sizeUnit: 'metric',
    constructionSize: 210,
    landSize: 300,
    images: ['/images/properties/property-03.svg'],
    coverImage: '/images/properties/property-03.svg',
    amenities: ['garden', 'patio'],
    status: 'available',
    featured: true,
  },
  {
    id: 'prop-004',
    title: 'Prime Commercial Space',
    slug: 'prime-commercial-space',
    description:
      'High-visibility commercial unit on a busy avenue, ideal for retail or a flagship showroom with large display windows.',
    operationType: 'rent',
    propertyType: 'commercial',
    price: 4200,
    currency: 'USD',
    location: 'Av. Reforma',
    city: 'Mexico City',
    state: 'CDMX',
    country: 'Mexico',
    parkingSpaces: 4,
    sizeUnit: 'metric',
    constructionSize: 180,
    images: ['/images/properties/property-04.svg'],
    coverImage: '/images/properties/property-04.svg',
    amenities: ['street-front', 'storage'],
    status: 'available',
    featured: true,
  },
  {
    id: 'prop-005',
    title: 'Garden View Building Lot',
    slug: 'garden-view-building-lot',
    description:
      'A flat, ready-to-build residential lot in a gated community with services in place and easy highway access.',
    operationType: 'sale',
    propertyType: 'land',
    price: 158000,
    currency: 'USD',
    location: 'Valle Verde',
    city: 'Querétaro',
    state: 'Querétaro',
    country: 'Mexico',
    sizeUnit: 'metric',
    landSize: 600,
    images: ['/images/properties/property-05.svg'],
    coverImage: '/images/properties/property-05.svg',
    amenities: ['gated', 'utilities'],
    status: 'reserved',
    featured: false,
  },
  {
    id: 'prop-006',
    title: 'Executive Office Suite',
    slug: 'executive-office-suite',
    description:
      'Move-in ready office suite with meeting rooms, a reception area and abundant natural light in a premier business tower.',
    operationType: 'rent',
    propertyType: 'office',
    price: 3100,
    currency: 'USD',
    location: 'Distrito Empresarial',
    city: 'Monterrey',
    state: 'Nuevo León',
    country: 'Mexico',
    parkingSpaces: 3,
    sizeUnit: 'metric',
    constructionSize: 145,
    images: ['/images/properties/property-06.svg'],
    coverImage: '/images/properties/property-06.svg',
    amenities: ['meeting-rooms', 'reception', 'parking'],
    status: 'available',
    featured: true,
  },
]

/**
 * Validated sample data. Parsing at module load guarantees the static content
 * always matches the property model (the build fails fast on a malformed entry)
 * and mirrors exactly how a future API/CMS response would be validated before
 * being consumed by services and components.
 */
export const sampleProperties: Property[] = propertyListSchema.parse(rawProperties)
