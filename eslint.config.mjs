// ESLint flat config wired to the auto-generated config from `@nuxt/eslint`.
import withNuxt from './.nuxt/eslint.config.mjs'

// The `.opencode/plugins/entire.ts` file is an auto-generated Entire
// OpenCode integration plugin (`entire enable --agent opencode`). It is
// not application source, it is not edited by humans, and it is not part
// of the project's `app/` source tree. The plugin uses `any` for
// `@opencode-ai/plugin` event payloads (the SDK does not export typed
// event shapes), so the project's `@typescript-eslint/no-explicit-any`
// rule does not apply to it. The narrowest possible ESLint ignore keeps
// every other project file under the full rule set.
export default withNuxt(
  {
    ignores: [
      '.opencode/plugins/entire.ts',
    ],
  },
)
