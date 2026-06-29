/**
 * Types for the homepage content modules.
 *
 * These describe the static showcase content of the landing page (locations
 * served, social proof and trust stats). They are owned by the home feature.
 */

/** An area / neighborhood the agency operates in. */
export interface HomeLocation {
  id: string
  /** Display name (agency content, not an i18n key). */
  name: string
  /** Slug used to deep-link into a filtered properties view. */
  slug: string
  /** Cover image path. */
  image: string
  /** Number of properties available in this area. */
  propertyCount: number
}

/** A customer testimonial used as social proof. */
export interface HomeTestimonial {
  id: string
  /** Person name (agency content). */
  name: string
  /** Person role / context (agency content). */
  role: string
  /** Testimonial body (agency content). */
  quote: string
  /** Rating from 1 to 5. */
  rating: number
  /** Optional avatar image path. */
  avatar?: string
}

/** A headline trust statistic. */
export interface HomeStat {
  id: string
  /** Pre-formatted value, e.g. `1,200+` (agency content). */
  value: string
  /** i18n key for the stat label. */
  labelKey: string
  /** Nuxt Icon name. */
  icon: string
}
