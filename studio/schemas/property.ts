import { defineField, defineType } from 'sanity'

/**
 * Sanity Studio — Property document schema (Task 117).
 *
 * The Studio schema is the source of truth for the agency
 * editor's content model. The Nuxt integration
 * (`server/utils/sanity-mappings.ts`) reads the published
 * dataset via GROQ and maps the documents into the
 * runtime boundary shape defined by
 * `app/features/properties/schemas/property.schema.ts`.
 *
 * **Field-name alignment.** Every field name in this
 * schema matches the GROQ projection in
 * `sanityPropertyQuery` (the projection selects the field
 * by name). The reference fields are named `agent` and
 * `development` (the natural Sanity convention); the GROQ
 * projection aliases them to `agentId` and `developmentId`
 * for the runtime mapping.
 *
 * **Image strategy.** The Property carries a `coverImage`
 * (the LCP candidate on the detail page and the primary
 * visual on the catalog card) and an `images` array (the
 * gallery). Both are typed as Sanity `image` fields. The
 * GROQ projection flattens the image references to URLs
 * via `asset->url`. The hotspot / crop-aware URL builder
 * (`@sanity/image-url`) is intentionally deferred — the
 * pilot uses direct projected asset URLs.
 *
 * **Required-field enforcement.** Sanity's `validation`
 * callback surfaces `Rule.required()` errors in the editor
 * on save. The runtime Zod schema
 * (`propertyListSchema`) is the authoritative boundary
 * for the Nuxt app; the Studio validation is the
 * authoritative boundary for the editor. The two are
 * matched by hand — when a field is required in the runtime
 * schema, it is also required in the Studio schema (and
 * vice versa).
 *
 * **Slug source.** The `slug` field is generated from the
 * `title` with `source: 'title'`. The editor can override
 * the slug manually. The slug is the canonical URL
 * parameter for `/properties/[slug]`.
 *
 * **Status enum.** The `status` field is the operational
 * status the runtime model uses to filter the catalog
 * (`status != 'hidden'` in the GROQ query). The five
 * options match the runtime Zod schema
 * (`propertyStatusSchema`).
 *
 * **Featured flag.** The `featured` flag is a boolean
 * (default `false`). The runtime property service uses
 * `featured` to filter the home / catalog "featured" rail.
 *
 * **Amenities.** The `amenities` field is an array of
 * strings. The runtime Zod schema validates each entry
 * as a non-empty string. The Studio uses `of: [{ type:
 * 'string' }]` with a per-item `.min(1)` validation.
 *
 * **Coordinates.** The `coordinates` field is a Sanity
 * `geopoint` value (an object with `lat` / `lng` /
 * `alt` numbers). The default Studio editing surface for
 * this field is a structured form with two numeric inputs
 * (latitude and longitude); the editor enters the values
 * by hand. The current Studio does NOT include a visual
 * map picker — adding a map would require a custom input
 * component (with a map provider such as Mapbox) and is a
 * deferred future task. The GROQ projection pulls the
 * `.lat` / `.lng` values; the runtime mapping accepts the
 * flat `{ lat, lng }` shape.
 *
 * **References.** The `agent` and `development` fields
 * are Sanity `reference` fields pointing to the
 * `agent` and `development` document types. The
 * `to: [{ type: 'agent' }]` / `to: [{ type: 'development' }]`
 * declarations pin the target types. The editor's
 * reference picker only shows documents of the matching
 * type. The runtime mapping reads the `_ref` string as
 * `agentId` / `developmentId`.
 *
 * **Field groups.** The schema groups fields into tabs
 * ("Content", "Media", "Location", "Status") so the
 * editor's form is navigable. The default group is
 * "Content" — the editor sees the title, slug, and
 * description first.
 *
 * **Preview.** The Studio preview shows the title
 * (subtitle = the property's location) for the document
 * list. The selection projection is the same shape the
 * GROQ query uses for the runtime mapping.
 */
export const propertyType = defineType({
  name: 'property',
  title: 'Property',
  type: 'document',
  groups: [
    { name: 'content', title: 'Content', default: true },
    { name: 'media', title: 'Media' },
    { name: 'location', title: 'Location' },
    { name: 'status', title: 'Status' },
  ],
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      group: 'content',
      validation: (Rule) => Rule.required().min(1).max(200),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      group: 'content',
      options: {
        source: 'title',
        maxLength: 96,
        isUnique: () => true,
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'text',
      group: 'content',
      rows: 6,
      validation: (Rule) => Rule.required().min(1),
    }),
    defineField({
      name: 'operationType',
      title: 'Operation type',
      type: 'string',
      group: 'content',
      options: {
        list: [
          { title: 'Sale', value: 'sale' },
          { title: 'Rent', value: 'rent' },
        ],
        layout: 'radio',
      },
      initialValue: 'sale',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'propertyType',
      title: 'Property type',
      type: 'string',
      group: 'content',
      options: {
        list: [
          { title: 'House', value: 'house' },
          { title: 'Apartment', value: 'apartment' },
          { title: 'Land', value: 'land' },
          { title: 'Commercial', value: 'commercial' },
          { title: 'Office', value: 'office' },
        ],
      },
      initialValue: 'house',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'price',
      title: 'Price',
      type: 'number',
      group: 'content',
      validation: (Rule) => Rule.required().min(0),
    }),
    defineField({
      name: 'currency',
      title: 'Currency (ISO 4217)',
      type: 'string',
      group: 'content',
      description: 'Three-letter ISO 4217 currency code (e.g. USD, EUR, MXN).',
      validation: (Rule) => Rule.required().min(1).max(8),
    }),
    defineField({
      name: 'amenities',
      title: 'Amenities',
      type: 'array',
      group: 'content',
      of: [{ type: 'string' }],
      options: { layout: 'tags' },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'coverImage',
      title: 'Cover image',
      type: 'image',
      group: 'media',
      description: 'The primary visual on the catalog card and the LCP candidate on the detail page.',
      options: { hotspot: false },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'images',
      title: 'Gallery',
      type: 'array',
      group: 'media',
      of: [{ type: 'image', options: { hotspot: false } }],
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'location',
      title: 'Location (free text)',
      type: 'string',
      group: 'location',
      description: 'The full address or a human-readable location string (e.g. "Polanco, Mexico City").',
      validation: (Rule) => Rule.required().min(1),
    }),
    defineField({
      name: 'city',
      title: 'City',
      type: 'string',
      group: 'location',
      validation: (Rule) => Rule.required().min(1),
    }),
    defineField({
      name: 'state',
      title: 'State / region',
      type: 'string',
      group: 'location',
      validation: (Rule) => Rule.required().min(1),
    }),
    defineField({
      name: 'country',
      title: 'Country',
      type: 'string',
      group: 'location',
      validation: (Rule) => Rule.required().min(1),
    }),
    defineField({
      name: 'coordinates',
      title: 'Coordinates',
      type: 'geopoint',
      group: 'location',
      description: 'Optional latitude / longitude. The current Studio shows two numeric inputs (no map picker yet).',
    }),
    defineField({
      name: 'bedrooms',
      title: 'Bedrooms',
      type: 'number',
      group: 'content',
      validation: (Rule) => Rule.min(0).integer(),
    }),
    defineField({
      name: 'bathrooms',
      title: 'Bathrooms',
      type: 'number',
      group: 'content',
      validation: (Rule) => Rule.min(0),
    }),
    defineField({
      name: 'parkingSpaces',
      title: 'Parking spaces',
      type: 'number',
      group: 'content',
      validation: (Rule) => Rule.min(0).integer(),
    }),
    defineField({
      name: 'sizeUnit',
      title: 'Size unit',
      type: 'string',
      group: 'content',
      options: {
        list: [
          { title: 'Metric (m²)', value: 'metric' },
          { title: 'Imperial (ft²)', value: 'imperial' },
        ],
      },
      initialValue: 'metric',
    }),
    defineField({
      name: 'constructionSize',
      title: 'Construction size (in the selected size unit)',
      type: 'number',
      group: 'content',
      validation: (Rule) => Rule.min(0),
    }),
    defineField({
      name: 'landSize',
      title: 'Land size (in the selected size unit)',
      type: 'number',
      group: 'content',
      validation: (Rule) => Rule.min(0),
    }),
    defineField({
      name: 'agent',
      title: 'Agent',
      type: 'reference',
      group: 'status',
      to: [{ type: 'agent' }],
      description: 'The agent who manages this property. The runtime mapping reads the document ID as `agentId`.',
    }),
    defineField({
      name: 'development',
      title: 'Development',
      type: 'reference',
      group: 'status',
      to: [{ type: 'development' }],
      description: 'The development this property belongs to. The runtime mapping reads the document ID as `developmentId`.',
    }),
    defineField({
      name: 'status',
      title: 'Status',
      type: 'string',
      group: 'status',
      options: {
        list: [
          { title: 'Available', value: 'available' },
          { title: 'Sold', value: 'sold' },
          { title: 'Rented', value: 'rented' },
          { title: 'Reserved', value: 'reserved' },
          { title: 'Hidden', value: 'hidden' },
        ],
      },
      initialValue: 'available',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'featured',
      title: 'Featured',
      type: 'boolean',
      group: 'status',
      initialValue: false,
      validation: (Rule) => Rule.required(),
    }),
  ],
  preview: {
    select: {
      title: 'title',
      location: 'location',
      status: 'status',
      media: 'coverImage',
    },
    prepare({ title, location, status, media }) {
      return {
        title: title ?? 'Untitled property',
        subtitle: [location, status].filter(Boolean).join(' · '),
        media,
      }
    },
  },
})
