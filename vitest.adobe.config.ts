import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

/** Adobe-Test (ROADMAP 8.5) für einen Rechner mit Adobe: npx vitest run -c vitest.adobe.config.ts */
export default defineConfig({
  resolve: { alias: { '@shared': resolve(__dirname, 'src/shared') } },
  test: {
    include: ['tests/adobe/**/*.test.ts'],
    environment: 'node',
    testTimeout: 10 * 60 * 1000
  }
})
