import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const tsxCli = path.resolve(scriptDir, '../node_modules/tsx/dist/cli.mjs')
const tsScript = path.resolve(scriptDir, 'generate-aksel-autocomplete-data.ts')

const result = spawnSync(
  process.execPath,
  [tsxCli, '--tsconfig', 'tsconfig.node.json', tsScript, ...process.argv.slice(2)],
  {
    stdio: 'inherit',
  }
)

if (result.error) {
  throw result.error
}

process.exit(result.status ?? 1)
