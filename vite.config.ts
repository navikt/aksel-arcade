import { defineConfig, type UserConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { execSync } from 'child_process'

const codeEditorChunkMarkers = [
  '/node_modules/@uiw/react-codemirror/',
  '/node_modules/@uiw/codemirror-themes/',
  '/node_modules/@codemirror/',
  '/node_modules/@lezer/',
]

function resolveAppVersion(): string {
  if (process.env.AKSEL_ARCADE_DESKTOP_VERSION) {
    return process.env.AKSEL_ARCADE_DESKTOP_VERSION
  }
  try {
    const tag = execSync('git tag --list "desktop-v*" --sort=-version:refname', {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .trim()
      .split('\n')[0]
    if (tag) return tag.replace('desktop-v', '')
  } catch {
    // no git or no tags
  }
  return 'dev'
}

export const baseViteConfig = {
  base: '/aksel-arcade/', // GitHub Pages base path
  define: {
    __APP_VERSION__: JSON.stringify(resolveAppVersion()),
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    // Exclude Aksel from pre-bundling so it uses external React from sandbox importmap
    exclude: ['@navikt/ds-react', '@navikt/ds-css', 'brotli-wasm', 'lzma'],
  },
  build: {
    // Security: Disable source maps in production
    sourcemap: false,
    manifest: true, // Generate manifest.json for runtime asset discovery (for main app assets)
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        // NOTE: sandboxAksel.ts is pre-bundled with esbuild (see scripts/build-sandbox.mjs)
        // It's NOT included here to avoid Vite mangling the exports
      },
      output: {
        manualChunks(id) {
          const normalizedId = id.replaceAll('\\', '/')

          if (normalizedId.includes('/node_modules/@babel/standalone/')) {
            return 'vendor-babel'
          }

          // Keep editor-heavy dependencies in a dedicated chunk under Rollup 4's function-based API.
          if (codeEditorChunkMarkers.some((marker) => normalizedId.includes(marker))) {
            return 'vendor-codemirror'
          }
        },
      },
    },
  },
} satisfies UserConfig

// https://vite.dev/config/
export default defineConfig(baseViteConfig)
