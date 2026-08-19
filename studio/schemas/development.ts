import { defineField, defineType } from 'sanity'

/**
 * Sanity Studio — Development document schema (Task 117).
 *
 * The Studio schema is the source of truth for the agency
 * editor's content model. The Nuxt integration
 * (`server/utils/sanity-mappings.ts`) reads the published
 * dataset via GROQ and maps the documents into the
 * runtime boundary shape defined by
 * `app/features/developments/schemas/development.schema.ts`.
 *
 * **Field-name alignment.** Every field name in this
 * schema matches the GROQ projection in
 * `sanityDevelopmentQuery`. The image field is named
 * `image` (the natural Sanity convention); the GROQ
 * projection flattens it to a URL via `image.asset->url`.
 *
 * **Required fields.** The runtime Zod schema requires
 * `id`, `name`, `slug`, `status`, `location`, `description`,
 * `image` (all non-empty). The Studio schema mirrors the
 * same rule: `Rule.required()` on every required field.
 * The `priceFrom`, `priceTo`, `currency`, `sizeUnit`,
 * `units`, `bedrooms`, `areaFrom`, `areaTo`, `deliveryDate`,
 * and `featured` fields are optional at the Studio level
 * and at the runtime boundary.
 *
 * **Status enum.** The `status` field is the operational
 * status the development detail page uses for the
 * "Delivery" pill. The four options match the runtime
 * Zod schema (`developmentStatusSchema`).
 *
 * **Slug source.** The `slug` field is generated from the
 * `name` with `source: 'name'`. The editor can override
 * the slug manually. The slug is the canonical URL
 * parameter for `/developments/[slug]`.
 *
 * **Image.** The `image` field is a Sanity `image` with
 * `hotspot: true`. The hotspot is stored on the asset
 * but the pilot ignores it (the GROQ projection flattens
 * to the raw asset URL). The hotspot is enabled so the
 * hotspot / crop-aware URL builder (`@sanity/image-url`,
 * deferred) can pick it up without a schema migration.
 *
 * **Numeric fields.** The `priceFrom`, `priceTo`,
 * `areaFrom`, `areaTo` fields are non-negative numbers.
 * The `units` and `bedrooms` fields are non-negative
 * integers. The Studio's `Rule.min(0)` / `Rule.integer()`
 * validations match the runtime Zod schema's
 * `.nonnegative()` / `.int().nonnegative()` rules.
 *
 * **Delivery date.** The `deliveryDate` field is a free
 * string. The runtime Zod schema treats it as an opaque
 * non-empty string when present; the Studio does not
 * enforce a date format (the field is a YYYY-MM string or
 * a "Q4 2026" string in the bundled sample data). The
 * agency may add a stricter validator in a future task.
 *
 * **Field groups.** The schema groups fields into
 * "About", "Media", "Pricing", and "Status" tabs so the
 * editor's form is navigable. The default group is
 * "About" — the editor sees the name, slug, description,
 * and location first.
 *
 * **Preview.** The Studio preview shows the name
 * (subtitle = the location + status) for the document
 * list. The selection projection is the same shape the
 * GROQ query uses for the runtime mapping.
 */
export const developmentType = defineType({
  name: 'development',
  title: 'Development',
  type: 'document',
  groups: [
    { name: 'about', title: 'About', default: true },
    { name: 'media', title: 'Media' },
    { name: 'pricing', title: 'Pricing' },
    { name: 'status', title: 'Status' },
  ],
  fields: [
    defineField({
      name: 'name',
      title: 'Name',
      type: 'string',
      group: 'about',
      validation: (Rule) => Rule.required().min(1).max(200),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      group: 'about',
      options: {
        source: 'name',
        maxLength: 96,
        isUnique: () => true,
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'text',
      group: 'about',
      rows: 6,
      validation: (Rule) => Rule.required().min(1),
    }),
    defineField({
      name: 'location',
      title: 'Location',
      type: 'string',
      group: 'about',
      validation: (Rule) => Rule.required().min(1).max(200),
    }),
    defineField({
      name: 'image',
      title: 'Cover image',
      type: 'image',
      group: 'media',
      options: { hotspot: true },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'priceFrom',
      title: 'Price from',
      type: 'number',
      group: 'pricing',
      validation: (Rule) => Rule.min(0),
    }),
    defineField({
      name: 'priceTo',
      title: 'Price to',
      type: 'number',
      group: 'pricing',
      description: 'Optional. Omit when the development has a single price (same as `priceFrom`).',
      validation: (Rule) => Rule.min(0),
    }),
    defineField({
      name: 'currency',
      title: 'Currency (ISO 4217)',
      type: 'string',
      group: 'pricing',
      description: 'Optional. Three-letter ISO 4217 currency code (e.g. USD, EUR, MXN).',
      validation: (Rule) => Rule.min(1).max(8),
    }),
    defineField({
      name: 'sizeUnit',
      title: 'Size unit',
      type: 'string',
      group: 'pricing',
      options: {
        list: [
          { title: 'Metric (m²)', value: 'metric' },
          { title: 'Imperial (ft²)', value: 'imperial' },
        ],
      },
      initialValue: 'metric',
    }),
    defineField({
      name: 'units',
      title: 'Units',
      type: 'number',
      group: 'pricing',
      validation: (Rule) => Rule.min(0).integer(),
    }),
    defineField({
      name: 'bedrooms',
      title: 'Bedrooms',
      type: 'number',
      group: 'pricing',
      description: 'Optional. The typical bedroom count per unit.',
      validation: (Rule) => Rule.min(0).integer(),
    }),
    defineField({
      name: 'areaFrom',
      title: 'Area from',
      type: 'number',
      group: 'pricing',
      description: 'Optional. The smallest unit area (in the selected size unit).',
      validation: (Rule) => Rule.min(0),
    }),
    defineField({
      name: 'areaTo',
      title: 'Area to',
      type: 'number',
      group: 'pricing',
      description: 'Optional. The largest unit area (in the selected size unit).',
      validation: (Rule) => Rule.min(0),
    }),
    defineField({
      name: 'deliveryDate',
      title: 'Delivery date',
      type: 'string',
      group: 'pricing',
      description: 'Optional. Free-form text (e.g. "Q4 2026" or "2026-12"). The runtime model treats it as opaque text.',
    }),
    defineField({
      name: 'status',
      title: 'Status',
      type: 'string',
      group: 'status',
      options: {
        list: [
          { title: 'Pre-sale', value: 'pre-sale' },
          { title: 'Under construction', value: 'under-construction' },
          { title: 'Ready to deliver', value: 'ready-to-deliver' },
          { title: 'Sold out', value: 'sold-out' },
        ],
      },
      initialValue: 'pre-sale',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'featured',
      title: 'Featured',
      type: 'boolean',
      group: 'status',
      initialValue: false,
    }),
  ],
  preview: {
    select: {
      title: 'name',
      location: 'location',
      status: 'status',
      media: 'image',
    },
    prepare({ title, location, status, media }) {
      return {
        title: title ?? 'Untitled development',
        subtitle: [location, status].filter(Boolean).join(' · '),
        media,
      }
    },
  },
})
