// Per Figma design (node 36:981) and Aksel breakpoints
export type ViewportSize = '2XL' | 'XL' | 'LG' | 'MD' | 'SM' | 'XS'
export type PanelLayout = 'editor-left' | 'editor-right'
export type ThemeMode = 'light' | 'dark'
export type PanelOrder = 'code-left' | 'preview-left'
export type ArcadePageId = `page${string}`
export type SelectedEditTarget = 'page' | 'global-config'

export interface ArcadeSourceFile {
  jsx: string
  hooks: string
}

export interface ArcadePage {
  id: ArcadePageId
  name: string
  source: ArcadeSourceFile
}

export interface ProjectSource {
  globalConfig: ArcadeSourceFile
  pages: ArcadePage[]
  startPageId: ArcadePageId
  nextPageNumber: number
}

export const CURRENT_PROJECT_VERSION = '2.0.0' as const

export interface Project {
  // Identity
  id: string // UUID v4 (generated on creation)
  name: string // User-editable project name

  // Code content
  source: ProjectSource
  activePageId: ArcadePageId

  // UI state
  viewportSize: ViewportSize // Selected responsive breakpoint
  panelLayout: PanelLayout // Editor/preview position

  // Metadata
  version: string // Schema version (e.g., "1.0.0")
  createdAt: string // ISO 8601 timestamp
  lastModified: string // ISO 8601 timestamp
}

export interface ProjectSizeStatus {
  valid: boolean
  sizeBytes: number
  message?: string
  warning?: string
}

export type ProjectFileLanguage = 'tsx' | 'css' | 'json'

export interface ProjectFileSnapshot {
  id: string
  name: string
  language: ProjectFileLanguage
  content: string
  order: number
  isReadonly?: boolean
}

export interface ProjectPreviewSnapshot {
  viewport: ViewportSize
  zoom: number
  theme: 'light' | 'dark'
  sandboxFlags: Record<string, boolean>
}

export interface ProjectSettingsSnapshot {
  autosave: boolean
  linting: boolean
  showLineNumbers: boolean
}

export interface ProjectSnapshot {
  version: string
  files: ProjectFileSnapshot[]
  activeFileId: string
  preview: ProjectPreviewSnapshot
  settings: ProjectSettingsSnapshot
  updatedAt: number
}

export type CompressionStrategyId =
  | 'lz-string-uri'
  | 'fflate-deflate-b91'
  | 'lzma-worker-b64url'
  | 'brotli-wasm-b64url'
  | 'ast-minify-lz-string'
  | 'packed-deflate-b91'
  | 'packed-brotli-q11-b91'
  | 'packed-brotli-q11-b64url'

export interface SharePayloadEnvelope {
  formatVersion: number
  metadataVersion: number
  checksum: string
  compressed: string
  approxBytes: number
  strategyId: CompressionStrategyId
  warningThresholdHit: boolean
  warningThreshold: number
  charLimit: number
}

export interface ShareUrlMetadata {
  formatVersion: number
  metadataVersion: number
  checksum: string
  payload: string
  strategyId: CompressionStrategyId
  warningThresholdHit: boolean
  warningThreshold?: number
  charLimit?: number
}

export interface CompressionExperimentResult {
  strategyId: CompressionStrategyId
  estimatedChars: number
  actualChars: number
  encodeMs: number
}
