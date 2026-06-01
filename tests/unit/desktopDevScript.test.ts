import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('desktop dev script', () => {
  it('starts a browser-neutral Vite renderer on the selected Desktop Arcade URL', () => {
    const script = readFileSync(resolve(process.cwd(), 'scripts/desktop-dev.mjs'), 'utf8')

    expect(script).toContain('findAvailablePort(DEFAULT_RENDERER_HOST, DEFAULT_RENDERER_PORT)')
    expect(script).toContain('Starting Desktop Arcade renderer at ${RENDERER_URL}')
    expect(script).toMatch(/'--host', rendererConfig\.viteHost/)
    expect(script).toMatch(/'--port', String\(rendererConfig\.port\)/)
    expect(script).toContain("'--strictPort'")
    expect(script).toContain('AKSEL_ARCADE_RENDERER_URL: RENDERER_URL')
    expect(script).toContain('is already in use')
    expect(script).not.toContain('VITE_AKSEL_ARCADE_SURFACE')
  })
})
