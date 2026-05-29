import { describe, expect, it } from 'vitest'
import { decompressFromEncodedURIComponent } from 'lz-string'
import type { ProjectSnapshot } from '@/types/project'
import {
  buildShareUrl,
  createShareToken,
  decodeShareTokenMetadata,
  DEFAULT_COMPRESSION_STRATEGY_ID,
  encodeSharePayload,
  computeChecksum,
  estimateShareUrlLength,
  SHARE_FORMAT_VERSION,
  SHARE_METADATA_VERSION,
  SHARE_URL_CHAR_LIMIT,
} from '@/utils/shareEncoding'
import { fromBase64Url } from '@/utils/base64'
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

    expect(envelope.formatVersion).toBe(SHARE_FORMAT_VERSION)
    expect(envelope.compressed.length).toBeGreaterThan(0)
    expect(envelope.checksum.length).toBeGreaterThanOrEqual(43)
    expect(token.split('.', 4)).toHaveLength(4)
    expect(token).not.toContain(' ')
  })

  it('serializes only the v3 Web share URL payload fields', async () => {
    const envelope = await encodeSharePayload(snapshotFixture)
    const serialized = decompressFromEncodedURIComponent(envelope.compressed)

    expect(serialized).toBeTruthy()
    const payload = JSON.parse(serialized ?? '')

    expect(payload).toEqual({
      source: {
        jsx: "export default function App() { return <div>Test</div> }",
        hooks: '',
      },
      preview: {
        viewport: 'MD',
        theme: 'dark',
      },
    })
    expect(serialized).not.toContain('activeFileId')
    expect(serialized).not.toContain('files')
    expect(serialized).not.toContain('settings')
    expect(serialized).not.toContain('updatedAt')
    expect(serialized).not.toContain('zoom')
    expect(serialized).not.toContain('sandboxFlags')
  })

  it('keeps share URL warning and limit metadata out of v3 tokens', async () => {
    const envelope = await encodeSharePayload(snapshotFixture, {
      warningThresholdHit: true,
      warningThreshold: 10,
      charLimit: 20,
    })
    const token = createShareToken(envelope)
    const [, metadataSegment] = token.split('.', 4)
    const metadataWire = JSON.parse(new TextDecoder().decode(fromBase64Url(metadataSegment)))

    expect(metadataWire).toEqual({
      v: SHARE_METADATA_VERSION,
      s: DEFAULT_COMPRESSION_STRATEGY_ID,
    })
    expect(decodeShareTokenMetadata(metadataSegment)).toEqual({
      metadataVersion: SHARE_METADATA_VERSION,
      strategyId: DEFAULT_COMPRESSION_STRATEGY_ID,
      warningThresholdHit: undefined,
      warningThreshold: undefined,
      charLimit: undefined,
    })
  })

  it('builds share URL with ?share param', async () => {
    const envelope = await encodeSharePayload(snapshotFixture)
    const token = createShareToken(envelope)
    const url = buildShareUrl(token, 'https://example.com/playground')

    const parsed = new URL(url)
    expect(`${parsed.origin}${parsed.pathname}`).toBe('https://example.com/playground')
    expect(parsed.searchParams.get('share')).toBe(token)
  })

  it('URL-encodes reserved token characters', () => {
    const token = "2.meta.checksum.A&B/?:#@"
    const url = buildShareUrl(token, 'https://example.com/playground?foo=bar')
    const parsed = new URL(url)

    expect(parsed.searchParams.get('share')).toBe(token)
    expect(url).toContain('%26')
    expect(url).toContain('%2F')
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
