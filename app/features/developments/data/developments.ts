import type { Development } from '../types/development.types'

/**
 * Bahía del Mar fictional rebrand development portfolio
 * (Task 122 dry-run).
 *
 * Two fictional developments on the Mexican Pacific coast. The
 * status, location, price range, and delivery-date values are
 * fictional placeholder content. The shape matches the
 * `Development` model exactly so the runtime Zod validation
 * passes at module load.
 */
export const sampleDevelopments: Development[] = [
  {
    id: 'bdm-dev-001',
    name: 'Residencial Costa Banderas',
    slug: 'residencial-costa-banderas',
    status: 'pre-sale',
    location: 'Nuevo Vallarta, Nayarit',
    description:
      'Conjunto de 32 condominios de dos y tres recámaras con vista al mar, alberca infinity y acceso controlado. Preventa con descuentos por etapa.',
    image: '/images/developments/development-01.svg',
    priceFrom: 4800000,
    priceTo: 8900000,
    currency: 'MXN',
    units: 32,
    bedrooms: 3,
    sizeUnit: 'metric',
    areaFrom: 95,
    areaTo: 165,
    deliveryDate: '2026-09',
    featured: true,
  },
  {
    id: 'bdm-dev-002',
    name: 'Villas Punta Sayulita',
    slug: 'villas-punta-sayulita',
    status: 'under-construction',
    location: 'Sayulita, Nayarit',
    description:
      'Ocho villas privadas con jardín, roof garden y acceso a la playa a pie. Construcción en etapa final; entrega programada para finales del próximo año.',
    image: '/images/developments/development-02.svg',
    priceFrom: 9500000,
    priceTo: 14200000,
    currency: 'MXN',
    units: 8,
    bedrooms: 3,
    sizeUnit: 'metric',
    areaFrom: 180,
    areaTo: 260,
    deliveryDate: '2026-04',
    featured: false,
  },
]
