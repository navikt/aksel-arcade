import {
  CURRENT_PROJECT_VERSION,
  type ArcadePage,
  type ArcadeSourceFile,
  type PanelOrder,
  type Project,
  type ProjectFileSnapshot,
  type ProjectPreviewSnapshot,
  type ProjectSettingsSnapshot,
  type ProjectSizeStatus,
  type ProjectSnapshot,
  type SelectedEditTarget,
  type ThemeMode,
} from '@/types/project'
import {
  cloneProjectSource,
  createSinglePageProjectSource,
  FIRST_PAGE_ID,
  getStartPageSource,
  isArcadePageId,
  normalizeProjectSelection,
} from '@/services/projectSource'
import { createDefaultProject } from '@/utils/projectDefaults'
import { generateSecureUUID } from '@/utils/crypto'

export const WEB_ARCADE_WORKING_COPY_STORAGE_KEY = 'aksel-arcade:project'
const STORAGE_KEY = WEB_ARCADE_WORKING_COPY_STORAGE_KEY
const WEB_ARCADE_WORKING_COPY_FORMAT = 'aksel-arcade/web-working-copy' as const
const WEB_ARCADE_WORKING_COPY_FORMAT_VERSION = 1
const MAX_PROJECT_SIZE_BYTES = 5 * 1024 * 1024 // 5MB
const WARN_PROJECT_SIZE_BYTES = 4 * 1024 * 1024 // 4MB
export const ARCADE_PROJECT_PACKAGE_FORMAT = 'aksel-arcade/project-package' as const
export const ARCADE_PROJECT_PACKAGE_FORMAT_VERSION = 3
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
  multiPageEnabled: boolean
  pagePanelOpen: boolean
  selectedEditTarget: SelectedEditTarget
  previewFullscreen: boolean
}

interface PersistedWebArcadeWorkingCopyPreferences
  extends Omit<WebArcadeWorkingCopyPreferences, 'multiPageEnabled'> {
  multiPageEnabled?: boolean
}

export interface SaveProjectOptions {
  preferences?: WebArcadeWorkingCopyPreferences
  updateLastModified?: boolean
}

interface WebArcadeWorkingCopyEnvelope {
  format: typeof WEB_ARCADE_WORKING_COPY_FORMAT
  formatVersion: typeof WEB_ARCADE_WORKING_COPY_FORMAT_VERSION
  project: Project
  preferences: PersistedWebArcadeWorkingCopyPreferences
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

const LEGACY_SINGLE_PAGE_ARCADE_PROJECT_PACKAGE_FORMAT_VERSION = 2 as const
const LEGACY_PORTABLE_ARCADE_PROJECT_PACKAGE_FORMAT_VERSION = 1 as const

export interface PortableArcadeProjectData {
  name: string
  source: Project['source']
  preview: {
    viewport: Project['viewportSize']
  }
}

export interface ArcadeProjectPackage {
  format: typeof ARCADE_PROJECT_PACKAGE_FORMAT
  formatVersion: typeof ARCADE_PROJECT_PACKAGE_FORMAT_VERSION
  project: PortableArcadeProjectData
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
  multiPageEnabled: true,
  pagePanelOpen: false,
  selectedEditTarget: 'page',
  previewFullscreen: false,
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
  const projectToSave =
    options?.updateLastModified === false
      ? project
      : {
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
    preferences: createPersistedWorkingCopyPreferences(preferences),
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
    project: createPortableArcadeProjectData(project),
  }
}

export const createPortableArcadeProjectData = (project: Project): PortableArcadeProjectData => ({
  name: project.name,
  source: cloneProjectSource(project.source),
  preview: {
    viewport: project.viewportSize,
  },
})

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
  return buildFreshProjectFromPortableArcadeProjectData(cleanProject)
}

export const buildFreshProjectFromPortableArcadeProjectData = (
  cleanProject: PortableArcadeProjectData
): Project => {
  const now = new Date().toISOString()

  return normalizeImportedProject({
    version: CURRENT_PROJECT_VERSION,
    id: generateSecureUUID(),
    name: cleanProject.name,
    source: cloneProjectSource(cleanProject.source),
    activePageId: cleanProject.source.startPageId,
    viewportSize: cleanProject.preview.viewport,
    panelLayout: createDefaultProject().panelLayout,
    createdAt: now,
    lastModified: now,
  })
}

const parseCleanArcadeProjectPackage = (payload: unknown): PortableArcadeProjectData => {
  if (!isRecord(payload)) {
    throw new Error(CLEAN_PACKAGE_REJECTION_MESSAGE)
  }

  if (
    payload.formatVersion === LEGACY_PORTABLE_ARCADE_PROJECT_PACKAGE_FORMAT_VERSION &&
    payload.format === ARCADE_PROJECT_PACKAGE_FORMAT
  ) {
    validateLegacyPortablePackageEnvelope(payload)
    return parseLegacyPortablePackageProject(payload.project)
  }

  assertExactKeys(payload, ['format', 'formatVersion', 'project'], 'package')

  if (payload.format !== ARCADE_PROJECT_PACKAGE_FORMAT) {
    throw new Error('Unsupported Arcade project package format')
  }

  switch (payload.formatVersion) {
    case ARCADE_PROJECT_PACKAGE_FORMAT_VERSION:
      return parseFullSourcePackageProject(payload.project)
    case LEGACY_SINGLE_PAGE_ARCADE_PROJECT_PACKAGE_FORMAT_VERSION:
      return parseLegacySinglePagePackageProject(payload.project)
    case LEGACY_PORTABLE_ARCADE_PROJECT_PACKAGE_FORMAT_VERSION:
      return parseLegacyPortablePackageProject(payload.project)
    default:
      throw new Error(`Unsupported Arcade project package version "${String(payload.formatVersion)}"`)
  }
}

const validateLegacyPortablePackageEnvelope = (payload: Record<string, unknown>): void => {
  const allowedKeys = new Set(['format', 'formatVersion', 'project', 'exportedAt', 'meta'])
  const unknownKeys = Object.keys(payload).filter((key) => !allowedKeys.has(key))

  if (unknownKeys.length) {
    throw new Error(`Invalid legacy portable package fields: unknown ${formatKeyList(unknownKeys)}`)
  }

  if ('exportedAt' in payload && typeof payload.exportedAt !== 'string') {
    throw new Error('Legacy portable package exportedAt must be a string')
  }

  if ('meta' in payload && !isRecord(payload.meta)) {
    throw new Error('Legacy portable package meta must be an object')
  }
}

const parseFullSourcePackageProject = (payload: unknown): PortableArcadeProjectData => {
  if (!isRecord(payload)) {
    throw new Error('Project package is missing clean project content')
  }

  return parsePortableArcadeProjectData(payload, 'project')
}

const parseLegacySinglePagePackageProject = (payload: unknown): PortableArcadeProjectData => {
  if (!isRecord(payload)) {
    throw new Error('Legacy project package is missing clean project content')
  }

  assertExactKeys(payload, ['name', 'source', 'preview'], 'legacy project')

  if (typeof payload.name !== 'string') {
    throw new Error('Legacy project package name must be a string')
  }

  if (!isRecord(payload.source)) {
    throw new Error('Legacy project package source must be an object')
  }

  assertExactKeys(payload.source, ['jsx', 'hooks'], 'legacy project source')

  if (typeof payload.source.jsx !== 'string') {
    throw new Error('Legacy project package JSX source must be a string')
  }

  if (typeof payload.source.hooks !== 'string') {
    throw new Error('Legacy project package Hooks source must be a string')
  }

  return {
    name: payload.name,
    source: createSinglePageProjectSource(payload.source.jsx, payload.source.hooks),
    preview: parsePackagePreview(payload.preview, 'legacy project preview'),
  }
}

const parseLegacyPortablePackageProject = (payload: unknown): PortableArcadeProjectData => {
  if (!isRecord(payload)) {
    throw new Error('Legacy project package is missing portable project content')
  }

  assertExactKeys(payload, ['version', 'id', 'name', 'createdAt', 'lastModified', 'code', 'ui'], 'legacy portable project')

  if (typeof payload.version !== 'string') {
    throw new Error('Legacy project package version must be a string')
  }

  if (typeof payload.id !== 'string') {
    throw new Error('Legacy project package id must be a string')
  }

  if (typeof payload.name !== 'string') {
    throw new Error('Legacy project package name must be a string')
  }

  if (typeof payload.createdAt !== 'string') {
    throw new Error('Legacy project package createdAt must be a string')
  }

  if (typeof payload.lastModified !== 'string') {
    throw new Error('Legacy project package lastModified must be a string')
  }

  if (!isRecord(payload.code)) {
    throw new Error('Legacy project package code must be an object')
  }

  assertExactKeys(payload.code, ['jsxCode', 'hooksCode'], 'legacy project code')

  if (typeof payload.code.jsxCode !== 'string') {
    throw new Error('Legacy project package JSX code must be a string')
  }

  if (typeof payload.code.hooksCode !== 'string') {
    throw new Error('Legacy project package Hooks code must be a string')
  }

  if (!isRecord(payload.ui)) {
    throw new Error('Legacy project package UI must be an object')
  }

  assertExactKeys(payload.ui, ['viewportSize', 'panelLayout'], 'legacy project UI')

  if (!isViewportSize(payload.ui.viewportSize)) {
    throw new Error('Legacy project package viewport size must be valid')
  }

  if (!isPanelLayout(payload.ui.panelLayout)) {
    throw new Error('Legacy project package panel layout must be valid')
  }

  return {
    name: payload.name,
    source: createSinglePageProjectSource(payload.code.jsxCode, payload.code.hooksCode),
    preview: {
      viewport: payload.ui.viewportSize,
    },
  }
}

export const parsePortableArcadeProjectData = (
  payload: unknown,
  label = 'project'
): PortableArcadeProjectData => {
  if (!isRecord(payload)) {
    throw new Error(`${capitalizeLabel(label)} must be an object`)
  }

  assertExactKeys(payload, ['name', 'source', 'preview'], label)

  if (typeof payload.name !== 'string') {
    throw new Error(`${capitalizeLabel(label)} name must be a string`)
  }

  return {
    name: payload.name,
    source: parsePortableProjectSource(payload.source, `${label} source`),
    preview: parsePackagePreview(payload.preview, `${label} preview`),
  }
}

const parsePortableProjectSource = (payload: unknown, label = 'project source'): PortableArcadeProjectData['source'] => {
  if (!isRecord(payload)) {
    throw new Error(`${capitalizeLabel(label)} must be an object`)
  }

  assertExactKeys(payload, ['globalConfig', 'pages', 'startPageId', 'nextPageNumber'], label)

  const globalConfig = parsePackageSourceFile(payload.globalConfig, `${label} global config`)

  if (!Array.isArray(payload.pages) || payload.pages.length === 0) {
    throw new Error(`${capitalizeLabel(label)} pages must contain at least one Arcade page`)
  }

  const pages = payload.pages.map((page) => parsePackagePage(page, label))
  const pageIds = new Set<string>()
  for (const page of pages) {
    if (pageIds.has(page.id)) {
      throw new Error(`Duplicate Arcade page id "${page.id}"`)
    }
    pageIds.add(page.id)
  }

  if (!isArcadePageId(payload.startPageId) || !pageIds.has(payload.startPageId)) {
    throw new Error(`${capitalizeLabel(label)} startPageId must target an exported Arcade page`)
  }

  if (
    typeof payload.nextPageNumber !== 'number' ||
    !Number.isInteger(payload.nextPageNumber) ||
    payload.nextPageNumber < 2
  ) {
    throw new Error(`${capitalizeLabel(label)} nextPageNumber must be an integer >= 2`)
  }

  return {
    globalConfig,
    pages,
    startPageId: payload.startPageId,
    nextPageNumber: payload.nextPageNumber,
  }
}

const parsePackagePage = (
  payload: unknown,
  projectSourceLabel: string
): PortableArcadeProjectData['source']['pages'][number] => {
  if (!isRecord(payload)) {
    throw new Error(`${capitalizeLabel(projectSourceLabel)} page must be an object`)
  }

  assertExactKeys(payload, ['id', 'name', 'source'], `${projectSourceLabel} page`)

  if (!isArcadePageId(payload.id)) {
    throw new Error(`${capitalizeLabel(projectSourceLabel)} page id must be a valid Arcade page id`)
  }

  if (typeof payload.name !== 'string' || payload.name.trim().length === 0) {
    throw new Error(`${capitalizeLabel(projectSourceLabel)} page name must be a non-empty string`)
  }

  return {
    id: payload.id,
    name: payload.name,
    source: parsePackageSourceFile(payload.source, `${capitalizeLabel(projectSourceLabel)} page "${payload.id}" source`),
  }
}

const parsePackageSourceFile = (payload: unknown, label: string): ArcadeSourceFile => {
  if (!isRecord(payload)) {
    throw new Error(`${label} must be an object`)
  }

  assertExactKeys(payload, ['jsx', 'hooks'], label)

  if (typeof payload.jsx !== 'string') {
    throw new Error(`${label} JSX must be a string`)
  }

  if (typeof payload.hooks !== 'string') {
    throw new Error(`${label} Hooks must be a string`)
  }

  return {
    jsx: payload.jsx,
    hooks: payload.hooks,
  }
}

const parsePackagePreview = (
  payload: unknown,
  label = 'project preview'
): ArcadeProjectPackage['project']['preview'] => {
  if (!isRecord(payload)) {
    throw new Error(`${label} must be an object`)
  }

  assertExactKeys(payload, ['viewport'], label)

  if (!isViewportSize(payload.viewport)) {
    throw new Error(`${label} viewport must be valid`)
  }

  return {
    viewport: payload.viewport,
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

const capitalizeLabel = (label: string): string =>
  label.charAt(0).toUpperCase() + label.slice(1)

const formatCleanPackageRejection = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error)
  return message.startsWith(CLEAN_PACKAGE_REJECTION_MESSAGE)
    ? message
    : `${CLEAN_PACKAGE_REJECTION_MESSAGE}: ${message}`
}

const normalizeImportedProject = (project: unknown): Project => {
  validateProjectSchema(project)
  return normalizeProjectSelection(copyProjectFields(project))
}

const copyProjectFields = (project: Project): Project => ({
  version: project.version,
  id: project.id,
  name: project.name,
  source: cloneProjectSource(project.source),
  activePageId: project.activePageId,
  viewportSize: project.viewportSize,
  panelLayout: project.panelLayout,
  createdAt: project.createdAt,
  lastModified: project.lastModified,
})

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
  const source = getStartPageSource(project)

  return [
    {
      id: SNAPSHOT_FILE_IDS.jsx,
      name: 'App.tsx',
      language: 'tsx',
      content: source.jsx,
      order: 0,
    },
    {
      id: SNAPSHOT_FILE_IDS.hooks,
      name: 'hooks.ts',
      language: 'tsx',
      content: source.hooks,
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
    storedProject.version !== CURRENT_PROJECT_VERSION
  ) {
    return {
      project: migrateProject(storedProject),
      migrated: true,
    }
  }

  return {
    project: normalizeImportedProject(storedProject),
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

  const legacyMultiPageEnabled =
    'multiPageEnabled' in preferences ? preferences.multiPageEnabled : undefined

  if (
    legacyMultiPageEnabled !== undefined &&
    typeof legacyMultiPageEnabled !== 'boolean'
  ) {
    throw new Error('Invalid Web Arcade working copy multi-page preference')
  }

  const pagePanelOpen =
    'pagePanelOpen' in preferences ? preferences.pagePanelOpen : DEFAULT_WEB_ARCADE_WORKING_COPY_PREFERENCES.pagePanelOpen

  if (typeof pagePanelOpen !== 'boolean') {
    throw new Error('Invalid Web Arcade working copy page panel preference')
  }

  const selectedEditTarget =
    'selectedEditTarget' in preferences
      ? preferences.selectedEditTarget
      : DEFAULT_WEB_ARCADE_WORKING_COPY_PREFERENCES.selectedEditTarget

  if (!isSelectedEditTarget(selectedEditTarget)) {
    throw new Error('Invalid Web Arcade working copy edit target preference')
  }

  const previewFullscreen =
    'previewFullscreen' in preferences
      ? preferences.previewFullscreen
      : DEFAULT_WEB_ARCADE_WORKING_COPY_PREFERENCES.previewFullscreen

  if (typeof previewFullscreen !== 'boolean') {
    throw new Error('Invalid Web Arcade working copy preview fullscreen preference')
  }

  return {
    theme: preferences.theme,
    panelOrder: preferences.panelOrder,
    // Permanent pages supersede the old experiment flag. Keep reading it for
    // compatibility, but always restore the current always-on behavior.
    multiPageEnabled: true,
    pagePanelOpen,
    selectedEditTarget,
    previewFullscreen,
  }
}

const createPersistedWorkingCopyPreferences = (
  preferences: WebArcadeWorkingCopyPreferences
): PersistedWebArcadeWorkingCopyPreferences => ({
  theme: preferences.theme,
  panelOrder: preferences.panelOrder,
  pagePanelOpen: preferences.pagePanelOpen,
  selectedEditTarget: preferences.selectedEditTarget,
  previewFullscreen: preferences.previewFullscreen,
})

const isThemeMode = (value: unknown): value is ThemeMode => value === 'light' || value === 'dark'

const isViewportSize = (value: unknown): value is Project['viewportSize'] =>
  value === 'XS' ||
  value === 'SM' ||
  value === 'MD' ||
  value === 'LG' ||
  value === 'XL' ||
  value === '2XL'

const isPanelLayout = (value: unknown): value is Project['panelLayout'] =>
  value === 'editor-left' || value === 'editor-right'

const isPanelOrder = (value: unknown): value is PanelOrder =>
  value === 'code-left' || value === 'preview-left'

const isSelectedEditTarget = (value: unknown): value is SelectedEditTarget =>
  value === 'page' || value === 'global-config'

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

  if (!isRecord(p.source)) {
    throw new Error('Invalid source field (must be object)')
  }

  validateArcadeSourceFile(p.source.globalConfig, 'globalConfig')

  if (!Array.isArray(p.source.pages) || p.source.pages.length === 0) {
    throw new Error('Invalid pages field (must contain at least one Arcade page)')
  }

  if (
    typeof p.source.nextPageNumber !== 'number' ||
    !Number.isInteger(p.source.nextPageNumber) ||
    p.source.nextPageNumber < 2
  ) {
    throw new Error('Invalid nextPageNumber field')
  }

  const pageIds = new Set<string>()
  for (const page of p.source.pages) {
    validateArcadePage(page)
    if (pageIds.has(page.id)) {
      throw new Error(`Duplicate Arcade page id "${page.id}"`)
    }
    pageIds.add(page.id)
  }

  if (!isArcadePageId(p.source.startPageId) || !pageIds.has(p.source.startPageId)) {
    throw new Error('Invalid startPageId field')
  }

  if (!isArcadePageId(p.activePageId) || !pageIds.has(p.activePageId)) {
    throw new Error('Invalid activePageId field')
  }

  if (!isViewportSize(p.viewportSize)) {
    throw new Error('Invalid viewportSize field')
  }

  if (!isPanelLayout(p.panelLayout)) {
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

  if (version === '1.0.0') {
    return migrateLegacyProject(stored)
  }

  if (version === CURRENT_PROJECT_VERSION) {
    return normalizeImportedProject(stored)
  }

  throw new Error(`Unsupported schema version: ${version}`)
}

const validateArcadeSourceFile: (
  value: unknown,
  label: string
) => asserts value is ArcadeSourceFile = (value, label) => {
  if (!isRecord(value)) {
    throw new Error(`Invalid ${label} field (must be object)`)
  }

  if (typeof value.jsx !== 'string') {
    throw new Error(`Invalid ${label}.jsx field (must be string)`)
  }

  if (typeof value.hooks !== 'string') {
    throw new Error(`Invalid ${label}.hooks field (must be string)`)
  }
}

const validateArcadePage: (value: unknown) => asserts value is ArcadePage = (value) => {
  if (!isRecord(value)) {
    throw new Error('Invalid Arcade page entry')
  }

  if (!isArcadePageId(value.id)) {
    throw new Error('Invalid Arcade page id')
  }

  if (typeof value.name !== 'string' || value.name.trim().length === 0) {
    throw new Error('Invalid Arcade page name')
  }

  validateArcadeSourceFile(value.source, `Arcade page "${value.id}" source`)
}

const migrateLegacyProject = (stored: unknown): Project => {
  if (!isRecord(stored)) {
    throw new Error('Legacy project must be an object')
  }

  if (typeof stored.id !== 'string' || !isValidUUID(stored.id)) {
    throw new Error('Invalid legacy id field (must be UUID)')
  }

  if (typeof stored.name !== 'string' || stored.name.trim().length === 0 || stored.name.length > 100) {
    throw new Error('Invalid legacy name field (1-100 characters)')
  }

  if (typeof stored.jsxCode !== 'string') {
    throw new Error('Invalid legacy jsxCode field (must be string)')
  }

  if (typeof stored.hooksCode !== 'string') {
    throw new Error('Invalid legacy hooksCode field (must be string)')
  }

  const validViewports = ['XS', 'SM', 'MD', 'LG', 'XL', '2XL']
  if (!validViewports.includes(stored.viewportSize as string)) {
    throw new Error('Invalid legacy viewportSize field')
  }

  const validLayouts = ['editor-left', 'editor-right']
  if (!validLayouts.includes(stored.panelLayout as string)) {
    throw new Error('Invalid legacy panelLayout field')
  }

  if (typeof stored.createdAt !== 'string' || !isValidISODate(stored.createdAt)) {
    throw new Error('Invalid legacy createdAt field (must be ISO 8601)')
  }

  if (typeof stored.lastModified !== 'string' || !isValidISODate(stored.lastModified)) {
    throw new Error('Invalid legacy lastModified field (must be ISO 8601)')
  }

  return normalizeImportedProject({
    version: CURRENT_PROJECT_VERSION,
    id: stored.id,
    name: stored.name,
    source: createSinglePageProjectSource(stored.jsxCode, stored.hooksCode),
    activePageId: FIRST_PAGE_ID,
    viewportSize: stored.viewportSize,
    panelLayout: stored.panelLayout,
    createdAt: stored.createdAt,
    lastModified: stored.lastModified,
  })
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
