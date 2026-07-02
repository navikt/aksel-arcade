import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'
import { describe, expect, it } from 'vitest'
import { decodeShareToken } from '@/utils/shareDecoding'
import {
  encodeSharePayload,
  createShareToken,
  LEGACY_FULL_PROJECT_SHARE_FORMAT_VERSION,
  LEGACY_SHARE_FORMAT_VERSION,
  LEGACY_MINIMAL_SHARE_FORMAT_VERSION,
  SHARE_FULLSCREEN_INTENT_FORMAT_VERSION,
} from '@/utils/shareEncoding'
import { getCompressionStrategy } from '@/services/compressionStrategies'
import type { ProjectSnapshot } from '@/types/project'
import { createDefaultProject } from '@/utils/projectDefaults'
import { createShareSnapshot, SNAPSHOT_FILE_IDS } from '@/services/storage'
import { createSinglePageProjectSource, getStartPageSource } from '@/services/projectSource'

describe('shareDecoding full-project payloads', () => {
  it('decodes Web share URL payloads into full project source and preview preferences', async () => {
    const project = createDefaultProject()
    project.name = 'Shared project name'
    project.viewportSize = 'LG'
    project.source = createSinglePageProjectSource(
      'export default function App() { return <div>Shared JSX</div> }',
      'export function useSharedHook() { return "Shared Hooks" }'
    )
    project.annotations = [
      {
        id: '11111111-1111-4111-8111-111111111111',
        pageId: 'page01',
        x: 10,
        y: 20,
        comment: 'Persist this review note',
        element: 'div',
        elementPath: 'main > div',
        timestamp: 1720000000000,
        kind: 'feedback',
        status: 'acknowledged',
        createdAt: '2026-07-01T08:00:00.000Z',
        updatedAt: '2026-07-01T08:05:00.000Z',
      },
    ]
    const envelope = await encodeSharePayload(project, {
      previewTheme: 'light',
    })
    const token = createShareToken(envelope)
    const result = await decodeShareToken(token)

    expect(result.checksumValid).toBe(true)
    expect(result.sharedProject).toEqual({
      project: {
        annotations: project.annotations,
        name: 'Shared project name',
        source: project.source,
        preview: {
          viewport: 'LG',
        },
      },
      theme: 'light',
    })
    expect(result.snapshot?.files.find(file => file.id === 'file-jsx')?.content).toContain('Shared JSX')
    expect(result.snapshot?.files.find(file => file.id === 'file-hooks')?.content).toContain('Shared Hooks')
    expect(result.snapshot?.preview).toEqual({
      viewport: 'LG',
      zoom: 1,
      theme: 'light',
      sandboxFlags: {},
    })
    expect(result.snapshot?.settings).toEqual({
      autosave: true,
      linting: true,
      showLineNumbers: true,
    })
  })

  it('exposes preview fullscreen opening intent without adding it to the shared snapshot model', async () => {
    const project = createDefaultProject()
    project.name = 'Shared fullscreen project'
    project.viewportSize = 'LG'
    project.source = createSinglePageProjectSource(
      'export default function App() { return <div>Shared fullscreen intent</div> }',
      'export function useSharedFullscreenIntent() { return "Shared Hooks" }'
    )
    const envelope = await encodeSharePayload(project, {
      previewTheme: 'light',
      openingIntent: { previewFullscreen: true },
    })
    const token = createShareToken(envelope)
    const result = await decodeShareToken(token)

    expect(result.checksumValid).toBe(true)
    expect(result.metadata?.formatVersion).toBe(SHARE_FULLSCREEN_INTENT_FORMAT_VERSION)
    expect(result.openingIntent).toEqual({ previewFullscreen: true })
    expect(result.sharedProject).toEqual({
      project: {
        annotations: [],
        name: 'Shared fullscreen project',
        source: project.source,
        preview: {
          viewport: 'LG',
        },
      },
      theme: 'light',
    })
    expect(result.snapshot?.preview).toEqual({
      viewport: 'LG',
      zoom: 1,
      theme: 'light',
      sandboxFlags: {},
    })
    expect(JSON.stringify(result.snapshot)).not.toContain('previewFullscreen')
  })

  it('keeps decoding legacy full-project share payloads without annotations as empty annotation sets', async () => {
    const project = createDefaultProject()
    project.name = 'Legacy full-project share'
    project.viewportSize = 'LG'
    project.source = createSinglePageProjectSource(
      'export default function App() { return <div>Legacy full-project JSX</div> }',
      'export function useLegacyFullProjectHook() { return "Legacy full-project Hooks" }'
    )
    const serialized = JSON.stringify({
      project: {
        name: project.name,
        source: project.source,
        preview: {
          viewport: project.viewportSize,
        },
      },
      theme: 'light',
    })
    const envelope = await encodeSharePayload(project, {
      formatVersion: LEGACY_FULL_PROJECT_SHARE_FORMAT_VERSION,
      serialized,
      checksumSource: serialized,
    })
    const token = createShareToken(envelope)
    const result = await decodeShareToken(token)

    expect(result.checksumValid).toBe(true)
    expect(result.sharedProject?.project.annotations).toEqual([])
    expect(result.sharedProject?.project.source).toEqual(project.source)
  })

  it('keeps decoding old single-page minimal Web share URL payloads as one-page projects', async () => {
    const project = createDefaultProject()
    project.source = createSinglePageProjectSource(
      'export default function App() { return <div>Legacy minimal JSX</div> }',
      'export function useLegacyMinimalHook() { return "Legacy minimal Hooks" }'
    )
    const snapshot = createShareSnapshot(project, {
      preview: {
        viewport: 'LG',
        theme: 'light',
      },
    })
    const envelope = await encodeSharePayload(snapshot, {
      formatVersion: LEGACY_MINIMAL_SHARE_FORMAT_VERSION,
    })
    const token = createShareToken(envelope)
    const result = await decodeShareToken(token)

    expect(result.checksumValid).toBe(true)
    expect(result.sharedProject).toBeUndefined()
    expect(result.snapshot?.files.find(file => file.id === 'file-jsx')?.content).toContain(
      'Legacy minimal JSX'
    )
    expect(result.snapshot?.files.find(file => file.id === 'file-hooks')?.content).toContain(
      'Legacy minimal Hooks'
    )
  })

  it('detects preview fullscreen intent tampering through checksum validation', async () => {
    const project = createDefaultProject()
    project.source = createSinglePageProjectSource(
      'export default function App() { return <div>Checksum guard</div> }',
      'export function useChecksumGuard() { return "Shared Hooks" }'
    )
    const snapshot = createShareSnapshot(project)
    const envelope = await encodeSharePayload(snapshot)
    const token = createShareToken(envelope)
    const [version, metadata, checksum, payload] = token.split('.', 4)

    if (!version || !metadata || !checksum || !payload) {
      throw new Error('Expected a v3 share token with four segments')
    }

    const serialized = decompressFromEncodedURIComponent(payload)
    if (!serialized) {
      throw new Error('Expected the default v3 payload to decompress')
    }

    const tamperedSerialized = JSON.stringify({
      ...JSON.parse(serialized),
      previewFullscreen: true,
    })
    const tamperedToken =
      `${version}.${metadata}.${checksum}.${compressToEncodedURIComponent(tamperedSerialized)}`
    const result = await decodeShareToken(tamperedToken)

    expect(result.checksumValid).toBe(false)
    expect(result.error?.code).toBe('checksum-mismatch')
  })
})

describe('shareDecoding temporary legacy v2 full-snapshot normalization', () => {
  it('normalizes legacy v2 full snapshots to the Web share URL boundary', async () => {
    const snapshot = createLegacyFullSnapshot()
    const token = await createLegacyV2TokenForSnapshot(snapshot)
    const result = await decodeShareToken(token)

    expect(result.checksumValid).toBe(true)
    expect(result.snapshot).toMatchObject({
      version: '1.0.0',
      activeFileId: SNAPSHOT_FILE_IDS.jsx,
      preview: {
        viewport: 'XL',
        zoom: 1,
        theme: 'light',
        sandboxFlags: {},
      },
      settings: {
        autosave: true,
        linting: true,
        showLineNumbers: true,
      },
    })
    expect(result.snapshot?.updatedAt).not.toBe(snapshot.updatedAt)
    expect(result.snapshot?.files).toEqual([
      {
        id: SNAPSHOT_FILE_IDS.jsx,
        name: 'App.tsx',
        language: 'tsx',
        content: 'export default function App() { return <div>Legacy JSX</div> }',
        order: 0,
      },
      {
        id: SNAPSHOT_FILE_IDS.hooks,
        name: 'hooks.ts',
        language: 'tsx',
        content: 'export function useLegacyHook() { return "Legacy Hooks" }',
        order: 1,
      },
    ])
  })

  it.each([
    ['JSX', SNAPSHOT_FILE_IDS.jsx],
    ['Hooks', SNAPSHOT_FILE_IDS.hooks],
  ])('rejects legacy v2 full snapshots missing canonical %s source', async (_label, fileId) => {
    const snapshot = createLegacyFullSnapshot()
    snapshot.files = snapshot.files.filter(file => file.id !== fileId)
    const token = await createLegacyV2TokenForSnapshot(snapshot)
    const result = await decodeShareToken(token)

    expect(result.checksumValid).toBe(false)
    expect(result.snapshot).toBeUndefined()
    expect(result.error?.code).toBe('decode-failed')
  })
})

describe('shareDecoding temporary legacy v2 packed strategy', () => {
  it('decodes packed-deflate tokens', async () => {
    const snapshot = createLegacyFullSnapshot()
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
    expect(result.snapshot?.files[0]?.name).toBe('App.tsx')
    expect(result.snapshot?.files.find(file => file.id === 'legacy-extra')).toBeUndefined()
  })

  it('decodes packed-brotli q11 tokens', async () => {
    const snapshot = createLegacyFullSnapshot()
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
    expect(result.snapshot?.preview.zoom).toBe(1)
  })

  it('decodes packed-brotli q11 base64url tokens', async () => {
    const snapshot = createLegacyFullSnapshot()
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

const createLegacyFullSnapshot = (): ProjectSnapshot => {
  const project = createDefaultProject()
  project.version = '9.9.9'
  project.source = createSinglePageProjectSource(
    'export default function App() { return <div>Legacy JSX</div> }',
    'export function useLegacyHook() { return "Legacy Hooks" }'
  )
  const source = getStartPageSource(project)
  const snapshot = createShareSnapshot(project, {
    files: [
      {
        id: SNAPSHOT_FILE_IDS.jsx,
        name: 'SenderApp.tsx',
        language: 'tsx',
        content: source.jsx,
        order: 10,
      },
      {
        id: SNAPSHOT_FILE_IDS.hooks,
        name: 'sender-hooks.ts',
        language: 'tsx',
        content: source.hooks,
        order: 20,
      },
      {
        id: 'legacy-extra',
        name: 'legacy-extra.tsx',
        language: 'tsx',
        content: 'export const leaked = true',
        order: 30,
      },
    ],
    activeFileId: SNAPSHOT_FILE_IDS.hooks,
    preview: {
      viewport: 'XL',
      zoom: 0.5,
      theme: 'light',
      sandboxFlags: { outlines: true },
    },
    settings: {
      autosave: false,
      linting: false,
      showLineNumbers: false,
    },
  })
  snapshot.updatedAt = 1234567890
  return snapshot
}

const createLegacyV2TokenForSnapshot = async (snapshot: ProjectSnapshot): Promise<string> => {
  const envelope = await encodeSharePayload(snapshot, {
    formatVersion: LEGACY_SHARE_FORMAT_VERSION,
  })
  return createShareToken(envelope)
}
