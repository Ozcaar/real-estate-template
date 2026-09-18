/**
 * Provider-neutral image-source metadata (Zod runtime contract).
 *
 * Mirrors `app/core/image/image-source.ts` so the boundary regression
 * tests can verify the optional `*Meta` fields at runtime, not just at
 * compile time. The Zod schema is intentionally permissive about
 * unknown fields (`.passthrough()`) so a future provider that adds a
 * metadata field the schema does not yet know about does not break
 * parsing — the boundary only validates the canonical fields.
 */
import { z } from 'zod'

export const imageHotspotSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().min(0).max(1),
  height: z.number().min(0).max(1),
})

export const imageCropSchema = z.object({
  top: z.number().min(0).max(1),
  bottom: z.number().min(0).max(1),
  left: z.number().min(0).max(1),
  right: z.number().min(0).max(1),
})

export const imageAssetMetadataSchema = z.object({
  width: z.number().positive(),
  height: z.number().positive(),
  aspectRatio: z.number().positive(),
})

export const imageSourceMetaSchema = z.object({
  assetRef: z.string().min(1),
  assetUrl: z.string().url(),
  hotspot: imageHotspotSchema.optional(),
  crop: imageCropSchema.optional(),
  metadata: imageAssetMetadataSchema.optional(),
})
