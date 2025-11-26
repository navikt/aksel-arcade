import { describe, expect, it } from 'vitest'
import { packSnapshot, serializePackedSnapshot, unpackSnapshot } from '@/utils/snapshotPacking'
import type { ProjectSnapshot } from '@/types/project'

const baseSnapshot: ProjectSnapshot = {
  version: '1.0.0',
  files: [
    {
      id: 'jsx',
      name: 'App.tsx',
      language: 'tsx',
      content: '<App />',
      order: 0,
    },
    {
      id: 'hooks',
      name: 'useFeature.ts',
      language: 'tsx',
      content: 'export const useFeature = () => {}',
      order: 1,
      isReadonly: true,
    },
  ],
  activeFileId: 'hooks',
  preview: {
    viewport: 'MD',
    zoom: 0.9,
    theme: 'dark',
    sandboxFlags: {
      isolateNetwork: true,
      strictMode: false,
    },
  },
  settings: {
    autosave: true,
    linting: false,
    showLineNumbers: true,
  },
  updatedAt: 1730000000000,
}

describe('snapshotPacking', () => {
  it('round-trips snapshots losslessly', () => {
    const packed = packSnapshot(baseSnapshot)
    const unpacked = unpackSnapshot(packed)

    expect(unpacked).toEqual(baseSnapshot)
  })

  it('preserves sandbox flag ordering deterministically', () => {
    const scrambled: ProjectSnapshot = {
      ...baseSnapshot,
      activeFileId: 'jsx',
      preview: {
        ...baseSnapshot.preview,
        sandboxFlags: {
          laterFlag: false,
          firstFlag: true,
        },
      },
    }

    const packed = packSnapshot(scrambled)
    const unpacked = unpackSnapshot(packed)

    expect(Object.keys(unpacked.preview.sandboxFlags)).toEqual(['laterFlag', 'firstFlag'])
    expect(serializePackedSnapshot(unpacked)).toEqual(packed)
  })

  it('repairs packed payloads with stray quotes inside file content', () => {
    const packed = packSnapshot({
      ...baseSnapshot,
      files: [
        {
          ...baseSnapshot.files[0],
          content: '<BodyShort>" <strong>Literal quote</strong></BodyShort>',
        },
      ],
    })

    const corrupted = packed.replace('\\" <strong>', '" <strong>')
    const unpacked = unpackSnapshot(corrupted)

    expect(unpacked.files[0].content).toContain('" <strong>Literal quote')
    expect(unpacked).toMatchObject({
      files: [{ content: '<BodyShort>" <strong>Literal quote</strong></BodyShort>' }],
    })
  })
})
