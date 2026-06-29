# DESIGN.md — Real Estate Website Template

## Purpose

This document defines the design system, visual direction, theme strategy, and UI rules for the Real Estate Website Template.

The goal is to create a premium, modern, responsive, and easily customizable real estate website that can be adapted to different agencies without rewriting components.

Each agency should be able to customize branding through configuration and theme tokens, not by editing component internals.

## Design principles

### 1. Premium but approachable

The website should feel professional, trustworthy, and polished without feeling cold or overly corporate.

Real estate websites must communicate:

* trust
* clarity
* quality
* location expertise
* ease of contact
* confidence in the agency

### 2. Content first

Properties are the main product.

Design decisions should help users quickly understand:

* property type
* location
* price
* main features
* available media
* contact options
* whether the property matches their needs

Avoid decorative UI that competes with property content.

### 3. Mobile first

Most visitors will likely browse properties from a phone.

Every page, card, filter, gallery, CTA, and form must work well on mobile before desktop enhancements are added.

### 4. Theme driven

Colors, radius, shadows, typography, and brand styling must come from design tokens.

Components should not hardcode agency-specific styles.

### 5. Reusable across agencies

The template must support multiple real estate agencies with different branding needs.

Examples:

* luxury agency
* urban apartments agency
* family homes agency
* commercial real estate agency
* beach properties agency
* rental-focused agency

The same component system should support all of them.

## Brand customization strategy

Agency branding must be configured through:

```txt
config/
themes/
assets/
i18n/
```

The expected customizable areas are:

* logo
* agency name
* slogan
* primary color
* secondary color
* accent color
* typography
* border radius
* button style
* property card style
* hero layout
* contact information
* social links
* navigation items
* SEO metadata
* default locale
* currency
* measurement units

Components should consume these values through config, composables, or CSS variables.

Do not duplicate agency branding inside components.

## Theme system

Themes live inside:

```txt
themes/
```

Each theme should define CSS variables that control the visual identity of the site.

Recommended structure:

```txt
themes/
├── default.css
├── luxury.css
├── modern.css
└── minimal.css
```

A theme should expose semantic tokens, not raw design decisions.

Example:

```css
:root {
  --color-background: #ffffff;
  --color-foreground: #111827;

  --color-surface: #ffffff;
  --color-surface-muted: #f7f7f7;

  --color-primary: #1f3a5f;
  --color-primary-foreground: #ffffff;

  --color-secondary: #c8a96a;
  --color-secondary-foreground: #111827;

  --color-accent: #e8f0f8;
  --color-accent-foreground: #1f3a5f;

  --color-border: #e5e7eb;
  --color-muted: #6b7280;

  --radius-sm: 0.375rem;
  --radius-md: 0.75rem;
  --radius-lg: 1rem;
  --radius-xl: 1.5rem;

  --shadow-sm: 0 1px 2px rgb(0 0 0 / 0.08);
  --shadow-md: 0 8px 24px rgb(0 0 0 / 0.10);
  --shadow-lg: 0 16px 48px rgb(0 0 0 / 0.14);

  --font-sans: Inter, system-ui, sans-serif;
  --font-heading: Inter, system-ui, sans-serif;
}
```

## Token categories

### Color tokens

Use semantic color tokens:

```txt
--color-background
--color-foreground
--color-surface
--color-surface-muted
--color-primary
--color-primary-foreground
--color-secondary
--color-secondary-foreground
--color-accent
--color-accent-foreground
--color-border
--color-muted
--color-success
--color-warning
--color-error
```

Avoid raw color usage inside Vue components.

Do not use hardcoded Tailwind color utilities for brand colors.

Allowed:

```vue
<div class="grid gap-6 rounded-xl p-6">
```

Avoid:

```vue
<div class="bg-blue-900 text-white">
```

Preferred:

```vue
<div class="bg-[var(--color-primary)] text-[var(--color-primary-foreground)]">
```

### Radius tokens

Use radius tokens for consistent shape language:

```txt
--radius-sm
--radius-md
--radius-lg
--radius-xl
--radius-full
```

Recommended usage:

| Token           | Usage                       |
| --------------- | --------------------------- |
| `--radius-sm`   | inputs, tags, small buttons |
| `--radius-md`   | cards, dropdowns            |
| `--radius-lg`   | property cards, sections    |
| `--radius-xl`   | hero panels, featured cards |
| `--radius-full` | pills, avatars, badges      |

### Shadow tokens

Use shadow tokens for elevation:

```txt
--shadow-sm
--shadow-md
--shadow-lg
```

Recommended usage:

| Token         | Usage                                     |
| ------------- | ----------------------------------------- |
| `--shadow-sm` | subtle cards                              |
| `--shadow-md` | property cards, dropdowns                 |
| `--shadow-lg` | hero cards, modals, floating contact CTAs |

### Typography tokens

Typography should support both clean modern agencies and more premium/luxury brands.

Recommended tokens:

```txt
--font-sans
--font-heading
--font-serif
```

Typography hierarchy:

| Element         | Style                         |
| --------------- | ----------------------------- |
| Hero heading    | Large, strong, high contrast  |
| Section heading | Clear, readable, medium-large |
| Property title  | Short, scannable              |
| Body text       | Comfortable line-height       |
| Metadata        | Smaller, muted                |
| Price           | Prominent and high contrast   |

## Layout system

The layout should be clean, spacious, and responsive.

Use consistent containers:

```txt
max-w-7xl mx-auto px-4 sm:px-6 lg:px-8
```

Recommended section spacing:

```txt
py-12 sm:py-16 lg:py-24
```

Recommended grids:

```txt
grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6
```

For property listings:

```txt
grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6
```

## Core UI components

Generic UI components live in:

```txt
components/ui/
```

They must be prefixed with `Base`.

Recommended components:

```txt
BaseButton.vue
BaseInput.vue
BaseTextarea.vue
BaseSelect.vue
BaseCheckbox.vue
BaseRadio.vue
BaseBadge.vue
BaseCard.vue
BaseModal.vue
BaseDropdown.vue
BasePagination.vue
BaseContainer.vue
BaseSection.vue
BaseIcon.vue
BaseSkeleton.vue
```

UI primitives should be business-agnostic.

A `BaseButton` should not know anything about properties, agencies, agents, or listings.

## Layout components

Layout components live in:

```txt
components/layout/
```

They must be prefixed with `App`.

Recommended components:

```txt
AppHeader.vue
AppFooter.vue
AppShell.vue
AppNavbar.vue
AppMobileMenu.vue
AppLanguageSwitcher.vue
AppThemeProvider.vue
```

Layout components may consume agency config, navigation config, theme config, and locale settings.

## Shared components

Shared components live in:

```txt
components/shared/
```

These are reusable across multiple features but are not generic UI primitives.

Examples:

```txt
CurrencyText.vue
ResponsiveImage.vue
SeoBreadcrumbs.vue
ContactCta.vue
SocialLinks.vue
EmptyState.vue
LoadingState.vue
ErrorState.vue
```

## Feature components

Feature-specific components live inside their feature folder.

Example:

```txt
features/properties/components/
├── PropertyCard.vue
├── PropertyGrid.vue
├── PropertyFilters.vue
├── PropertyGallery.vue
├── PropertyHero.vue
├── PropertyPrice.vue
├── PropertyLocation.vue
├── PropertyFeatures.vue
└── PropertyContactForm.vue
```

A feature component may use:

* UI primitives
* shared components
* feature-specific composables
* feature-specific types
* feature-specific services

## Property card design

The property card is one of the most important components in the project.

It should be:

* image-first
* easy to scan
* responsive
* visually consistent
* theme-aware
* accessible

Recommended content:

* main image
* status badge: sale, rent, sold, reserved
* property type
* title
* location
* price
* bedrooms
* bathrooms
* parking spaces
* area
* CTA

Recommended hierarchy:

1. Image
2. Price
3. Title
4. Location
5. Key features
6. CTA or details link

Property cards should not fetch their own data.

They should receive a typed `property` prop.

## Property detail page design

Property detail pages should help users evaluate and contact quickly.

Recommended sections:

1. Property gallery
2. Main summary
3. Price and status
4. Key features
5. Description
6. Location/map area
7. Amenities
8. Agent or agency contact block
9. Similar properties
10. Lead capture form

The contact CTA should be visible early on mobile.

Avoid hiding the main contact action below too much content.

## Homepage design

The homepage should present the agency and make property exploration easy.

Recommended structure:

```txt
Hero
Featured properties
Property search/filter block
Why choose this agency
Property categories
Locations/areas served
Testimonials or trust indicators
CTA section
```

The hero should support different layouts depending on agency branding:

* centered text
* image split layout
* full background image
* search-focused hero
* luxury editorial layout

Hero content must come from config or i18n.

## Search and filters

Search and filters must be simple and mobile-friendly.

Recommended filters:

* operation type: sale/rent
* property type
* location
* price range
* bedrooms
* bathrooms
* area range
* amenities
* status

On mobile, filters should be collapsible or shown inside a modal/drawer.

Do not overload the first version with too many filters.

## Forms

Forms should be clear, accessible, and easy to complete.

Recommended form rules:

* labels must be visible or accessible
* errors must be clear
* validation must use Zod schemas
* required fields must be obvious
* buttons must show loading state
* success state must be clear
* avoid long forms when possible

Lead forms should ask only for essential information:

* name
* email or phone
* message
* property interest, when applicable

## Buttons

Button variants should be theme-aware.

Recommended variants:

```txt
primary
secondary
outline
ghost
link
danger
```

Recommended sizes:

```txt
sm
md
lg
icon
```

Buttons should support:

* loading state
* disabled state
* icon before text
* icon after text
* full width on mobile when needed

## Images

Real estate websites depend heavily on images.

Use `Nuxt Image` whenever possible.

Image rules:

* always provide meaningful `alt` text
* use responsive sizes
* avoid layout shift
* use lazy loading for below-the-fold images
* prioritize hero and first property image
* use consistent aspect ratios

Recommended aspect ratios:

| Usage             | Ratio                     |
| ----------------- | ------------------------- |
| Property card     | `4 / 3`                   |
| Hero image        | `16 / 9` or full viewport |
| Gallery thumbnail | `1 / 1`                   |
| Agent avatar      | `1 / 1`                   |
| Blog image        | `16 / 9`                  |

## Icons

Use Nuxt Icon.

Icons should support the current theme color.

Do not use icons as the only way to communicate meaning.

When an icon represents an action, include accessible labels.

## Accessibility

The site must be usable with keyboard, screen readers, and high contrast themes.

Minimum requirements:

* semantic HTML
* proper heading order
* visible focus states
* accessible buttons and links
* form labels
* descriptive alt text
* sufficient color contrast
* no color-only status indicators
* keyboard-accessible menus and modals

Focus states should use theme tokens.

Example:

```css
:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
```

## Internationalization

The design must support English and Spanish.

No visible text should be hardcoded.

All visible strings must use i18n keys.

Text length must be considered in layout because Spanish labels may be longer than English ones.

Avoid fixed-width text containers that break with longer translations.

## Responsive behavior

Recommended breakpoints should follow Tailwind defaults.

Design mobile first:

```txt
base  -> mobile
sm    -> large mobile
md    -> tablet
lg    -> laptop
xl    -> desktop
2xl   -> large desktop
```

Important mobile rules:

* navigation should collapse into a mobile menu
* filters should be collapsible or use a drawer
* CTAs should be easy to tap
* property cards should remain readable
* forms should use full-width fields
* galleries should support swipe gestures

## Motion and interaction

Motion should be subtle and useful.

Recommended uses:

* hover elevation on cards
* smooth menu transitions
* gallery transitions
* modal transitions
* loading skeletons
* CTA hover states

Avoid excessive animation.

Motion should not make the website feel slow.

Respect reduced motion preferences.

```css
@media (prefers-reduced-motion: reduce) {
  * {
    scroll-behavior: auto;
    transition-duration: 0.01ms;
    animation-duration: 0.01ms;
  }
}
```

## SEO-aware design

Design should support SEO-friendly content structure.

Pages should include:

* one clear `h1`
* meaningful section headings
* readable property descriptions
* structured content
* internal links
* image alt text
* breadcrumb support where useful

Do not sacrifice semantic HTML for visual layout.

## Empty, loading, and error states

Every major feature should define:

* loading state
* empty state
* error state

Examples:

```txt
No properties found
No featured properties available
Could not load property details
Message sent successfully
```

These messages must use i18n keys.

## Dark mode

Dark mode is optional for the MVP, but the token system should not block it.

If dark mode is added, define theme variables through a selector such as:

```css
[data-theme='dark'] {
  --color-background: #0f172a;
  --color-foreground: #f8fafc;
}
```

Do not implement dark mode by adding dark-specific classes across every component.

## Agency theme examples

### Default theme

Clean, neutral, flexible.

Best for general agencies.

### Luxury theme

Editorial, high contrast, refined spacing.

Suggested traits:

* deep primary color
* gold or champagne accent
* larger typography
* subtle shadows
* elegant cards

### Modern theme

Minimal and sharp.

Suggested traits:

* neutral surfaces
* strong typography
* rounded cards
* clear CTAs
* simple filters

### Family homes theme

Warm and approachable.

Suggested traits:

* softer colors
* friendly radius
* larger images
* warmer accent colors

## Implementation rules

Do:

* use CSS variables for theme values
* keep components reusable
* keep property content easy to scan
* support mobile first
* update both locales when adding UI text
* use typed props
* use accessible HTML

Do not:

* hardcode brand colors
* hardcode visible UI text
* fetch data inside presentational components
* place business logic in pages
* create agency-specific components unless absolutely necessary
* duplicate styles across many components
* rely on color alone to communicate meaning

## Recommended first design tasks

For the MVP, implement the design system in this order:

1. CSS variable tokens
2. Base layout container
3. Base button
4. Base input
5. Base card
6. App header
7. App footer
8. Property card
9. Property grid
10. Homepage sections

This order allows the rest of the website to grow consistently.
