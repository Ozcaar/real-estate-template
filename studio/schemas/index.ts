import { propertyType } from './property'
import { agentType } from './agent'
import { developmentType } from './development'

/**
 * Sanity Studio schemas index (Task 117).
 *
 * The Studio config (`sanity.config.ts`) imports
 * `schemaTypes` from this module and passes the array to
 * `defineConfig({ schema: { types: schemaTypes } })`. The
 * three document types are the source of truth for the
 * agency editor's content model.
 *
 * The `Property` schema carries references to `agent` and
 * `development` (the `to: [{ type: 'agent' }]` and
 * `to: [{ type: 'development' }]` declarations). The
 * Studio's reference picker only shows documents of the
 * matching type, so the editor cannot accidentally wire
 * a Property to a non-Agent reference.
 *
 * **Schema boundary.** The Studio schemas are NOT
 * imported by the Nuxt app. The Nuxt app reads the
 * published dataset via the `@sanity/client` driver; the
 * boundary Zod schemas (`propertyListSchema`,
 * `agentListSchema`, `developmentListSchema`) are the
 * runtime contract. The Studio schemas are the editor
 * contract. The two are matched by hand — changing one
 * without the other is a deliberate decision (the
 * commit + PR review catches the drift).
 *
 * **CI contract test.** A future task can add a CI step
 * that runs the Studio's schema against the runtime
 * boundary schema (e.g. a script that fetches the Studio
 * schema output and validates the GROQ projection shape).
 * The boundary regression test
 * (`server/utils/sanity-boundary.test.ts`) pins the
 * server-only / not-in-`app/` boundary; the contract
 * test would pin the schema / boundary shape parity.
 */
export const schemaTypes = [
  propertyType,
  agentType,
  developmentType,
]
