import { defineConfig, mergeConfig } from 'vite'
import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig,
  defineConfig({
    base: './',
    build: {
      outDir: 'dist-desktop',
      emptyOutDir: true,
    },
  })
)
