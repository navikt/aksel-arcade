import fs from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { generateAutocompleteDataFile } from './lib/akselDocs'

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      write: {
        type: 'string',
      },
    },
    strict: true,
    allowPositionals: false,
  })

  const source = await generateAutocompleteDataFile()

  if (values.write) {
    const filePath = path.resolve(values.write)
    fs.writeFileSync(filePath, source, 'utf8')
    process.stdout.write(`Refreshed ${filePath}\n`)
    return
  }

  process.stdout.write(source)
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`)
  process.exitCode = 1
})
