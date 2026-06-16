import type { Project, ThemeMode, ViewportSize } from '@/types/project'
import type { PreviewDiagnostics } from '@/services/previewDiagnostics'
import {
  createDesktopMcpProjectDiagnostics,
  createDesktopMcpProjectRevision,
  DESKTOP_MCP_PROJECT_MANIFEST_URI,
} from '@/services/desktopMcpProjectResources'
import { getActivePage, getPageById } from '@/services/projectSource'
import type {
  DesktopMcpPreviewCaptureFailure,
  DesktopMcpPreviewCaptureLayer,
  DesktopMcpPreviewCaptureRequest,
  DesktopMcpPreviewCaptureResource,
  DesktopMcpPreviewCaptureResult,
  DesktopMcpPreviewCaptureSuccess,
} from './desktopMcpPreviewCaptureProtocol'
import {
  MAX_PREVIEW_EVIDENCE_ELEMENTS,
  type PreviewEvidence,
  type PreviewEvidenceAccessibility,
  type PreviewEvidenceCaptureTarget,
  type PreviewEvidenceScreenshot,
  type PreviewEvidenceScreenshotScope,
} from './previewEvidence'

export const DESKTOP_MCP_PREVIEW_CAPTURE_TIMEOUT_MS = 20_000

export const DESKTOP_MCP_PREVIEW_CAPTURE_LAYER_PURPOSES = Object.freeze({
  screenshot: 'visual appearance and spatial gestalt',
  accessibility:
    'semantic roles, accessible names, landmarks, focusable controls, and semantic hierarchy',
  dom_layout_style:
    'actionable hierarchy, bounds, styles, spacing, colors, typography, and overflow',
  frame: 'viewport, theme, page, scroll, diagnostics, truncation, and capture metadata',
})

export const DEFAULT_DESKTOP_MCP_PREVIEW_CAPTURE_LAYERS = Object.freeze([
  'screenshot',
  'accessibility',
  'dom_layout_style',
  'frame',
] satisfies DesktopMcpPreviewCaptureLayer[])

interface DesktopMcpPreviewCaptureContext {
  project: Project
  theme: ThemeMode
  diagnostics: PreviewDiagnostics
}

export interface PreparedDesktopMcpPreviewCapture {
  ok: true
  pageId: Project['source']['pages'][number]['id']
  pageName: string
  viewportSize: ViewportSize
  theme: ThemeMode
  requestedLayers: DesktopMcpPreviewCaptureLayer[]
  screenshotScope: PreviewEvidenceScreenshotScope
  target?: PreviewEvidenceCaptureTarget
  projectRevision: string
}

export interface DesktopMcpSandboxCaptureSuccess {
  ok: true
  evidence: PreviewEvidence
  accessibility?: PreviewEvidenceAccessibility
  screenshot?: PreviewEvidenceScreenshot
  targetDescription?: string | null
}

export type DesktopMcpSandboxCaptureResult =
  | DesktopMcpSandboxCaptureSuccess
  | DesktopMcpPreviewCaptureFailure

interface PreviewDiagnosticsSummary {
  status: PreviewDiagnostics['status']
  issueCount: number
  compileError: boolean
  runtimeError: boolean
  stalePageReferenceCount: number
}

export const createDesktopMcpPreviewCaptureManifestUri = (captureId: string): string =>
  `arcade://preview/captures/${captureId}/manifest`

export const createDesktopMcpPreviewCaptureScreenshotUri = (captureId: string): string =>
  `arcade://preview/captures/${captureId}/screenshot`

export const createDesktopMcpPreviewCaptureAccessibilityUri = (captureId: string): string =>
  `arcade://preview/captures/${captureId}/accessibility`

export const createDesktopMcpPreviewCaptureDomLayoutStyleUri = (captureId: string): string =>
  `arcade://preview/captures/${captureId}/dom-layout-style`

export const createDesktopMcpPreviewCaptureFrameUri = (captureId: string): string =>
  `arcade://preview/captures/${captureId}/frame`

export const prepareDesktopMcpPreviewCapture = (
  request: DesktopMcpPreviewCaptureRequest,
  context: DesktopMcpPreviewCaptureContext
): PreparedDesktopMcpPreviewCapture | DesktopMcpPreviewCaptureFailure => {
  const page =
    (request.pageId ? getPageById(context.project.source, request.pageId) : undefined) ??
    (!request.pageId ? getActivePage(context.project) : undefined)
  if (!page) {
    return createPreviewCaptureFailure(
      'invalid-page-id',
      request.pageId
        ? `capture_preview_evidence could not find Arcade page "${request.pageId}". Re-read arcade://project/manifest before retrying.`
        : 'capture_preview_evidence could not determine an active Arcade page to capture.',
      {
        manifestResourceUri: DESKTOP_MCP_PROJECT_MANIFEST_URI,
      }
    )
  }

  const target = normalizePreviewCaptureTarget(request.target)
  const screenshotScope = request.screenshotScope ?? 'viewport'
  if (screenshotScope === 'region' && !target) {
    return createPreviewCaptureFailure(
      'invalid-capture-target',
      'capture_preview_evidence screenshotScope "region" requires a preview-root selector or accessibility target.'
    )
  }

  if (screenshotScope !== 'region' && target) {
    return createPreviewCaptureFailure(
      'invalid-capture-target',
      'capture_preview_evidence target may be provided only when screenshotScope is "region".'
    )
  }

  const requestedLayers =
    request.layers && request.layers.length > 0
      ? [...request.layers]
      : [...DEFAULT_DESKTOP_MCP_PREVIEW_CAPTURE_LAYERS]

  return {
    ok: true,
    pageId: page.id,
    pageName: page.name,
    viewportSize: request.viewportSize ?? context.project.viewportSize,
    theme: request.theme ?? context.theme,
    requestedLayers,
    screenshotScope,
    ...(target ? { target } : {}),
    projectRevision: createDesktopMcpProjectRevision({
      project: context.project,
      theme: context.theme,
    }),
  }
}

export const finalizeDesktopMcpPreviewCapture = (
  prepared: PreparedDesktopMcpPreviewCapture,
  capture: DesktopMcpSandboxCaptureSuccess,
  context: DesktopMcpPreviewCaptureContext,
  {
    captureId = createDesktopMcpPreviewCaptureId(),
    timestamp = new Date().toISOString(),
  }: {
    captureId?: string
    timestamp?: string
  } = {}
): DesktopMcpPreviewCaptureResult => {
  if (
    prepared.requestedLayers.includes('screenshot') &&
    (!capture.screenshot || capture.screenshot.text.trim().length === 0)
  ) {
    return createPreviewCaptureFailure(
      'render-failed',
      'capture_preview_evidence did not receive the requested screenshot layer from the isolated Preview render.'
    )
  }

  if (prepared.requestedLayers.includes('accessibility') && !capture.accessibility) {
    return createPreviewCaptureFailure(
      'render-failed',
      'capture_preview_evidence did not receive the requested accessibility layer from the isolated Preview render.'
    )
  }

  const manifestResourceUri = createDesktopMcpPreviewCaptureManifestUri(captureId)
  const accessibilityResourceUri = createDesktopMcpPreviewCaptureAccessibilityUri(captureId)
  const domLayoutStyleResourceUri = createDesktopMcpPreviewCaptureDomLayoutStyleUri(captureId)
  const frameResourceUri = createDesktopMcpPreviewCaptureFrameUri(captureId)
  const screenshotResourceUri = createDesktopMcpPreviewCaptureScreenshotUri(captureId)
  const diagnosticsSummary = summarizePreviewDiagnostics(context)
  const resources: DesktopMcpPreviewCaptureResource[] = []
  const producedResources = [manifestResourceUri]
  const producedLayers: DesktopMcpPreviewCaptureLayer[] = []
  const layerResources: DesktopMcpPreviewCaptureSuccess['layerResources'] = {}

  const frame = capture.evidence.frame

  const frameResource = {
    captureId,
    projectRevision: prepared.projectRevision,
    page: {
      id: prepared.pageId,
      name: prepared.pageName,
    },
    preview: {
      viewportSize: prepared.viewportSize,
      theme: prepared.theme,
      viewport: frame.viewport,
      scroll: frame.scroll,
      rootSelector: frame.rootSelector,
    },
    diagnostics: {
      ...diagnosticsSummary,
      capturedAt: timestamp,
    },
    capture: {
      isolatedRender: true,
      requestedLayers: prepared.requestedLayers,
      producedLayers,
      screenshotScope: prepared.screenshotScope,
      ...(capture.targetDescription ? { targetDescription: capture.targetDescription } : {}),
      capturedElementCount: frame.capturedElementCount,
      truncated: frame.truncated,
      limits: {
        maxDomElements: MAX_PREVIEW_EVIDENCE_ELEMENTS,
        maxAccessibilityNodes: MAX_PREVIEW_EVIDENCE_ELEMENTS,
      },
      timeoutMs: DESKTOP_MCP_PREVIEW_CAPTURE_TIMEOUT_MS,
      capturedAt: timestamp,
    },
  }

  const manifest = {
    captureId,
    summary: createPreviewCaptureSummary(prepared, capture, producedLayers),
    projectRevision: prepared.projectRevision,
    page: {
      id: prepared.pageId,
      name: prepared.pageName,
    },
    preview: {
      viewportSize: prepared.viewportSize,
      theme: prepared.theme,
    },
    requestedLayers: prepared.requestedLayers,
    producedLayers,
    layerPurposes: Object.fromEntries(
      producedLayers.map((layer) => [layer, DESKTOP_MCP_PREVIEW_CAPTURE_LAYER_PURPOSES[layer]])
    ),
    layerResources,
    ...(producedLayers.includes('screenshot')
      ? {
          screenshot: {
            scope: prepared.screenshotScope,
            ...(capture.targetDescription ? { targetDescription: capture.targetDescription } : {}),
          },
        }
      : {}),
    diagnostics: {
      ...diagnosticsSummary,
      capturedAt: timestamp,
    },
    capture: {
      isolatedRender: true,
      rootSelector: frame.rootSelector,
      capturedElementCount: frame.capturedElementCount,
      truncated: frame.truncated,
      limits: {
        maxDomElements: MAX_PREVIEW_EVIDENCE_ELEMENTS,
        maxAccessibilityNodes: MAX_PREVIEW_EVIDENCE_ELEMENTS,
      },
      timeoutMs: DESKTOP_MCP_PREVIEW_CAPTURE_TIMEOUT_MS,
      capturedAt: timestamp,
    },
  }

  const addLayerResource = (
    layer: DesktopMcpPreviewCaptureLayer,
    resource: DesktopMcpPreviewCaptureResource
  ) => {
    producedLayers.push(layer)
    producedResources.push(resource.uri)
    resources.push(resource)

    if (layer === 'screenshot') {
      layerResources.screenshot = resource.uri
      return
    }

    if (layer === 'accessibility') {
      layerResources.accessibility = resource.uri
      return
    }

    if (layer === 'dom_layout_style') {
      layerResources.dom_layout_style = resource.uri
      return
    }

    layerResources.frame = resource.uri
  }

  for (const layer of prepared.requestedLayers) {
    switch (layer) {
      case 'screenshot':
        if (capture.screenshot) {
          addLayerResource('screenshot', {
            uri: screenshotResourceUri,
            mimeType: capture.screenshot.mimeType,
            text: capture.screenshot.text,
          })
        }
        break
      case 'accessibility':
        if (capture.accessibility) {
          addLayerResource('accessibility', {
            uri: accessibilityResourceUri,
            mimeType: 'application/json',
            text: JSON.stringify(capture.accessibility),
          })
        }
        break
      case 'dom_layout_style':
        addLayerResource('dom_layout_style', {
          uri: domLayoutStyleResourceUri,
          mimeType: 'application/json',
          text: JSON.stringify({
            rootSelector: frame.rootSelector,
            capturedElementCount: frame.capturedElementCount,
            truncated: frame.truncated,
            tree: capture.evidence.tree,
          }),
        })
        break
      case 'frame':
        addLayerResource('frame', {
          uri: frameResourceUri,
          mimeType: 'application/json',
          text: '',
        })
        break
    }
  }

  if (layerResources.frame) {
    const frameResourceEntry = resources.find((resource) => resource.uri === frameResourceUri)
    if (frameResourceEntry) {
      frameResourceEntry.text = JSON.stringify(frameResource)
    }
  }

  manifest.summary = createPreviewCaptureSummary(prepared, capture, producedLayers)
  manifest.producedLayers = producedLayers
  manifest.layerPurposes = Object.fromEntries(
    producedLayers.map((layer) => [layer, DESKTOP_MCP_PREVIEW_CAPTURE_LAYER_PURPOSES[layer]])
  )
  manifest.layerResources = layerResources
  if (producedLayers.includes('screenshot')) {
    manifest.screenshot = {
      scope: prepared.screenshotScope,
      ...(capture.targetDescription ? { targetDescription: capture.targetDescription } : {}),
    }
  }

  resources.unshift({
    uri: manifestResourceUri,
    mimeType: 'application/json',
    text: JSON.stringify(manifest),
  })

  return {
    ok: true,
    summary: manifest.summary,
    captureId,
    manifestResourceUri,
    producedResources,
    page: {
      id: prepared.pageId,
      name: prepared.pageName,
    },
    requestedLayers: prepared.requestedLayers,
    producedLayers,
    layerResources,
    resources,
    safeActivity: {
      toolName: 'capture_preview_evidence',
      operationTypes: producedLayers,
      timestamp,
    },
  }
}

export const createDesktopMcpPreviewCaptureId = (
  now = Date.now(),
  random = Math.random()
): string => `capture-${now.toString(36)}-${Math.floor(random * 0xffffff)
  .toString(36)
  .padStart(4, '0')}`

const normalizePreviewCaptureTarget = (
  target: PreviewEvidenceCaptureTarget | undefined
): PreviewEvidenceCaptureTarget | undefined => {
  if (!target) {
    return undefined
  }

  const normalized = Object.fromEntries(
    Object.entries(target)
      .map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value])
      .filter(([, value]) => typeof value === 'string' && value.length > 0)
  ) as PreviewEvidenceCaptureTarget

  return Object.keys(normalized).length > 0 ? normalized : undefined
}

const summarizePreviewDiagnostics = (
  context: DesktopMcpPreviewCaptureContext
): PreviewDiagnosticsSummary => {
  const diagnostics = createDesktopMcpProjectDiagnostics(context)

  return {
    status: diagnostics.status,
    issueCount: diagnostics.issues.length,
    compileError: diagnostics.issues.some((issue) => issue.kind === 'compile-error'),
    runtimeError: diagnostics.issues.some((issue) => issue.kind === 'runtime-error'),
    stalePageReferenceCount: diagnostics.issues.filter(
      (issue) => issue.kind === 'stale-page-reference'
    ).length,
  }
}

const createPreviewCaptureSummary = (
  prepared: PreparedDesktopMcpPreviewCapture,
  capture: DesktopMcpSandboxCaptureSuccess,
  producedLayers: DesktopMcpPreviewCaptureLayer[]
): string => {
  const formattedLayers = producedLayers.map(formatPreviewCaptureLayerLabel)
  const lastProducedLayer = formattedLayers[formattedLayers.length - 1] ?? ''
  const layerSummary =
    formattedLayers.length === 1
      ? formattedLayers[0]
      : `${formattedLayers.slice(0, -1).join(', ')} and ${lastProducedLayer}`
  const scopeSummary = producedLayers.includes('screenshot')
    ? prepared.screenshotScope === 'region'
      ? capture.targetDescription
        ? ` (region (${capture.targetDescription}))`
        : ' (region)'
      : ` (${prepared.screenshotScope.replace('_', '-')})`
    : ''

  return `Captured ${prepared.pageName} (${prepared.pageId}) in ${prepared.theme} ${prepared.viewportSize} preview with ${layerSummary} evidence${scopeSummary}.`
}

const formatPreviewCaptureLayerLabel = (layer: DesktopMcpPreviewCaptureLayer): string => {
  switch (layer) {
    case 'dom_layout_style':
      return 'DOM/layout/style'
    default:
      return layer
  }
}

const createPreviewCaptureFailure = (
  code: DesktopMcpPreviewCaptureFailure['code'],
  message: string,
  extras: Omit<DesktopMcpPreviewCaptureFailure, 'ok' | 'code' | 'message'> = {}
): DesktopMcpPreviewCaptureFailure => ({
  ok: false,
  code,
  message,
  ...extras,
})
