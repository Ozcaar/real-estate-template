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
export interface DevelopmentCoordinates {
  lat: number
  lng: number
}

export interface Development {
  id: string
  name: string
  slug: string
  shortDescription: string
  description: string
  location: string
  city: string
  state: string
  country: string
  coverImage: string
  gallery: string[]
  amenities: string[]
  propertyTypes: PropertyType[]
  availablePropertiesCount: number
  coordinates?: DevelopmentCoordinates
  active: boolean
}
```

## 4. Agent

```ts
export interface Agent {
  id: string
  name: string
  slug: string
  photo: string
  position: string
  email: string
  phone: string
  whatsapp: string
  bio: string
  active: boolean
}
```

## 5. Lead

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
```

## 9. Model Rules

* Use TypeScript interfaces for main entities.
* Use union types for fixed values.
* Keep models close to their feature when possible.
* Keep global models only when they are reused by multiple features.
* Keep models backend-friendly for future API integration.

---

# docs/I18N.md

# Internationalization Guide

## 1. Goal

The project must support multiple languages using Nuxt i18n.

Visible UI text should not be hardcoded inside components.

## 2. Initial Languages

Required MVP languages:

* English
* Spanish

## 3. Locale Folder Structure

```txt
i18n/
└── locales/
    ├── en.json
    └── es.json
```

## 4. Translation Key Structure

Suggested structure:

```json
{
  "nav": {
    "home": "Home",
    "properties": "Properties",
    "developments": "Developments",
    "agents": "Agents",
    "about": "About Us",
    "contact": "Contact"
  },
  "common": {
    "contact": "Contact",
    "viewDetails": "View details",
    "learnMore": "Learn more",
    "loading": "Loading...",
    "empty": "No results found"
  },
  "home": {
    "heroTitle": "Find your ideal property",
    "heroSubtitle": "Explore homes, apartments, land and developments available for sale or rent."
  },
  "properties": {
    "title": "Properties",
    "featured": "Featured properties",
    "filters": {
      "operationType": "Operation type",
      "propertyType": "Property type",
      "priceRange": "Price range",
      "location": "Location"
    }
  },
  "developments": {
    "title": "Developments",
    "availableProperties": "Available properties"
  },
  "agents": {
    "title": "Agents"
  },
  "contact": {
    "title": "Contact us",
    "form": {
      "name": "Name",
      "email": "Email",
      "phone": "Phone",
      "message": "Message",
      "submit": "Send message"
    }
  }
}
```

## 5. Rules

* All visible static UI text must use translation keys.
* Do not hardcode navigation labels.
* Do not hardcode button labels.
* Do not hardcode form labels.
* Do not hardcode empty states.
* Do not hardcode validation messages.
* Dynamic content from data files can be translated later if needed.

## 6. Good Example

```vue
<template>
  <BaseButton>
    {{ $t('common.contact') }}
  </BaseButton>
</template>
```

## 7. Bad Example

```vue
<template>
  <BaseButton>
    Contact
  </BaseButton>
</template>
```

## 8. Localized Routes

The project should be prepared for localized routes.

Example:

```txt
/en/properties
/es/propiedades
```

For the MVP, localized labels are required. Localized routes can be implemented after the initial structure is stable.

## 9. Agency Content

Some content can come from agency configuration instead of translation files.

Examples:

* Agency name.
* Address.
* Business hours.
* Social media URLs.
* Phone numbers.
* WhatsApp number.

## 10. i18n Rules for OpenCode

* When creating a component, add translation keys if visible static text is needed.
* Update both `en.json` and `es.json`.
* Use descriptive nested keys.
* Do not add random flat keys.
* Keep key names in English.
