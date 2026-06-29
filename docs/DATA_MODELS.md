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

> **Status: planned, not yet implemented.** `app/features/leads/` is
> reserved for the future lead-capture feature. The current contact
> form is a UI placeholder until the lead module lands. The interface
> below is the **planned** shape; do not consume it from code yet.

```ts
export type LeadInterestType =
  | 'buy'
  | 'rent'
  | 'sell'
  | 'invest'
  | 'info'

export type LeadSource =
  | 'contact'
  | 'property'
  | 'development'
  | 'whatsapp'
  | 'cta'

export interface Lead {
  id?: string
  name: string
  email?: string
  phone: string
  message?: string
  interestType: LeadInterestType
  propertyId?: string
  developmentId?: string
  source: LeadSource
}
```

## 6. Agency Config

```ts
export interface AgencyContactConfig {
  phone: string
  whatsapp: string
  email: string
  address: string
  businessHours?: string
}

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
  /** Title template, `%s` is replaced by the page title. */
  titleTemplate: string
  /** Default Open Graph / fallback share image. */
  ogImage: string
  /** Twitter card type. */
  twitterCard: 'summary' | 'summary_large_image'
}
```

`SiteConfig` is the resolved configuration consumed across the app (active agency + its resolved theme). `NavItem` powers the navigation configuration in `app/config/navigation.ts` and is consumed by `AppHeader`, `AppMobileMenu` and `AppFooter`; the optional `module` field lets layout components hide entries for disabled agency modules. `SeoConfig` powers structural SEO defaults in `app/config/seo.ts` and is consumed by the `usePageSeo` composable.

## 9. Listing Query & Sort Shape

The `/properties` page reads four optional query params and routes them through `propertiesService.filter(filters, sort)`. The shape is defined in code (not in the `Property` model) and consumed by `app/features/properties/services/properties.service.ts`.

### Query keys

| Key | Allowed values | Type | Effect |
| --- | --- | --- | --- |
| `operation` | `sale`, `rent` | `PropertyOperationType` | Exact match on `Property.operationType`, case-insensitive |
| `type` | `house`, `apartment`, `land`, `commercial`, `office` | `PropertyType` | Exact match on `Property.propertyType`, case-insensitive |
| `location` | free text | `string` | Substring match against `location + city + state + country` joined with spaces. **Case-insensitive** and **accent-insensitive** (Unicode NFD + combining-mark strip — no external dependency). `Mexico` matches `México`, `Queretaro` matches `Querétaro`, `Leon` matches `Nuevo León` |
| `sort` | `featured`, `price-asc`, `price-desc` | `PropertySort` (see below) | See the sort table |

### `PropertySort`

```ts
export type PropertySort = 'featured' | 'price-asc' | 'price-desc'
```

| Value | Order |
| --- | --- |
| `featured` (default) | `featured: true` first, then `id` ascending for ties |
| `price-asc` | `price` ascending, then `id` ascending for ties |
| `price-desc` | `price` descending, then `id` ascending for ties |

**Stable order.** Every sort branch uses `id.localeCompare(otherId)` as a tiebreaker so equal-scoring or equal-priced properties always render in the same order across SSR and CSR. The `ItemList` JSON-LD on the listing page reflects the same order as the visible cards via `position: index + 1`.

**URL hygiene.** Empty values are stripped from the URL. The default sort (`featured`) is also omitted — bare `/properties` means "all visible, sorted by featured first". Unknown `?sort=` values are coerced to `featured` via the `isPropertySort` guard. The canonical URL strips the entire query string for SEO, so all filtered variants canonicalize to `/properties`.

### Type guard

```ts
export function isPropertySort(value: unknown): value is PropertySort {
  return typeof value === 'string' && (VALID_SORTS as readonly string[]).includes(value)
}
```

Use this guard in the page to coerce a raw `route.query.sort` value (which is `string | string[] | null | undefined`) into a safe `PropertySort` before passing it to the service.

## 10. Model Rules

* Use TypeScript interfaces for main entities.
* Use union types for fixed values.
* Keep models close to their feature when possible.
* Keep global models only when they are reused by multiple features.
* Keep models backend-friendly for future API integration.

