import type { Agent } from '../types/agent.types'

/**
 * Sample agents for the MVP team page.
 *
 * This is placeholder agency content (names, roles, bios, photos are
 * intentionally raw strings, not i18n keys). In a later phase a service
 * can fetch the same shape from an API without changing components. Images
 * point to local SVG placeholders under `public/images` so the template
 * renders offline; agencies replace them with real portraits.
 */
export const sampleAgents: Agent[] = [
  {
    id: 'agent-001',
    name: 'María González',
    slug: 'maria-gonzalez',
    role: 'Senior Advisor',
    bio: 'Over a decade helping families and investors find the right home in the metropolitan area. Specialist in residential sales.',
    image: '/images/agents/agent-01.svg',
    phone: '1-800-555-1234',
    email: 'maria@example.com',
    whatsapp: '1-800-555-1234',
    specialties: ['Residential', 'First-time buyers'],
  },
  {
    id: 'agent-002',
    name: 'James Carter',
    slug: 'james-carter',
    role: 'Commercial Specialist',
    bio: 'Focused on commercial properties, retail spaces and office leasing. Background in real estate finance.',
    image: '/images/agents/agent-02.svg',
    phone: '1-800-555-1234',
    email: 'james@example.com',
    whatsapp: '1-800-555-1234',
    specialties: ['Commercial', 'Leasing'],
  },
  {
    id: 'agent-003',
    name: 'Lucía Fernández',
    slug: 'lucia-fernandez',
    role: 'Rentals Lead',
    bio: 'Coordinates the rentals portfolio and supports tenants and landlords from listing to move-in.',
    image: '/images/agents/agent-03.svg',
    email: 'lucia@example.com',
    specialties: ['Rentals', 'Tenant relations'],
  },
  {
    id: 'agent-004',
    name: 'Daniel Ramírez',
    slug: 'daniel-ramirez',
    role: 'Land & Developments',
    bio: 'Advises clients on land acquisitions, residential developments and long-term investment opportunities.',
    image: '/images/agents/agent-04.svg',
    phone: '1-800-555-1234',
    whatsapp: '1-800-555-1234',
    specialties: ['Land', 'Investments'],
  },
]
