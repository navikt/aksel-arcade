import type { CompileError, RuntimeError } from './preview'
import type { InspectionData } from './inspection'

// Main → Sandbox messages
export type MainToSandboxMessage =
  | { type: 'EXECUTE_CODE'; payload: { jsxCode: string; hooksCode: string } }
  | { type: 'UPDATE_VIEWPORT'; payload: { width: number } }
  | { type: 'TOGGLE_INSPECT'; payload: { enabled: boolean } }
  | { type: 'GET_INSPECTION_DATA'; payload: { x: number; y: number } }
  | { type: 'UPDATE_THEME'; payload: { theme: 'light' | 'dark' } }

// Sandbox → Main messages
export type SandboxToMainMessage =
  | { type: 'RENDER_SUCCESS' }
  | { type: 'COMPILE_ERROR'; payload: CompileError }
  | { type: 'RUNTIME_ERROR'; payload: RuntimeError }
  | { type: 'INSPECTION_DATA'; payload: InspectionData | null }
  | { type: 'CONSOLE_LOG'; payload: { level: 'log' | 'warn' | 'error'; args: unknown[] } }

// Type guards
export const isMainToSandboxMessage = (msg: unknown): msg is MainToSandboxMessage => {
  return msg !== null && typeof msg === 'object' && 'type' in msg && 'payload' in msg
}

export const isSandboxToMainMessage = (msg: unknown): msg is SandboxToMainMessage => {
  return msg !== null && typeof msg === 'object' && 'type' in msg
}
