import type { ArcadePageId, ViewportSize } from './project'
import type { InspectionData } from './inspection'

export type PreviewStatus = 'idle' | 'transpiling' | 'rendering' | 'error'

export interface CompileError {
  message: string
  line: number | null
  column: number | null
  stack: string | null
  pageId?: ArcadePageId | null
}

export interface RuntimeError {
  message: string
  componentStack: string | null
  stack: string
  pageId?: ArcadePageId | null
}

export type SandboxConsoleLevel = 'log' | 'warn' | 'error'

export interface SandboxConsoleMessage {
  level: SandboxConsoleLevel
  message: string
  args: string[]
  timestamp: string
}

export interface PreviewState {
  // Rendering state
  status: PreviewStatus
  transpiledCode: string | null // Compiled JS code for iframe

  // Error state
  compileError: CompileError | null
  runtimeError: RuntimeError | null
  sandboxConsoleMessages: SandboxConsoleMessage[]

  // Inspect mode
  inspectEnabled: boolean
  inspectedElement: InspectionData | null

  // Viewport
  currentViewport: ViewportSize
  viewportWidth: number // Actual pixel width for current viewport

  // Performance tracking
  lastRenderTime: number // Timestamp of last successful render
  renderDuration: number // Time taken for last render (ms)
}

export interface TranspileResult {
  success: boolean
  code: string | null // Transpiled JavaScript (if success)
  error: CompileError | null // Error details (if failure)
}
