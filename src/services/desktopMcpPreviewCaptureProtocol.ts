import type { ArcadePageId, ThemeMode, ViewportSize } from '@/types/project'
import type { DesktopMcpLastActivity } from './desktopMcpApplyChangesProtocol'
import type {
  PreviewInteractionState,
  PreviewInteractionStep,
  PreviewEvidenceCaptureTarget,
  PreviewEvidenceScreenshotScope,
} from './previewEvidence'

export type DesktopMcpPreviewCaptureLayer =
  | 'screenshot'
  | 'accessibility'
  | 'dom_layout_style'
  | 'frame'

export interface DesktopMcpPreviewCaptureRequest {
  pageId?: ArcadePageId
  viewportSize?: ViewportSize
  theme?: ThemeMode
  layers?: DesktopMcpPreviewCaptureLayer[]
  screenshotScope?: PreviewEvidenceScreenshotScope
  target?: PreviewEvidenceCaptureTarget
  interactions?: PreviewInteractionStep[]
}

export type DesktopMcpPreviewCaptureErrorCode =
  | 'project-unavailable'
  | 'invalid-page-id'
  | 'invalid-capture-target'
  | 'render-timeout'
  | 'render-failed'

export interface DesktopMcpPreviewCaptureLayerResources {
  screenshot?: string
  accessibility?: string
  dom_layout_style?: string
  frame?: string
}

export interface DesktopMcpPreviewCaptureResource {
  uri: string
  mimeType: string
  text: string
}

export interface DesktopMcpPreviewCaptureSuccess {
  ok: true
  summary: string
  captureId: string
  manifestResourceUri: string
  producedResources: string[]
  page: {
    id: ArcadePageId
    name: string
    navigatedToId?: ArcadePageId
    navigatedToName?: string
  }
  requestedLayers: DesktopMcpPreviewCaptureLayer[]
  producedLayers: DesktopMcpPreviewCaptureLayer[]
  layerResources: DesktopMcpPreviewCaptureLayerResources
  interactions?: PreviewInteractionState
  resources: DesktopMcpPreviewCaptureResource[]
  safeActivity: DesktopMcpLastActivity
}

export interface DesktopMcpPreviewCaptureFailure {
  ok: false
  code: DesktopMcpPreviewCaptureErrorCode
  message: string
  manifestResourceUri?: string
  interactions?: PreviewInteractionState
  currentPageId?: ArcadePageId | null
}

export type DesktopMcpPreviewCaptureResult =
  | DesktopMcpPreviewCaptureSuccess
  | DesktopMcpPreviewCaptureFailure

export type DesktopMcpPreviewCaptureHandler = (
  request: DesktopMcpPreviewCaptureRequest
) => DesktopMcpPreviewCaptureResult | Promise<DesktopMcpPreviewCaptureResult>
