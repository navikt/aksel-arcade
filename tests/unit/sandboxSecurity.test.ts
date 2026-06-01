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

  it('routes parent-to-sandbox messages through a private message channel', () => {
    const sandboxHtml = readProjectFile('public/sandbox.html')
    const livePreview = readProjectFile('src/components/Preview/LivePreview.tsx')

    expect(sandboxHtml).toContain('CONNECT_SANDBOX')
    expect(sandboxHtml).toContain('mainMessagePort')
    expect(livePreview).toContain('new MessageChannel()')
    expect(livePreview).toContain('registerSandboxMessagePort')
    expect(livePreview).toContain("iframe?.addEventListener('load', handleLoad)")
    expect(livePreview).toContain('sandboxConnectedRef.current = false')
    expect(livePreview).toContain('sandboxRetiredRef.current')
    expect(livePreview).toContain('Ignored sandbox message after iframe navigation')
    expect(livePreview).toContain("type: 'TOGGLE_INSPECT'")
    expect(livePreview).toContain('[isInspectMode, sandboxReady, iframeRef]')
  })

  it('checks parent message source and origin before handling sandbox messages', () => {
    const sandboxHtml = readProjectFile('public/sandbox.html')

    expect(sandboxHtml).toContain('event.source !== window.parent')
    expect(sandboxHtml).toContain('event.origin === window.location.origin')
    expect(sandboxHtml).toContain("window.location.protocol === 'file:' && event.origin === 'null'")
  })
})
