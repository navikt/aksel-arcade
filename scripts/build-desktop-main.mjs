import path from 'node:path'
import { builtinModules } from 'node:module'
import * as esbuild from 'esbuild'

const workspaceRoot = process.cwd()
const entryPoint = path.resolve(workspaceRoot, 'desktop/main.ts')
const outputFile = path.resolve(workspaceRoot, 'desktop/dist/main.cjs')

const external = [
  'electron',
  ...builtinModules,
  ...builtinModules.map((moduleName) => `node:${moduleName}`),
]

await esbuild.build({
  entryPoints: [entryPoint],
  outfile: outputFile,
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: 'node20',
  sourcemap: false,
  legalComments: 'none',
  logLevel: 'info',
  external,
})
