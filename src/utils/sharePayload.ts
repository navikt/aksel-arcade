import type { ProjectSnapshot, ShareUrlOpeningIntent, ViewportSize } from '@/types/project'
import { SNAPSHOT_FILE_IDS } from '@/services/storage'

export interface WebShareUrlPayloadV3 {
  source: {
    jsx: string
    hooks: string
  }
  preview: {
    viewport: ViewportSize
    theme: ProjectSnapshot['preview']['theme']
  }
  previewFullscreen?: true
}

const WEB_SHARE_SNAPSHOT_VERSION = '1.0.0'
const VALID_VIEWPORTS: readonly ViewportSize[] = ['2XL', 'XL', 'LG', 'MD', 'SM', 'XS']
const VALID_THEMES: readonly ProjectSnapshot['preview']['theme'][] = ['light', 'dark']

export const createWebShareUrlPayload = (
  snapshot: ProjectSnapshot,
  options?: { openingIntent?: ShareUrlOpeningIntent }
): WebShareUrlPayloadV3 => ({
  source: {
    jsx: findJsxSource(snapshot),
    hooks: findHooksSource(snapshot),
  },
  preview: {
    viewport: snapshot.preview.viewport,
    theme: snapshot.preview.theme,
  },
  ...(options?.openingIntent?.previewFullscreen ? { previewFullscreen: true } : {}),
})

export const normalizeLegacyV2FullSnapshotToWebShareSnapshot = (
  snapshot: ProjectSnapshot
): ProjectSnapshot =>
  webShareUrlPayloadToSnapshot({
    source: {
      jsx: requireCanonicalSource(snapshot, SNAPSHOT_FILE_IDS.jsx, 'JSX'),
      hooks: requireCanonicalSource(snapshot, SNAPSHOT_FILE_IDS.hooks, 'Hooks'),
    },
    preview: {
      viewport: snapshot.preview.viewport,
      theme: snapshot.preview.theme,
    },
  })

export const serializeWebShareUrlPayload = (payload: WebShareUrlPayloadV3): string =>
  JSON.stringify({
    source: {
      jsx: payload.source.jsx,
      hooks: payload.source.hooks,
    },
    preview: {
      viewport: payload.preview.viewport,
      theme: payload.preview.theme,
    },
    ...(payload.previewFullscreen ? { previewFullscreen: true } : {}),
  })

export const parseWebShareUrlPayload = (serialized: string): WebShareUrlPayloadV3 => {
  const value = JSON.parse(serialized) as unknown
  assertRecord(value, 'Web share payload')
  assertAllowedKeys(value, ['source', 'preview', 'previewFullscreen'], 'Web share payload')
  assertRequiredKeys(value, ['source', 'preview'], 'Web share payload')

  const { source, preview } = value
  assertRecord(source, 'Web share source')
  assertRecord(preview, 'Web share preview')
  assertExactKeys(source, ['jsx', 'hooks'], 'Web share source')
  assertExactKeys(preview, ['viewport', 'theme'], 'Web share preview')

  if ('previewFullscreen' in value && value.previewFullscreen !== true) {
    throw new Error('Web share preview fullscreen intent is invalid')
  }

  if (typeof source.jsx !== 'string' || typeof source.hooks !== 'string') {
    throw new Error('Web share source must include JSX and Hooks strings')
  }

  if (!isViewport(preview.viewport)) {
    throw new Error('Web share preview viewport is invalid')
  }

  if (!isTheme(preview.theme)) {
    throw new Error('Web share preview theme is invalid')
  }

  return {
    source: {
      jsx: source.jsx,
      hooks: source.hooks,
    },
    preview: {
      viewport: preview.viewport,
      theme: preview.theme,
    },
    ...(value.previewFullscreen === true ? { previewFullscreen: true } : {}),
  }
}

export const extractShareUrlOpeningIntent = (
  payload: Pick<WebShareUrlPayloadV3, 'previewFullscreen'>
): ShareUrlOpeningIntent | undefined =>
  payload.previewFullscreen ? { previewFullscreen: true } : undefined

export const webShareUrlPayloadToSnapshot = (payload: WebShareUrlPayloadV3): ProjectSnapshot => ({
  version: WEB_SHARE_SNAPSHOT_VERSION,
  files: [
    {
      id: SNAPSHOT_FILE_IDS.jsx,
      name: 'App.tsx',
      language: 'tsx',
      content: payload.source.jsx,
      order: 0,
    },
    {
      id: SNAPSHOT_FILE_IDS.hooks,
      name: 'hooks.ts',
      language: 'tsx',
      content: payload.source.hooks,
      order: 1,
    },
  ],
  activeFileId: SNAPSHOT_FILE_IDS.jsx,
  preview: {
    viewport: payload.preview.viewport,
    zoom: 1,
    theme: payload.preview.theme,
    sandboxFlags: {},
  },
  settings: {
    autosave: true,
    linting: true,
    showLineNumbers: true,
  },
  updatedAt: Date.now(),
})

const findJsxSource = (snapshot: ProjectSnapshot): string =>
  findFileContent(snapshot, SNAPSHOT_FILE_IDS.jsx)
  ?? findFileContentByName(snapshot, 'App.tsx')
  ?? findFileContent(snapshot, snapshot.activeFileId)
  ?? findFirstTsxContent(snapshot)
  ?? ''

const findHooksSource = (snapshot: ProjectSnapshot): string =>
  findFileContent(snapshot, SNAPSHOT_FILE_IDS.hooks)
  ?? findFileContentByName(snapshot, 'hooks.ts')
  ?? ''

const findFileContent = (snapshot: ProjectSnapshot, fileId: string): string | undefined =>
  snapshot.files.find((file) => file.id === fileId)?.content

const findFileContentByName = (snapshot: ProjectSnapshot, name: string): string | undefined =>
  snapshot.files.find((file) => file.name === name)?.content

const findFirstTsxContent = (snapshot: ProjectSnapshot): string | undefined =>
  snapshot.files.find((file) => file.language === 'tsx')?.content

const requireCanonicalSource = (
  snapshot: ProjectSnapshot,
  fileId: string,
  label: string
): string => {
  const content = findFileContent(snapshot, fileId)
  if (content === undefined) {
    throw new Error(`Legacy v2 Web share URL is missing canonical ${label} source`)
  }
  return content
}

function assertRecord(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`)
  }
}

const assertExactKeys = (
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
  label: string
): void => {
  const keys = Object.keys(value)
  const extras = keys.filter((key) => !allowedKeys.includes(key))

  if (extras.length) {
    throw new Error(`${label} keys are invalid`)
  }
}

const assertAllowedKeys = (
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
  label: string
): void => {
  const keys = Object.keys(value)
  const extras = keys.filter((key) => !allowedKeys.includes(key))

  if (extras.length) {
    throw new Error(`${label} keys are invalid`)
  }
}

const assertRequiredKeys = (
  value: Record<string, unknown>,
  requiredKeys: readonly string[],
  label: string
): void => {
  const keys = Object.keys(value)
  const missing = requiredKeys.filter((key) => !keys.includes(key))

  if (missing.length) {
    throw new Error(`${label} keys are invalid`)
  }
}

const isViewport = (value: unknown): value is ViewportSize =>
  typeof value === 'string' && VALID_VIEWPORTS.includes(value as ViewportSize)

const isTheme = (value: unknown): value is ProjectSnapshot['preview']['theme'] =>
  typeof value === 'string' && VALID_THEMES.includes(value as ProjectSnapshot['preview']['theme'])
