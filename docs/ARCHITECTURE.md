# Architecture Guide

## 1. Architecture Overview

This project follows a **feature-first architecture**.

Instead of grouping all files only by type, each business module should own its components, composables, services, stores, types, schemas, data, constants, and utilities.

The goal is to make each module easier to maintain, replace, reuse, or extend.

## 2. Root Folder Structure

```txt
./
├── assets/
│   ├── css/
│   ├── fonts/
│   ├── icons/
│   └── images/
│
├── components/
│   ├── layout/
│   ├── shared/
│   └── ui/
│
├── composables/
│
├── config/
│   ├── agencies/
│   ├── site.config.ts
│   ├── navigation.ts
│   └── seo.ts
│
├── content/
│
├── core/
│   ├── composables/
│   ├── services/
│   ├── types/
│   └── utils/
│
├── features/
│   ├── home/
│   ├── properties/
│   ├── developments/
│   ├── agents/
│   ├── contact/
│   ├── leads/
│   ├── search/
│   └── shared/
│
├── i18n/
│   └── locales/
│       ├── en.json
│       └── es.json
│
├── layouts/
├── lib/
├── middleware/
├── pages/
├── plugins/
├── public/
├── server/
├── stores/
├── themes/
├── types/
└── utils/
```

## 3. Root Folder Responsibilities

```txt
assets/       Static source assets such as CSS, fonts, icons, and images.
components/   Global reusable components shared across multiple features.
composables/  Global Nuxt/Vue composables.
config/       Central project and agency configuration files.
content/      Optional markdown/content files for future Nuxt Content usage.
core/         Infrastructure and shared business-agnostic logic.
features/     Business modules grouped by domain.
i18n/         Translation files and localization resources.
layouts/      Nuxt layouts.
lib/          External library adapters and wrappers.
middleware/   Nuxt route middleware.
pages/        Nuxt file-based routes.
plugins/      Nuxt plugins.
public/       Public static files served directly.
server/       Nuxt server routes, APIs, and server utilities.
stores/       Global Pinia stores.
themes/       Theme definitions and design tokens.
types/        Global TypeScript types.
utils/        Global utility functions.
```

## 4. Feature Structure

Each feature should follow this structure when needed:

```txt
features/
└── properties/
    ├── api/
    ├── components/
    ├── composables/
    ├── constants/
    ├── data/
    ├── schemas/
    ├── services/
    ├── stores/
    ├── types/
    └── utils/
```

Not every feature must use every folder. Only create folders when they are needed.

## 5. Example: Properties Feature

```txt
features/
└── properties/
    ├── api/
    │   ├── get-properties.ts
    │   └── get-property.ts
    │
    ├── components/
    │   ├── PropertyCard.vue
    │   ├── PropertyFilters.vue
    │   ├── PropertyGallery.vue
    │   ├── PropertyFeatures.vue
    │   ├── PropertyMap.vue
    │   ├── PropertyContactForm.vue
    │   └── PropertyGrid.vue
    │
    ├── composables/
    │   └── useProperties.ts
    │
    ├── constants/
    │   ├── property-types.ts
    │   ├── property-statuses.ts
    │   └── operation-types.ts
    │
    ├── data/
    │   ├── properties.ts
    │   └── amenities.ts
    │
    ├── schemas/
    │   └── property.schema.ts
    │
    ├── services/
    │   └── properties.service.ts
    │
    ├── stores/
    │   └── properties.store.ts
    │
    ├── types/
    │   └── property.ts
    │
    └── utils/
        └── property.helpers.ts
```

## 6. Core Layer

The `core` directory should contain infrastructure-level logic that is not tied to a specific business feature.

```txt
core/
├── composables/
│   ├── useApi.ts
│   ├── useSeo.ts
│   └── useCurrency.ts
│
├── services/
│   ├── api-client.service.ts
│   ├── seo.service.ts
│   └── storage.service.ts
│
├── types/
│   ├── api-response.ts
│   └── seo.ts
│
└── utils/
    ├── currency-format.ts
    ├── date-format.ts
    └── slugify.ts
```

## 7. Global Stores

The root `stores` directory should only contain global application state.

```txt
stores/
├── app.ts
├── ui.ts
├── locale.ts
└── site.ts
```

Feature-specific stores should live inside their own feature.

Example:

```txt
features/
└── properties/
    └── stores/
        └── properties.store.ts
```

## 8. API Layer

The `api` folder inside each feature should contain data access functions.

Example:

```ts
export async function getProperties() {
  return await $fetch('/api/properties')
}
```

For the MVP, these functions can read from local static data.

Later, they can be connected to a real backend without changing UI components.

## 9. Services Layer

Services should contain business logic and coordinate API calls.

Example:

```ts
export const propertiesService = {
  async getFeaturedProperties() {
    const properties = await getProperties()
    return properties.filter((property) => property.featured)
  }
}
```

## 10. Pages Layer

Pages should be thin.

A page should mainly:

* Load data.
* Set SEO metadata.
* Compose feature components.
* Avoid complex business logic.

## 11. Architecture Rules

* Keep business-specific components inside their feature directory.
* Keep global UI components inside `components/ui`.
* Keep layout components inside `components/layout`.
* Keep infrastructure logic inside `core`.
* Keep third-party library wrappers inside `lib`.
* Keep static or configurable feature data inside `data`.
* Keep validation rules inside `schemas`.
* Keep API access functions inside `api`.
* Keep complex business logic inside `services`.
* Avoid hardcoded text; use i18n keys.
* Prefer extracting reusable logic into composables or services.
* Avoid placing feature-specific code in global folders.

---
