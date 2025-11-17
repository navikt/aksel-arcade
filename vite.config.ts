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
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-codemirror': ['@uiw/react-codemirror', '@codemirror/lang-javascript', '@codemirror/autocomplete', '@codemirror/lint'],
          'vendor-aksel': ['@navikt/ds-react', '@navikt/ds-tokens'],
          'vendor-babel': ['@babel/standalone'],
        },
      },
    },
  },
})
