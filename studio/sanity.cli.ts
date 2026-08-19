import { defineCliConfig } from 'sanity/cli'

/**
 * Sanity Studio CLI config (Task 117).
 *
 * The CLI config is read by the `sanity` CLI for project
 * helpers such as `sanity dataset create`, `sanity deploy`,
 * `sanity exec`, `sanity dataset export`, etc.
 *
 * The `projectId` is the same value the Studio config
 * reads (`SANITY_STUDIO_PROJECT_ID`). The `dataset` is the
 * same default (`'production'`). Both are required to run
 * any `sanity` command that needs to talk to the project
 * (the developer's local Studio does not need them, but
 * `sanity deploy` and `sanity dataset` do).
 *
 * The Studio is the agency-owned project. The implementer
 * inherits the project ID from the agency's Sanity
 * organisation at onboarding time
 * (`docs/CLIENT_ONBOARDING.md` §2.1).
 */
export default defineCliConfig({
  api: {
    projectId: process.env.SANITY_STUDIO_PROJECT_ID ?? '',
    dataset: process.env.SANITY_STUDIO_DATASET ?? 'production',
  },
})
