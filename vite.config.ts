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
    manifest: true, // Generate manifest.json for runtime asset discovery
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        sandbox: path.resolve(__dirname, 'src/sandboxAksel.ts'),
      },
      output: {
        manualChunks: {
          // NO code-splitting for React/Aksel - they must be in the sandbox bundle
          // Only split truly independent vendor chunks that sandbox doesn't need
          'vendor-codemirror': ['@uiw/react-codemirror', '@codemirror/lang-javascript', '@codemirror/autocomplete', '@codemirror/lint'],
          'vendor-babel': ['@babel/standalone'],
        },
      },
    },
  },
})
