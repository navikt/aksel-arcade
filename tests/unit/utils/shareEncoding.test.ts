import { describe, expect, it } from 'vitest'
import { decompressFromEncodedURIComponent } from 'lz-string'
import type { Project, ProjectSnapshot } from '@/types/project'
import {
  buildShareUrl,
  createShareToken,
  decodeShareTokenMetadata,
  DEFAULT_COMPRESSION_STRATEGY_ID,
  encodeSharePayload,
  computeChecksum,
  estimateShareUrlLength,
  LEGACY_SHARE_FORMAT_VERSION,
  SHARE_FULLSCREEN_INTENT_FORMAT_VERSION,
  SHARE_FORMAT_VERSION,
  SHARE_METADATA_VERSION,
  SHARE_URL_CHAR_LIMIT,
} from '@/utils/shareEncoding'
import { fromBase64Url } from '@/utils/base64'
import { createDefaultProject } from '@/utils/projectDefaults'
import { createShareSnapshot, SNAPSHOT_FILE_IDS } from '@/services/storage'
import { createSinglePageProjectSource, getStartPageSource } from '@/services/projectSource'
import type { ArcadeAnnotation } from '@/types/annotations'

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
  project: Project
  snapshot: ProjectSnapshot
  expectedPayload: {
    project: {
      annotations: ArcadeAnnotation[]
      name: string
      source: Project['source']
      preview: {
        viewport: Project['viewportSize']
      }
    }
    theme: ProjectSnapshot['preview']['theme']
  }
  excludedSnippets: string[]
} => {
  const project = createDefaultProject()
  project.id = '11111111-1111-4111-8111-111111111111'
  project.name = 'Sender-only project name'
  project.version = '9.9.9'
  project.createdAt = '2024-01-01T00:00:00.000Z'
  project.lastModified = '2024-01-02T00:00:00.000Z'
  project.viewportSize = 'LG'
  project.source = createSinglePageProjectSource(
    'export default function App() { return <div>Shareable JSX</div> }',
    'export function useShareableHook() { return "Shareable Hooks" }'
  )
  project.annotations = [
    {
      id: '33333333-3333-4333-8333-333333333333',
      pageId: 'page01',
      x: 12,
      y: 18,
      comment: 'Persist this annotation in the share payload',
      element: 'Alert',
      elementPath: 'main > div',
      timestamp: 1720000000000,
      kind: 'feedback',
      status: 'acknowledged',
      thread: [
        {
          id: '22222222-2222-4222-8222-222222222222',
          role: 'agent',
          content: 'Acknowledged for follow-up.',
          timestamp: 1720000005000,
        },
      ],
      createdAt: '2026-07-01T08:00:00.000Z',
      updatedAt: '2026-07-01T08:05:00.000Z',
    },
  ]
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
    project,
    snapshot,
    expectedPayload: {
      project: {
        annotations: project.annotations,
        name: project.name,
        source: project.source,
        preview: {
          viewport: 'LG',
        },
      },
      theme: 'light',
    },
    excludedSnippets: [
      project.id,
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
      String(snapshot.updatedAt),
      'zoom',
      '0.42',
      'sandboxFlags',
      'outlines',
      'previewFullscreen',
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

const createShareUrlForProject = async (
  project: Project,
  previewTheme: ProjectSnapshot['preview']['theme'] = 'dark'
): Promise<string> => {
  const envelope = await encodeSharePayload(project, { previewTheme })
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

  it('encodes project into a URI-safe payload', async () => {
    const envelope = await encodeSharePayload(createDefaultProject())
    const token = createShareToken(envelope)

    expect(envelope.formatVersion).toBe(SHARE_FORMAT_VERSION)
    expect(envelope.compressed.length).toBeGreaterThan(0)
    expect(envelope.checksum.length).toBeGreaterThanOrEqual(43)
    expect(token.split('.', 4)).toHaveLength(4)
    expect(token).not.toContain(' ')
  })

  it('serializes newly generated full-project payloads without non-shareable project state', async () => {
    const { project, expectedPayload, excludedSnippets } = createNonShareableStateFixture()
    const envelope = await encodeSharePayload(project, {
      previewTheme: 'light',
      warningThresholdHit: true,
      warningThreshold: 1234,
      charLimit: 2345,
    })
    const serialized = decompressFromEncodedURIComponent(envelope.compressed)

    expect(serialized).toBeTruthy()
    const payload = JSON.parse(serialized ?? '')

    expect(payload).toEqual(expectedPayload)
    expect(Object.keys(payload).sort()).toEqual(['project', 'theme'])
    expect(Object.keys(payload.project).sort()).toEqual([
      'annotations',
      'name',
      'preview',
      'source',
    ])
    expect(Object.keys(payload.project.preview).sort()).toEqual(['viewport'])
    for (const snippet of excludedSnippets) {
      expect(serialized).not.toContain(snippet)
    }
  })

  it('serializes preview fullscreen opening intent only when requested', async () => {
    const { project, expectedPayload } = createNonShareableStateFixture()
    const envelope = await encodeSharePayload(project, {
      previewTheme: 'light',
      openingIntent: { previewFullscreen: true },
    })
    const serialized = decompressFromEncodedURIComponent(envelope.compressed)

    expect(serialized).toBeTruthy()
    expect(envelope.formatVersion).toBe(SHARE_FULLSCREEN_INTENT_FORMAT_VERSION)
    expect(JSON.parse(serialized ?? '')).toEqual({
      ...expectedPayload,
      previewFullscreen: true,
    })
  })

  it('generates shorter full-project Web share URLs than equivalent legacy v2 full-snapshot URLs', async () => {
    const representativeProjects = [
      { project: createDefaultProject(), previewTheme: 'dark' as const },
      {
        project: {
          ...createNonShareableStateFixture().project,
          annotations: [],
        },
        previewTheme: 'light' as const,
      },
    ]

    for (const { project, previewTheme } of representativeProjects) {
      const snapshot = createShareSnapshot(project, {
        preview: {
          viewport: project.viewportSize,
          theme: previewTheme,
        },
      })
      const currentUrl = await createShareUrlForProject(project, previewTheme)
      const legacyV2Url = await createShareUrlForSnapshot(snapshot, LEGACY_SHARE_FORMAT_VERSION)

      expect(currentUrl.length).toBeLessThan(legacyV2Url.length)
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

  it('keeps the default project under the share limit', async () => {
    const envelope = await encodeSharePayload(createDefaultProject())
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
