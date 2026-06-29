/**
 * Agent domain model.
 *
 * Mirrors `docs/DATA_MODELS.md`. Kept inside the agents feature (not the
 * global `types/`) because it is owned by this module. The shape is
 * backend-friendly so the static MVP data can later be replaced by an API
 * response without touching components.
 */

export interface Agent {
  /** Unique agent identifier. */
  id: string
  /** Display name. */
  name: string
  /** Role / position within the agency (agency content, not i18n). */
  role: string
  /** Short biography shown on the team card. */
  bio: string
  /** Cover / portrait image path (served from `public/`). */
  image: string
  /** Direct phone line, optional. */
  phone?: string
  /** Direct email, optional. */
  email?: string
  /** WhatsApp number (digits or human-formatted), optional. */
  whatsapp?: string
  /** Short specialty tags, optional. */
  specialties?: string[]
}
