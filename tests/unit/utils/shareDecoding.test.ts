import fs from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { decodeShareToken } from '@/utils/shareDecoding'
import { encodeSharePayload, createShareToken, LEGACY_SHARE_FORMAT_VERSION } from '@/utils/shareEncoding'
import { getCompressionStrategy } from '@/services/compressionStrategies'
import type { ProjectSnapshot } from '@/types/project'
import { createDefaultProject } from '@/utils/projectDefaults'
import { createShareSnapshot } from '@/services/storage'

const fixturesDir = path.resolve(process.cwd(), 'tests/fixtures/share')

const loadFixtureSnapshot = async (fileName: string): Promise<ProjectSnapshot> => {
  const raw = await fs.readFile(path.join(fixturesDir, fileName), 'utf-8')
  return JSON.parse(raw) as ProjectSnapshot
}

describe('shareDecoding v3 payloads', () => {
  it('decodes v3 Web share URL payloads into shared source and preview preferences', async () => {
    const project = createDefaultProject()
    project.jsxCode = 'export default function App() { return <div>Shared JSX</div> }'
    project.hooksCode = 'export function useSharedHook() { return "Shared Hooks" }'
    const snapshot = createShareSnapshot(project, {
      preview: {
        viewport: 'LG',
        theme: 'light',
      },
    })
    const envelope = await encodeSharePayload(snapshot)
    const token = createShareToken(envelope)
    const result = await decodeShareToken(token)

    expect(result.checksumValid).toBe(true)
    expect(result.snapshot?.files.find(file => file.id === 'file-jsx')?.content).toContain('Shared JSX')
    expect(result.snapshot?.files.find(file => file.id === 'file-hooks')?.content).toContain('Shared Hooks')
    expect(result.snapshot?.preview).toEqual({
      viewport: snapshot.preview.viewport,
      zoom: 1,
      theme: snapshot.preview.theme,
      sandboxFlags: {},
    })
    expect(result.snapshot?.settings).toEqual({
      autosave: true,
      linting: true,
      showLineNumbers: true,
    })
  })
})

describe('shareDecoding packed strategy', () => {
  it('decodes packed-deflate tokens', async () => {
    const snapshot = await loadFixtureSnapshot('summary-page.json')
    const strategy = getCompressionStrategy('packed-deflate-b91')
    if (!strategy) {
      throw new Error('packed-deflate-b91 strategy missing')
    }

    const encoded = await strategy.encode({ snapshot })
    const envelope = await encodeSharePayload(snapshot, {
      formatVersion: LEGACY_SHARE_FORMAT_VERSION,
      serialized: encoded.serialized,
      checksumSource: encoded.checksumSource,
      compressed: encoded.payload,
      strategyId: strategy.id,
    })
    const token = createShareToken(envelope)
    const result = await decodeShareToken(token)

    expect(result.checksumValid).toBe(true)
    expect(result.snapshot?.files[0]?.name).toBe('SummaryPage.tsx')
  })

  it('decodes packed-brotli q11 tokens', async () => {
    const snapshot = await loadFixtureSnapshot('hooks-demo.json')
    const strategy = getCompressionStrategy('packed-brotli-q11-b91')
    if (!strategy) {
      throw new Error('packed-brotli-q11-b91 strategy missing')
    }

    const encoded = await strategy.encode({ snapshot })
    const envelope = await encodeSharePayload(snapshot, {
      formatVersion: LEGACY_SHARE_FORMAT_VERSION,
      serialized: encoded.serialized,
      checksumSource: encoded.checksumSource,
      compressed: encoded.payload,
      strategyId: strategy.id,
    })
    const token = createShareToken(envelope)
    const result = await decodeShareToken(token)

    expect(result.checksumValid).toBe(true)
    expect(result.snapshot?.files.some(file => file.name === 'App.tsx')).toBe(true)
  })

  it('decodes packed-brotli q11 base64url tokens', async () => {
    const snapshot = await loadFixtureSnapshot('hooks-demo.json')
    const strategy = getCompressionStrategy('packed-brotli-q11-b64url')
    if (!strategy) {
      throw new Error('packed-brotli-q11-b64url strategy missing')
    }

    const encoded = await strategy.encode({ snapshot })
    const envelope = await encodeSharePayload(snapshot, {
      formatVersion: LEGACY_SHARE_FORMAT_VERSION,
      serialized: encoded.serialized,
      checksumSource: encoded.checksumSource,
      compressed: encoded.payload,
      strategyId: strategy.id,
    })
    const token = createShareToken(envelope)
    const result = await decodeShareToken(token)

    expect(result.checksumValid).toBe(true)
    expect(result.snapshot?.files.some(file => file.name === 'App.tsx')).toBe(true)
  })
})
