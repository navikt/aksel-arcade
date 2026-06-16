import type { ArcadePageId, ThemeMode, ViewportSize } from '@/types/project'
import type { DesktopMcpLastActivity } from './desktopMcpApplyChangesProtocol'
import type {
  PreviewEvidenceCaptureTarget,
  PreviewEvidenceScreenshotScope,
} from './previewEvidence'

export type DesktopMcpPreviewCaptureLayer = 'screenshot' | 'frame'

export interface DesktopMcpPreviewCaptureRequest {
  pageId?: ArcadePageId
  viewportSize?: ViewportSize
  theme?: ThemeMode
  layers?: DesktopMcpPreviewCaptureLayer[]
  screenshotScope?: PreviewEvidenceScreenshotScope
  target?: PreviewEvidenceCaptureTarget
}

export type DesktopMcpPreviewCaptureErrorCode =
  | 'project-unavailable'
  | 'invalid-page-id'
  | 'invalid-capture-target'
  | 'render-timeout'
  | 'render-failed'

export interface DesktopMcpPreviewCaptureLayerResources {
  screenshot?: string
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
  }
  requestedLayers: DesktopMcpPreviewCaptureLayer[]
  producedLayers: DesktopMcpPreviewCaptureLayer[]
  layerResources: DesktopMcpPreviewCaptureLayerResources
  resources: DesktopMcpPreviewCaptureResource[]
  safeActivity: DesktopMcpLastActivity
}

export interface DesktopMcpPreviewCaptureFailure {
  ok: false
  code: DesktopMcpPreviewCaptureErrorCode
  message: string
  manifestResourceUri?: string
}

export type DesktopMcpPreviewCaptureResult =
  | DesktopMcpPreviewCaptureSuccess
  | DesktopMcpPreviewCaptureFailure

export type DesktopMcpPreviewCaptureHandler = (
  request: DesktopMcpPreviewCaptureRequest
) => DesktopMcpPreviewCaptureResult | Promise<DesktopMcpPreviewCaptureResult>
