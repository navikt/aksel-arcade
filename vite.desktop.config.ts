import { defineConfig, mergeConfig } from 'vite'
import { baseViteConfig } from './vite.config'

export default mergeConfig(
  baseViteConfig,
  defineConfig({
    base: './',
    build: {
      outDir: 'dist-desktop',
      emptyOutDir: true,
    },
  })
)
