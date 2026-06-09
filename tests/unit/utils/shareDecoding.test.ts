import { describe, expect, it } from 'vitest'
import { decodeShareToken } from '@/utils/shareDecoding'
import { encodeSharePayload, createShareToken, LEGACY_SHARE_FORMAT_VERSION } from '@/utils/shareEncoding'
import { getCompressionStrategy } from '@/services/compressionStrategies'
import type { ProjectSnapshot } from '@/types/project'
import { createDefaultProject } from '@/utils/projectDefaults'
import { createShareSnapshot, SNAPSHOT_FILE_IDS } from '@/services/storage'
import { createSinglePageProjectSource, getStartPageSource } from '@/services/projectSource'

describe('shareDecoding v3 payloads', () => {
  it('decodes v3 Web share URL payloads into shared source and preview preferences', async () => {
    const project = createDefaultProject()
    project.source = createSinglePageProjectSource(
      'export default function App() { return <div>Shared JSX</div> }',
      'export function useSharedHook() { return "Shared Hooks" }'
    )
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
