import { defineField, defineType } from 'sanity'

/**
 * Sanity Studio — Agent document schema (Task 117 + Task 119).
 *
 * The Studio schema is the source of truth for the agency
 * editor's content model. The Nuxt integration
 * (`server/utils/sanity-mappings.ts`) reads the published
 * dataset via GROQ and maps the documents into the
 * runtime boundary shape defined by
 * `app/features/agents/schemas/agent.schema.ts`.
 *
 * **Field-name alignment.** Every field name in this
 * schema matches the GROQ projection in
 * `sanityAgentQuery`. The image field is named `image`
 * (the natural Sanity convention); the GROQ projection
 * flattens it to a URL via `image.asset->url`.
 *
 * **Required fields.** The runtime Zod schema requires
 * `id`, `name`, `slug`, `role`, `bio`, `image` (all
 * non-empty). The Studio schema mirrors the same rule:
 * `Rule.required()` on every required field, with a
 * human-readable `.error(...)` message so the editor sees
 * the failing field name. The `phone`, `email`,
 * `whatsapp`, and `specialties` fields are optional at the
 * Studio level and at the runtime boundary.
 *
 * **Email validation.** The `email` field uses Sanity's
 * built-in `Rule.email()` validation. The runtime Zod
 * schema does not enforce an email format (the documentation
 * notes that the field is a non-empty string when present),
 * so the Studio's stricter validation is a superset of the
 * runtime contract.
 *
 * **Phone and WhatsApp.** The fields are optional strings.
 * The Studio does not enforce a phone-format regex — the
 * runtime Zod schema does not either (`phone?: string`).
 * The agency owner can validate the format at content time.
 * The description tells the editor to use the international
 * format with a country code.
 *
 * **Slug source.** The `slug` field is generated from the
 * `name` with `source: 'name'`. The editor can override
 * the slug manually. The slug is the canonical URL
 * parameter for `/agents/[slug]`.
 *
 * **Image.** The `image` field is a Sanity `image` with
 * `hotspot: true` so the editor can set the focal point
 * (the hotspot is stored on the asset but the pilot
 * ignores it — the GROQ projection flattens to the raw
 * asset URL). The `hotspot: true` option is enabled
 * because hotspot / crop-aware URL building is a future
 * task (`@sanity/image-url` is deferred); the data is
 * already in the asset when the agency needs it.
 *
 * **Specialties.** The `specialties` field is an array of
 * strings. The runtime Zod schema validates each entry as
 * a non-empty string. The Studio uses `of: [{ type:
 * 'string' }]` with a per-item `.min(1)` validation.
 *
 * **Field groups.** The schema groups fields into
 * "About", "Media", and "Contact" tabs so the editor's
 * form is navigable. The default group is "About" — the
 * editor sees the name, slug, role, and bio first.
 *
 * **Preview.** The Studio preview shows the name (subtitle
 * = the role) for the document list. The selection
 * projection is the same shape the GROQ query uses for
 * the runtime mapping.
 */
export const agentType = defineType({
  name: 'agent',
  title: 'Agent',
  type: 'document',
  groups: [
    { name: 'about', title: 'About', default: true },
    { name: 'media', title: 'Media' },
    { name: 'contact', title: 'Contact' },
  ],
  fields: [
    defineField({
      name: 'name',
      title: 'Name',
      type: 'string',
      group: 'about',
      description: 'The agent\'s full name as displayed on the team listing and the detail page.',
      validation: (Rule) =>
        Rule.required()
          .error('Name is required.')
          .min(1)
          .error('Name cannot be empty.')
          .max(120)
          .error('Name must be 120 characters or fewer.'),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      group: 'about',
      description: 'The URL of the profile. Leave blank to generate from the name.',
      options: {
        source: 'name',
        maxLength: 96,
        isUnique: () => true,
      },
      validation: (Rule) => Rule.required().error('Slug is required.'),
    }),
    defineField({
      name: 'role',
      title: 'Role at the agency',
      type: 'string',
      group: 'about',
      description: 'A short role label (e.g. "Senior Real Estate Advisor").',
      validation: (Rule) =>
        Rule.required()
          .error('Role is required.')
          .min(1)
          .error('Role cannot be empty.')
          .max(120)
          .error('Role must be 120 characters or fewer.'),
    }),
    defineField({
      name: 'bio',
      title: 'Biography',
      type: 'text',
      group: 'about',
      rows: 6,
      description: 'A free-form paragraph shown on the agent detail page. Plain text only (no markdown).',
      validation: (Rule) =>
        Rule.required()
          .error('Biography is required.')
          .min(1)
          .error('Biography cannot be empty.'),
    }),
    defineField({
      name: 'specialties',
      title: 'Specialties',
      type: 'array',
      group: 'about',
      of: [{ type: 'string' }],
      options: { layout: 'tags' },
      description: 'Areas of expertise (e.g. "Luxury homes", "Beachfront", "Investments"). Optional.',
    }),
    defineField({
      name: 'image',
      title: 'Portrait',
      type: 'image',
      group: 'media',
      description: 'A square portrait (1:1) for best results. The hotspot is enabled so you can pick the focal point.',
      options: { hotspot: true },
      validation: (Rule) => Rule.required().error('A portrait image is required.'),
    }),
    defineField({
      name: 'phone',
      title: 'Phone number',
      type: 'string',
      group: 'contact',
      description: 'International format with country code (e.g. "+52 55 1234 5678"). Optional.',
    }),
    defineField({
      name: 'email',
      title: 'Email',
      type: 'string',
      group: 'contact',
      description: 'A valid email address. Optional.',
      validation: (Rule) => Rule.email().error('Please enter a valid email address.'),
    }),
    defineField({
      name: 'whatsapp',
      title: 'WhatsApp number',
      type: 'string',
      group: 'contact',
      description: 'International format with country code (e.g. "+52 55 1234 5678"). Optional — used for the "Chat on WhatsApp" button.',
    }),
  ],
  preview: {
    select: {
      title: 'name',
      role: 'role',
      media: 'image',
    },
    prepare({ title, role, media }) {
      return {
        title: title ?? 'Unnamed agent',
        subtitle: role ?? '',
        media,
      }
    },
  },
})