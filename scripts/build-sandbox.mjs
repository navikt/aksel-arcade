#!/usr/bin/env node
/**
 * Pre-bundle sandbox with esbuild
 * 
 * This script bundles sandboxAksel.ts into a single IIFE bundle that:
 * 1. Includes all React/Aksel dependencies
 * 2. Exposes exports as window.sandboxBundle
 * 3. Is NOT processed by Vite (stays as-is)
 * 
 * Why: Vite's production build mangles module exports when re-exporting
 * external dependencies. Pre-bundling with esbuild gives us full control.
 */

import * as esbuild from 'esbuild';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

console.log('🔨 Building sandbox bundle with esbuild...');

try {
  // Ensure public directory exists
  const publicDir = join(rootDir, 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // Build sandbox bundle as IIFE
  await esbuild.build({
    entryPoints: [join(rootDir, 'src/sandboxAksel.ts')],
    bundle: true,
    format: 'iife',
    globalName: 'sandboxBundle',
    outfile: join(publicDir, 'sandbox-bundle.js'),
    platform: 'browser',
    target: 'es2020',
    minify: false, // Keep readable for debugging (production will minify)
    sourcemap: true,
    loader: {
      '.css': 'css',
    },
    external: [], // Bundle everything
    logLevel: 'info',
  });

  console.log('✅ Sandbox bundle created: public/sandbox-bundle.js');
  console.log('   This file will be copied as-is by Vite (no processing)');
} catch (error) {
  console.error('❌ Failed to build sandbox bundle:', error);
  process.exit(1);
}
