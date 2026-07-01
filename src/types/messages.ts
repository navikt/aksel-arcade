import type { ArcadePageId } from './project'
import type { CompileError, RuntimeError } from './preview'
import type { InspectionData } from './inspection'
import type {
  PreviewEvidenceCaptureResult,
  PreviewEvidenceCaptureTarget,
  PreviewInteractionStep,
  PreviewEvidenceLayer,
  PreviewEvidenceScreenshotScope,
} from '@/services/previewEvidence'
import type {
  AnnotationTargetResolutionRequest,
  AnnotationTargetResolutionResult,
} from '@/services/annotationTargets'

// Main → Sandbox messages
export type MainToSandboxMessage =
  | { type: 'CONNECT_SANDBOX' }
  | { type: 'EXECUTE_CODE'; payload: { jsxCode: string; hooksCode: string } }
  | { type: 'NAVIGATE_TO_PAGE'; payload: { pageId: ArcadePageId } }
  | { type: 'UPDATE_VIEWPORT'; payload: { width: number } }
  | { type: 'TOGGLE_INSPECT'; payload: { enabled: boolean } }
  | { type: 'GET_INSPECTION_DATA'; payload: { x: number; y: number } }
  | { type: 'UPDATE_THEME'; payload: { theme: 'light' | 'dark' } }
  | {
      type: 'CAPTURE_PREVIEW_EVIDENCE'
      payload: {
        requestId: string
        layers?: PreviewEvidenceLayer[]
        interactions?: PreviewInteractionStep[]
        screenshotScope?: PreviewEvidenceScreenshotScope
        viewportWidth?: number
        viewportHeight?: number
        target?: PreviewEvidenceCaptureTarget
        expectedPageId?: ArcadePageId
      }
    }
  | {
      type: 'RESOLVE_ANNOTATION_TARGET'
      payload: {
        requestId: string
        request: AnnotationTargetResolutionRequest
      }
    }

// Sandbox → Main messages
export type SandboxToMainMessage =
  | { type: 'SANDBOX_CONNECTED' }
  | { type: 'RENDER_SUCCESS' }
  | { type: 'COMPILE_ERROR'; payload: CompileError }
  | { type: 'RUNTIME_ERROR'; payload: RuntimeError }
  | { type: 'PREVIEW_PAGE_CHANGED'; payload: { pageId: ArcadePageId } }
  | { type: 'INSPECTION_DATA'; payload: InspectionData | null }
  | { type: 'THEME_UPDATED'; payload: { theme: 'light' | 'dark' } }
  | { type: 'CONSOLE_LOG'; payload: { level: 'log' | 'warn' | 'error'; args: unknown[] } }
  | {
      type: 'PREVIEW_EVIDENCE_CAPTURED'
      payload: { requestId: string; result: PreviewEvidenceCaptureResult }
    }
  | {
      type: 'ANNOTATION_TARGET_RESOLVED'
      payload: { requestId: string; result: AnnotationTargetResolutionResult }
    }

// Type guards
export const isMainToSandboxMessage = (msg: unknown): msg is MainToSandboxMessage => {
  if (msg === null || typeof msg !== 'object' || !('type' in msg)) return false
  if ((msg as { type: unknown }).type === 'CONNECT_SANDBOX') return true
  return 'payload' in msg
}

export const isSandboxToMainMessage = (msg: unknown): msg is SandboxToMainMessage => {
  return msg !== null && typeof msg === 'object' && 'type' in msg
}
