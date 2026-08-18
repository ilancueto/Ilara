import { defineConfig } from 'vitest/config'
import path from 'path'

/**
 * Suite de integración Etapa 0.
 * Requiere STAGE0_INTEGRATION=1 y keys de staging/local (docs/ETAPA0_INTEGRATION_TESTS.md).
 */
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['tests/integration/**/*.test.ts'],
    exclude: ['node_modules', '.next'],
    testTimeout: 60000,
    hookTimeout: 60000,
    fileParallelism: false,
    maxWorkers: 1,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
