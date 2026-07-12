# Data Models

## 1. Goal

This document defines the main TypeScript models used by the real estate website template.

The models should be flexible enough for the MVP and future backend integration.

## 2. Property

```ts
export type PropertyOperationType = 'sale' | 'rent'

export type PropertyType =
  | 'house'
  | 'apartment'
  | 'land'
  | 'commercial'
  | 'office'

export type PropertyStatus =
  | 'available'
  | 'sold'
  | 'rented'
  | 'reserved'
  | 'hidden'

export interface PropertyCoordinates {
  lat: number
  lng: number
}

export interface Property {
  id: string
  title: string
  slug: string
  description: string
  operationType: PropertyOperationType
  propertyType: PropertyType
  price: number
  currency: string
  location: string
  city: string
  state: string
  country: string
  bedrooms?: number
  bathrooms?: number
  parkingSpaces?: number
  /**
   * Unit of `constructionSize` and `landSize`. Defaults to the agency
   * `measurementUnit` when omitted. The number is rendered as-is in the
   * declared unit — the template does not perform automatic m² ↔ ft²
   * conversion. Set this per record when a real agency mixes units in
   * the same catalog.
   */
  sizeUnit?: MeasurementUnit
  constructionSize?: number
  landSize?: number
  images: string[]
  coverImage: string
  amenities: string[]
  developmentId?: string
  agentId?: string
  coordinates?: PropertyCoordinates
  status: PropertyStatus
  featured: boolean
}
```

> **Runtime validation.** The property model also has a matching Zod schema at
> `features/properties/schemas/property.schema.ts` (`propertySchema`,
> `propertyListSchema`). The hand-written interfaces above remain the canonical
> types; the schema is the runtime boundary used to validate external data
> (static MVP data today, a CMS/API response later) before it reaches services
> and components.

## 3. Development

```ts
export type DevelopmentStatus =
  | 'pre-sale'
  | 'under-construction'
  | 'ready-to-deliver'
  | 'sold-out'

export interface Development {
  /** Unique development identifier. */
  id: string
  /** Display name (agency content, not an i18n key). */
  name: string
  /** Slug reserved for a future detail page (`/developments/[slug]`). */
  slug: string
  /** Current build / sales status. */
  status: DevelopmentStatus
  /** Location: neighborhood, city, state (agency content). */
  location: string
  /** Short marketing description (agency content). */
  description: string
  /** Cover image path (served from `public/`). */
  image: string
  /** Starting price in the configured currency. Optional. */
  priceFrom?: number
  /** Ending price in the configured currency. Optional. */
  priceTo?: number
  /** ISO 4217 currency code. Defaults to the agency currency at render time. */
  currency?: string
  /** Total number of units in the development. */
  units?: number
  /** Typical bedroom count, e.g. 2 or 3. */
  bedrooms?: number
  /**
   * Unit of `areaFrom` and `areaTo`. Defaults to the agency
   * `measurementUnit` when omitted so a record that pre-dates this field
   * continues to render correctly.
   *
   * The number is rendered **as-is** in the declared unit — the template does
   * not perform automatic m² ↔ ft² conversion. When a real agency mixes
   * units in the same catalog, set this per record.
   */
  sizeUnit?: MeasurementUnit
  /** Smallest unit size. */
  areaFrom?: number
  /** Largest unit size. */
  areaTo?: number
  /** Expected delivery date as an ISO 8601 string (`YYYY-MM` or `YYYY-MM-DD`). */
  deliveryDate?: string
  /** Whether to highlight this development in showcases. */
  featured?: boolean
}
```

> **Runtime validation.** `Development` currently has no Zod schema. The
> hand-written `Development` interface above is the current source of
> truth and is enforced by the TypeScript compiler. A future task may
> add a development schema mirroring the property pattern
> (`features/properties/schemas/property.schema.ts`).

## 4. Agent

```ts
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
```

> **Runtime validation.** `Agent` currently has no Zod schema. The
> hand-written `Agent` interface above is the current source of truth
> and is enforced by the TypeScript compiler. A future task may add an
> agent schema mirroring the property pattern
> (`features/properties/schemas/property.schema.ts`).

## 5. Lead

> **Status: shipped (Task 080 / M26).** `app/features/leads/` owns
> the public input contract, the shared Zod schema, the form
> component, and the type definitions. Server-side delivery lives
> in `server/services/leads/` and is documented in
> `docs/REBRANDING.md` §12.

### 5.1 Public input contract

The form posts a flat JSON object to `POST /api/contact`. Server-side
re-validation runs the same schema (`app/features/leads/schemas/lead.schema.ts`).
The contract is intentionally a subset of the planned `Lead` shape
— the server stamps the server-only fields (`id`, `receivedAt`,
`source`) before delivery.

```ts
import type { LeadInput } from '~/features/leads/types/lead.types'

// Shape of the JSON body the form posts to /api/contact.
export interface LeadInput {
  name: string          // 2–120 trimmed characters, required
  email: string         // optional, but if present must be a valid email
  phone: string         // optional, 6–32 chars, permissive formatting
  message: string       // 10–4000 trimmed characters, required
  website: string       // honeypot — must be empty
  locale: string        // optional, 2–12 characters
}
```

### 5.2 Field rules

| Field    | Required | Rule                                                                |
| -------- | -------- | ------------------------------------------------------------------- |
| `name`   | yes      | trimmed, 2–120 chars                                                |
| `email`  | no       | trimmed, ≤ 254 chars, must be a valid email when present            |
| `phone`  | no       | 6–32 chars; accepts digits, spaces, dashes, parentheses, leading `+` |
| `message`| yes      | trimmed, 10–4000 chars                                              |
| `website`| yes      | honeypot — must be empty (any non-empty value is a bot signal)      |
| `locale` | no       | 2–12 chars; BCP-47-shaped; falls back to `accept-language`         |

**Cross-field rule.** At least one of `email` or `phone` must be
non-empty. A real lead has at least one contact channel.

### 5.3 Stamped (internal) lead shape

The server stamps the input before delivery. The stamped shape
includes three server-only fields. The raw IP, user-agent, and
cookies are **never** carried into the stamped shape and **never**
leave the server.

```ts
export type LeadSource = 'contact'

export interface Lead {
  id: string           // crypto.randomUUID()
  receivedAt: string   // ISO 8601 timestamp
  source: LeadSource
  name: string
  email: string
  phone: string
  message: string
  locale: string
}
```

### 5.4 Honeypot

The `website` field is a hidden text input that real users never
touch. The server treats any non-empty value as a bot and returns
the same generic `200 { "ok": true }` response without delivering or
logging the lead. Bots that read the response body cannot tell
they have been detected.

### 5.5 Validation

The shared Zod schema lives at
`app/features/leads/schemas/lead.schema.ts`:

```ts
export const leadInputSchema = z.object({
  name: z.string().trim().min(2, 'name_too_short').max(120, 'name_too_long'),
  email: z.string().trim().max(254, 'email_too_long').email('email_invalid').optional().or(z.literal('')),
  phone: z.string().trim().max(32, 'phone_too_long').regex(/^[+]?[0-9 ()\-]{6,32}$/u, 'phone_invalid').optional().or(z.literal('')),
  message: z.string().trim().min(10, 'message_too_short').max(4000, 'message_too_long'),
  website: z.string().max(0, 'honeypot').optional().or(z.literal('')),
  locale: z.string().trim().min(2, 'locale_invalid').max(12, 'locale_invalid').optional().or(z.literal('')),
})

export const leadInputRefined = leadInputSchema.refine(
  (data) => Boolean(data.email) || Boolean(data.phone),
  { message: 'contact_channel_required', path: ['email'] },
)
```

The schema emits **stable error codes** (e.g. `name_too_short`) so
the i18n layer can map them to per-locale copy without coupling the
schema to a particular translation file.

### 5.6 Endpoint and response shapes

The `POST /api/contact` endpoint maps the server-side service result
to one of six HTTP responses. The shapes are stable and the
client never receives provider details, webhook URLs, secrets, or
stack traces.

| Status | Body | When |
| ------ | ---- | ---- |
| 200    | `{ "ok": true, "id": "..." }` | Successful delivery |
| 200    | `{ "ok": true }` | Honeypot tripped (silent) |
| 400    | `{ "ok": false, "error": "validation", "issues": [{ "path", "message" }] }` | Schema validation failed (client or server) |
| 413    | `{ "ok": false, "error": "payload_too_large" }` | Body larger than 16 KB |
| 415    | `{ "ok": false, "error": "unsupported_media_type" }` | Content-Type is not `application/json` |
| 429    | `{ "ok": false, "error": "rate_limited" }` | Per-process rate limit exceeded |
| 502    | `{ "ok": false, "error": "delivery" }` | Adapter returned a non-success result |
| 503    | `{ "ok": false, "error": "adapter_disabled" }` | Runtime adapter is `disabled` |

### 5.7 Defenses and privacy

- **Honeypot.** As above. No new dependency.
- **Body size limit.** 16 KB, checked before JSON parsing.
- **Per-process rate limit.** 5 accepted attempts per 10 minutes
  per request key (`ip + user-agent`, truncated to 200 chars).
  In-memory `Map`, opportunistic cleanup. **Not** distributed; a
  future v1.x task can move it to a Nitro storage driver backed
  by an external KV.
- **Privacy.** The endpoint never logs the body. The rate-limit
  key is the only thing that sees the IP. The stamped lead shape
  carries no IP, no user-agent, no cookies. The `log` adapter
  writes only `{ id, source, presence flags, message length }` to
  stdout; the `webhook` adapter sends the stamped lead as JSON to
  the agency's endpoint under the agency's own retention policy.
- **No storage.** The endpoint does not persist leads to
  disk, to `useStorage()`, or to any external sink the agency
  did not configure. A persistence adapter is a deliberate future
  task and is out of scope for the MVP.

## 6. Agency Config

```ts
export interface AgencyContactConfig {
  phone: string
  whatsapp: string
  email: string
  address: string
  structuredAddress?: AgencyStructuredAddress
  businessHours?: string
}

export interface AgencyStructuredAddress {
  streetAddress?: string
  addressLocality?: string
  addressRegion?: string
  postalCode?: string
  addressCountry?: string
}

> `address` is the free-text human-readable address used by the visible
> footer (`app/components/layout/AppFooter.vue`) and the contact page
> contact-method card (`app/pages/contact/index.vue`). It is **required**
> and **unchanged** by the PostalAddress build. `structuredAddress` is
> the optional schema.org `PostalAddress` companion consumed only by
> the JSON-LD builder (`app/core/utils/postal-address.ts`) on the home,
> contact and about `RealEstateAgent` nodes. The two fields coexist: a
> rebrand that has not migrated still gets the legacy plain-string
> `address` in the JSON-LD; a migrated agency gets a `PostalAddress`
> object with only the non-empty structured fields. `addressRegion` and
> `postalCode` are not invented for the default agency — they are
> omitted because the shipped free-text address does not declare them.

export interface AgencySocialConfig {
  facebook?: string
  instagram?: string
  linkedin?: string
  tiktok?: string
  youtube?: string
}

export interface AgencyModulesConfig {
  properties: boolean
  developments: boolean
  agents: boolean
  blog: boolean
  testimonials: boolean
  contact: boolean
}

export type MeasurementUnit = 'metric' | 'imperial'

export interface AgencyConfig {
  id: string
  name: string
  /** Optional short marketing slogan. */
  slogan?: string
  logo: string
  favicon?: string
  theme: string
  defaultLocale: string
  availableLocales: string[]
  /** ISO 4217 currency code used to format prices (e.g. `USD`, `MXN`). */
  currency: string
  /** Measurement unit used for property areas. */
  measurementUnit: MeasurementUnit
  contact: AgencyContactConfig
  social: AgencySocialConfig
  modules: AgencyModulesConfig
}
```

> `slogan`, `currency` and `measurementUnit` are required by `docs/DESIGN.md`
> (configurable branding, price formatting and area units) and are part of the
> implemented `AgencyConfig`.

## 7. Theme Config

The token set is a superset that reconciles this document with the semantic
tokens required by `docs/DESIGN.md` (surfaces, status colors, shadows, serif
font and a `full` radius). These objects are the single source of truth and are
serialized into CSS variables at runtime by `core/utils/theme-to-css-vars.ts`.

```ts
export interface ThemeColors {
  background: string
  foreground: string
  surface: string
  surfaceMuted: string
  primary: string
  primaryForeground: string
  secondary: string
  secondaryForeground: string
  accent: string
  accentForeground: string
  muted: string
  border: string
  card: string
  cardForeground: string
  success: string
  warning: string
  error: string
}

export interface ThemeFonts {
  heading: string
  body: string
  serif: string
}

export interface ThemeRadius {
  sm: string
  md: string
  lg: string
  xl: string
  full: string
}

export interface ThemeShadow {
  sm: string
  md: string
  lg: string
}

export interface ThemeLayout {
  containerMaxWidth: string
  sectionSpacing: string
}

export interface ThemeConfig {
  id: string
  name: string
  colors: ThemeColors
  fonts: ThemeFonts
  radius: ThemeRadius
  shadow: ThemeShadow
  layout: ThemeLayout
}
```

## 8. Site Config

```ts
export interface SiteConfig {
  agency: AgencyConfig
  theme: ThemeConfig
}

/**
 * A single navigation entry. `labelKey` is an i18n key (never raw text) and
 * `module` optionally ties the item to an agency module so navigation can be
 * filtered by what is enabled.
 */
export interface NavItem {
  labelKey: string
  to: string
  module?: keyof AgencyModulesConfig
}

/**
 * Non-textual SEO defaults. Human readable strings (titles, descriptions) live
 * in i18n; this only holds structural/branding defaults.
 */
export interface SeoConfig {
  /** Default Open Graph / fallback share image. */
  ogImage: string
  /** Twitter card type. */
  twitterCard: 'summary' | 'summary_large_image'
}
```

`SiteConfig` is the resolved configuration consumed across the app (active agency + its resolved theme). `NavItem` powers the navigation configuration in `app/config/navigation.ts` and is consumed by `AppHeader`, `AppMobileMenu` and `AppFooter`; the optional `module` field lets layout components hide entries for disabled agency modules. `SeoConfig` powers structural SEO defaults in `app/config/seo.ts` and is consumed by the `usePageSeo` composable.

## 9. Listing Query & Sort Shape

The `/properties` page reads five optional query params and routes them through `propertiesService.filter(filters, sort)` and a small generic `paginate()` utility. The shape is defined in code (not in the `Property` model) and consumed by `app/features/properties/services/properties.service.ts` and `app/core/utils/paginate.ts`.

### Query keys

| Key | Allowed values | Type | Effect |
| --- | --- | --- | --- |
| `operation` | `sale`, `rent` | `PropertyOperationType` | Exact match on `Property.operationType`, case-insensitive |
| `type` | `house`, `apartment`, `land`, `commercial`, `office` | `PropertyType` | Exact match on `Property.propertyType`, case-insensitive |
| `location` | free text | `string` | Substring match against `location + city + state + country` joined with spaces. **Case-insensitive** and **accent-insensitive** (Unicode NFD + combining-mark strip — no external dependency). `Mexico` matches `México`, `Queretaro` matches `Querétaro`, `Leon` matches `Nuevo León` |
| `sort` | `featured`, `price-asc`, `price-desc` | `PropertySort` (see below) | See the sort table |
| `page` | positive integer, default `1` | `number` (1-based) | Selects which slice of the filtered + sorted list is rendered. Read via `parsePageParam` and clamped inside `paginate` to `[1, totalPages]` |

### `PropertySort`

```ts
export type PropertySort = 'featured' | 'price-asc' | 'price-desc'
```

| Value | Order |
| --- | --- |
| `featured` (default) | `featured: true` first, then `id` ascending for ties |
| `price-asc` | `price` ascending, then `id` ascending for ties |
| `price-desc` | `price` descending, then `id` ascending for ties |

**Stable order.** Every sort branch uses `id.localeCompare(otherId)` as a tiebreaker so equal-scoring or equal-priced properties render in the same order across SSR and CSR. The `ItemList` JSON-LD on the listing page reflects the same order as the visible cards via **global** `position: (currentPage - 1) * PAGE_SIZE + index + 1`.

**URL hygiene.** Empty values are stripped from the URL. The default sort (`featured`) is also omitted — bare `/properties` means "all visible, sorted by featured first". Unknown `?sort=` values are coerced to `featured` via the `isPropertySort` guard. The canonical URL strips the entire query string for SEO, so all filtered variants canonicalize to `/properties`.

**`?page=` URL hygiene.** `?page=1` is omitted from the URL by `BasePagination` (page 1 is the default). `?page=N` is included for N ≥ 2. Out-of-range values (for example `?page=99` on a 3-page result set) are silently clamped to the last available page by `paginate()` so the route never 404s and never renders an empty grid. The user can always click the correct page link to fix the URL.

**Filter and sort form submissions reset to `?page=1`.** The in-page filter form's `applyFilters` handler builds a fresh query object from non-empty / non-default values. `page` is never part of that object, so submitting the form always navigates to page 1 of the new filtered set. The "Clear filters" button navigates to bare `/properties` with no query, which also strips `?page=N`. Sort changes go through the same form handler, so a sort change also resets to page 1.

**Pagination links preserve active filters and sort.** `BasePagination` receives the page's pre-filtered `query` (operation, type, location, non-default sort) and rebuilds it for every page link. A `?operation=sale&type=house&page=2` URL produces page 1 and page 3 links of the form `?operation=sale&type=house` and `?operation=sale&type=house&page=3` respectively — the active filters travel with the pagination navigation.

### Type guard

```ts
export function isPropertySort(value: unknown): value is PropertySort {
  return typeof value === 'string' && (VALID_SORTS as readonly string[]).includes(value)
}
```

Use this guard in the page to coerce a raw `route.query.sort` value (which is `string | string[] | null | undefined`) into a safe `PropertySort` before passing it to the service.

### `parsePageParam`

```ts
export function parsePageParam(raw: unknown): number
```

Normalises a raw `useRoute().query` value into a 1-based page number. `null`, `undefined`, empty string, whitespace-only, non-numeric, zero, and negative values all resolve to `1`. Decimal values are truncated to an integer. Array values use the first scalar entry. Out-of-range values are NOT clamped here — the page layer clamps the effective page against the resolved `totalPages` inside `paginate()` so the helper stays generic and dataset-agnostic.

### `paginate`

```ts
export interface PaginatedResult<T> { items: T[]; page: number; pageSize: number; totalItems: number; totalPages: number }
export function paginate<T>(items: readonly T[], requestedPage: number, pageSize: number): PaginatedResult<T>
```

Pure helper. Slices a list into a single page. The input array is never mutated. An empty input returns `{ items: [], page: 1, totalItems: 0, totalPages: 0 }`. `pageSize < 1` is coerced to `1`. The effective page is clamped to `[1, max(1, totalPages)]`.

## 10. Model Rules

* Use TypeScript interfaces for main entities.
* Use union types for fixed values.
* Keep models close to their feature when possible.
* Keep global models only when they are reused by multiple features.
* Keep models backend-friendly for future API integration.

