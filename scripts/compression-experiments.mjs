#!/usr/bin/env node
import fs from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import * as esbuild from 'esbuild'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, '..')
const cacheDir = join(projectRoot, 'node_modules', '.cache', 'aksel-arcade')
const entryPoint = join(__dirname, 'compression-experiments-entry.ts')
const bundledRunner = join(cacheDir, 'compression-experiments-entry.mjs')

if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true })
}

try {
  await esbuild.build({
    entryPoints: [entryPoint],
    outfile: bundledRunner,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: ['node18'],
    sourcemap: false,
    external: ['brotli-wasm', 'lzma'],
    logLevel: 'silent',
    tsconfigRaw: {
      compilerOptions: {
        baseUrl: projectRoot,
        paths: {
          '@/*': ['src/*'],
        },
      },
    },
  })
} catch (error) {
  console.error('❌ Failed to compile compression experiments runner:', error)
  process.exit(1)
}

process.env.AKSEL_ARCADE_ROOT = projectRoot

try {
  const moduleUrl = pathToFileURL(bundledRunner).href
  const runnerModule = await import(moduleUrl)
  const runner = runnerModule.runCompressionExperiments ?? runnerModule.default
  if (typeof runner !== 'function') {
    throw new Error('Compiled runner does not export runCompressionExperiments()')
  }
  await runner()
} catch (error) {
  console.error('❌ Compression experiments failed:', error)
  process.exit(1)
}
