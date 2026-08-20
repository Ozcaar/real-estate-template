import { defineField, defineType } from 'sanity'

/**
 * Sanity Studio — Property document schema (Task 117 + Task 119).
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
 * on save. Each required rule chains an `.error(...)` with
 * a human-readable message so the editor sees the failing
 * field name instead of the generic "Field is required".
 * The runtime Zod schema (`propertyListSchema`) is the
 * authoritative boundary for the Nuxt app; the Studio
 * validation is the authoritative boundary for the editor.
 * The two are matched by hand — when a field is required
 * in the runtime schema, it is also required in the Studio
 * schema (and vice versa).
 *
 * **Conditional relevance.** When `propertyType` is
 * `"land"`, the fields that only apply to built properties
 * (`bedrooms`, `bathrooms`, `parkingSpaces`,
 * `constructionSize`) are hidden via the field-level
 * `hidden({ document }) => document?.propertyType === 'land'`
 * helper. The values are preserved in the document so a
 * later change back to "house" or "apartment" does not lose
 * data. No other conditional rules — the runtime has no
 * notion of "land-only" filtering and the editor's mental
 * model is simpler when the field count matches the
 * property kind.
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
 * strings. The runtime Zod schema validates each entry as
 * a non-empty string. The Studio uses `of: [{ type:
 * 'string' }]` with a per-item `.min(1)` validation. The
 * array itself may be empty (the runtime allows an empty
 * array) — only the inner strings are required.
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
 * ("Content", "Pricing", "Details", "Media", "Location",
 * "References", "Status") so the editor's form is
 * navigable. The default group is "Content" — the editor
 * sees the title, slug, and description first. The groups
 * match the editor's mental model: "what is it",
 * "what does it cost", "how big is it", "show me",
 * "where is it", "who manages it", "what state is it in".
 *
 * **Preview.** The Studio preview shows the title
 * (subtitle = the operation label + location + status
 * label) and the cover image as the thumbnail. The status
 * and operation labels are translated to human-readable
 * form ("Available" instead of "available", "For sale"
 * instead of "sale") so a non-technical editor can scan
 * the document list at a glance. The selection projection
 * is the same shape the GROQ query uses for the runtime
 * mapping.
 */
export const propertyType = defineType({
  name: 'property',
  title: 'Property',
  type: 'document',
  groups: [
    { name: 'content', title: 'Content', default: true },
    { name: 'pricing', title: 'Pricing' },
    { name: 'details', title: 'Details' },
    { name: 'media', title: 'Media' },
    { name: 'location', title: 'Location' },
    { name: 'references', title: 'References' },
    { name: 'status', title: 'Status' },
  ],
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      group: 'content',
      description: 'The headline shown on the listing card and the detail page.',
      validation: (Rule) =>
        Rule.required()
          .error('Title is required.')
          .min(1)
          .error('Title cannot be empty.')
          .max(200)
          .error('Title must be 200 characters or fewer.'),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      group: 'content',
      description: 'The URL of the listing. Leave blank to generate from the title.',
      options: {
        source: 'title',
        maxLength: 96,
        isUnique: () => true,
      },
      validation: (Rule) => Rule.required().error('Slug is required.'),
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'text',
      group: 'content',
      rows: 6,
      description: 'A free-form paragraph shown on the detail page. Plain text only (no markdown).',
      validation: (Rule) =>
        Rule.required()
          .error('Description is required.')
          .min(1)
          .error('Description cannot be empty.'),
    }),
    defineField({
      name: 'operationType',
      title: 'Listing type',
      type: 'string',
      group: 'content',
      description: 'Whether the listing is for sale or for rent.',
      options: {
        list: [
          { title: 'For sale', value: 'sale' },
          { title: 'For rent', value: 'rent' },
        ],
        layout: 'radio',
      },
      initialValue: 'sale',
      validation: (Rule) => Rule.required().error('Choose whether the listing is for sale or for rent.'),
    }),
    defineField({
      name: 'propertyType',
      title: 'Property type',
      type: 'string',
      group: 'content',
      description: 'The kind of property this listing represents.',
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
      validation: (Rule) => Rule.required().error('Choose the property type.'),
    }),
    defineField({
      name: 'amenities',
      title: 'Amenities',
      type: 'array',
      group: 'content',
      of: [{ type: 'string' }],
      options: { layout: 'tags' },
      description: 'Free-form tags visitors can scan (e.g. "Pool", "Parking", "24/7 Security"). Leave empty for none.',
      validation: (Rule) => Rule.required().error('Amenities is required (the list may be empty).'),
    }),
    defineField({
      name: 'price',
      title: 'Price',
      type: 'number',
      group: 'pricing',
      description: 'The total asking price in the chosen currency. Use 0 when the price is on application.',
      validation: (Rule) =>
        Rule.required()
          .error('Price is required.')
          .min(0)
          .error('Price must be 0 or greater.'),
    }),
    defineField({
      name: 'currency',
      title: 'Currency',
      type: 'string',
      group: 'pricing',
      description: 'The three-letter ISO 4217 code (e.g. USD, EUR, MXN).',
      validation: (Rule) =>
        Rule.required()
          .error('Currency is required.')
          .min(1)
          .error('Currency cannot be empty.')
          .max(8)
          .error('Currency code must be 8 characters or fewer.'),
    }),
    defineField({
      name: 'bedrooms',
      title: 'Bedrooms',
      type: 'number',
      group: 'details',
      description: 'The number of bedrooms. Hidden when the property type is "Land".',
      hidden: ({ document }) => document?.propertyType === 'land',
      validation: (Rule) =>
        Rule.min(0)
          .error('Bedrooms must be 0 or greater.')
          .integer()
          .error('Bedrooms must be a whole number.'),
    }),
    defineField({
      name: 'bathrooms',
      title: 'Bathrooms',
      type: 'number',
      group: 'details',
      description: 'The number of bathrooms. Hidden when the property type is "Land".',
      hidden: ({ document }) => document?.propertyType === 'land',
      validation: (Rule) => Rule.min(0).error('Bathrooms must be 0 or greater.'),
    }),
    defineField({
      name: 'parkingSpaces',
      title: 'Parking spaces',
      type: 'number',
      group: 'details',
      description: 'The number of parking spaces. Hidden when the property type is "Land".',
      hidden: ({ document }) => document?.propertyType === 'land',
      validation: (Rule) =>
        Rule.min(0)
          .error('Parking spaces must be 0 or greater.')
          .integer()
          .error('Parking spaces must be a whole number.'),
    }),
    defineField({
      name: 'sizeUnit',
      title: 'Size unit',
      type: 'string',
      group: 'details',
      description: 'The unit of measure for the construction and land sizes below.',
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
      title: 'Construction size',
      type: 'number',
      group: 'details',
      description: 'The interior living area in the selected size unit. Hidden when the property type is "Land".',
      hidden: ({ document }) => document?.propertyType === 'land',
      validation: (Rule) => Rule.min(0).error('Construction size must be 0 or greater.'),
    }),
    defineField({
      name: 'landSize',
      title: 'Land size',
      type: 'number',
      group: 'details',
      description: 'The total lot size in the selected size unit.',
      validation: (Rule) => Rule.min(0).error('Land size must be 0 or greater.'),
    }),
    defineField({
      name: 'coverImage',
      title: 'Cover image',
      type: 'image',
      group: 'media',
      description: 'The primary visual on the catalog card and the detail page. Use a landscape image (16:9 or 4:3) for best results.',
      options: { hotspot: false },
      validation: (Rule) => Rule.required().error('A cover image is required.'),
    }),
    defineField({
      name: 'images',
      title: 'Gallery',
      type: 'array',
      group: 'media',
      of: [{ type: 'image', options: { hotspot: false } }],
      description: 'Additional images shown in the property gallery (the cover image is the first image the visitor sees). Add 2 to 5 high-quality images.',
      validation: (Rule) => Rule.required().error('At least one gallery image is required.'),
    }),
    defineField({
      name: 'location',
      title: 'Street address',
      type: 'string',
      group: 'location',
      description: 'The full street address or a human-readable location (e.g. "123 Main Street, Polanco").',
      validation: (Rule) =>
        Rule.required()
          .error('Street address is required.')
          .min(1)
          .error('Street address cannot be empty.'),
    }),
    defineField({
      name: 'city',
      title: 'City',
      type: 'string',
      group: 'location',
      description: 'The city name (e.g. "Mexico City").',
      validation: (Rule) =>
        Rule.required()
          .error('City is required.')
          .min(1)
          .error('City cannot be empty.'),
    }),
    defineField({
      name: 'state',
      title: 'State / region',
      type: 'string',
      group: 'location',
      description: 'The state, region, or province (e.g. "CDMX").',
      validation: (Rule) =>
        Rule.required()
          .error('State / region is required.')
          .min(1)
          .error('State / region cannot be empty.'),
    }),
    defineField({
      name: 'country',
      title: 'Country',
      type: 'string',
      group: 'location',
      description: 'The country name (e.g. "Mexico").',
      validation: (Rule) =>
        Rule.required()
          .error('Country is required.')
          .min(1)
          .error('Country cannot be empty.'),
    }),
    defineField({
      name: 'coordinates',
      title: 'Coordinates',
      type: 'geopoint',
      group: 'location',
      description: 'Optional geographic coordinates (latitude and longitude). The Studio shows two numeric inputs — no map picker is bundled with this template.',
    }),
    defineField({
      name: 'agent',
      title: 'Agent',
      type: 'reference',
      group: 'references',
      to: [{ type: 'agent' }],
      description: 'The agent who manages this listing. Pick from the existing agents in the dataset (leave empty if unassigned).',
    }),
    defineField({
      name: 'development',
      title: 'Development',
      type: 'reference',
      group: 'references',
      to: [{ type: 'development' }],
      description: 'The development this listing belongs to. Leave empty for standalone listings.',
    }),
    defineField({
      name: 'status',
      title: 'Status',
      type: 'string',
      group: 'status',
      description: 'The operational status. A published property with the "Hidden" status stays in the published dataset but is excluded from the public catalog (the GROQ query filters on `status != "hidden"`). Sanity drafts are a separate concept and are not part of the current Nuxt integration — the Nuxt app reads the published dataset only.',
      options: {
        list: [
          { title: 'Available', value: 'available' },
          { title: 'Sold', value: 'sold' },
          { title: 'Rented', value: 'rented' },
          { title: 'Reserved', value: 'reserved' },
          { title: 'Hidden (not visible in the catalog)', value: 'hidden' },
        ],
      },
      initialValue: 'available',
      validation: (Rule) => Rule.required().error('Status is required.'),
    }),
    defineField({
      name: 'featured',
      title: 'Featured',
      type: 'boolean',
      group: 'status',
      description: 'Featured properties appear on the home page and the catalog hero.',
      initialValue: false,
    }),
  ],
  preview: {
    select: {
      title: 'title',
      location: 'location',
      status: 'status',
      operationType: 'operationType',
      media: 'coverImage',
    },
    prepare({ title, location, status, operationType, media }) {
      const operationLabel
        = operationType === 'sale'
          ? 'For sale'
          : operationType === 'rent'
            ? 'For rent'
            : null
      const statusLabel
        = status === 'available'
          ? 'Available'
          : status === 'sold'
            ? 'Sold'
            : status === 'rented'
              ? 'Rented'
              : status === 'reserved'
                ? 'Reserved'
                : status === 'hidden'
                  ? 'Hidden'
                  : null
      const subtitle = [operationLabel, location, statusLabel].filter(Boolean).join(' · ')
      return {
        title: title ?? 'Untitled property',
        subtitle,
        media,
      }
    },
  },
})