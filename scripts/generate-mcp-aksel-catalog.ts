import fs from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'
import {
  renderLegacyMcpAkselCatalogModule,
  renderSharedMcpAkselCatalogModule,
} from './lib/akselMcpCatalog'

const DEFAULT_SHARED_OUTPUT_PATH = 'src/shared/desktopMcp/akselCatalogData.generated.ts'
const DEFAULT_LEGACY_OUTPUT_PATH = 'desktop/akselCatalogData.generated.cjs'

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      write: {
        type: 'boolean',
      },
    },
    strict: true,
    allowPositionals: false,
  })

  const sharedSource = renderSharedMcpAkselCatalogModule()
  const legacySource = renderLegacyMcpAkselCatalogModule()

  if (values.write) {
    const sharedPath = path.resolve(DEFAULT_SHARED_OUTPUT_PATH)
    const legacyPath = path.resolve(DEFAULT_LEGACY_OUTPUT_PATH)
    fs.mkdirSync(path.dirname(sharedPath), { recursive: true })
    fs.writeFileSync(sharedPath, sharedSource, 'utf8')
    fs.writeFileSync(legacyPath, legacySource, 'utf8')
    process.stdout.write(`Refreshed ${sharedPath}\nRefreshed ${legacyPath}\n`)
    return
  }

  process.stdout.write(sharedSource)
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`)
  process.exitCode = 1
})
