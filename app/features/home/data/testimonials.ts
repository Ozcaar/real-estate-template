import type { HomeTestimonial } from '../types/home.types'

/**
 * Bahía del Mar fictional rebrand testimonials (Task 122 dry-run).
 *
 * All copy is fictional placeholder content. The rebrand can
 * replace every entry with the agency's real client quotes; the
 * shape (`name`, `role`, `quote`, `rating`) is unchanged so the
 * home page renders without any component edit.
 */
export const homeTestimonials: HomeTestimonial[] = [
  {
    id: 'bdm-tst-001',
    name: 'Familia Reyes',
    role: 'Compraron casa de playa',
    quote:
      'El equipo de Bahía del Mar nos acompañó durante todo el proceso. Encontraron una casa con vista al mar que se ajustaba a lo que buscábamos.',
    rating: 5,
  },
  {
    id: 'bdm-tst-002',
    name: 'Mariana López',
    role: 'Rentó departamento',
    quote:
      'La atención fue rápida y profesional. El departamento que nos ofrecieron estaba en perfectas condiciones y la entrega fue puntual.',
    rating: 5,
  },
  {
    id: 'bdm-tst-003',
    name: 'Carlos Hernández',
    role: 'Inversionista',
    quote:
      'Su conocimiento del mercado local y de las nuevas zonas en desarrollo nos ayudó a tomar una buena decisión de inversión.',
    rating: 4,
  },
]
