import { createServer, request, type Server } from 'node:http'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DESKTOP_MCP_AUTH_DESCRIPTION,
  DESKTOP_MCP_PATH,
  DESKTOP_MCP_PORT,
  DESKTOP_MCP_SERVER_NAME,
  DESKTOP_MCP_SERVER_VERSION,
  DESKTOP_MCP_TRANSPORT_LABEL,
  createDesktopMcpServer,
} from '../../../desktop/mcpSdkServer'
import type { DesktopMcpApplyChangesHandler } from '../../../src/services/desktopMcpApplyChangesProtocol'
import type { DesktopMcpAnnotationMutationHandler } from '../../../src/services/desktopMcpAnnotationProtocol'
import type { DesktopMcpPreviewCaptureHandler } from '../../../src/services/desktopMcpPreviewCaptureProtocol'
import type {
  DesktopMcpProjectResourceReadHandler,
  DesktopMcpProjectResourceReadResult,
} from '../../../src/services/desktopMcpProjectResourceProtocol'
import type { ArcadeAnnotation, AnnotationStatus } from '../../../src/types/annotations'

interface DesktopMcpServerState {
  serverName: string
  transportLabel: string
  url: string
  requiresAuth: false
  authDescription: string
  availability: { status: 'available' } | { status: 'unavailable'; reason: string }
}

interface DesktopMcpServer {
  getState: () => DesktopMcpServerState
  start: () => Promise<DesktopMcpServerState>
  stop: () => Promise<boolean>
}

const activeServers: DesktopMcpServer[] = []
const occupiedServers: Server[] = []

const createManagedServer = (options?: {
  port?: number
  readProjectResource?: DesktopMcpProjectResourceReadHandler
  mutateAnnotation?: DesktopMcpAnnotationMutationHandler
  applyChanges?: DesktopMcpApplyChangesHandler
  capturePreviewEvidence?: DesktopMcpPreviewCaptureHandler
}): DesktopMcpServer => {
  const server = createDesktopMcpServer({
    port: options?.port ?? 0,
    readProjectResource: options?.readProjectResource,
    mutateAnnotation: options?.mutateAnnotation,
    applyChanges: options?.applyChanges,
    capturePreviewEvidence: options?.capturePreviewEvidence,
  })
  activeServers.push(server)
  return server
}

const expectedToolNames = [
  'read_resource',
  'list_annotations',
  'watch_annotations',
  'acknowledge_annotation',
  'resolve_annotation',
  'dismiss_annotation',
  'reply_to_annotation',
  'capture_preview_evidence',
  'apply_changes',
]

const createMockAnnotation = (annotationId: string, status: AnnotationStatus): ArcadeAnnotation => ({
  id: annotationId,
  pageId: 'page01',
  x: 12,
  y: 24,
  comment: `Annotation ${annotationId}`,
  element: 'button',
  elementPath: 'main > button:nth-of-type(1)',
  timestamp: 1,
  status,
})

describe('desktopMcpSdkServer', () => {
  afterEach(async () => {
    await Promise.all(activeServers.map((server) => server.stop()))
    activeServers.length = 0
    await Promise.all(occupiedServers.map(closeHttpServer))
    occupiedServers.length = 0
  })

  it('exports the fixed Desktop Arcade MCP configuration', () => {
    expect(DESKTOP_MCP_SERVER_NAME).toBe('aksel-arcade')
    expect(DESKTOP_MCP_SERVER_VERSION).toBe('0.0.0')
    expect(DESKTOP_MCP_TRANSPORT_LABEL).toBe('HTTP (MCP Streamable HTTP)')
    expect(DESKTOP_MCP_AUTH_DESCRIPTION).toBe('No token/header required.')
    expect(DESKTOP_MCP_PORT).toBe(3846)
    expect(DESKTOP_MCP_PATH).toBe('/mcp')
  })

  it('starts an SDK-backed endpoint that negotiates initialize through the official SDK', async () => {
    const server = createManagedServer()
    const state = await server.start()

    expect(state.availability).toEqual({ status: 'available' })
    expect(state.requiresAuth).toBe(false)
    expect(state.authDescription).toBe('No token/header required.')

    const url = new URL(state.url)
    const initialize = await postJsonRpc(url, {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: {
          name: 'vitest',
          version: '1.0.0',
        },
      },
    })

    expect(initialize.status).toBe(200)
    expect(initialize.payload).toMatchObject({
      jsonrpc: '2.0',
      id: 1,
      result: {
        serverInfo: {
          name: 'aksel-arcade',
          version: '0.0.0',
        },
        capabilities: {
          tools: {
            listChanged: false,
          },
          resources: {
            subscribe: false,
            listChanged: false,
          },
        },
        instructions: expect.stringContaining('Desktop Arcade is a live sandbox'),
      },
    })
    expect(
      (initialize.payload as { result: { instructions: string } }).result.instructions
    ).toContain('arcade://desktop/start-here')
    expect(
      (initialize.payload as { result: { protocolVersion: string } }).result.protocolVersion
    ).not.toBe('2024-11-05')
  })

  it('accepts repeated initialize requests without reusing a stateless transport', async () => {
    const server = createManagedServer()
    const state = await server.start()

    const url = new URL(state.url)
    const initializePayload = {
      jsonrpc: '2.0',
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: {
          name: 'vitest',
          version: '1.0.0',
        },
      },
    }

    const firstInitialize = await postJsonRpc(url, {
      ...initializePayload,
      id: 1,
    })
    const secondInitialize = await postJsonRpc(url, {
      ...initializePayload,
      id: 2,
    })

    expect(firstInitialize.status).toBe(200)
    expect(firstInitialize.payload).toMatchObject({
      jsonrpc: '2.0',
      id: 1,
      result: expect.any(Object),
    })
    expect(secondInitialize.status).toBe(200)
    expect(secondInitialize.payload).toMatchObject({
      jsonrpc: '2.0',
      id: 2,
      result: expect.any(Object),
    })
  })

  it('lists SDK-backed resources/templates and reads representative project resources', async () => {
    const server = createManagedServer({
      readProjectResource: createStubProjectResourceReadHandler(),
    })
    const state = await server.start()
    const url = new URL(state.url)

    const resourcesList = await postJsonRpc(url, {
      jsonrpc: '2.0',
      id: 3,
      method: 'resources/list',
    })
    expect(resourcesList.status).toBe(200)
    expect(resourcesList.payload).toMatchObject({
      jsonrpc: '2.0',
      id: 3,
      result: {
        resources: expect.any(Array),
      },
    })

    const listedUris = (
      resourcesList.payload as {
        result: { resources: Array<{ uri: string }> }
      }
    ).result.resources.map((resource) => resource.uri)
    expect(listedUris).toEqual(
      expect.arrayContaining([
        'arcade://desktop/start-here',
        'arcade://desktop/operating-guide',
        'arcade://desktop/authoring-guide',
        'arcade://desktop/capabilities',
        'arcade://desktop/apply-changes-operations',
        'arcade://aksel/catalog',
        'arcade://project/manifest',
        'arcade://project/annotations',
        'arcade://project/preview-context',
        'arcade://project/diagnostics',
        'arcade://project/source/global/jsx',
        'arcade://project/source/global/hooks',
        'arcade://project/source/pages/page01/jsx',
        'arcade://project/source/pages/page01/hooks',
        'arcade://project/pages/page01/annotations',
      ])
    )

    const resourceTemplatesList = await postJsonRpc(url, {
      jsonrpc: '2.0',
      id: 4,
      method: 'resources/templates/list',
    })
    expect(resourceTemplatesList.status).toBe(200)
    expect(resourceTemplatesList.payload).toMatchObject({
      jsonrpc: '2.0',
      id: 4,
      result: {
        resourceTemplates: expect.any(Array),
      },
    })
    expect(
      (
        resourceTemplatesList.payload as {
          result: { resourceTemplates: Array<{ uriTemplate: string }> }
        }
      ).result.resourceTemplates.map((template) => template.uriTemplate)
    ).toEqual(
      expect.arrayContaining([
        'arcade://project/source/pages/{pageId}/jsx',
        'arcade://project/source/pages/{pageId}/hooks',
        'arcade://project/pages/{pageId}/annotations',
        'arcade://aksel/components/{name}',
        'arcade://preview/captures/{captureId}/manifest',
      ])
    )

    const startHere = await postJsonRpc(url, {
      jsonrpc: '2.0',
      id: 5,
      method: 'resources/read',
      params: {
        uri: 'arcade://desktop/start-here',
      },
    })
    expect(startHere.status).toBe(200)
    expect(startHere.payload).toMatchObject({
      jsonrpc: '2.0',
      id: 5,
      result: {
        contents: [
          {
            uri: 'arcade://desktop/start-here',
            mimeType: 'text/markdown',
            text: expect.stringContaining('# Desktop Arcade MCP start-here'),
          },
        ],
      },
    })

    const capabilitiesResponse = await postJsonRpc(url, {
      jsonrpc: '2.0',
      id: 6,
      method: 'resources/read',
      params: {
        uri: 'arcade://desktop/capabilities',
      },
    })
    const capabilities = JSON.parse(
      (
        capabilitiesResponse.payload as {
          result: { contents: Array<{ text: string }> }
        }
      ).result.contents[0].text
    ) as {
      endpoint: string
      toolNames: string[]
      resourceTemplateUris: string[]
      omittedFeatures: string[]
    }
    expect(capabilities.endpoint).toBe(state.url)
    expect(capabilities.toolNames).toEqual(expectedToolNames)
    expect(capabilities.resourceTemplateUris).toEqual(
      expect.arrayContaining([
        'arcade://project/source/pages/{pageId}/jsx',
        'arcade://project/pages/{pageId}/annotations',
        'arcade://aksel/components/{name}',
      ])
    )
    expect(capabilities.omittedFeatures).toEqual(
      expect.arrayContaining(['No prompts surface.', 'No list-changed notifications.'])
    )

    const manifestResponse = await postJsonRpc(url, {
      jsonrpc: '2.0',
      id: 7,
      method: 'resources/read',
      params: {
        uri: 'arcade://project/manifest',
      },
    })
    const manifest = JSON.parse(
      (
        manifestResponse.payload as {
          result: { contents: Array<{ text: string }> }
        }
      ).result.contents[0].text
    ) as {
      activePageId: string
      pages: Array<{ id: string }>
    }
    expect(manifest.activePageId).toBe('page01')
    expect(manifest.pages).toEqual([{ id: 'page01', name: 'Landing', source: expect.any(Object) }])

    const pageJsxResponse = await postJsonRpc(url, {
      jsonrpc: '2.0',
      id: 8,
      method: 'resources/read',
      params: {
        uri: 'arcade://project/source/pages/page01/jsx',
      },
    })
    expect(pageJsxResponse.payload).toMatchObject({
      jsonrpc: '2.0',
      id: 8,
      result: {
        contents: [
          {
            uri: 'arcade://project/source/pages/page01/jsx',
            mimeType: 'text/plain',
            text: '<Page>Landing</Page>',
          },
        ],
      },
    })

    const invalidPageResource = await postJsonRpc(url, {
      jsonrpc: '2.0',
      id: 9,
      method: 'resources/read',
      params: {
        uri: 'arcade://project/pages/page99/annotations',
      },
    })
    expect(invalidPageResource.status).toBe(200)
    expect(invalidPageResource.payload).toMatchObject({
      jsonrpc: '2.0',
      id: 9,
      error: {
        code: -32602,
        data: {
          code: 'invalid-resource-uri',
          resourceUri: 'arcade://project/pages/page99/annotations',
        },
      },
    })
    expect(
      (
        invalidPageResource.payload as {
          error: { message: string }
        }
      ).error.message
    ).toContain('arcade://project/pages/page99/annotations')

    const toolsList = await postJsonRpc(url, {
      jsonrpc: '2.0',
      id: 10,
      method: 'tools/list',
    })
    expect(toolsList.status).toBe(200)
    expect(
      (
        toolsList.payload as {
          result: { tools: Array<{ name: string }> }
        }
      ).result.tools.map((tool) => tool.name)
    ).toEqual(expectedToolNames)
  })

  it('bridges read_resource, list_annotations, and watch_annotations through SDK tools', async () => {
    let pendingAnnotations: Array<Record<string, unknown>> = [
      {
        id: 'ann-1',
        status: 'pending',
        comment: 'Pending note',
      },
    ]
    const readProjectResource: DesktopMcpProjectResourceReadHandler = vi.fn(
      async ({ uri }): Promise<DesktopMcpProjectResourceReadResult> => {
      switch (uri) {
        case 'arcade://project/manifest':
          return {
            ok: true as const,
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({
              activePageId: 'page01',
              pages: [{ id: 'page01', name: 'Overview' }],
            }),
          }
        case 'arcade://project/annotations':
          return {
            ok: true as const,
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({
              counts: { open: 1, pending: 1, acknowledged: 0, resolved: 2, dismissed: 1 },
              annotations: [
                { id: 'ann-1', status: 'pending' },
                { id: 'ann-2', status: 'resolved' },
                { id: 'ann-3', status: 'dismissed' },
              ],
            }),
          }
        case 'arcade://project/pages/page01/annotations':
          return {
            ok: true as const,
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({
              page: { id: 'page01', name: 'Overview' },
              counts: {
                open: pendingAnnotations.length,
                pending: pendingAnnotations.length,
                acknowledged: 0,
                resolved: 0,
                dismissed: 0,
              },
              annotations: pendingAnnotations,
            }),
          }
        default:
          return {
            ok: false as const,
            code: 'source-not-found',
            resourceUri: uri,
            message: `Missing ${uri}`,
          }
      }
      }
    )
    const server = createManagedServer({ port: 0, readProjectResource })
    const state = await server.start()
    const url = new URL(state.url)

    const readResourceResponse = await postJsonRpc(url, {
      jsonrpc: '2.0',
      id: 11,
      method: 'tools/call',
      params: {
        name: 'read_resource',
        arguments: {
          uri: 'arcade://desktop/start-here',
        },
      },
    })
    expect(readResourceResponse.status).toBe(200)
    expect(readResourceResponse.payload).toMatchObject({
      jsonrpc: '2.0',
      id: 11,
      result: {
        structuredContent: {
          ok: true,
          uri: 'arcade://desktop/start-here',
          mimeType: 'text/markdown',
          text: expect.stringContaining('# Desktop Arcade MCP start-here'),
        },
      },
    })

    const readResourceDomainError = await postJsonRpc(url, {
      jsonrpc: '2.0',
      id: 12,
      method: 'tools/call',
      params: {
        name: 'read_resource',
        arguments: {
          uri: 'arcade://desktop/not-a-resource',
        },
      },
    })
    expect(readResourceDomainError.status).toBe(200)
    expect(readResourceDomainError.payload).toMatchObject({
      jsonrpc: '2.0',
      id: 12,
      result: {
        isError: true,
        structuredContent: {
          code: 'resource-not-found',
          toolName: 'read_resource',
          resourceUri: 'arcade://desktop/not-a-resource',
        },
      },
    })

    const listAnnotationsResponse = await postJsonRpc(url, {
      jsonrpc: '2.0',
      id: 13,
      method: 'tools/call',
      params: {
        name: 'list_annotations',
        arguments: {},
      },
    })
    expect(listAnnotationsResponse.status).toBe(200)
    expect(listAnnotationsResponse.payload).toMatchObject({
      jsonrpc: '2.0',
      id: 13,
      result: {
        structuredContent: {
          ok: true,
          scope: 'page',
          status: 'open',
          resourceUri: 'arcade://project/pages/page01/annotations',
          annotations: [{ id: 'ann-1', status: 'pending', comment: 'Pending note' }],
        },
      },
    })

    const projectAnnotationsResponse = await postJsonRpc(url, {
      jsonrpc: '2.0',
      id: 14,
      method: 'tools/call',
      params: {
        name: 'list_annotations',
        arguments: {
          scope: 'project',
          status: 'resolved',
        },
      },
    })
    expect(projectAnnotationsResponse.status).toBe(200)
    expect(projectAnnotationsResponse.payload).toMatchObject({
      jsonrpc: '2.0',
      id: 14,
      result: {
        structuredContent: {
          ok: true,
          scope: 'project',
          status: 'resolved',
          resourceUri: 'arcade://project/annotations',
          annotations: [{ id: 'ann-2', status: 'resolved' }],
        },
      },
    })

    const watchImmediateResponse = await postJsonRpc(url, {
      jsonrpc: '2.0',
      id: 15,
      method: 'tools/call',
      params: {
        name: 'watch_annotations',
        arguments: {
          scope: 'page',
          waitTimeoutSeconds: 1,
          batchWindowSeconds: 1,
        },
      },
    })
    expect(watchImmediateResponse.status).toBe(200)
    expect(watchImmediateResponse.payload).toMatchObject({
      jsonrpc: '2.0',
      id: 15,
      result: {
        structuredContent: {
          ok: true,
          scope: 'page',
          status: 'pending',
          timedOut: false,
          annotations: [{ id: 'ann-1', status: 'pending', comment: 'Pending note' }],
        },
      },
    })

    pendingAnnotations = []
    setTimeout(() => {
      pendingAnnotations = [{ id: 'ann-2', status: 'pending', comment: 'Arrived later' }]
    }, 250)

    const watchDelayedResponse = await postJsonRpc(url, {
      jsonrpc: '2.0',
      id: 16,
      method: 'tools/call',
      params: {
        name: 'watch_annotations',
        arguments: {
          scope: 'page',
          waitTimeoutSeconds: 2,
          batchWindowSeconds: 1,
        },
      },
    })
    expect(watchDelayedResponse.status).toBe(200)
    expect(watchDelayedResponse.payload).toMatchObject({
      jsonrpc: '2.0',
      id: 16,
      result: {
        structuredContent: {
          ok: true,
          scope: 'page',
          status: 'pending',
          timedOut: false,
          annotations: [{ id: 'ann-2', status: 'pending', comment: 'Arrived later' }],
        },
      },
    })
  })

  it('routes capture_preview_evidence through the SDK tool layer and preserves expiring capture resources', async () => {
    const capturePreviewEvidence = vi.fn<DesktopMcpPreviewCaptureHandler>().mockResolvedValue({
      ok: true,
      summary:
        'Captured Details (page02) in dark MD preview with screenshot, accessibility, DOM/layout/style and frame evidence (region).',
      captureId: 'capture-demo',
      manifestResourceUri: 'arcade://preview/captures/capture-demo/manifest',
      producedResources: [
        'arcade://preview/captures/capture-demo/manifest',
        'arcade://preview/captures/capture-demo/screenshot',
        'arcade://preview/captures/capture-demo/accessibility',
        'arcade://preview/captures/capture-demo/dom-layout-style',
        'arcade://preview/captures/capture-demo/frame',
      ],
      page: {
        id: 'page02',
        name: 'Details',
      },
      requestedLayers: ['screenshot', 'accessibility', 'dom_layout_style', 'frame'],
      producedLayers: ['screenshot', 'accessibility', 'dom_layout_style', 'frame'],
      layerResources: {
        screenshot: 'arcade://preview/captures/capture-demo/screenshot',
        accessibility: 'arcade://preview/captures/capture-demo/accessibility',
        dom_layout_style: 'arcade://preview/captures/capture-demo/dom-layout-style',
        frame: 'arcade://preview/captures/capture-demo/frame',
      },
      resources: [
        {
          uri: 'arcade://preview/captures/capture-demo/manifest',
          mimeType: 'application/json',
          text: '{"captureId":"capture-demo"}',
        },
        {
          uri: 'arcade://preview/captures/capture-demo/screenshot',
          mimeType: 'image/svg+xml',
          text: '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
        },
        {
          uri: 'arcade://preview/captures/capture-demo/accessibility',
          mimeType: 'application/json',
          text: '{"rootSelector":"#root","nodeCount":2,"truncated":false}',
        },
        {
          uri: 'arcade://preview/captures/capture-demo/dom-layout-style',
          mimeType: 'application/json',
          text: '{"rootSelector":"#root","capturedElementCount":4,"truncated":false}',
        },
        {
          uri: 'arcade://preview/captures/capture-demo/frame',
          mimeType: 'application/json',
          text: '{"page":{"id":"page02"}}',
        },
      ],
      safeActivity: {
        toolName: 'capture_preview_evidence',
        operationTypes: ['screenshot', 'accessibility', 'dom_layout_style', 'frame'],
        timestamp: '2026-06-16T12:30:00.000Z',
      },
    })
    const server = createManagedServer({
      port: 0,
      readProjectResource: createStubProjectResourceReadHandler(),
      capturePreviewEvidence,
    })
    const state = await server.start()
    const url = new URL(state.url)

    const toolResponse = await postJsonRpc(url, {
      jsonrpc: '2.0',
      id: 17,
      method: 'tools/call',
      params: {
        name: 'capture_preview_evidence',
        arguments: {
          pageId: 'page02',
          viewportSize: 'MD',
          layers: ['screenshot', 'accessibility', 'dom_layout_style', 'frame'],
          screenshotScope: 'region',
          includeAnnotationOverlays: true,
          target: {
            role: 'button',
            name: 'Continue',
          },
          interactions: [
            {
              action: 'click',
              target: {
                role: 'button',
                name: 'Continue',
              },
            },
          ],
        },
      },
    })
    expect(toolResponse.status).toBe(200)
    expect(toolResponse.payload).toMatchObject({
      jsonrpc: '2.0',
      id: 17,
      result: {
        structuredContent: {
          ok: true,
          captureId: 'capture-demo',
          manifestResourceUri: 'arcade://preview/captures/capture-demo/manifest',
          layerResources: {
            screenshot: 'arcade://preview/captures/capture-demo/screenshot',
          },
        },
      },
    })

    const screenshotResponse = await postJsonRpc(url, {
      jsonrpc: '2.0',
      id: 18,
      method: 'resources/read',
      params: {
        uri: 'arcade://preview/captures/capture-demo/screenshot',
      },
    })
    expect(screenshotResponse.status).toBe(200)
    expect(screenshotResponse.payload).toMatchObject({
      jsonrpc: '2.0',
      id: 18,
      result: {
        contents: [
          {
            uri: 'arcade://preview/captures/capture-demo/screenshot',
            mimeType: 'image/svg+xml',
          },
        ],
      },
    })

    const invalidArgumentsResponse = await postJsonRpc(url, {
      jsonrpc: '2.0',
      id: 19,
      method: 'tools/call',
      params: {
        name: 'capture_preview_evidence',
        arguments: {
          interactions: [
            {
              action: 'waitFor',
              text: 'Loaded',
              renderIdle: true,
            },
          ],
        },
      },
    })
    expect(invalidArgumentsResponse.status).toBe(200)
    expect(invalidArgumentsResponse.payload).toMatchObject({
      jsonrpc: '2.0',
      id: 19,
      result: {
        isError: true,
        content: [
          {
            type: 'text',
            text: expect.stringContaining(
              'capture_preview_evidence interactions[0] waitFor steps require exactly one of text, target, or renderIdle.'
            ),
          },
        ],
      },
    })
  })

  it('routes SDK mutation tools through the injected renderer handlers', async () => {
    const mutateAnnotation = vi.fn<DesktopMcpAnnotationMutationHandler>().mockImplementation(
      async (request) => {
        const statusByToolName = {
          acknowledge_annotation: 'acknowledged',
          resolve_annotation: 'resolved',
          dismiss_annotation: 'dismissed',
          reply_to_annotation: 'pending',
        } as const satisfies Record<
          Parameters<DesktopMcpAnnotationMutationHandler>[0]['toolName'],
          AnnotationStatus
        >
        const annotation = createMockAnnotation(request.annotationId, statusByToolName[request.toolName])
        return {
          ok: true,
          toolName: request.toolName,
          annotationId: request.annotationId,
          pageId: 'page01',
          message: `${request.toolName} updated ${request.annotationId}.`,
          annotation,
          annotations: [annotation],
        }
      }
    )
    const applyChanges = vi
      .fn<DesktopMcpApplyChangesHandler>()
      .mockResolvedValueOnce({
        ok: true,
        summary: 'Create a landing page',
        projectRevision: 'rev-1234abcd',
        changedResources: [
          'arcade://project/manifest',
          'arcade://project/source/pages/page02/jsx',
          'arcade://project/source/pages/page02/hooks',
        ],
        nextRecommendedResources: [
          'arcade://project/manifest',
          'arcade://project/diagnostics',
          'arcade://project/source/pages/page02/jsx',
          'arcade://project/source/pages/page02/hooks',
        ],
        operationResults: [
          {
            index: 0,
            type: 'create_page',
            pageId: 'page02',
            name: 'Page 2',
            newPageRef: 'landing',
            sourceResources: {
              jsxResourceUri: 'arcade://project/source/pages/page02/jsx',
              hooksResourceUri: 'arcade://project/source/pages/page02/hooks',
            },
          },
          {
            index: 1,
            type: 'select_active_page',
            pageId: 'page02',
          },
        ],
        postChangeSummary: {
          pageCount: 2,
          startPageId: 'page01',
          activePageId: 'page02',
          pages: [
            {
              id: 'page01',
              name: 'Page 1',
              sourceResources: {
                jsxResourceUri: 'arcade://project/source/pages/page01/jsx',
                hooksResourceUri: 'arcade://project/source/pages/page01/hooks',
              },
            },
            {
              id: 'page02',
              name: 'Landing',
              sourceResources: {
                jsxResourceUri: 'arcade://project/source/pages/page02/jsx',
                hooksResourceUri: 'arcade://project/source/pages/page02/hooks',
              },
            },
          ],
          warnings: [],
        },
        tempPageRefMappings: {
          landing: {
            pageId: 'page02',
            sourceResources: {
              jsxResourceUri: 'arcade://project/source/pages/page02/jsx',
              hooksResourceUri: 'arcade://project/source/pages/page02/hooks',
            },
          },
        },
        safeActivity: {
          toolName: 'apply_changes',
          operationTypes: ['create_page', 'select_active_page'],
          timestamp: '2026-06-16T12:00:00.000Z',
        },
      })
      .mockResolvedValueOnce({
        ok: false,
        code: 'persistence-failed',
        message: 'Working copy save failed.',
      })
    const server = createManagedServer({
      port: 0,
      mutateAnnotation,
      applyChanges,
    })
    const state = await server.start()
    const url = new URL(state.url)

    const toolsList = await postJsonRpc(url, {
      jsonrpc: '2.0',
      id: 20,
      method: 'tools/list',
    })
    expect(
      (
        toolsList.payload as {
          result: { tools: Array<{ name: string }> }
        }
      ).result.tools.map((tool) => tool.name)
    ).toEqual(expectedToolNames)

    const acknowledgeResponse = await postJsonRpc(url, {
      jsonrpc: '2.0',
      id: 21,
      method: 'tools/call',
      params: {
        name: 'acknowledge_annotation',
        arguments: {
          annotationId: 'ann-1',
        },
      },
    })
    expect(acknowledgeResponse.status).toBe(200)
    expect(acknowledgeResponse.payload).toMatchObject({
      jsonrpc: '2.0',
      id: 21,
      result: {
        structuredContent: {
          ok: true,
          toolName: 'acknowledge_annotation',
          annotationId: 'ann-1',
        },
      },
    })
    expect(mutateAnnotation).toHaveBeenCalledWith({
      toolName: 'acknowledge_annotation',
      annotationId: 'ann-1',
    })

    for (const [toolName, argumentsPayload] of [
      ['resolve_annotation', { annotationId: 'ann-1', summary: 'Done' }],
      ['dismiss_annotation', { annotationId: 'ann-1', reason: 'Not needed' }],
      ['reply_to_annotation', { annotationId: 'ann-1', message: 'Thanks' }],
    ] as const) {
      const response = await postJsonRpc(url, {
        jsonrpc: '2.0',
        id: toolName,
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: argumentsPayload,
        },
      })
      expect(response.status).toBe(200)
      expect(response.payload).toMatchObject({
        jsonrpc: '2.0',
        id: toolName,
        result: {
          structuredContent: {
            ok: true,
            toolName,
            annotationId: 'ann-1',
          },
        },
      })
      expect(mutateAnnotation).toHaveBeenCalledWith({
        toolName,
        ...argumentsPayload,
      })
    }

    mutateAnnotation.mockResolvedValueOnce({
      ok: false,
      code: 'persistence-failed',
      annotationId: 'ann-1',
      message: 'Annotation save failed.',
    })
    const acknowledgeFailure = await postJsonRpc(url, {
      jsonrpc: '2.0',
      id: 212,
      method: 'tools/call',
      params: {
        name: 'acknowledge_annotation',
        arguments: {
          annotationId: 'ann-1',
        },
      },
    })
    expect(acknowledgeFailure.status).toBe(200)
    expect(acknowledgeFailure.payload).toMatchObject({
      jsonrpc: '2.0',
      id: 212,
      result: {
        isError: true,
        structuredContent: {
          code: 'persistence-failed',
          toolName: 'acknowledge_annotation',
          annotationId: 'ann-1',
          message: 'Annotation save failed.',
        },
      },
    })

    const applyChangesSuccess = await postJsonRpc(url, {
      jsonrpc: '2.0',
      id: 22,
      method: 'tools/call',
      params: {
        name: 'apply_changes',
        arguments: {
          summary: 'Create a landing page',
          operations: [
            {
              type: 'create_page',
              newPageRef: 'landing',
              jsxCode: 'export default function LandingPage() { return <div>Landing</div> }',
            },
            {
              type: 'select_active_page',
              tempPageRef: 'landing',
            },
          ],
        },
      },
    })
    expect(applyChangesSuccess.status).toBe(200)
    expect(applyChangesSuccess.payload).toMatchObject({
      jsonrpc: '2.0',
      id: 22,
      result: {
        structuredContent: {
          ok: true,
          summary: 'Create a landing page',
          nextSteps: [
            'Read arcade://project/diagnostics to confirm the batch is healthy.',
            'Run capture_preview_evidence({ pageId }) to inspect the rendered result.',
          ],
        },
      },
    })

    const applyChangesFailure = await postJsonRpc(url, {
      jsonrpc: '2.0',
      id: 23,
      method: 'tools/call',
      params: {
        name: 'apply_changes',
        arguments: {
          summary: 'Retry with stale revision',
          expectedProjectRevision: 'rev-old',
          operations: [
            {
              type: 'rename_project',
              name: 'Renamed project',
            },
          ],
        },
      },
    })
    expect(applyChangesFailure.status).toBe(200)
    expect(applyChangesFailure.payload).toMatchObject({
      jsonrpc: '2.0',
      id: 23,
      result: {
        isError: true,
        structuredContent: {
          code: 'persistence-failed',
          toolName: 'apply_changes',
          message: 'Working copy save failed.',
        },
      },
    })
  })

  it('reports an explicit unavailable reason when the fixed port is already occupied', async () => {
    const occupiedServer = await listenOnPort(0)
    occupiedServers.push(occupiedServer)
    const occupiedAddress = occupiedServer.address()
    const occupiedPort =
      occupiedAddress && typeof occupiedAddress !== 'string' ? occupiedAddress.port : 0

    const server = createManagedServer({ port: occupiedPort })
    const state = await server.start()
    expect(state.availability).toEqual({
      status: 'unavailable',
      reason: `Port ${occupiedPort} on 127.0.0.1 is already in use.`,
    })
  })
})

const postJsonRpc = async (url: URL, payload: Record<string, unknown>) => {
  return new Promise<{ status: number; payload: Record<string, unknown> }>((resolve, reject) => {
    const req = request(
      url,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
        },
      },
      (response) => {
        const chunks: Buffer[] = []
        response.on('data', (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
        })
        response.on('end', () => {
          resolve({
            status: response.statusCode ?? 0,
            payload: parseJsonOrSse(Buffer.concat(chunks).toString('utf8')),
          })
        })
        response.on('error', reject)
      }
    )

    req.on('error', reject)
    req.end(JSON.stringify(payload))
  })
}

const parseJsonOrSse = (bodyText: string) => {
  if (!bodyText.startsWith('event:')) {
    return JSON.parse(bodyText) as Record<string, unknown>
  }

  const dataLines = bodyText
    .split('\n')
    .filter((line) => line.startsWith('data: '))
    .map((line) => line.slice('data: '.length))

  return JSON.parse(dataLines.join('\n')) as Record<string, unknown>
}

const listenOnPort = (port: number) =>
  new Promise<Server>((resolve, reject) => {
    const server = createServer((_request, response) => {
      response.statusCode = 200
      response.end('occupied')
    })
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => resolve(server))
  })

const closeHttpServer = (server: Server) =>
  new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error)
        return
      }
      resolve()
    })
  })

const createStubProjectResourceReadHandler = (): DesktopMcpProjectResourceReadHandler => {
  const resources = new Map<string, { mimeType: string; text: string }>([
    [
      'arcade://project/manifest',
      {
        mimeType: 'application/json',
        text: JSON.stringify({
          name: 'Resource test project',
          projectRevision: 'rev-resource-test',
          activePageId: 'page01',
          globalConfig: {
            source: {
              jsx: { uri: 'arcade://project/source/global/jsx' },
              hooks: { uri: 'arcade://project/source/global/hooks' },
            },
          },
          pages: [
            {
              id: 'page01',
              name: 'Landing',
              source: {
                jsx: { uri: 'arcade://project/source/pages/page01/jsx' },
                hooks: { uri: 'arcade://project/source/pages/page01/hooks' },
              },
            },
          ],
        }),
      },
    ],
    [
      'arcade://project/annotations',
      {
        mimeType: 'application/json',
        text: JSON.stringify({
          scope: 'project',
          annotations: [],
        }),
      },
    ],
    [
      'arcade://project/preview-context',
      {
        mimeType: 'application/json',
        text: JSON.stringify({
          viewportSize: 'MD',
          theme: 'light',
        }),
      },
    ],
    [
      'arcade://project/diagnostics',
      {
        mimeType: 'application/json',
        text: JSON.stringify({
          status: 'idle',
          issues: [],
        }),
      },
    ],
    [
      'arcade://project/source/global/jsx',
      {
        mimeType: 'text/plain',
        text: '<Theme>{children}</Theme>',
      },
    ],
    [
      'arcade://project/source/global/hooks',
      {
        mimeType: 'text/plain',
        text: 'const noop = () => {}',
      },
    ],
    [
      'arcade://project/source/pages/page01/jsx',
      {
        mimeType: 'text/plain',
        text: '<Page>Landing</Page>',
      },
    ],
    [
      'arcade://project/source/pages/page01/hooks',
      {
        mimeType: 'text/plain',
        text: 'const [open, setOpen] = useState(false)',
      },
    ],
    [
      'arcade://project/pages/page01/annotations',
      {
        mimeType: 'application/json',
        text: JSON.stringify({
          scope: 'page',
          page: {
            id: 'page01',
            name: 'Landing',
            isActive: true,
          },
          annotations: [],
        }),
      },
    ],
  ])

  return async ({ uri }) => {
    const resource = resources.get(uri)
    if (!resource) {
      return {
        ok: false,
        code: 'invalid-resource-uri',
        resourceUri: uri,
        message: `Unknown project resource "${uri}".`,
      }
    }

    return {
      ok: true,
      uri,
      mimeType: resource.mimeType,
      text: resource.text,
    }
  }
}
