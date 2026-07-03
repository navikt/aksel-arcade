import { describe, expect, it } from 'vitest'
import { collectPreviewDiagnostics } from '@/services/previewDiagnostics'
import {
  DEFAULT_DESKTOP_MCP_PREVIEW_CAPTURE_LAYERS,
  DESKTOP_MCP_PREVIEW_CAPTURE_EPHEMERAL_NOTE,
  finalizeDesktopMcpPreviewCapture,
  prepareDesktopMcpPreviewCapture,
  type DesktopMcpSandboxCaptureSuccess,
} from '@/services/desktopMcpPreviewCapture'
import {
  MAX_PREVIEW_EVIDENCE_ELEMENTS,
  PREVIEW_EVIDENCE_ANNOTATION_OVERLAY_NOTE,
} from '@/services/previewEvidence'
import { createDefaultPreviewState, createDefaultProject } from '@/utils/projectDefaults'

describe('desktopMcpPreviewCapture', () => {
  it('defaults omitted layer requests to all available capture layers', () => {
    const context = createCaptureContext()
    const prepared = prepareDesktopMcpPreviewCapture({}, context)
    if (!prepared.ok) {
      throw new Error('Expected preview capture preparation to succeed.')
    }

    expect(prepared.requestedLayers).toEqual([...DEFAULT_DESKTOP_MCP_PREVIEW_CAPTURE_LAYERS])
    expect(prepared.includeAnnotationOverlays).toBe(false)
  })

  it('finalizes all requested evidence layers with manifest docs and resource payloads', () => {
    const context = createCaptureContext()
    const prepared = prepareDesktopMcpPreviewCapture({}, context)
    if (!prepared.ok) {
      throw new Error('Expected preview capture preparation to succeed.')
    }

    const result = finalizeDesktopMcpPreviewCapture(prepared, createSandboxCapture(), context, {
      captureId: 'capture-demo',
      timestamp: '2026-06-16T12:00:00.000Z',
    })
    expect(result).toMatchObject({
      ok: true,
      requestedLayers: [...DEFAULT_DESKTOP_MCP_PREVIEW_CAPTURE_LAYERS],
      producedLayers: [...DEFAULT_DESKTOP_MCP_PREVIEW_CAPTURE_LAYERS],
      layerResources: {
        screenshot: 'arcade://preview/captures/capture-demo/screenshot',
        accessibility: 'arcade://preview/captures/capture-demo/accessibility',
        dom_layout_style: 'arcade://preview/captures/capture-demo/dom-layout-style',
        frame: 'arcade://preview/captures/capture-demo/frame',
      },
    })
    if (!result.ok) {
      throw new Error('Expected finalized preview capture to succeed.')
    }

    const manifest = JSON.parse(findResourceText(result.resources, result.manifestResourceUri))
    expect(manifest.layerPurposes).toMatchObject({
      screenshot: 'visual appearance and spatial gestalt',
      accessibility:
        'semantic roles, accessible names, landmarks, focusable controls, and semantic hierarchy',
      dom_layout_style:
        'actionable hierarchy, bounds, styles, spacing, colors, typography, and overflow',
      frame: 'viewport, theme, page, scroll, diagnostics, truncation, and capture metadata',
    })
    expect(manifest.capture.limits).toEqual({
      maxDomElements: MAX_PREVIEW_EVIDENCE_ELEMENTS,
      maxAccessibilityNodes: MAX_PREVIEW_EVIDENCE_ELEMENTS,
    })

    const accessibilityResource = JSON.parse(
      findResourceText(
        result.resources,
        'arcade://preview/captures/capture-demo/accessibility'
      )
    )
    expect(accessibilityResource).toMatchObject({
      rootSelector: '#root',
      nodeCount: 2,
      truncated: false,
      nodes: [
        {
          role: 'heading',
          name: 'Details',
          level: 1,
        },
        {
          role: 'button',
          name: 'Continue',
          focusable: true,
        },
      ],
    })

    const domLayoutStyleResource = JSON.parse(
      findResourceText(
        result.resources,
        'arcade://preview/captures/capture-demo/dom-layout-style'
      )
    )
    expect(domLayoutStyleResource).toMatchObject({
      rootSelector: '#root',
      capturedElementCount: 4,
      truncated: false,
      tree: {
        tagName: 'div',
      },
    })

    expect(result.page).not.toHaveProperty('navigatedToId')
    expect(manifest.page).not.toHaveProperty('navigatedToId')
    expect(manifest.capture.ephemeral).toBe(true)
    expect(manifest.capture.ephemeralNote).toBe(DESKTOP_MCP_PREVIEW_CAPTURE_EPHEMERAL_NOTE)
    expect(result.summary).not.toContain('Interactions navigated to')
  })

  it('surfaces annotation overlay capture metadata without changing annotation resources', () => {
    const context = createCaptureContext()
    const prepared = prepareDesktopMcpPreviewCapture(
      {
        includeAnnotationOverlays: true,
      },
      context
    )
    if (!prepared.ok) {
      throw new Error('Expected overlay capture preparation to succeed.')
    }

    const result = finalizeDesktopMcpPreviewCapture(
      prepared,
      {
        ...createSandboxCapture(),
        captureMeta: {
          ...createSandboxCapture().captureMeta,
          annotationOverlays: {
            requested: true,
            included: true,
            visibleAnnotationCount: 2,
            note: PREVIEW_EVIDENCE_ANNOTATION_OVERLAY_NOTE,
          },
        },
      },
      context,
      {
        captureId: 'capture-overlay',
        timestamp: '2026-06-16T12:00:00.000Z',
      }
    )
    if (!result.ok) {
      throw new Error('Expected overlay capture finalization to succeed.')
    }

    expect(result.summary).toContain('with annotation overlays')
    const manifest = JSON.parse(findResourceText(result.resources, result.manifestResourceUri))
    expect(manifest.capture.annotationOverlays).toEqual({
      requested: true,
      included: true,
      visibleAnnotationCount: 2,
      note: PREVIEW_EVIDENCE_ANNOTATION_OVERLAY_NOTE,
    })
    const frameResource = JSON.parse(
      findResourceText(result.resources, 'arcade://preview/captures/capture-overlay/frame')
    )
    expect(frameResource.capture.annotationOverlays).toEqual({
      requested: true,
      included: true,
      visibleAnnotationCount: 2,
      note: PREVIEW_EVIDENCE_ANNOTATION_OVERLAY_NOTE,
    })
    expect(manifest.screenshot.includesAnnotationOverlays).toBe(true)
  })

  it('rejects annotation overlays when the caller omits the screenshot layer', () => {
    const context = createCaptureContext()
    const prepared = prepareDesktopMcpPreviewCapture(
      {
        layers: ['frame'],
        includeAnnotationOverlays: true,
      },
      context
    )

    expect(prepared).toEqual({
      ok: false,
      code: 'invalid-capture-target',
      message: 'capture_preview_evidence includeAnnotationOverlays requires the screenshot layer.',
    })
  })

  it('publishes only the selected layer resources when a caller narrows the request', () => {
    const context = createCaptureContext()
    const prepared = prepareDesktopMcpPreviewCapture(
      {
        layers: ['accessibility', 'dom_layout_style'],
      },
      context
    )
    if (!prepared.ok) {
      throw new Error('Expected preview capture preparation to succeed.')
    }

    const result = finalizeDesktopMcpPreviewCapture(prepared, createSandboxCapture(), context, {
      captureId: 'capture-selected',
      timestamp: '2026-06-16T12:00:00.000Z',
    })
    expect(result).toMatchObject({
      ok: true,
      producedResources: [
        'arcade://preview/captures/capture-selected/manifest',
        'arcade://preview/captures/capture-selected/accessibility',
        'arcade://preview/captures/capture-selected/dom-layout-style',
      ],
      producedLayers: ['accessibility', 'dom_layout_style'],
      layerResources: {
        accessibility: 'arcade://preview/captures/capture-selected/accessibility',
        dom_layout_style: 'arcade://preview/captures/capture-selected/dom-layout-style',
      },
    })
    if (!result.ok) {
      throw new Error('Expected finalized preview capture to succeed.')
    }

    expect(result.layerResources.screenshot).toBeUndefined()
    expect(result.layerResources.frame).toBeUndefined()

    const manifest = JSON.parse(findResourceText(result.resources, result.manifestResourceUri))
    expect(manifest.producedLayers).toEqual(['accessibility', 'dom_layout_style'])
    expect(manifest.layerResources).toEqual({
      accessibility: 'arcade://preview/captures/capture-selected/accessibility',
      dom_layout_style: 'arcade://preview/captures/capture-selected/dom-layout-style',
    })
    expect(manifest.screenshot).toBeUndefined()
  })

  it('records requested and executed interaction state in the finalized manifest', () => {
    const context = createCaptureContext()
    const prepared = prepareDesktopMcpPreviewCapture(
      {
        interactions: [
          {
            action: 'click',
            target: { role: 'button', name: 'Open details' },
          },
          {
            action: 'waitFor',
            text: 'Expanded details',
            timeoutMs: 300,
          },
        ],
      },
      context
    )
    if (!prepared.ok) {
      throw new Error('Expected preview capture preparation to succeed.')
    }

    const result = finalizeDesktopMcpPreviewCapture(
      prepared,
      {
        ...createSandboxCapture(),
        captureMeta: {
          currentPageId: 'page02',
          interactions: {
            requested: prepared.requestedInteractions,
            executed: [
              {
                index: 0,
                step: prepared.requestedInteractions[0],
                targetDescription: 'role=button name="Open details"',
              },
              {
                index: 1,
                step: prepared.requestedInteractions[1],
              },
            ],
          },
        },
      },
      context,
      {
        captureId: 'capture-interactions',
        timestamp: '2026-06-16T12:00:00.000Z',
      }
    )

    expect(result).toMatchObject({
      ok: true,
      summary:
        'Captured Page 1 (page01) in dark MD preview with screenshot, accessibility, DOM/layout/style and frame evidence after 2 interactions (viewport). Interactions navigated to page02 (page02); this is an isolated render, so the Active page is unchanged.',
      page: {
        id: 'page01',
        navigatedToId: 'page02',
      },
      interactions: {
        executed: [
          {
            index: 0,
            targetDescription: 'role=button name="Open details"',
          },
          {
            index: 1,
          },
        ],
      },
    })
    if (!result.ok) {
      throw new Error('Expected finalized preview capture to succeed.')
    }

    const frameResource = JSON.parse(
      findResourceText(result.resources, 'arcade://preview/captures/capture-interactions/frame')
    )
    expect(frameResource.page.navigatedToId).toBe('page02')
    expect(frameResource.capture.ephemeral).toBe(true)
    expect(frameResource.capture.ephemeralNote).toBe(DESKTOP_MCP_PREVIEW_CAPTURE_EPHEMERAL_NOTE)

    const manifest = JSON.parse(findResourceText(result.resources, result.manifestResourceUri))
    expect(manifest.interactions).toEqual({
      requested: prepared.requestedInteractions,
      executed: [
        {
          index: 0,
          step: prepared.requestedInteractions[0],
          targetDescription: 'role=button name="Open details"',
        },
        {
          index: 1,
          step: prepared.requestedInteractions[1],
        },
      ],
      finalState: {
        pageId: 'page02',
        scroll: {
          x: 0,
          y: 0,
        },
      },
    })
    expect(manifest.page.navigatedToId).toBe(manifest.interactions.finalState.pageId)
    expect(manifest.capture.ephemeral).toBe(true)
    expect(manifest.capture.interactionLimits).toEqual({
      maxSteps: 10,
      maxTotalTimeMs: 10000,
      maxWaitTimeoutMs: 5000,
    })
  })
})

const createCaptureContext = () => ({
  project: createDefaultProject(),
  theme: 'dark' as const,
  diagnostics: collectPreviewDiagnostics(createDefaultPreviewState()),
})

const createSandboxCapture = (): DesktopMcpSandboxCaptureSuccess => ({
  ok: true,
  evidence: {
    frame: {
      rootSelector: '#root',
      viewport: {
        width: 768,
        height: 900,
        devicePixelRatio: 2,
      },
      scroll: {
        x: 0,
        y: 0,
      },
      capturedElementCount: 4,
      truncated: false,
    },
    tree: {
      tagName: 'div',
      text: 'Root text',
      boundingBox: createRect(320, 200),
      computedStyle: {
        display: 'flex',
      },
      children: [
        {
          tagName: 'button',
          text: 'Continue',
          boundingBox: createRect(96, 32),
          computedStyle: {
            display: 'inline-flex',
          },
        },
      ],
    },
  },
  accessibility: {
    rootSelector: '#root',
    nodeCount: 2,
    truncated: false,
    nodes: [
      {
        role: 'heading',
        name: 'Details',
        level: 1,
      },
      {
        role: 'button',
        name: 'Continue',
        focusable: true,
      },
    ],
  },
  screenshot: {
    mimeType: 'image/svg+xml',
    text: '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"></svg>',
    width: 320,
    height: 200,
  },
  captureMeta: {
    targetDescription: 'role=button name="Continue"',
  },
})

const createRect = (width: number, height: number) => ({
  x: 0,
  y: 0,
  width,
  height,
  top: 0,
  right: width,
  bottom: height,
  left: 0,
})

const findResourceText = (
  resources: Array<{ uri: string; text: string }>,
  uri: string
): string => {
  const resource = resources.find((candidate) => candidate.uri === uri)
  if (!resource) {
    throw new Error(`Expected capture resource ${uri} to exist.`)
  }

  return resource.text
}
