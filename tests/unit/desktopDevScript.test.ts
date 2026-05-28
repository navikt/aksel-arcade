import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('desktop dev script', () => {
  it('starts the Vite renderer with the Desktop Arcade capability surface', () => {
    const script = readFileSync(resolve(process.cwd(), 'scripts/desktop-dev.mjs'), 'utf8')

    expect(script).toMatch(
      /spawnChild\(commandName\('vite'\), \['--host', '127\.0\.0\.1', '--strictPort'\],[\s\S]*VITE_AKSEL_ARCADE_SURFACE: 'desktop'/
    )
  })
})
