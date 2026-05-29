import type {
  Project,
  ProjectFileSnapshot,
  ProjectPreviewSnapshot,
  ProjectSettingsSnapshot,
  ProjectSizeStatus,
  ProjectSnapshot,
  PanelOrder,
  ThemeMode,
} from '@/types/project'
import { createDefaultProject } from '@/utils/projectDefaults'
import { generateSecureUUID } from '@/utils/crypto'

export const WEB_ARCADE_WORKING_COPY_STORAGE_KEY = 'aksel-arcade:project'
const STORAGE_KEY = WEB_ARCADE_WORKING_COPY_STORAGE_KEY
const WEB_ARCADE_WORKING_COPY_FORMAT = 'aksel-arcade/web-working-copy' as const
const WEB_ARCADE_WORKING_COPY_FORMAT_VERSION = 1
const MAX_PROJECT_SIZE_BYTES = 5 * 1024 * 1024 // 5MB
const WARN_PROJECT_SIZE_BYTES = 4 * 1024 * 1024 // 4MB
const CURRENT_VERSION = '1.0.0'
export const ARCADE_PROJECT_PACKAGE_FORMAT = 'aksel-arcade/project-package' as const
export const ARCADE_PROJECT_PACKAGE_FORMAT_VERSION = 2
export const ARCADE_PROJECT_PACKAGE_EXTENSION = '.akselarcade' as const
const CLEAN_PACKAGE_REJECTION_MESSAGE = 'Package is not a clean .akselarcade Arcade project package'
export const ARCADE_PROJECT_PACKAGE_MIME_TYPE =
  'application/vnd.nav.aksel-arcade.project-package+json'
export const ARCADE_PROJECT_IMPORT_ACCEPT = [
  ARCADE_PROJECT_PACKAGE_EXTENSION,
  ARCADE_PROJECT_PACKAGE_MIME_TYPE,
].join(',')

export interface SaveResult {
  success: boolean
  sizeBytes: number
  warning?: string
  error?: string
}

export interface WebArcadeWorkingCopyPreferences {
  theme: ThemeMode
  panelOrder: PanelOrder
}

export interface SaveProjectOptions {
  preferences?: WebArcadeWorkingCopyPreferences
}

interface WebArcadeWorkingCopyEnvelope {
  format: typeof WEB_ARCADE_WORKING_COPY_FORMAT
  formatVersion: typeof WEB_ARCADE_WORKING_COPY_FORMAT_VERSION
  project: Project
  preferences: WebArcadeWorkingCopyPreferences
}

export interface LoadResult {
  project: Project | null
  preferences: WebArcadeWorkingCopyPreferences
  fromStorage: boolean
  migrated: boolean
  error?: string
}

export interface ImportResult {
  project: Project | null
  success: boolean
  error?: string
}

export interface ExportProjectOptions {
  exportedAt?: string
}

export interface ArcadeProjectPackage {
  format: typeof ARCADE_PROJECT_PACKAGE_FORMAT
  formatVersion: typeof ARCADE_PROJECT_PACKAGE_FORMAT_VERSION
  project: {
    name: string
    source: {
      jsx: string
      hooks: string
    }
    preview: {
      viewport: Project['viewportSize']
    }
  }
}

export interface ShareSnapshotOverrides {
  files?: ProjectFileSnapshot[]
  activeFileId?: string
  preview?: Partial<ProjectPreviewSnapshot>
  settings?: Partial<ProjectSettingsSnapshot>
}

export const DEFAULT_WEB_ARCADE_WORKING_COPY_PREFERENCES: WebArcadeWorkingCopyPreferences = {
  theme: 'dark',
  panelOrder: 'code-left',
}

export const SNAPSHOT_FILE_IDS = {
  jsx: 'file-jsx',
  hooks: 'file-hooks',
} as const

export const validateProjectSize = (project: Project): ProjectSizeStatus => {
  const json = JSON.stringify(project)
  const sizeBytes = new Blob([json]).size

  if (sizeBytes > MAX_PROJECT_SIZE_BYTES) {
    return {
      valid: false,
      sizeBytes,
      message: `Project size (${formatBytes(sizeBytes)}) exceeds 5MB limit`,
    }
  }

  if (sizeBytes > WARN_PROJECT_SIZE_BYTES) {
    return {
      valid: true,
      sizeBytes,
      warning: `Project size (${formatBytes(sizeBytes)}) approaching 5MB limit`,
    }
  }

  return { valid: true, sizeBytes }
}

export const saveProject = (project: Project, options?: SaveProjectOptions): SaveResult => {
  // Update timestamp
  const projectToSave = {
    ...project,
    lastModified: new Date().toISOString(),
  }

  // Validate schema
  try {
    validateProjectSchema(projectToSave)
  } catch (error) {
    return {
      success: false,
      sizeBytes: 0,
      error: `Validation error: ${error instanceof Error ? error.message : String(error)}`,
    }
  }

  let preferences: WebArcadeWorkingCopyPreferences
  try {
    preferences = validateWorkingCopyPreferences(
      options?.preferences ?? DEFAULT_WEB_ARCADE_WORKING_COPY_PREFERENCES
    )
  } catch (error) {
    return {
      success: false,
      sizeBytes: 0,
      error: `Validation error: ${error instanceof Error ? error.message : String(error)}`,
    }
  }

  // Serialize and measure size
  const workingCopy: WebArcadeWorkingCopyEnvelope = {
    format: WEB_ARCADE_WORKING_COPY_FORMAT,
    formatVersion: WEB_ARCADE_WORKING_COPY_FORMAT_VERSION,
    project: projectToSave,
    preferences,
  }
  const json = JSON.stringify(workingCopy)
  const sizeBytes = new Blob([json]).size

  // Check size limits
  if (sizeBytes > MAX_PROJECT_SIZE_BYTES) {
    return {
      success: false,
      sizeBytes,
      error: `Project size (${formatBytes(sizeBytes)}) exceeds 5MB limit`,
    }
  }

  // Save to tab-scoped sessionStorage so each Web Arcade tab owns its working copy.
  try {
    sessionStorage.setItem(STORAGE_KEY, json)
  } catch (error) {
    return {
      success: false,
      sizeBytes,
      error: `Storage error: ${error instanceof Error ? error.message : String(error)}`,
    }
  }

  // Success with optional warning
  const result: SaveResult = { success: true, sizeBytes }

  if (sizeBytes > WARN_PROJECT_SIZE_BYTES) {
    result.warning = `Project size (${formatBytes(sizeBytes)}) approaching 5MB limit`
  }

  return result
}

export const loadProject = (): LoadResult => {
  try {
    const json = sessionStorage.getItem(STORAGE_KEY)

    // No tab-scoped working copy
    if (!json) {
      return {
        project: createDefaultProject(),
        preferences: DEFAULT_WEB_ARCADE_WORKING_COPY_PREFERENCES,
        fromStorage: false,
        migrated: false,
      }
    }

    // Parse JSON
    let stored: unknown
    try {
      stored = JSON.parse(json)
    } catch {
      return {
        project: null,
        preferences: DEFAULT_WEB_ARCADE_WORKING_COPY_PREFERENCES,
        fromStorage: true,
        migrated: false,
        error: 'Failed to parse stored project JSON',
      }
    }

    // Migrate if necessary
    let project: Project
    let preferences: WebArcadeWorkingCopyPreferences
    let migrated = false

    try {
      const restoredWorkingCopy = restoreStoredWorkingCopy(stored)
      project = restoredWorkingCopy.project
      preferences = restoredWorkingCopy.preferences
      migrated = restoredWorkingCopy.migrated
    } catch (error) {
      return {
        project: null,
        preferences: DEFAULT_WEB_ARCADE_WORKING_COPY_PREFERENCES,
        fromStorage: true,
        migrated: false,
        error: `Migration failed: ${error instanceof Error ? error.message : String(error)}`,
      }
    }

    // Validate
    try {
      validateProjectSchema(project)
    } catch (error) {
      return {
        project: null,
        preferences: DEFAULT_WEB_ARCADE_WORKING_COPY_PREFERENCES,
        fromStorage: true,
        migrated,
        error: `Validation failed: ${error instanceof Error ? error.message : String(error)}`,
      }
    }

    return {
      project,
      preferences,
      fromStorage: true,
      migrated,
    }
  } catch (error) {
    return {
      project: null,
      preferences: DEFAULT_WEB_ARCADE_WORKING_COPY_PREFERENCES,
      fromStorage: false,
      migrated: false,
      error: `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

export const createArcadeProjectPackage = (project: Project): ArcadeProjectPackage => {
  return {
    format: ARCADE_PROJECT_PACKAGE_FORMAT,
    formatVersion: ARCADE_PROJECT_PACKAGE_FORMAT_VERSION,
    project: {
      name: project.name,
      source: {
        jsx: project.jsxCode,
        hooks: project.hooksCode,
      },
      preview: {
        viewport: project.viewportSize,
      },
    },
  }
}

export const exportProject = (project: Project, options: ExportProjectOptions = {}): void => {
  const exportedAt = options.exportedAt ?? new Date().toISOString()
  const packageData = createArcadeProjectPackage(project)
  const json = JSON.stringify(packageData, null, 2)
  const blob = new Blob([json], { type: ARCADE_PROJECT_PACKAGE_MIME_TYPE })
  const url = URL.createObjectURL(blob)

  const timestamp = exportedAt.split('T')[0] // YYYY-MM-DD
  const filename = `${sanitizeFilename(project.name)}-${timestamp}${ARCADE_PROJECT_PACKAGE_EXTENSION}`

  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()

  URL.revokeObjectURL(url)
}

export const importProject = async (file: File): Promise<ImportResult> => {
  try {
    if (!isArcadeProjectPackageFile(file)) {
      return {
        project: null,
        success: false,
        error: `Only clean ${ARCADE_PROJECT_PACKAGE_EXTENSION} Arcade project packages can be imported`,
      }
    }

    // Read file
    const text = await file.text()

    // Parse JSON
    let imported: unknown
    try {
      imported = JSON.parse(text)
    } catch {
      return {
        project: null,
        success: false,
        error: 'Invalid .akselarcade Arcade project package JSON',
      }
    }

    let project: Project
    try {
      project = buildProjectFromCleanPackage(imported)
    } catch (error) {
      return {
        project: null,
        success: false,
        error: formatCleanPackageRejection(error),
      }
    }

    return {
      project,
      success: true,
    }
  } catch (error) {
    return {
      project: null,
      success: false,
      error: `Import error: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

const isArcadeProjectPackageFile = (file: File): boolean =>
  file.name.toLowerCase().endsWith(ARCADE_PROJECT_PACKAGE_EXTENSION)

const buildProjectFromCleanPackage = (payload: unknown): Project => {
  const cleanProject = parseCleanArcadeProjectPackage(payload)
  const now = new Date().toISOString()

  return normalizeImportedProject({
    version: CURRENT_VERSION,
    id: generateSecureUUID(),
    name: cleanProject.name,
    jsxCode: cleanProject.source.jsx,
    hooksCode: cleanProject.source.hooks,
    viewportSize: cleanProject.preview.viewport,
    panelLayout: createDefaultProject().panelLayout,
    createdAt: now,
    lastModified: now,
  })
}

const parseCleanArcadeProjectPackage = (payload: unknown): ArcadeProjectPackage['project'] => {
  if (!isRecord(payload)) {
    throw new Error(CLEAN_PACKAGE_REJECTION_MESSAGE)
  }

  assertExactKeys(payload, ['format', 'formatVersion', 'project'], 'package')

  if (payload.formatVersion !== ARCADE_PROJECT_PACKAGE_FORMAT_VERSION) {
    throw new Error(`Unsupported Arcade project package version "${String(payload.formatVersion)}"`)
  }

  if (payload.format !== ARCADE_PROJECT_PACKAGE_FORMAT) {
    throw new Error('Unsupported Arcade project package format')
  }

  return parseCleanPackageProject(payload.project)
}

const parseCleanPackageProject = (payload: unknown): ArcadeProjectPackage['project'] => {
  if (!isRecord(payload)) {
    throw new Error('Project package is missing clean project content')
  }

  assertExactKeys(payload, ['name', 'source', 'preview'], 'project')

  if (!isRecord(payload.source)) {
    throw new Error('Project package source must be an object')
  }

  assertExactKeys(payload.source, ['jsx', 'hooks'], 'project source')

  if (!isRecord(payload.preview)) {
    throw new Error('Project package preview must be an object')
  }

  assertExactKeys(payload.preview, ['viewport'], 'project preview')

  if (typeof payload.name !== 'string') {
    throw new Error('Project package name must be a string')
  }

  if (typeof payload.source.jsx !== 'string') {
    throw new Error('Project package JSX source must be a string')
  }

  if (typeof payload.source.hooks !== 'string') {
    throw new Error('Project package Hooks source must be a string')
  }

  if (typeof payload.preview.viewport !== 'string') {
    throw new Error('Project package preview viewport must be a string')
  }

  return {
    name: payload.name,
    source: {
      jsx: payload.source.jsx,
      hooks: payload.source.hooks,
    },
    preview: {
      viewport: payload.preview.viewport as Project['viewportSize'],
    },
  }
}

const assertExactKeys = (
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
  label: string
): void => {
  const keys = Object.keys(value)
  const missingKeys = allowedKeys.filter((key) => !keys.includes(key))
  const unknownKeys = keys.filter((key) => !allowedKeys.includes(key))

  if (!missingKeys.length && !unknownKeys.length) {
    return
  }

  const details = [
    missingKeys.length ? `missing ${formatKeyList(missingKeys)}` : null,
    unknownKeys.length ? `unknown ${formatKeyList(unknownKeys)}` : null,
  ]
    .filter(Boolean)
    .join('; ')

  throw new Error(`Invalid clean Arcade project ${label} fields: ${details}`)
}

const formatKeyList = (keys: string[]): string => keys.map((key) => `"${key}"`).join(', ')

const formatCleanPackageRejection = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error)
  return message.startsWith(CLEAN_PACKAGE_REJECTION_MESSAGE)
    ? message
    : `${CLEAN_PACKAGE_REJECTION_MESSAGE}: ${message}`
}

const normalizeImportedProject = (project: unknown): Project => {
  validateProjectSchema(project)
  return copyProjectFields(project)
}

const copyProjectFields = (project: Project): Project => ({
  version: project.version,
  id: project.id,
  name: project.name,
  jsxCode: project.jsxCode,
  hooksCode: project.hooksCode,
  viewportSize: project.viewportSize,
  panelLayout: project.panelLayout,
  createdAt: project.createdAt,
  lastModified: project.lastModified,
})

export const clearStorage = (): void => {
  sessionStorage.removeItem(STORAGE_KEY)
}

export const createShareSnapshot = (
  project: Project,
  overrides?: ShareSnapshotOverrides
): ProjectSnapshot => {
  const files = overrides?.files ?? buildDefaultSnapshotFiles(project)
  if (!files.length) {
    throw new Error('Project snapshot requires at least one file')
  }

  const preview: ProjectPreviewSnapshot = {
    viewport: overrides?.preview?.viewport ?? project.viewportSize,
    zoom: overrides?.preview?.zoom ?? 1,
    theme: overrides?.preview?.theme ?? 'dark',
    sandboxFlags: overrides?.preview?.sandboxFlags ?? {},
  }

  const settings: ProjectSettingsSnapshot = {
    autosave: overrides?.settings?.autosave ?? true,
    linting: overrides?.settings?.linting ?? true,
    showLineNumbers: overrides?.settings?.showLineNumbers ?? true,
  }

  return {
    version: project.version,
    files,
    activeFileId: overrides?.activeFileId ?? files[0].id,
    preview,
    settings,
    updatedAt: Date.now(),
  }
}

// Helper functions

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const buildDefaultSnapshotFiles = (project: Project): ProjectFileSnapshot[] => {
  return [
    {
      id: SNAPSHOT_FILE_IDS.jsx,
      name: 'App.tsx',
      language: 'tsx',
      content: project.jsxCode,
      order: 0,
    },
    {
      id: SNAPSHOT_FILE_IDS.hooks,
      name: 'hooks.ts',
      language: 'tsx',
      content: project.hooksCode,
      order: 1,
    },
  ]
}

const restoreStoredWorkingCopy = (
  stored: unknown
): {
  project: Project
  preferences: WebArcadeWorkingCopyPreferences
  migrated: boolean
} => {
  if (isWebArcadeWorkingCopyEnvelope(stored)) {
    const restoredProject = restoreStoredProject(stored.project)
    return {
      ...restoredProject,
      preferences: validateWorkingCopyPreferences(stored.preferences),
    }
  }

  return {
    ...restoreStoredProject(stored),
    preferences: DEFAULT_WEB_ARCADE_WORKING_COPY_PREFERENCES,
  }
}

const restoreStoredProject = (storedProject: unknown): { project: Project; migrated: boolean } => {
  if (
    storedProject &&
    typeof storedProject === 'object' &&
    'version' in storedProject &&
    storedProject.version !== CURRENT_VERSION
  ) {
    return {
      project: migrateProject(storedProject),
      migrated: true,
    }
  }

  return {
    project: storedProject as Project,
    migrated: false,
  }
}

const isWebArcadeWorkingCopyEnvelope = (
  stored: unknown
): stored is WebArcadeWorkingCopyEnvelope => {
  if (!isRecord(stored) || stored.format !== WEB_ARCADE_WORKING_COPY_FORMAT) {
    return false
  }

  if (stored.formatVersion !== WEB_ARCADE_WORKING_COPY_FORMAT_VERSION) {
    throw new Error(`Unsupported Web Arcade working copy version "${String(stored.formatVersion)}"`)
  }

  if (!('project' in stored)) {
    throw new Error('Web Arcade working copy is missing project data')
  }

  if (!('preferences' in stored)) {
    throw new Error('Web Arcade working copy is missing preferences')
  }

  return true
}

const validateWorkingCopyPreferences = (preferences: unknown): WebArcadeWorkingCopyPreferences => {
  if (!isRecord(preferences)) {
    throw new Error('Web Arcade working copy preferences must be an object')
  }

  if (!isThemeMode(preferences.theme)) {
    throw new Error('Invalid Web Arcade working copy theme')
  }

  if (!isPanelOrder(preferences.panelOrder)) {
    throw new Error('Invalid Web Arcade working copy panel order')
  }

  return {
    theme: preferences.theme,
    panelOrder: preferences.panelOrder,
  }
}

const isThemeMode = (value: unknown): value is ThemeMode => value === 'light' || value === 'dark'

const isPanelOrder = (value: unknown): value is PanelOrder =>
  value === 'code-left' || value === 'preview-left'

const validateProjectSchema: (project: unknown) => asserts project is Project = (project) => {
  if (!project || typeof project !== 'object') {
    throw new Error('Project must be an object')
  }

  const p = project as Record<string, unknown>

  // Required fields
  if (typeof p.version !== 'string' || !p.version.match(/^\d+\.\d+\.\d+$/)) {
    throw new Error('Invalid version field')
  }

  if (typeof p.id !== 'string' || !isValidUUID(p.id)) {
    throw new Error('Invalid id field (must be UUID)')
  }

  if (typeof p.name !== 'string' || p.name.trim().length === 0 || p.name.length > 100) {
    throw new Error('Invalid name field (1-100 characters)')
  }

  if (typeof p.jsxCode !== 'string') {
    throw new Error('Invalid jsxCode field (must be string)')
  }

  if (typeof p.hooksCode !== 'string') {
    throw new Error('Invalid hooksCode field (must be string)')
  }

  const validViewports = ['XS', 'SM', 'MD', 'LG', 'XL', '2XL']
  if (!validViewports.includes(p.viewportSize as string)) {
    throw new Error('Invalid viewportSize field')
  }

  const validLayouts = ['editor-left', 'editor-right']
  if (!validLayouts.includes(p.panelLayout as string)) {
    throw new Error('Invalid panelLayout field')
  }

  if (typeof p.createdAt !== 'string' || !isValidISODate(p.createdAt)) {
    throw new Error('Invalid createdAt field (must be ISO 8601)')
  }

  if (typeof p.lastModified !== 'string' || !isValidISODate(p.lastModified)) {
    throw new Error('Invalid lastModified field (must be ISO 8601)')
  }
}

const migrateProject = (stored: unknown): Project => {
  const version =
    stored && typeof stored === 'object' && 'version' in stored
      ? (stored.version as string)
      : '0.0.0'

  // No migrations for initial version
  if (version === '1.0.0') {
    return stored as Project
  }

  // Future migrations go here

  throw new Error(`Unsupported schema version: ${version}`)
}

const isValidUUID = (uuid: string): boolean => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid)
}

const isValidISODate = (date: string): boolean => {
  return !isNaN(Date.parse(date))
}

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

const sanitizeFilename = (name: string): string => {
  return name
    .replace(/[^a-z0-9]/gi, '-') // Replace non-alphanumeric with dash
    .replace(/-+/g, '-') // Collapse multiple dashes
    .replace(/^-|-$/g, '') // Trim dashes from ends
    .toLowerCase()
    .substring(0, 50) // Max 50 chars
}
