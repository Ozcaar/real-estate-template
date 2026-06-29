# Real Estate Website Template - SPEC

## 1. Project Overview

This project is a modular real estate website template designed to be reused and customized for different real estate agencies.

The goal is to provide a flexible white-label foundation that can adapt to each agency through configuration, theming, reusable components, and feature modules.

The template should support different business needs such as property catalogs, developments, neighborhoods, agents, contact forms, lead capture, and future admin features.

## 2. Main Goals

* Build a reusable real estate website template.
* Support agency-specific branding and themes.
* Support multiple languages using i18n.
* Organize the project using feature-first architecture.
* Provide reusable UI components.
* Display properties, developments, agents, and contact forms.
* Capture leads from different user flows.
* Prepare the project for future admin and backend integration.
* Keep the project easy to customize for each real estate agency.

## 3. Tech Stack

Initial stack:

* Nuxt
* Vue
* Vite
* Tailwind CSS
* Pinia
* ESLint
* Nuxt Image
* Nuxt Icon
* Nuxt i18n
* VueUse
* Zod
* Swiper

## 4. Core Modules

The project should be divided into the following modules:

* Public website
* Properties
* Developments / neighborhoods / residential areas
* Agents
* Leads
* Search
* Contact
* Branding and theme system
* Configuration system
* Internationalization

## 5. Public Pages

Required MVP pages:

```txt
/
 /properties
 /properties/[slug]
 /developments
 /developments/[slug]
 /agents
 /about
 /contact
```

Future admin pages:

```txt
/admin
/admin/properties
/admin/developments
/admin/agents
/admin/leads
/admin/settings
```

## 6. MVP Scope

The first version should include:

* Responsive landing page.
* Properties listing page.
* Property detail page.
* Developments listing page.
* Development detail page.
* Agents listing page.
* About page.
* Contact page.
* Static/mock data.
* Basic Pinia stores when needed.
* i18n setup.
* Theme system.
* SEO metadata.
* Reusable components.
* Central agency configuration.
* Central theme configuration.

## 7. Out of Scope for MVP

The MVP does not require:

* Authentication.
* Admin dashboard.
* Full backend.
* Payments.
* CRM integration.
* Image upload.
* Multi-tenant backend.
* Real-time chat.
* User saved properties.

These features should be planned for future versions.

## 8. Documentation Map

For implementation details, read:

* `docs/ARCHITECTURE.md`
* `docs/THEMING.md`
* `docs/COMPONENTS.md`
* `docs/DATA_MODELS.md`
* `docs/I18N.md`
* `docs/ROADMAP.md`
* `docs/OPENCODE.md`

## 9. Acceptance Criteria

The project base will be considered valid when:

* The main public pages are created.
* The folder structure follows the feature-first architecture.
* Properties can be displayed from static data.
* Developments can be displayed from static data.
* Property detail pages work using slugs.
* Development detail pages work using slugs.
* The site supports English and Spanish.
* Branding can be changed from configuration files.
* Colors and styles use theme tokens or CSS variables.
* The layout is responsive.
* Visible text uses i18n keys.
* The project is ready to be extended with an admin panel later.

---
