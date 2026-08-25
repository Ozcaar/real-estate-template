import type { Agent } from '../types/agent.types'

/**
 * Bahía del Mar fictional rebrand team (Task 122 dry-run).
 *
 * The fictional team's names, bios, contact details, and
 * specialties are placeholder content. The contact phone /
 * WhatsApp values match the agency's `contact.phone` value
 * (`+52 322 123 4567`) so the rendered team cards stay
 * consistent with the footer / contact card. The rebrand can
 * later override individual agents with direct lines; the
 * template does not require this.
 */
export const sampleAgents: Agent[] = [
  {
    id: 'bdm-agent-001',
    name: 'Sofía Mendoza',
    slug: 'sofia-mendoza',
    role: 'Directora Asociada',
    bio: 'Más de 12 años asesorando a familias e inversionistas en la Riviera Nayarit. Especialista en propiedades residenciales y de lujo frente al mar.',
    image: '/images/agents/agent-01.svg',
    phone: '+52 322 123 4567',
    email: 'sofia@bahia-del-mar.test',
    whatsapp: '+52 322 123 4567',
    specialties: ['Residencial', 'Lujo'],
  },
  {
    id: 'bdm-agent-002',
    name: 'Andrés Vega',
    slug: 'andres-vega',
    role: 'Asesor Comercial',
    bio: 'Apoya a clientes que buscan locales comerciales, espacios para restaurantes y terrenos para desarrollo en la región.',
    image: '/images/agents/agent-02.svg',
    phone: '+52 322 123 4567',
    email: 'andres@bahia-del-mar.test',
    whatsapp: '+52 322 123 4567',
    specialties: ['Comercial', 'Terrenos'],
  },
  {
    id: 'bdm-agent-003',
    name: 'Camila Ortega',
    slug: 'camila-ortega',
    role: 'Coordinadora de Rentas',
    bio: 'Administra la cartera de rentas vacacionales y de larga estancia. Atiende a inquilinos y propietarios desde la publicación hasta la entrega.',
    image: '/images/agents/agent-03.svg',
    email: 'camila@bahia-del-mar.test',
    specialties: ['Rentas', 'Atención a clientes'],
  },
]
