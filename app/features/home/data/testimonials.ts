import type { HomeTestimonial } from '../types/home.types'

/**
 * Sample testimonials for the homepage social-proof section. All copy is
 * placeholder agency content and can be replaced per agency.
 */
export const homeTestimonials: HomeTestimonial[] = [
  {
    id: 'tst-001',
    name: 'María González',
    role: 'Bought a family home',
    quote:
      'The team understood exactly what we were looking for and found our home in weeks. The whole process felt effortless and transparent.',
    rating: 5,
  },
  {
    id: 'tst-002',
    name: 'James Carter',
    role: 'Sold an apartment',
    quote:
      'Professional, responsive and genuinely helpful. They priced our apartment perfectly and we closed above asking.',
    rating: 5,
  },
  {
    id: 'tst-003',
    name: 'Lucía Fernández',
    role: 'Rented an office',
    quote:
      'Great selection of commercial spaces and clear advice at every step. I would recommend them to any business owner.',
    rating: 4,
  },
]
