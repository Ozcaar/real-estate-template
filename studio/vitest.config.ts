import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['schemas/**/*.test.ts', '*.test.ts'],
    environment: 'node',
  },
})
