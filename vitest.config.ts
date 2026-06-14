import { defineConfig, mergeConfig } from 'vitest/config'
import { baseViteConfig } from './vite.config'

export default mergeConfig(
  baseViteConfig,
  defineConfig({
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['tests/setup/wasmFetchPolyfill.ts'],
      include: ['tests/**/*.test.{ts,tsx}'],
      testTimeout: 15000,
      hookTimeout: 15000,
    },
  })
)
