import { defineField, defineType } from 'sanity'

/**
 * Sanity Studio — Agent document schema (Task 117).
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
 * `Rule.required()` on every required field. The
 * `phone`, `email`, `whatsapp`, and `specialties` fields
 * are optional at the Studio level and at the runtime
 * boundary.
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
 * **Field groups.** The schema groups fields into "About",
 * "Media", and "Contact" tabs so the editor's form is
 * navigable. The default group is "About" — the editor
 * sees the name, slug, role, and bio first.
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
      validation: (Rule) => Rule.required().min(1).max(120),
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
      name: 'role',
      title: 'Role',
      type: 'string',
      group: 'about',
      description: 'The agent\'s role at the agency (e.g. "Senior Real Estate Advisor").',
      validation: (Rule) => Rule.required().min(1).max(120),
    }),
    defineField({
      name: 'bio',
      title: 'Biography',
      type: 'text',
      group: 'about',
      rows: 6,
      validation: (Rule) => Rule.required().min(1),
    }),
    defineField({
      name: 'image',
      title: 'Portrait',
      type: 'image',
      group: 'media',
      options: { hotspot: true },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'specialties',
      title: 'Specialties',
      type: 'array',
      group: 'about',
      of: [{ type: 'string' }],
      options: { layout: 'tags' },
      description: 'Optional. Free-form tags (e.g. "Luxury homes", "Beachfront", "Investments").',
    }),
    defineField({
      name: 'phone',
      title: 'Phone',
      type: 'string',
      group: 'contact',
    }),
    defineField({
      name: 'email',
      title: 'Email',
      type: 'string',
      group: 'contact',
      validation: (Rule) => Rule.email(),
    }),
    defineField({
      name: 'whatsapp',
      title: 'WhatsApp number',
      type: 'string',
      group: 'contact',
      description: 'Optional. International format with country code (e.g. "+52 55 1234 5678").',
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
