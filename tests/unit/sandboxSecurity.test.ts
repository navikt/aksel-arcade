import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const readProjectFile = (filePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), filePath), 'utf8')

describe('sandbox security boundaries', () => {
  it('does not execute user code through direct string evaluation', () => {
    const sandboxHtml = readProjectFile('public/sandbox.html')

    expect(sandboxHtml).not.toMatch(/\beval\s*\(/)
    expect(sandboxHtml).not.toMatch(/\bnew\s+Function\s*\(/)
    expect(sandboxHtml).not.toContain("'unsafe-eval'")
  })

  it('runs the preview iframe with an opaque sandbox origin', () => {
    const livePreview = readProjectFile('src/components/Preview/LivePreview.tsx')

    expect(livePreview).toContain('sandbox="allow-scripts"')
    expect(livePreview).not.toContain('allow-same-origin')
  })

  it('requires the original sandbox session before parent messages resume', () => {
    const sandboxHtml = readProjectFile('public/sandbox.html')
    const livePreview = readProjectFile('src/components/Preview/LivePreview.tsx')

    expect(sandboxHtml).toContain('sandboxSessionToken')
    expect(livePreview).toContain('sandboxSessionTokenRef')
    expect(livePreview).toContain("iframe.addEventListener('load', handleLoad)")
  })
})
