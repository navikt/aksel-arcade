import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('desktop dev script', () => {
  it('starts a browser-neutral Vite renderer and lets Electron preload select Desktop Arcade', () => {
    const script = readFileSync(resolve(process.cwd(), 'scripts/desktop-dev.mjs'), 'utf8')

    expect(script).toMatch(
      /spawnChild\(commandName\('vite'\), \['--host', '127\.0\.0\.1', '--strictPort'\]/
    )
    expect(script).not.toContain('VITE_AKSEL_ARCADE_SURFACE')
  })
})
