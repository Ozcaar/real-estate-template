# Theming and Branding Guide

## 1. Goal

The template must support agency-specific branding through a centralized configuration and theme system.

Each real estate agency should be able to customize the website without modifying core components.

Branding should never be hardcoded directly inside Vue components.

## 2. Customizable Branding

Each agency should be able to customize:

* Agency name.
* Logo.
* Favicon.
* Primary color.
* Secondary color.
* Accent color.
* Background color.
* Text color.
* Muted text color.
* Typography.
* Border radius.
* Button style.
* Card style.
* Header style.
* Footer style.
* Contact information.
* Social media links.
* Enabled modules.
* Default language.
* Available languages.

## 3. Recommended Folder Structure

```txt
config/
├── agencies/
│   ├── default.agency.ts
│   └── example.agency.ts
│
├── site.config.ts
├── navigation.ts
└── seo.ts

themes/
├── default.theme.ts
├── luxury.theme.ts
└── minimal.theme.ts
```

## 4. Agency Configuration

Each agency should have a configuration file.

Example:

```ts
export const defaultAgencyConfig = {
  id: 'default',
  name: 'Real Estate Agency',
  logo: '/images/logo.svg',
  favicon: '/favicon.ico',
  theme: 'default',
  defaultLocale: 'en',
  availableLocales: ['en', 'es'],
  contact: {
    phone: '',
    whatsapp: '',
    email: '',
    address: '',
    businessHours: ''
  },
  social: {
    facebook: '',
    instagram: '',
    linkedin: '',
    tiktok: ''
  },
  modules: {
    properties: true,
    developments: true,
    agents: true,
    blog: false,
    testimonials: true,
    contact: true
  }
}
```

## 5. Theme Configuration

Themes should define design tokens.

Example:

```ts
export const defaultTheme = {
  id: 'default',
  name: 'Default Theme',
  colors: {
    primary: '#0F766E',
    primaryForeground: '#FFFFFF',
    secondary: '#F5F5F4',
    secondaryForeground: '#111827',
    accent: '#D97706',
    accentForeground: '#FFFFFF',
    background: '#FFFFFF',
    foreground: '#111827',
    muted: '#6B7280',
    border: '#E5E7EB',
    card: '#FFFFFF',
    cardForeground: '#111827'
  },
  fonts: {
    heading: 'Inter, sans-serif',
    body: 'Inter, sans-serif'
  },
  radius: {
    sm: '0.375rem',
    md: '0.75rem',
    lg: '1rem',
    xl: '1.5rem'
  },
  layout: {
    containerMaxWidth: '1200px',
    sectionSpacing: '5rem'
  }
}
```

## 6. CSS Variables

Theme values should be exposed as CSS variables.

Example:

```css
:root {
  --color-primary: #0F766E;
  --color-primary-foreground: #FFFFFF;
  --color-secondary: #F5F5F4;
  --color-secondary-foreground: #111827;
  --color-accent: #D97706;
  --color-accent-foreground: #FFFFFF;
  --color-background: #FFFFFF;
  --color-foreground: #111827;
  --color-muted: #6B7280;
  --color-border: #E5E7EB;
  --color-card: #FFFFFF;
  --color-card-foreground: #111827;

  --font-heading: Inter, sans-serif;
  --font-body: Inter, sans-serif;

  --radius-sm: 0.375rem;
  --radius-md: 0.75rem;
  --radius-lg: 1rem;
  --radius-xl: 1.5rem;

  --container-max-width: 1200px;
  --section-spacing: 5rem;
}
```

## 7. Tailwind Usage

Use Tailwind utility classes, but consume theme values through CSS variables.

Good:

```vue
<button class="bg-[var(--color-primary)] text-[var(--color-primary-foreground)] rounded-[var(--radius-md)]">
  {{ $t('common.contact') }}
</button>
```

Avoid:

```vue
<button class="bg-teal-700 text-white rounded-xl">
  Contact
</button>
```

Hardcoded utility classes are acceptable only for layout, spacing, grid behavior, responsiveness, and non-brand-specific styling.

## 8. Component Variants

Reusable UI components should expose variants.

Example:

```vue
<BaseButton variant="primary" />
<BaseButton variant="secondary" />
<BaseButton variant="ghost" />
```

The variant should map to CSS variables, not hardcoded colors.

## 9. Logo and Image Rules

* Agency logos should be loaded from agency configuration.
* Do not import a single logo directly inside layout components.
* Use Nuxt Image when possible.
* Provide fallback alt text using the agency name.

## 10. Runtime Theme Loading

The theme system should allow the active agency theme to be loaded from configuration.

Initial MVP can use a static default agency.

Future versions may load agency configuration from:

* Environment variables.
* JSON files.
* API response.
* Multi-tenant backend.

## 11. Theming Rules

* Do not hardcode brand colors in components.
* Do not hardcode agency names in components.
* Do not hardcode phone numbers, WhatsApp numbers, or emails.
* Use agency configuration for identity and contact data.
* Use theme tokens for colors, fonts, border radius, and visual style.
* Keep the system simple enough to customize manually.

