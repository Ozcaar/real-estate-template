import type { Property } from '../types/property.types'
import { propertyListSchema } from '../schemas/property.schema'

/**
 * Bahía del Mar fictional rebrand catalog (Task 122 dry-run).
 *
 * This is the rebranded sample data for the fictional Bahía del
 * Mar Propiedades agency (a Mexican Pacific coast boutique
 * agency). Every title, description, address, currency value, and
 * price is fictional placeholder content. The shape matches the
 * `Property` model exactly so the runtime Zod validation passes
 * at module load (and so the service layer, the page components,
 * and the JSON-LD builder consume the catalog without any code
 * change).
 *
 * The catalog intentionally mixes operation types (sale + rent),
 * property types (house / apartment / land / commercial /
 * office), and statuses (available / reserved) so the
 * `/properties` listing exercises every filter and sort branch.
 */
const rawProperties: Property[] = [
  {
    id: 'bdm-prop-001',
    title: 'Casa Vista al Mar en Sayulita',
    slug: 'casa-vista-al-mar-sayulita',
    description:
      'Casa de dos plantas con vista directa al océano, terraza cubierta y piscina privada. A cinco minutos del centro de Sayulita y de la playa principal.',
    operationType: 'sale',
    propertyType: 'house',
    price: 12500000,
    currency: 'MXN',
    location: 'Camino a Playa Los Muertos 12',
    city: 'Sayulita',
    state: 'Nayarit',
    country: 'México',
    bedrooms: 3,
    bathrooms: 3,
    parkingSpaces: 2,
    sizeUnit: 'metric',
    constructionSize: 240,
    landSize: 380,
    images: [
      '/images/properties/property-01.svg',
      '/images/properties/property-02.svg',
      '/images/properties/property-03.svg',
    ],
    coverImage: '/images/properties/property-01.svg',
    amenities: ['alberca', 'terraza', 'vista-al-mar'],
    status: 'available',
    featured: true,
  },
  {
    id: 'bdm-prop-002',
    title: 'Departamento en Renta — Punta Mita',
    slug: 'departamento-renta-punta-mita',
    description:
      'Departamento amueblado de dos recámaras con acceso a club de playa, gimnasio y seguridad 24 horas. Renta mensual con mantenimiento incluido.',
    operationType: 'rent',
    propertyType: 'apartment',
    price: 38000,
    currency: 'MXN',
    location: 'Condominio Pacífico, Lote 4',
    city: 'Punta Mita',
    state: 'Nayarit',
    country: 'México',
    bedrooms: 2,
    bathrooms: 2,
    parkingSpaces: 1,
    sizeUnit: 'metric',
    constructionSize: 110,
    images: [
      '/images/properties/property-02.svg',
      '/images/properties/property-03.svg',
      '/images/properties/property-04.svg',
    ],
    coverImage: '/images/properties/property-02.svg',
    amenities: ['amueblado', 'gimnasio', 'club-de-playa'],
    status: 'available',
    featured: true,
  },
  {
    id: 'bdm-prop-003',
    title: 'Terreno Residencial en San Pancho',
    slug: 'terreno-residencial-san-pancho',
    description:
      'Lote plano con servicios subterráneos instalados, dentro de comunidad cerrada con acceso controlado. Ideal para construir casa de descanso.',
    operationType: 'sale',
    propertyType: 'land',
    price: 3200000,
    currency: 'MXN',
    location: 'Av. Las Palmas, Lote 18',
    city: 'San Francisco (San Pancho)',
    state: 'Nayarit',
    country: 'México',
    sizeUnit: 'metric',
    landSize: 540,
    images: [
      '/images/properties/property-03.svg',
      '/images/properties/property-04.svg',
      '/images/properties/property-05.svg',
    ],
    coverImage: '/images/properties/property-03.svg',
    amenities: ['servicios-subterraneos', 'acceso-controlado'],
    status: 'available',
    featured: false,
  },
  {
    id: 'bdm-prop-004',
    title: 'Local Comercial sobre Boulevard Riviera',
    slug: 'local-comercial-boulevard-riviera',
    description:
      'Local comercial en planta baja con gran visibilidad sobre el boulevard principal. Apto para restaurante, boutique o tienda de surf.',
    operationType: 'rent',
    propertyType: 'commercial',
    price: 65000,
    currency: 'MXN',
    location: 'Blvd. Riviera Nayarit 245',
    city: 'Bucerías',
    state: 'Nayarit',
    country: 'México',
    sizeUnit: 'metric',
    constructionSize: 95,
    images: [
      '/images/properties/property-04.svg',
      '/images/properties/property-05.svg',
      '/images/properties/property-06.svg',
    ],
    coverImage: '/images/properties/property-04.svg',
    amenities: ['planta-baja', 'frente-a-boulevard'],
    status: 'reserved',
    featured: false,
  },
  {
    id: 'bdm-prop-005',
    title: 'Oficina Corporativa en Centro Financiero',
    slug: 'oficina-corporativa-centro-financiero',
    description:
      'Oficina amueblada en piso alto con sala de juntas, recepción y vista panorámica al mar. Estacionamiento y vigilancia 24 horas.',
    operationType: 'rent',
    propertyType: 'office',
    price: 48000,
    currency: 'MXN',
    location: 'Torre Pacífico, Piso 12',
    city: 'Punta Mita',
    state: 'Nayarit',
    country: 'México',
    parkingSpaces: 2,
    sizeUnit: 'metric',
    constructionSize: 120,
    images: [
      '/images/properties/property-05.svg',
      '/images/properties/property-06.svg',
      '/images/properties/property-01.svg',
    ],
    coverImage: '/images/properties/property-05.svg',
    amenities: ['amueblada', 'sala-de-juntas', 'estacionamiento'],
    status: 'available',
    featured: false,
  },
]

/**
 * Validated sample data. Parsing at module load guarantees the
 * static content always matches the property model (the build
 * fails fast on a malformed entry) and mirrors exactly how a
 * future API / CMS response would be validated before being
 * consumed by services and components.
 */
export const sampleProperties: Property[] = propertyListSchema.parse(rawProperties)
