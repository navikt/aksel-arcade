import type { ProjectFileLanguage, ProjectSnapshot, ViewportSize } from '@/types/project'

const PACK_FORMAT_VERSION = 1
const FILE_LANGUAGE_CODES: readonly ProjectFileLanguage[] = ['tsx', 'css', 'json']
const VIEWPORT_CODES: readonly ViewportSize[] = ['2XL', 'XL', 'LG', 'MD', 'SM', 'XS']
const THEME_CODES = ['light', 'dark'] as const

const SETTINGS_AUTOSAVE_BIT = 1 << 0
const SETTINGS_LINTING_BIT = 1 << 1
const SETTINGS_LINE_NUMBERS_BIT = 1 << 2
const FILE_FLAG_READONLY = 1 << 0

export const serializePackedSnapshot = (snapshot: ProjectSnapshot): string => {
  const payload = buildPackedSnapshotWire(snapshot)
  return JSON.stringify(payload)
}

export const packSnapshot = (snapshot: ProjectSnapshot): string => {
  return serializePackedSnapshot(snapshot)
}

const buildPackedSnapshotWire = (snapshot: ProjectSnapshot): PackedSnapshotWire => {
  const activeFileIndex = Math.max(
    0,
    snapshot.files.findIndex(file => file.id === snapshot.activeFileId),
  )

  const files = snapshot.files.map(file => {
    let flags = 0
    if (file.isReadonly) {
      flags |= FILE_FLAG_READONLY
    }

    const entry: PackedFile = [
      file.id,
      file.name,
      encodeFileLanguage(file.language),
      file.order,
      file.content,
    ]

    if (flags) {
      entry.push(flags)
    }

    return entry
  })

  const preview = packPreview(snapshot)
  const settingsBits = encodeSettingsBits(snapshot)

  const payload: PackedSnapshotWire = [
    PACK_FORMAT_VERSION,
    snapshot.version,
    snapshot.updatedAt,
    activeFileIndex,
    files,
    preview,
    settingsBits,
  ]
  return payload
}

export const unpackSnapshot = (packed: string): ProjectSnapshot => {
  const payload = parsePackedSnapshot(packed)

  if (!Array.isArray(payload)) {
    throw new Error('Packed snapshot payload must be an array')
  }

  const [version, snapshotVersion, updatedAt, activeIndex, files, preview, settingsBits] = payload

  if (version !== PACK_FORMAT_VERSION) {
    throw new Error(`Unsupported packed snapshot format v${version}`)
  }

  if (typeof snapshotVersion !== 'string' || typeof updatedAt !== 'number') {
    throw new Error('Packed snapshot metadata is invalid')
  }

  if (!Array.isArray(files) || !Array.isArray(preview) || typeof settingsBits !== 'number') {
    throw new Error('Packed snapshot structure is invalid')
  }

  const decodedFiles = files.map(decodePackedFile)
  const safeIndex = clampIndex(activeIndex, decodedFiles.length)
  const activeFileId = decodedFiles[safeIndex]?.id ?? decodedFiles[0]?.id ?? ''

  return {
    version: snapshotVersion,
    files: decodedFiles,
    activeFileId,
    preview: unpackPreview(preview),
    settings: decodeSettingsBits(settingsBits),
    updatedAt,
  }
}

let lastPackedSnapshotRepairApplied = false

const parsePackedSnapshot = (packed: string): PackedSnapshotWire => {
  lastPackedSnapshotRepairApplied = false
  try {
    return JSON.parse(packed) as PackedSnapshotWire
  } catch {
    const repaired = repairPackedSnapshotJson(packed)
    if (!repaired) {
      throw new Error('Packed snapshot payload is not valid JSON')
    }
    lastPackedSnapshotRepairApplied = true
    try {
      return JSON.parse(repaired) as PackedSnapshotWire
    } catch {
      throw new Error('Packed snapshot payload is not valid JSON')
    }
  }
}

export const repairPackedSnapshotJson = (packed: string): string | null => {
  let inString = false
  let escapeNext = false
  let changed = false
  let result = ''

  for (let i = 0; i < packed.length; i += 1) {
    const char = packed[i]

    if (!inString) {
      if (char === '"') {
        inString = true
      }
      result += char
      continue
    }

    if (escapeNext) {
      escapeNext = false
      result += char
      continue
    }

    if (char === '\\') {
      escapeNext = true
      result += char
      continue
    }

    if (char === '"') {
      const nextMeaningfulIndex = findNextMeaningfulChar(packed, i + 1)
      const nextChar = nextMeaningfulIndex === -1 ? '' : packed[nextMeaningfulIndex]

      if (nextChar && !',]}'.includes(nextChar)) {
        result += "\\\""
        changed = true
        continue
      }

      inString = false
      result += char
      continue
    }

    result += char
  }

  return changed ? result : null
}

export const resetPackedSnapshotRepairState = (): void => {
  lastPackedSnapshotRepairApplied = false
}

export const consumePackedSnapshotRepairState = (): boolean => {
  const applied = lastPackedSnapshotRepairApplied
  lastPackedSnapshotRepairApplied = false
  return applied
}

const findNextMeaningfulChar = (input: string, start: number): number => {
  for (let i = start; i < input.length; i += 1) {
    const char = input[i]
    if (char === ' ' || char === '\n' || char === '\r' || char === '\t') {
      continue
    }
    return i
  }
  return -1
}

const packPreview = (snapshot: ProjectSnapshot): PackedPreview => {
  const { preview } = snapshot
  const packed: PackedPreview = [
    encodeViewport(preview.viewport),
    preview.zoom,
    encodeTheme(preview.theme),
  ]

  const keys = Object.keys(preview.sandboxFlags ?? {})
  if (keys.length) {
    const bitset = keys.map(key => (preview.sandboxFlags?.[key] ? '1' : '0')).join('')
    packed.push(keys)
    packed.push(bitset)
  }

  return packed
}

const unpackPreview = (packed: PackedPreview): ProjectSnapshot['preview'] => {
  const [viewportCode, zoom, themeCode, keys, bitset] = packed
  if (typeof viewportCode !== 'number' || typeof zoom !== 'number' || typeof themeCode !== 'number') {
    throw new Error('Packed preview payload is invalid')
  }

  const sandboxFlags: Record<string, boolean> = {}
  if (Array.isArray(keys) && typeof bitset === 'string') {
    keys.forEach((key, index) => {
      sandboxFlags[key] = bitset[index] === '1'
    })
  }

  return {
    viewport: decodeViewport(viewportCode),
    zoom,
    theme: decodeTheme(themeCode),
    sandboxFlags,
  }
}

const encodeSettingsBits = (snapshot: ProjectSnapshot): number => {
  let bits = 0
  if (snapshot.settings.autosave) {
    bits |= SETTINGS_AUTOSAVE_BIT
  }
  if (snapshot.settings.linting) {
    bits |= SETTINGS_LINTING_BIT
  }
  if (snapshot.settings.showLineNumbers) {
    bits |= SETTINGS_LINE_NUMBERS_BIT
  }
  return bits
}

const decodeSettingsBits = (bits: number): ProjectSnapshot['settings'] => {
  return {
    autosave: Boolean(bits & SETTINGS_AUTOSAVE_BIT),
    linting: Boolean(bits & SETTINGS_LINTING_BIT),
    showLineNumbers: Boolean(bits & SETTINGS_LINE_NUMBERS_BIT),
  }
}

const decodePackedFile = (entry: PackedFile): ProjectSnapshot['files'][number] => {
  const [id, name, langCode, order, content, flags = 0] = entry
  if (
    typeof id !== 'string' ||
    typeof name !== 'string' ||
    typeof langCode !== 'number' ||
    typeof order !== 'number' ||
    typeof content !== 'string'
  ) {
    throw new Error('Packed file entry is invalid')
  }

  const baseFile = {
    id,
    name,
    language: decodeFileLanguage(langCode),
    order,
    content,
  }

  if (flags & FILE_FLAG_READONLY) {
    return {
      ...baseFile,
      isReadonly: true,
    }
  }

  return baseFile
}

const encodeFileLanguage = (language: ProjectFileLanguage): number => {
  const code = FILE_LANGUAGE_CODES.indexOf(language)
  if (code === -1) {
    throw new Error(`Unsupported file language: ${language}`)
  }
  return code
}

const decodeFileLanguage = (code: number): ProjectFileLanguage => {
  const language = FILE_LANGUAGE_CODES[code]
  if (!language) {
    throw new Error(`Unknown file language code: ${code}`)
  }
  return language
}

const encodeViewport = (viewport: ViewportSize): number => {
  const code = VIEWPORT_CODES.indexOf(viewport)
  if (code === -1) {
    throw new Error(`Unsupported viewport size: ${viewport}`)
  }
  return code
}

const decodeViewport = (code: number): ViewportSize => {
  const viewport = VIEWPORT_CODES[code]
  if (!viewport) {
    throw new Error(`Unknown viewport code: ${code}`)
  }
  return viewport
}

const encodeTheme = (theme: 'light' | 'dark'): number => {
  const code = THEME_CODES.indexOf(theme)
  if (code === -1) {
    throw new Error(`Unsupported theme: ${theme}`)
  }
  return code
}

const decodeTheme = (code: number): 'light' | 'dark' => {
  const theme = THEME_CODES[code]
  if (!theme) {
    throw new Error(`Unknown theme code: ${code}`)
  }
  return theme
}

const clampIndex = (index: unknown, length: number): number => {
  if (typeof index !== 'number' || !Number.isFinite(index)) {
    return 0
  }
  if (length <= 0) {
    return 0
  }
  if (index < 0) {
    return 0
  }
  if (index >= length) {
    return length - 1
  }
  return Math.floor(index)
}

type PackedFile = [string, string, number, number, string, number?]
type PackedPreview = [number, number, number, string[]?, string?]
type PackedSnapshotWire = [
  number,
  string,
  number,
  number,
  PackedFile[],
  PackedPreview,
  number,
]
