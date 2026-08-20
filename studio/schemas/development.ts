import { defineField, defineType } from 'sanity'

/**
 * Sanity Studio — Development document schema (Task 117 + Task 119).
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
 * same rule: `Rule.required()` on every required field,
 * with a human-readable `.error(...)` message so the
 * editor sees the failing field name. The `priceFrom`,
 * `priceTo`, `currency`, `sizeUnit`, `units`, `bedrooms`,
 * `areaFrom`, `areaTo`, `deliveryDate`, and `featured`
 * fields are optional at the Studio level and at the
 * runtime boundary.
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
 * `.nonnegative()` / `.int().nonnegative()` rules. Each
 * numeric rule chains a human-readable `.error(...)`
 * message so the editor sees the failing field name.
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
 * (subtitle = the human-readable location + status) for
 * the document list. The status value is translated to
 * its human-readable form ("Pre-sale" instead of
 * "pre-sale") so a non-technical editor can scan the
 * document list at a glance. The selection projection is
 * the same shape the GROQ query uses for the runtime
 * mapping.
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
      description: 'The development\'s display name (e.g. "Mirador del Valle").',
      validation: (Rule) =>
        Rule.required()
          .error('Name is required.')
          .min(1)
          .error('Name cannot be empty.')
          .max(200)
          .error('Name must be 200 characters or fewer.'),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      group: 'about',
      description: 'The URL of the development page. Leave blank to generate from the name.',
      options: {
        source: 'name',
        maxLength: 96,
        isUnique: () => true,
      },
      validation: (Rule) => Rule.required().error('Slug is required.'),
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'text',
      group: 'about',
      rows: 6,
      description: 'A free-form paragraph shown on the development detail page. Plain text only (no markdown).',
      validation: (Rule) =>
        Rule.required()
          .error('Description is required.')
          .min(1)
          .error('Description cannot be empty.'),
    }),
    defineField({
      name: 'location',
      title: 'Location',
      type: 'string',
      group: 'about',
      description: 'City and neighborhood (e.g. "Monterrey, Nuevo León").',
      validation: (Rule) =>
        Rule.required()
          .error('Location is required.')
          .min(1)
          .error('Location cannot be empty.')
          .max(200)
          .error('Location must be 200 characters or fewer.'),
    }),
    defineField({
      name: 'image',
      title: 'Cover image',
      type: 'image',
      group: 'media',
      description: 'The primary visual on the development card and the detail page. Use a landscape image (16:9) for best results.',
      options: { hotspot: true },
      validation: (Rule) => Rule.required().error('A cover image is required.'),
    }),
    defineField({
      name: 'priceFrom',
      title: 'Starting price',
      type: 'number',
      group: 'pricing',
      description: 'The lowest price across units in the chosen currency. Omit for a price-on-application development.',
      validation: (Rule) => Rule.min(0).error('Starting price must be 0 or greater.'),
    }),
    defineField({
      name: 'priceTo',
      title: 'Top price',
      type: 'number',
      group: 'pricing',
      description: 'The highest price across units. Omit when the development has a single price (the same as the starting price).',
      validation: (Rule) => Rule.min(0).error('Top price must be 0 or greater.'),
    }),
    defineField({
      name: 'currency',
      title: 'Currency',
      type: 'string',
      group: 'pricing',
      description: 'The three-letter ISO 4217 code (e.g. USD, EUR, MXN). Optional — shown next to the prices above.',
      validation: (Rule) =>
        Rule.min(1)
          .error('Currency cannot be empty.')
          .max(8)
          .error('Currency code must be 8 characters or fewer.'),
    }),
    defineField({
      name: 'sizeUnit',
      title: 'Size unit',
      type: 'string',
      group: 'pricing',
      description: 'The unit of measure for the smallest / largest unit areas below.',
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
      title: 'Total units',
      type: 'number',
      group: 'pricing',
      description: 'The total number of units in the development.',
      validation: (Rule) =>
        Rule.min(0)
          .error('Total units must be 0 or greater.')
          .integer()
          .error('Total units must be a whole number.'),
    }),
    defineField({
      name: 'bedrooms',
      title: 'Typical bedrooms',
      type: 'number',
      group: 'pricing',
      description: 'The typical bedroom count per unit (e.g. 2 for a 2-bedroom development). Optional.',
      validation: (Rule) =>
        Rule.min(0)
          .error('Bedrooms must be 0 or greater.')
          .integer()
          .error('Bedrooms must be a whole number.'),
    }),
    defineField({
      name: 'areaFrom',
      title: 'Smallest unit area',
      type: 'number',
      group: 'pricing',
      description: 'The smallest unit area in the selected size unit. Optional.',
      validation: (Rule) => Rule.min(0).error('Smallest unit area must be 0 or greater.'),
    }),
    defineField({
      name: 'areaTo',
      title: 'Largest unit area',
      type: 'number',
      group: 'pricing',
      description: 'The largest unit area in the selected size unit. Optional.',
      validation: (Rule) => Rule.min(0).error('Largest unit area must be 0 or greater.'),
    }),
    defineField({
      name: 'deliveryDate',
      title: 'Delivery date',
      type: 'string',
      group: 'pricing',
      description: 'Free-form text (e.g. "Q4 2026" or "2026-12"). The runtime treats this as opaque text. Optional.',
    }),
    defineField({
      name: 'status',
      title: 'Status',
      type: 'string',
      group: 'status',
      description: 'The current development phase. Drives the "Delivery" pill on the detail page.',
      options: {
        list: [
          { title: 'Pre-sale', value: 'pre-sale' },
          { title: 'Under construction', value: 'under-construction' },
          { title: 'Ready to deliver', value: 'ready-to-deliver' },
          { title: 'Sold out', value: 'sold-out' },
        ],
      },
      initialValue: 'pre-sale',
      validation: (Rule) => Rule.required().error('Status is required.'),
    }),
    defineField({
      name: 'featured',
      title: 'Featured',
      type: 'boolean',
      group: 'status',
      description: 'Featured developments appear on the home page and the catalog hero.',
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
      const statusLabel
        = status === 'pre-sale'
          ? 'Pre-sale'
          : status === 'under-construction'
            ? 'Under construction'
            : status === 'ready-to-deliver'
              ? 'Ready to deliver'
              : status === 'sold-out'
                ? 'Sold out'
                : null
      const subtitle = [location, statusLabel].filter(Boolean).join(' · ')
      return {
        title: title ?? 'Untitled development',
        subtitle,
        media,
      }
    },
  },
})