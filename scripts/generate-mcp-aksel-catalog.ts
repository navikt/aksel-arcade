import fs from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { renderSharedMcpAkselCatalogModule } from './lib/akselMcpCatalog'

const DEFAULT_SHARED_OUTPUT_PATH = 'src/shared/desktopMcp/akselCatalogData.generated.ts'

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
  if (values.write) {
    const sharedPath = path.resolve(DEFAULT_SHARED_OUTPUT_PATH)
    fs.mkdirSync(path.dirname(sharedPath), { recursive: true })
    fs.writeFileSync(sharedPath, sharedSource, 'utf8')
    process.stdout.write(`Refreshed ${sharedPath}\n`)
    return
  }

  process.stdout.write(sharedSource)
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`)
  process.exitCode = 1
})
