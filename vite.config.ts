import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { execSync } from 'child_process'

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

// https://vite.dev/config/
export default defineConfig({
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
        manualChunks: {
          // Split codemirror and babel into separate chunks to reduce main bundle size
          'vendor-codemirror': ['@uiw/react-codemirror', '@codemirror/lang-javascript', '@codemirror/autocomplete', '@codemirror/lint'],
          'vendor-babel': ['@babel/standalone'],
        },
      },
    },
  },
})
