import type {
  Project,
  ProjectFileSnapshot,
  ProjectPreviewSnapshot,
  ProjectSettingsSnapshot,
  ProjectSizeStatus,
  ProjectSnapshot,
} from '@/types/project'
import { createDefaultProject } from '@/utils/projectDefaults'
import { generateSecureUUID } from '@/utils/crypto'

const STORAGE_KEY = 'aksel-arcade:project'
const MAX_PROJECT_SIZE_BYTES = 5 * 1024 * 1024 // 5MB
const WARN_PROJECT_SIZE_BYTES = 4 * 1024 * 1024 // 4MB
const CURRENT_VERSION = '1.0.0'
export const ARCADE_PROJECT_PACKAGE_FORMAT = 'aksel-arcade/project-package' as const
export const ARCADE_PROJECT_PACKAGE_FORMAT_VERSION = 2
export const ARCADE_PROJECT_PACKAGE_EXTENSION = '.akselarcade' as const
export const ARCADE_PROJECT_PACKAGE_MIME_TYPE =
  'application/vnd.nav.aksel-arcade.project-package+json'
export const ARCADE_PROJECT_IMPORT_ACCEPT = [
  ARCADE_PROJECT_PACKAGE_EXTENSION,
  ARCADE_PROJECT_PACKAGE_MIME_TYPE,
  '.json',
  'application/json',
].join(',')

export interface SaveResult {
  success: boolean
  sizeBytes: number
  warning?: string
  error?: string
}

export interface LoadResult {
  project: Project | null
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

export const saveProject = (project: Project): SaveResult => {
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

  // Serialize and measure size
  const json = JSON.stringify(projectToSave)
  const sizeBytes = new Blob([json]).size

  // Check size limits
  if (sizeBytes > MAX_PROJECT_SIZE_BYTES) {
    return {
      success: false,
      sizeBytes,
      error: `Project size (${formatBytes(sizeBytes)}) exceeds 5MB limit`,
    }
  }

  // Save to LocalStorage
  try {
    localStorage.setItem(STORAGE_KEY, json)
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
    const json = localStorage.getItem(STORAGE_KEY)

    // No saved project
    if (!json) {
      return {
        project: createDefaultProject(),
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
        fromStorage: true,
        migrated: false,
        error: 'Failed to parse stored project JSON',
      }
    }

    // Migrate if necessary
    let project: Project
    let migrated = false

    if (
      stored &&
      typeof stored === 'object' &&
      'version' in stored &&
      stored.version !== CURRENT_VERSION
    ) {
      try {
        project = migrateProject(stored)
        migrated = true
      } catch (error) {
        return {
          project: null,
          fromStorage: true,
          migrated: false,
          error: `Migration failed: ${error instanceof Error ? error.message : String(error)}`,
        }
      }
    } else {
      project = stored as Project
    }

    // Validate
    try {
      validateProjectSchema(project)
    } catch (error) {
      return {
        project: null,
        fromStorage: true,
        migrated,
        error: `Validation failed: ${error instanceof Error ? error.message : String(error)}`,
      }
    }

    return {
      project,
      fromStorage: true,
      migrated,
    }
  } catch (error) {
    return {
      project: null,
      fromStorage: false,
      migrated: false,
      error: `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

export const createArcadeProjectPackage = (
  project: Project
): ArcadeProjectPackage => {
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

export const exportProject = (
  project: Project,
  options: ExportProjectOptions = {}
): void => {
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
        error: 'Invalid JSON file',
      }
    }

    // Extract portable project data from package or legacy JSON formats.
    let project: Project
    try {
      project = extractImportedProject(imported)
    } catch (error) {
      return {
        project: null,
        success: false,
        error: `Validation failed: ${error instanceof Error ? error.message : String(error)}`,
      }
    }

    // Assign new ID and timestamp (treat as new project)
    project = {
      ...project,
      id: generateSecureUUID(),
      lastModified: new Date().toISOString(),
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

const extractImportedProject = (payload: unknown): Project => {
  if (!isRecord(payload)) {
    throw new Error('Invalid project data')
  }

  const packagedProject = extractArcadeProjectPackage(payload)
  if (packagedProject) {
    return packagedProject
  }

  if (isPortableProjectPayload(payload)) {
    return buildProjectFromPortable(payload)
  }

  if ('jsxCode' in payload && 'hooksCode' in payload) {
    return buildProjectFromLegacyJson(payload)
  }

  throw new Error('Unrecognized project format')
}

const extractArcadeProjectPackage = (payload: Record<string, unknown>): Project | null => {
  const hasPackageShape = 'format' in payload && 'formatVersion' in payload && 'project' in payload
  if (!hasPackageShape) {
    return null
  }

  if (payload.format !== ARCADE_PROJECT_PACKAGE_FORMAT) {
    throw new Error('Unsupported Arcade project package format')
  }

  if (payload.formatVersion === ARCADE_PROJECT_PACKAGE_FORMAT_VERSION) {
    return buildProjectFromCleanPackage(payload.project)
  }

  if (payload.formatVersion === 1) {
    return buildProjectFromPortable(payload.project)
  }

  throw new Error('Unsupported Arcade project package version')
}

const buildProjectFromCleanPackage = (cleanProject: unknown): Project => {
  if (!isCleanPackageProjectPayload(cleanProject)) {
    throw new Error('Project package is missing clean project content')
  }

  const now = new Date().toISOString()

  return normalizeImportedProject({
    version: CURRENT_VERSION,
    id: '00000000-0000-4000-8000-000000000000',
    name: cleanProject.name,
    jsxCode: cleanProject.source.jsx,
    hooksCode: cleanProject.source.hooks,
    viewportSize: cleanProject.preview.viewport,
    panelLayout: createDefaultProject().panelLayout,
    createdAt: now,
    lastModified: now,
  })
}

const buildProjectFromPortable = (portable: unknown): Project => {
  if (!isPortableProjectPayload(portable)) {
    throw new Error('Project package is missing portable project content')
  }

  return normalizeImportedProject({
    version:
      typeof portable.version === 'string' && portable.version.trim()
        ? portable.version
        : CURRENT_VERSION,
    id: portable.id,
    name: portable.name,
    createdAt: portable.createdAt,
    lastModified: portable.lastModified,
    jsxCode: portable.code.jsxCode,
    hooksCode: portable.code.hooksCode,
    viewportSize: portable.ui.viewportSize,
    panelLayout: portable.ui.panelLayout,
  })
}

const buildProjectFromLegacyJson = (legacyProject: Record<string, unknown>): Project => {
  const project =
    legacyProject.version === CURRENT_VERSION ? legacyProject : migrateProject(legacyProject)

  return normalizeImportedProject(project)
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

const isPortableProjectPayload = (
  payload: unknown
): payload is Record<string, unknown> & {
  code: Record<string, unknown>
  ui: Record<string, unknown>
} => isRecord(payload) && isRecord(payload.code) && isRecord(payload.ui)

const isCleanPackageProjectPayload = (
  payload: unknown
): payload is Record<string, unknown> & {
  name: string
  source: Record<string, unknown> & { jsx: string; hooks: string }
  preview: Record<string, unknown> & { viewport: Project['viewportSize'] }
} =>
  isRecord(payload) &&
  isRecord(payload.source) &&
  isRecord(payload.preview) &&
  typeof payload.name === 'string' &&
  typeof payload.source.jsx === 'string' &&
  typeof payload.source.hooks === 'string' &&
  typeof payload.preview.viewport === 'string'

export const clearStorage = (): void => {
  localStorage.removeItem(STORAGE_KEY)
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
