import { z } from 'zod'
import type { Agent } from '../types/agent.types'

/**
 * Runtime validation for the agent domain model.
 *
 * Mirrors `docs/DATA_MODELS.md` and the TypeScript types in
 * `agent.types.ts`. The hand-written interface remains the
 * canonical type; this schema is the runtime boundary so any
 * external data (the bundled MVP catalog today, an HTTP API
 * response tomorrow, a CMS adapter in a future task) is
 * validated with the same rules before it reaches services and
 * components — no UI changes required when the source is
 * swapped.
 *
 * **Field rules.**
 *
 *  - `id`, `name`, `slug`, `role`, `bio`, `image` are required
 *    non-empty strings. The slug is the canonical
 *    `agents/[slug]` route parameter, so a missing or empty
 *    slug would 404 the detail page.
 *  - `phone`, `email`, `whatsapp`, `specialties` are optional.
 *    When supplied, every entry of `specialties` is non-empty
 *    (`.min(1)` per item) so a rendered badge is never an empty
 *    string.
 *
 * The schema is consumed by:
 *
 *  - the static adapter at module load
 *    (`server/utils/agents.ts` → `createStaticDataSource({ schema: agentListSchema })`)
 *    so a malformed record fails at startup rather than at
 *    first request;
 *  - the api adapter at response-parse time
 *    (`createApiDataSource({ schema: agentListSchema })`) so the
 *    remote source is held to the same rules as the bundled
 *    static data.
 *
 * The compile-time guard at the bottom pins the schema output
 * to the canonical {@link Agent} interface so the two cannot
 * drift.
 */

export const agentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1),
  role: z.string().min(1),
  bio: z.string().min(1),
  image: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().optional(),
  whatsapp: z.string().optional(),
  specialties: z.array(z.string().min(1)).optional(),
}) satisfies z.ZodType<Agent>

export const agentListSchema = z.array(agentSchema)

/**
 * Type inferred from the schema. Kept assignable to the canonical
 * {@link Agent} interface via the assertion below, so the schema
 * and the type cannot drift.
 */
export type AgentInput = z.infer<typeof agentSchema>

// Compile-time guard: the schema output and the hand-written interface
// must stay structurally identical. If either side changes, this fails
// to compile.
const _typeCheck: AgentInput extends Agent
  ? Agent extends AgentInput
    ? true
    : never
  : never = true
void _typeCheck