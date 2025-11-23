import { describe, expect, it } from 'vitest'
import type { ProjectSnapshot } from '@/types/project'
import {
  buildShareUrl,
  createShareToken,
  encodeSharePayload,
  computeChecksum,
  estimateShareUrlLength,
  SHARE_URL_CHAR_LIMIT,
} from '@/utils/shareEncoding'
import { createDefaultProject } from '@/utils/projectDefaults'
import { createShareSnapshot } from '@/services/storage'

const snapshotFixture: ProjectSnapshot = {
  version: '1.0.0',
  files: [
    {
      id: 'file-jsx',
      name: 'App.tsx',
      language: 'tsx',
      content: "export default function App() { return <div>Test</div> }",
      order: 0,
    },
  ],
  activeFileId: 'file-jsx',
  preview: {
    viewport: 'MD',
    zoom: 1,
    theme: 'dark',
    sandboxFlags: {},
  },
  settings: {
    autosave: true,
    linting: true,
    showLineNumbers: true,
  },
  updatedAt: Date.now(),
}

describe('shareEncoding utilities', () => {
  it('computes a stable checksum for identical payloads', async () => {
    const serialized = JSON.stringify(snapshotFixture)
    const first = await computeChecksum(serialized)
    const second = await computeChecksum(serialized)

    expect(first).toEqual(second)
    expect(first).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('encodes snapshot into URI-safe payload', async () => {
    const envelope = await encodeSharePayload(snapshotFixture)
    const token = createShareToken(envelope)

    expect(envelope.compressed.length).toBeGreaterThan(0)
    expect(envelope.checksum.length).toBeGreaterThanOrEqual(43)
    expect(token.split('.', 4)).toHaveLength(4)
    expect(token).not.toContain(' ')
  })

  it('builds share URL with ?share param', async () => {
    const envelope = await encodeSharePayload(snapshotFixture)
    const token = createShareToken(envelope)
    const url = buildShareUrl(token, 'https://example.com/playground')

    expect(url).toBe(`https://example.com/playground?share=${token}`)
  })

  it('keeps default project snapshot under share limit', async () => {
    const project = createDefaultProject()
    const snapshot = createShareSnapshot(project)
    const envelope = await encodeSharePayload(snapshot)
    const token = createShareToken(envelope)

    expect(token.length).toBeLessThanOrEqual(SHARE_URL_CHAR_LIMIT)
  })

  it('estimates URL length using the heuristic multiplier', () => {
    const small = estimateShareUrlLength(200, 'https://example.com/playground')
    const large = estimateShareUrlLength(800, 'https://example.com/playground')

    expect(small).toBeGreaterThan(0)
    expect(large).toBeGreaterThan(small)
  })
})
