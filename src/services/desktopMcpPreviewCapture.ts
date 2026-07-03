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
  MAX_PREVIEW_INTERACTION_STEPS,
  MAX_PREVIEW_INTERACTION_TOTAL_TIME_MS,
  MAX_PREVIEW_INTERACTION_WAIT_TIMEOUT_MS,
  MAX_PREVIEW_EVIDENCE_ELEMENTS,
  type PreviewEvidence,
  type PreviewEvidenceAccessibility,
  type PreviewEvidenceCaptureMetadata,
  type PreviewEvidenceCaptureTarget,
  type PreviewInteractionState,
  type PreviewInteractionStep,
  type PreviewEvidenceScreenshot,
  type PreviewEvidenceScreenshotScope,
} from './previewEvidence'

export const DESKTOP_MCP_PREVIEW_CAPTURE_TIMEOUT_MS = 20_000
export const DESKTOP_MCP_PREVIEW_CAPTURE_MAX_INTERACTION_STEPS = MAX_PREVIEW_INTERACTION_STEPS
export const DESKTOP_MCP_PREVIEW_CAPTURE_MAX_INTERACTION_TOTAL_TIME_MS =
  MAX_PREVIEW_INTERACTION_TOTAL_TIME_MS
export const DESKTOP_MCP_PREVIEW_CAPTURE_MAX_WAIT_TIMEOUT_MS =
  MAX_PREVIEW_INTERACTION_WAIT_TIMEOUT_MS

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
  requestedInteractions: PreviewInteractionStep[]
  screenshotScope: PreviewEvidenceScreenshotScope
  includeAnnotationOverlays: boolean
  target?: PreviewEvidenceCaptureTarget
  projectRevision: string
}

export interface DesktopMcpSandboxCaptureSuccess {
  ok: true
  evidence: PreviewEvidence
  accessibility?: PreviewEvidenceAccessibility
  screenshot?: PreviewEvidenceScreenshot
  captureMeta?: PreviewEvidenceCaptureMetadata
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
  const requestedInteractions = normalizePreviewInteractions(request.interactions)
  const includeAnnotationOverlays = request.includeAnnotationOverlays === true
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

  if (requestedInteractions.length > DESKTOP_MCP_PREVIEW_CAPTURE_MAX_INTERACTION_STEPS) {
    return createPreviewCaptureFailure(
      'invalid-capture-target',
      `capture_preview_evidence supports at most ${DESKTOP_MCP_PREVIEW_CAPTURE_MAX_INTERACTION_STEPS} bounded Preview interactions per capture.`
    )
  }

  const requestedLayers =
    request.layers && request.layers.length > 0
      ? [...request.layers]
      : [...DEFAULT_DESKTOP_MCP_PREVIEW_CAPTURE_LAYERS]
  if (includeAnnotationOverlays && !requestedLayers.includes('screenshot')) {
    return createPreviewCaptureFailure(
      'invalid-capture-target',
      'capture_preview_evidence includeAnnotationOverlays requires the screenshot layer.'
    )
  }

  return {
    ok: true,
    pageId: page.id,
    pageName: page.name,
    viewportSize: request.viewportSize ?? context.project.viewportSize,
    theme: request.theme ?? context.theme,
    requestedLayers,
    requestedInteractions,
    screenshotScope,
    includeAnnotationOverlays,
    ...(target ? { target } : {}),
    projectRevision: createDesktopMcpProjectRevision({
      project: context.project,
      theme: context.theme,
    }),
  }
}

// Capture runs in a throwaway, isolated off-screen render that cannot reach the
// durable project, the human-visible Active page, or saved Preview preferences.
// Stating this in the output stops agents from "restoring" an Active page that
// never moved after an in-capture goToPage navigation.
export const DESKTOP_MCP_PREVIEW_CAPTURE_EPHEMERAL_NOTE =
  'Isolated, throwaway render: in-capture interactions and goToPage navigation do not change the human-visible Active page, durable source, or saved Preview preferences. No restore needed.'

// When in-capture interactions navigate to another page, report that destination
// alongside the page the capture started on so the frame/manifest never contradict
// the accessibility and screenshot layers, which reflect the post-navigation DOM.
const resolveCaptureNavigatedToPage = (
  prepared: PreparedDesktopMcpPreviewCapture,
  capture: DesktopMcpSandboxCaptureSuccess,
  context: DesktopMcpPreviewCaptureContext
): { navigatedToId: Project['source']['pages'][number]['id']; navigatedToName?: string } | null => {
  const navigatedToId = capture.captureMeta?.currentPageId
  if (typeof navigatedToId !== 'string' || navigatedToId === prepared.pageId) {
    return null
  }

  const navigatedToPage = getPageById(context.project.source, navigatedToId)
  return {
    navigatedToId,
    ...(navigatedToPage ? { navigatedToName: navigatedToPage.name } : {}),
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
  const interactionState = capture.captureMeta?.interactions
  const targetDescription = capture.captureMeta?.targetDescription

  const frame = capture.evidence.frame
  const navigatedTo = resolveCaptureNavigatedToPage(prepared, capture, context)
  const screenshotMetadata = {
    scope: prepared.screenshotScope,
    ...(targetDescription ? { targetDescription } : {}),
    ...(capture.captureMeta?.annotationOverlays?.included
      ? { includesAnnotationOverlays: true }
      : {}),
  }

  const frameResource = {
    captureId,
    projectRevision: prepared.projectRevision,
    page: {
      id: prepared.pageId,
      name: prepared.pageName,
      ...(navigatedTo ?? {}),
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
      ephemeral: true,
      ephemeralNote: DESKTOP_MCP_PREVIEW_CAPTURE_EPHEMERAL_NOTE,
      requestedLayers: prepared.requestedLayers,
      producedLayers,
      screenshotScope: prepared.screenshotScope,
      ...(targetDescription ? { targetDescription } : {}),
      capturedElementCount: frame.capturedElementCount,
      truncated: frame.truncated,
      limits: {
        maxDomElements: MAX_PREVIEW_EVIDENCE_ELEMENTS,
        maxAccessibilityNodes: MAX_PREVIEW_EVIDENCE_ELEMENTS,
      },
      timeoutMs: DESKTOP_MCP_PREVIEW_CAPTURE_TIMEOUT_MS,
      ...(capture.captureMeta?.annotationOverlays
        ? { annotationOverlays: capture.captureMeta.annotationOverlays }
        : {}),
      interactionLimits: {
        maxSteps: DESKTOP_MCP_PREVIEW_CAPTURE_MAX_INTERACTION_STEPS,
        maxTotalTimeMs: DESKTOP_MCP_PREVIEW_CAPTURE_MAX_INTERACTION_TOTAL_TIME_MS,
        maxWaitTimeoutMs: DESKTOP_MCP_PREVIEW_CAPTURE_MAX_WAIT_TIMEOUT_MS,
      },
      capturedAt: timestamp,
    },
  }

  const manifest: Record<string, unknown> & {
    summary: string
    producedLayers: DesktopMcpPreviewCaptureLayer[]
    layerPurposes: Record<string, string>
    layerResources: DesktopMcpPreviewCaptureSuccess['layerResources']
    screenshot?: typeof screenshotMetadata
    interactions?: PreviewInteractionState & {
      finalState: {
        pageId: Project['source']['pages'][number]['id']
        scroll: PreviewEvidence['frame']['scroll']
      }
    }
  } = {
    captureId,
    summary: createPreviewCaptureSummary(prepared, capture, producedLayers, navigatedTo),
    projectRevision: prepared.projectRevision,
    page: {
      id: prepared.pageId,
      name: prepared.pageName,
      ...(navigatedTo ?? {}),
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
          screenshot: screenshotMetadata,
        }
      : {}),
    diagnostics: {
      ...diagnosticsSummary,
      capturedAt: timestamp,
    },
    capture: {
      isolatedRender: true,
      ephemeral: true,
      ephemeralNote: DESKTOP_MCP_PREVIEW_CAPTURE_EPHEMERAL_NOTE,
      rootSelector: frame.rootSelector,
      capturedElementCount: frame.capturedElementCount,
      truncated: frame.truncated,
      limits: {
        maxDomElements: MAX_PREVIEW_EVIDENCE_ELEMENTS,
        maxAccessibilityNodes: MAX_PREVIEW_EVIDENCE_ELEMENTS,
      },
      timeoutMs: DESKTOP_MCP_PREVIEW_CAPTURE_TIMEOUT_MS,
      ...(capture.captureMeta?.annotationOverlays
        ? { annotationOverlays: capture.captureMeta.annotationOverlays }
        : {}),
      interactionLimits: {
        maxSteps: DESKTOP_MCP_PREVIEW_CAPTURE_MAX_INTERACTION_STEPS,
        maxTotalTimeMs: DESKTOP_MCP_PREVIEW_CAPTURE_MAX_INTERACTION_TOTAL_TIME_MS,
        maxWaitTimeoutMs: DESKTOP_MCP_PREVIEW_CAPTURE_MAX_WAIT_TIMEOUT_MS,
      },
      capturedAt: timestamp,
    },
  }

  if (prepared.requestedInteractions.length > 0 || interactionState) {
   manifest.interactions = {
     requested: prepared.requestedInteractions,
     executed: interactionState?.executed ?? [],
     finalState: {
       pageId: capture.captureMeta?.currentPageId ?? prepared.pageId,
       scroll: frame.scroll,
     },
     ...(interactionState?.failedStep ? { failedStep: interactionState.failedStep } : {}),
   }
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

  manifest.summary = createPreviewCaptureSummary(prepared, capture, producedLayers, navigatedTo)
  manifest.producedLayers = producedLayers
  manifest.layerPurposes = Object.fromEntries(
    producedLayers.map((layer) => [layer, DESKTOP_MCP_PREVIEW_CAPTURE_LAYER_PURPOSES[layer]])
  )
  manifest.layerResources = layerResources
  if (producedLayers.includes('screenshot')) {
    manifest.screenshot = screenshotMetadata
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
      ...(navigatedTo ?? {}),
    },
    requestedLayers: prepared.requestedLayers,
    producedLayers,
    layerResources,
    ...(interactionState || prepared.requestedInteractions.length > 0
      ? {
          interactions: {
            requested: prepared.requestedInteractions,
            executed: interactionState?.executed ?? [],
            ...(interactionState?.failedStep ? { failedStep: interactionState.failedStep } : {}),
          } satisfies PreviewInteractionState,
        }
      : {}),
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

const normalizePreviewInteractions = (
  interactions: PreviewInteractionStep[] | undefined
): PreviewInteractionStep[] => {
  if (!interactions || interactions.length === 0) {
    return []
  }

  return interactions.map((interaction) => {
    const target =
      'target' in interaction && interaction.target
        ? normalizePreviewCaptureTarget(interaction.target)
        : undefined

    if (interaction.action === 'waitFor') {
      return {
        ...interaction,
        ...(typeof interaction.text === 'string' ? { text: interaction.text.trim() } : {}),
        ...(target ? { target } : {}),
      }
    }

    return {
      ...interaction,
      ...(target ? { target } : {}),
    }
  })
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
  producedLayers: DesktopMcpPreviewCaptureLayer[],
  navigatedTo: { navigatedToId: string; navigatedToName?: string } | null
): string => {
  const formattedLayers = producedLayers.map(formatPreviewCaptureLayerLabel)
  const lastProducedLayer = formattedLayers[formattedLayers.length - 1] ?? ''
  const layerSummary =
    formattedLayers.length === 1
      ? formattedLayers[0]
      : `${formattedLayers.slice(0, -1).join(', ')} and ${lastProducedLayer}`
  const scopeSummary = producedLayers.includes('screenshot')
    ? prepared.screenshotScope === 'region'
      ? capture.captureMeta?.targetDescription
        ? ` (region (${capture.captureMeta.targetDescription}))`
        : ' (region)'
      : ` (${prepared.screenshotScope.replace('_', '-')})`
    : ''
  const annotationOverlaySummary = capture.captureMeta?.annotationOverlays?.included
    ? ' with annotation overlays'
    : ''
  const interactionSummary =
    prepared.requestedInteractions.length > 0
      ? ` after ${prepared.requestedInteractions.length} interaction${prepared.requestedInteractions.length === 1 ? '' : 's'}`
      : ''
  const navigationSummary = navigatedTo
    ? ` Interactions navigated to ${navigatedTo.navigatedToName ?? navigatedTo.navigatedToId} (${navigatedTo.navigatedToId}); this is an isolated render, so the Active page is unchanged.`
    : ''

  return `Captured ${prepared.pageName} (${prepared.pageId}) in ${prepared.theme} ${prepared.viewportSize} preview with ${layerSummary} evidence${interactionSummary}${scopeSummary}${annotationOverlaySummary}.${navigationSummary}`
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
