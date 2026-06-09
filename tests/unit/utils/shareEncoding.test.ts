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
  LEGACY_SHARE_FORMAT_VERSION,
  SHARE_FORMAT_VERSION,
  SHARE_METADATA_VERSION,
  SHARE_URL_CHAR_LIMIT,
} from '@/utils/shareEncoding'
import { fromBase64Url } from '@/utils/base64'
import { createDefaultProject } from '@/utils/projectDefaults'
import { createShareSnapshot, SNAPSHOT_FILE_IDS } from '@/services/storage'
import { createSinglePageProjectSource, getStartPageSource } from '@/services/projectSource'

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

const createNonShareableStateFixture = (): {
  snapshot: ProjectSnapshot
  expectedPayload: {
    source: {
      jsx: string
      hooks: string
    }
    preview: {
      viewport: ProjectSnapshot['preview']['viewport']
      theme: ProjectSnapshot['preview']['theme']
    }
  }
  excludedSnippets: string[]
} => {
  const project = createDefaultProject()
  project.id = '11111111-1111-4111-8111-111111111111'
  project.name = 'Sender-only project name'
  project.version = '9.9.9'
  project.createdAt = '2024-01-01T00:00:00.000Z'
  project.lastModified = '2024-01-02T00:00:00.000Z'
  project.source = createSinglePageProjectSource(
    'export default function App() { return <div>Shareable JSX</div> }',
    'export function useShareableHook() { return "Shareable Hooks" }'
  )
  const source = getStartPageSource(project)

  const snapshot = createShareSnapshot(project, {
    files: [
      {
        id: SNAPSHOT_FILE_IDS.jsx,
        name: 'SenderOnlyApp.tsx',
        language: 'tsx',
        content: source.jsx,
        order: 10,
        isReadonly: true,
      },
      {
        id: SNAPSHOT_FILE_IDS.hooks,
        name: 'sender-only-hooks.ts',
        language: 'tsx',
        content: source.hooks,
        order: 20,
      },
      {
        id: 'sender-only-extra-file',
        name: 'SenderOnlyMetadata.tsx',
        language: 'tsx',
        content: 'export const senderOnlyExtraFile = true',
        order: 30,
      },
    ],
    activeFileId: SNAPSHOT_FILE_IDS.hooks,
    preview: {
      viewport: 'LG',
      zoom: 0.42,
      theme: 'light',
      sandboxFlags: { outlines: true },
    },
    settings: {
      autosave: false,
      linting: false,
      showLineNumbers: false,
    },
  })
  snapshot.updatedAt = 1700000000000

  return {
    snapshot,
    expectedPayload: {
      source: {
        jsx: source.jsx,
        hooks: source.hooks,
      },
      preview: {
        viewport: 'LG',
        theme: 'light',
      },
    },
    excludedSnippets: [
      project.id,
      project.name,
      project.version,
      project.createdAt,
      project.lastModified,
      'files',
      'activeFileId',
      SNAPSHOT_FILE_IDS.jsx,
      SNAPSHOT_FILE_IDS.hooks,
      'SenderOnlyApp.tsx',
      'sender-only-hooks.ts',
      'SenderOnlyMetadata.tsx',
      'sender-only-extra-file',
      'senderOnlyExtraFile',
      'language',
      'order',
      'isReadonly',
      'settings',
      'autosave',
      'linting',
      'showLineNumbers',
      'updatedAt',
      String(snapshot.updatedAt),
      'zoom',
      '0.42',
      'sandboxFlags',
      'outlines',
      'warningThreshold',
      'charLimit',
      '1234',
      '2345',
    ],
  }
}

const createShareUrlForSnapshot = async (
  snapshot: ProjectSnapshot,
  formatVersion = SHARE_FORMAT_VERSION
): Promise<string> => {
  const envelope = await encodeSharePayload(snapshot, { formatVersion })
  const token = createShareToken(envelope)
  return buildShareUrl(token, 'https://example.com/playground')
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

  it('serializes newly generated v3 payloads without non-shareable project state', async () => {
    const { snapshot, expectedPayload, excludedSnippets } = createNonShareableStateFixture()
    const envelope = await encodeSharePayload(snapshot, {
      warningThresholdHit: true,
      warningThreshold: 1234,
      charLimit: 2345,
    })
    const serialized = decompressFromEncodedURIComponent(envelope.compressed)

    expect(serialized).toBeTruthy()
    const payload = JSON.parse(serialized ?? '')

    expect(payload).toEqual(expectedPayload)
    expect(Object.keys(payload).sort()).toEqual(['preview', 'source'])
    expect(Object.keys(payload.source).sort()).toEqual(['hooks', 'jsx'])
    expect(Object.keys(payload.preview).sort()).toEqual(['theme', 'viewport'])
    for (const snippet of excludedSnippets) {
      expect(serialized).not.toContain(snippet)
    }
  })

  it('generates shorter v3 Web share URLs than equivalent legacy v2 full-snapshot URLs', async () => {
    const representativeSnapshots = [
      createShareSnapshot(createDefaultProject()),
      createNonShareableStateFixture().snapshot,
    ]

    for (const snapshot of representativeSnapshots) {
      const v3Url = await createShareUrlForSnapshot(snapshot)
      const legacyV2Url = await createShareUrlForSnapshot(snapshot, LEGACY_SHARE_FORMAT_VERSION)

      expect(v3Url.length).toBeLessThan(legacyV2Url.length)
    }
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
