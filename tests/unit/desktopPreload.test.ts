import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('desktop preload script', () => {
  it('does not require project-local modules in the sandboxed preload context', () => {
    const preloadScript = readFileSync(resolve(process.cwd(), 'desktop/preload.cjs'), 'utf8')

    expect(preloadScript).not.toMatch(/require\(['"]\.\//)
  })
})
