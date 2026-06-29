# OpenCode Instructions

## 1. Main Rule

Before implementing any feature, read the relevant documentation file inside `docs/`.

The implementation must follow the architecture, theming, i18n, and component rules defined in this documentation.

## 2. Documentation Usage

Use:

* `SPEC.md` for the general project goal.
* `ARCHITECTURE.md` for folder structure and code organization.
* `THEMING.md` for branding, themes, CSS variables, and agency customization.
* `COMPONENTS.md` for component rules and naming conventions.
* `DATA_MODELS.md` for TypeScript interfaces.
* `I18N.md` for translations and localization rules.
* `ROADMAP.md` for implementation order.

## 3. Implementation Rules

* Follow feature-first architecture.
* Do not place feature-specific logic inside global folders.
* Use TypeScript.
* Use reusable components.
* Use i18n keys for visible text.
* Avoid hardcoded colors.
* Use CSS variables for theme values.
* Keep business logic outside Vue components when possible.
* Use services for data access.
* Use schemas for validation.
* Use Pinia only when shared state is needed.
* Keep pages thin.
* Keep components small and focused.

## 4. Component Rules

* Global UI components go in `components/ui`.
* Layout components go in `components/layout`.
* Feature-specific components go inside their feature folder.
* Components should receive data through props when possible.
* Components should not fetch their own data unless explicitly required.
* Components should use theme tokens.
* Components should use i18n for visible text.

## 5. Styling Rules

* Use Tailwind CSS.
* Use design tokens and CSS variables for brand-specific values.
* Avoid hardcoded agency branding inside components.
* Avoid hardcoded colors for brand-specific styling.
* Themes must be configurable.
* Keep styles responsive and mobile-first.

## 6. Data Rules

* Use static data for MVP.
* Keep feature-specific static data inside `features/{feature}/data`.
* Keep TypeScript models inside `types`.
* Validate forms with schemas when needed.
* Prepare code so API integration can replace static data later.

## 7. i18n Rules

* Do not hardcode visible UI text.
* Update both English and Spanish locale files.
* Keep translation keys organized by domain.
* Use English key names.
* Do not create random flat translation keys.

## 8. Theming Rules

* Do not hardcode logos, agency names, phone numbers, or colors.
* Use agency configuration.
* Use theme configuration.
* Use CSS variables.
* Components should work with different themes without code changes.

## 9. Things to Avoid

* Do not hardcode visible text.
* Do not hardcode brand colors.
* Do not mix business modules in the same folder.
* Do not put API logic directly inside pages.
* Do not create large components with multiple responsibilities.
* Do not introduce backend/auth/admin features before the MVP is complete.
* Do not install unnecessary packages without justification.
* Do not create duplicated components for similar UI patterns.

## 10. Recommended First Tasks

1. Create the documentation files.
2. Configure Nuxt modules.
3. Create the folder structure.
4. Add agency configuration.
5. Add theme configuration.
6. Add CSS variables.
7. Add i18n locale files.
8. Create base layout components.
9. Create base UI components.
10. Create static data models.
11. Build the home page.
12. Build the properties module.
13. Build the developments module.
14. Build contact and leads.
