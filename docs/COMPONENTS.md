# Components Guide

## 1. Goal

This document defines the component strategy for the real estate website template.

The goal is to create reusable, maintainable, and theme-friendly components.

## 2. Component Categories

Components are divided into three main categories:

* Layout components.
* Global UI components.
* Feature-specific components.

## 3. Layout Components

Layout components live in:

```txt
components/layout/
```

Examples:

```txt
components/layout/
├── AppNavbar.vue
├── AppFooter.vue
└── MobileMenu.vue
```

Layout components should:

* Use agency configuration.
* Use navigation configuration.
* Use i18n keys.
* Avoid hardcoded branding.
* Avoid feature-specific business logic.

## 4. Global Shared Components

Shared components live in:

```txt
components/shared/
```

Examples:

```txt
components/shared/
├── SectionHeader.vue
├── EmptyState.vue
└── LoadingSpinner.vue
```

Shared components should be reusable across multiple features.

## 5. Global UI Components

UI components live in:

```txt
components/ui/
```

Examples:

```txt
components/ui/
├── BaseButton.vue
├── BaseInput.vue
├── BaseTextarea.vue
├── BaseSelect.vue
├── BaseBadge.vue
├── BaseCard.vue
├── BaseModal.vue
├── BasePagination.vue
└── BaseSkeleton.vue
```

UI components should:

* Be generic.
* Use props for variants and states.
* Use theme tokens.
* Avoid business-specific logic.
* Avoid hardcoded text.
* Support accessibility basics.

## 6. Feature Components

Feature components live inside their feature folder.

Example:

```txt
features/properties/components/
├── PropertyCard.vue
├── PropertyGrid.vue
├── PropertyFilters.vue
├── PropertyGallery.vue
├── PropertyFeatures.vue
├── PropertyMap.vue
└── PropertyContactForm.vue
```

Feature components can understand the domain they belong to.

Example:

* `PropertyCard.vue` can receive a `Property`.
* `AgentCard.vue` can receive an `Agent`.
* `DevelopmentCard.vue` can receive a `Development`.

## 7. Naming Conventions

Use PascalCase for Vue components.

Good:

```txt
PropertyCard.vue
DevelopmentGallery.vue
BaseButton.vue
AppNavbar.vue
```

Avoid:

```txt
property-card.vue
development_gallery.vue
button.vue
navbar.vue
```

Use prefixes consistently:

* `App` for layout-level app components.
* `Base` for primitive UI components.
* Domain names for feature components.

Examples:

```txt
AppNavbar.vue
BaseButton.vue
PropertyCard.vue
AgentCard.vue
DevelopmentCard.vue
```

## 8. Props Guidelines

Components should receive data through props when possible.

Example:

```ts
defineProps<{
  title: string
  description?: string
}>()
```

For object props, use imported domain types.

Example:

```ts
import type { Property } from '../types/property'

defineProps<{
  property: Property
}>()
```

## 9. Events Guidelines

Use typed emits.

Example:

```ts
const emit = defineEmits<{
  select: [id: string]
  submit: [value: string]
}>()
```

## 10. Styling Guidelines

Components should use:

* Tailwind CSS.
* CSS variables for theme values.
* Responsive classes.
* Semantic HTML.

Avoid hardcoded brand colors.

Good:

```vue
<div class="bg-[var(--color-card)] text-[var(--color-card-foreground)] rounded-[var(--radius-lg)]">
</div>
```

Avoid:

```vue
<div class="bg-white text-gray-900 rounded-xl">
</div>
```

## 11. Text and i18n

Visible text should use i18n keys.

Good:

```vue
{{ $t('properties.viewDetails') }}
```

Avoid:

```vue
View details
```

Exceptions:

* Data coming from property content.
* Agency-provided content.
* User-generated content.

## 12. Accessibility Guidelines

Components should:

* Use semantic HTML when possible.
* Use `button` for actions.
* Use `a` or `NuxtLink` for navigation.
* Add `alt` text to images.
* Associate labels with inputs.
* Avoid clickable `div` elements when a button or link is more appropriate.

## 13. Component Size

Keep components focused.

If a component becomes too large, split it into smaller components.

Example:

```txt
PropertyDetailPage.vue
├── PropertyHero.vue
├── PropertyGallery.vue
├── PropertyOverview.vue
├── PropertyFeatures.vue
├── PropertyLocation.vue
└── PropertyContactForm.vue
```

## 14. Component Rules

* Do not duplicate UI patterns.
* Do not hardcode agency branding.
* Do not hardcode visible text.
* Do not put API calls directly inside reusable UI components.
* Use feature services or composables for business logic.
* Keep global components business-agnostic.

---
