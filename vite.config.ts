import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  base: '/aksel-arcade/', // GitHub Pages base path
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    // Exclude Aksel from pre-bundling so it uses external React from sandbox importmap
    exclude: ['@navikt/ds-react', '@navikt/ds-css'],
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
