// Per Figma design (node 36:981) and Aksel breakpoints
export type ViewportSize = '2XL' | 'XL' | 'LG' | 'MD' | 'SM' | 'XS'
export type PanelLayout = 'editor-left' | 'editor-right'

export interface Project {
  // Identity
  id: string // UUID v4 (generated on creation)
  name: string // User-editable project name

  // Code content
  jsxCode: string // JSX tab code content
  hooksCode: string // Hooks tab code content

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
