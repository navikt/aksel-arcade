import { createServer, type Server } from 'node:http'
import { createRequire } from 'node:module'
import { afterEach, describe, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)
const {
  DESKTOP_MCP_PATH,
  DESKTOP_MCP_PORT,
  DESKTOP_MCP_SERVER_NAME,
  DESKTOP_MCP_SERVER_VERSION,
  DESKTOP_MCP_TRANSPORT_LABEL,
  createDesktopMcpServer,
}: {
  DESKTOP_MCP_PATH: string
  DESKTOP_MCP_PORT: number
  DESKTOP_MCP_SERVER_NAME: string
  DESKTOP_MCP_SERVER_VERSION: string
  DESKTOP_MCP_TRANSPORT_LABEL: string
  createDesktopMcpServer: (
    options?: Partial<{
      host: string
      port: number
      path: string
      readProjectResource: (request: { uri: string }) => ProjectResourceReadResult | Promise<ProjectResourceReadResult>
      applyChanges: (
        request: Record<string, unknown>
      ) => ApplyChangesResult | Promise<ApplyChangesResult>
      capturePreviewEvidence: (
        request: Record<string, unknown>
      ) => CapturePreviewResult | Promise<CapturePreviewResult>
      previewCaptureTtlMs: number
    }>
  ) => DesktopMcpServer
} = require('../../../desktop/mcpServer.cjs')

interface DesktopMcpServerState {
  serverName: string
  transportLabel: string
  url: string
  requiresAuth: false
  authDescription: string
  availability: { status: 'available' } | { status: 'unavailable'; reason: string }
  lastActivity?: {
    toolName: 'apply_changes' | 'capture_preview_evidence'
    operationTypes?: string[]
    timestamp: string
  } | null
}

interface DesktopMcpServer {
  getState: () => DesktopMcpServerState
  start: () => Promise<DesktopMcpServerState>
  stop: () => Promise<boolean>
}

interface ProjectResourceReadSuccess {
  ok: true
  uri: string
  mimeType: string
  text: string
}

interface ProjectResourceReadFailure {
  ok: false
  code: 'project-unavailable' | 'source-not-found' | 'invalid-resource-uri'
  resourceUri: string
  message: string
}

type ProjectResourceReadResult = ProjectResourceReadSuccess | ProjectResourceReadFailure

interface ApplyChangesSuccess {
  ok: true
  summary: string
  projectRevision: string
  changedResources: string[]
  nextRecommendedResources: string[]
  operationResults: Array<Record<string, unknown>>
  postChangeSummary: {
    pageCount: number
    startPageId: string
    activePageId: string
    pages: Array<Record<string, unknown>>
    warnings: string[]
  }
  tempPageRefMappings?: Record<
    string,
    {
      pageId: string
      sourceResources: {
        jsxResourceUri: string
        hooksResourceUri: string
      }
    }
  >
  safeActivity: {
    toolName: 'apply_changes'
    operationTypes?: string[]
    timestamp: string
  }
}

interface ApplyChangesFailure {
  ok: false
  code:
    | 'project-unavailable'
    | 'invalid-operation'
    | 'stale-project-revision'
    | 'invalid-operation-target'
    | 'invalid-project-name'
    | 'payload-too-large'
    | 'assertion-failed'
    | 'persistence-failed'
  message: string
  manifestResourceUri?: string
  resourceUri?: string
  expectedProjectRevision?: string
  currentProjectRevision?: string
}

type ApplyChangesResult = ApplyChangesSuccess | ApplyChangesFailure

interface CapturePreviewSuccess {
  ok: true
  summary: string
  captureId: string
  manifestResourceUri: string
  producedResources: string[]
  page: {
    id: string
    name: string
  }
  requestedLayers: string[]
  producedLayers: string[]
  layerResources: {
    screenshot?: string
    accessibility?: string
    dom_layout_style?: string
    frame?: string
  }
  interactions?: {
    requested: Array<Record<string, unknown>>
    executed: Array<Record<string, unknown>>
    failedStep?: Record<string, unknown>
  }
  resources: Array<{
    uri: string
    mimeType: string
    text: string
  }>
  safeActivity: {
    toolName: 'capture_preview_evidence'
    operationTypes?: string[]
    timestamp: string
  }
}

interface CapturePreviewFailure {
  ok: false
  code:
    | 'project-unavailable'
    | 'invalid-page-id'
    | 'invalid-capture-target'
    | 'render-timeout'
    | 'render-failed'
  message: string
  manifestResourceUri?: string
  interactions?: {
    requested: Array<Record<string, unknown>>
    executed: Array<Record<string, unknown>>
    failedStep?: Record<string, unknown>
  }
  currentPageId?: string | null
}

type CapturePreviewResult = CapturePreviewSuccess | CapturePreviewFailure

const activeServers: DesktopMcpServer[] = []
const occupiedServers: Server[] = []

const createManagedServer = (
  options?: Partial<{
    host: string
    port: number
    path: string
    readProjectResource: (request: { uri: string }) => ProjectResourceReadResult | Promise<ProjectResourceReadResult>
    applyChanges: (request: Record<string, unknown>) => ApplyChangesResult | Promise<ApplyChangesResult>
    capturePreviewEvidence: (
      request: Record<string, unknown>
    ) => CapturePreviewResult | Promise<CapturePreviewResult>
    previewCaptureTtlMs: number
  }>
): DesktopMcpServer => {
  const server = createDesktopMcpServer(options)
  activeServers.push(server)
  return server
}

describe('desktopMcpServer', () => {
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
    expect(DESKTOP_MCP_PORT).toBe(3846)
    expect(DESKTOP_MCP_PATH).toBe('/mcp')
  })

  it('reports available when the MCP endpoint is listening and accepts MCP initialize', async () => {
    const server = createManagedServer({ port: 0 })

    const state = await server.start()

    expect(state.availability).toEqual({ status: 'available' })
    expect(state.requiresAuth).toBe(false)
    expect(state.authDescription).toBe('No token/header required.')

    const url = new URL(state.url)
    expect(url.hostname).toBe('127.0.0.1')
    expect(url.pathname).toBe('/mcp')
    expect(Number(url.port)).toBeGreaterThan(0)

    const response = await postJson(state.url, {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'test-client',
          version: '1.0.0',
        },
      },
    })

    expect(response.status).toBe(200)
    const initializePayload = await response.json()
    expect(initializePayload).toMatchObject({
      jsonrpc: '2.0',
      id: 1,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
          resources: {},
        },
        serverInfo: {
          name: 'aksel-arcade',
          version: '0.0.0',
        },
        instructions: expect.stringContaining('Desktop Arcade is a live sandbox'),
      },
    })
    expect(initializePayload.result.instructions).toContain('goToPage')
    expect(initializePayload.result.instructions).toContain('import-free')
    expect(initializePayload.result.instructions).toContain('arcade://desktop/authoring-guide')
  })

  it('lists the v1 MCP tools and stable direct resources', async () => {
    const server = createManagedServer({ port: 0 })
    const state = await server.start()

    const toolsResponse = await postJson(state.url, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {
        _meta: {
          progressToken: 'tools-progress',
        },
      },
    })
    expect(toolsResponse.status).toBe(200)

    await expect(toolsResponse.json()).resolves.toMatchObject({
      jsonrpc: '2.0',
      id: 2,
      result: {
        tools: [
          {
           name: 'read_resource',
            inputSchema: {
             additionalProperties: false,
           },
         },
         {
           name: 'capture_preview_evidence',
           inputSchema: {
              additionalProperties: false,
            },
          },
          {
            name: 'apply_changes',
            inputSchema: {
              additionalProperties: false,
            },
          },
        ],
      },
    })

    const resourcesResponse = await postJson(state.url, {
      jsonrpc: '2.0',
      id: 3,
      method: 'resources/list',
      params: {
        _meta: {
          progressToken: 'resources-progress',
        },
      },
    })
    const resourcesPayload = await resourcesResponse.json()

    expect(resourcesResponse.status).toBe(200)
    expect(resourcesPayload.result.resources.map((resource: { uri: string }) => resource.uri)).toEqual([
      'arcade://desktop/start-here',
      'arcade://desktop/workflows/replace-project',
      'arcade://desktop/workflows/multi-page-navigation',
      'arcade://desktop/operating-guide',
      'arcade://desktop/authoring-guide',
      'arcade://desktop/capabilities',
      'arcade://desktop/apply-changes-operations',
      'arcade://aksel/catalog',
      'arcade://project/manifest',
      'arcade://project/preview-context',
      'arcade://project/diagnostics',
    ])
  })

  it('lists read_resource for tool-only hosts and reads stable resources through it', async () => {
    const server = createManagedServer({ port: 0 })
    const state = await server.start()

    const toolsResponse = await postJson(state.url, {
      jsonrpc: '2.0',
      id: 31,
      method: 'tools/list',
    })
    expect(toolsResponse.status).toBe(200)
    const toolsPayload = await toolsResponse.json()
    expect(toolsPayload.result.tools.map((tool: { name: string }) => tool.name)).toEqual([
      'read_resource',
      'capture_preview_evidence',
      'apply_changes',
    ])

    const readResourceResponse = await postJson(state.url, {
      jsonrpc: '2.0',
      id: 32,
      method: 'tools/call',
      params: {
        name: 'read_resource',
        arguments: {
          uri: 'arcade://desktop/start-here',
        },
      },
    })
    expect(readResourceResponse.status).toBe(200)
    await expect(readResourceResponse.json()).resolves.toEqual({
      jsonrpc: '2.0',
      id: 32,
      result: {
        content: [
          {
            type: 'text',
            text: 'Read Desktop Arcade MCP resource arcade://desktop/start-here (text/markdown).',
          },
        ],
        structuredContent: {
          ok: true,
          uri: 'arcade://desktop/start-here',
          mimeType: 'text/markdown',
          text: expect.stringContaining('# Desktop Arcade MCP start-here'),
        },
      },
    })
  })

  it('returns 202 for initialized notifications and keeps unsupported MCP surfaces undiscoverable', async () => {
    const server = createManagedServer({ port: 0 })
    const state = await server.start()

    const notificationResponse = await postJson(state.url, {
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    })
    expect(notificationResponse.status).toBe(202)
    expect(await notificationResponse.text()).toBe('')

    const malformedNotificationResponse = await postJson(state.url, {
      jsonrpc: '2.0',
      method: 'notifications/initialized',
      params: 'unexpected',
    })
    expect(malformedNotificationResponse.status).toBe(202)
    expect(await malformedNotificationResponse.text()).toBe('')

    const promptsResponse = await postJson(state.url, {
      jsonrpc: '2.0',
      id: 4,
      method: 'prompts/list',
    })
    expect(promptsResponse.status).toBe(200)
    await expect(promptsResponse.json()).resolves.toEqual({
      jsonrpc: '2.0',
      id: 4,
      error: {
        code: -32601,
        message: 'Desktop Arcade MCP method "prompts/list" is not supported in v1.',
      },
    })
  })

  it('returns structured project-unavailable failures for capture_preview_evidence and rejects unknown tools or unsupported fields', async () => {
    const server = createManagedServer({ port: 0 })
    const state = await server.start()

    const knownToolResponse = await postJson(state.url, {
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: {
        name: 'capture_preview_evidence',
        arguments: {
          pageId: 'page01',
          viewportSize: 'MD',
        },
        _meta: {
          progressToken: 'tool-progress',
        },
      },
    })
    expect(knownToolResponse.status).toBe(200)
    await expect(knownToolResponse.json()).resolves.toEqual({
      jsonrpc: '2.0',
      id: 5,
      result: {
        content: [
          {
            type: 'text',
            text:
              'Desktop Arcade MCP capture_preview_evidence is unavailable because no active preview capture bridge is connected.',
          },
        ],
        isError: true,
        structuredContent: {
          code: 'project-unavailable',
          toolName: 'capture_preview_evidence',
          message:
            'Desktop Arcade MCP capture_preview_evidence is unavailable because no active preview capture bridge is connected.',
        },
      },
    })

    const unknownToolResponse = await postJson(state.url, {
      jsonrpc: '2.0',
      id: 6,
      method: 'tools/call',
      params: {
        name: 'unknown_tool',
      },
    })
    expect(unknownToolResponse.status).toBe(200)
    await expect(unknownToolResponse.json()).resolves.toEqual({
      jsonrpc: '2.0',
      id: 6,
      error: {
        code: -32602,
        message: 'Unknown Desktop Arcade MCP tool "unknown_tool".',
        data: {
          code: 'unknown-tool',
          toolName: 'unknown_tool',
        },
      },
    })

    const invalidToolFieldResponse = await postJson(state.url, {
      jsonrpc: '2.0',
      id: 7,
      method: 'tools/call',
      params: {
        name: 'capture_preview_evidence',
        arguments: {
          surprise: true,
        },
      },
    })
    expect(invalidToolFieldResponse.status).toBe(200)
    await expect(invalidToolFieldResponse.json()).resolves.toEqual({
      jsonrpc: '2.0',
      id: 7,
      error: {
        code: -32602,
        message: 'capture_preview_evidence arguments contain unsupported fields: surprise.',
        data: {
          code: 'invalid-tool-arguments',
          toolName: 'capture_preview_evidence',
        },
      },
    })
  })

  it('routes capture_preview_evidence through the injected preview capture bridge and serves expiring resources', async () => {
    const capturePreviewEvidence = vi
      .fn<(request: Record<string, unknown>) => Promise<CapturePreviewResult>>()
      .mockResolvedValue({
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
        interactions: {
          requested: [
            {
              action: 'click',
              target: {
                role: 'button',
                name: 'Continue',
              },
            },
          ],
          executed: [
            {
              index: 0,
              step: {
                action: 'click',
                target: {
                  role: 'button',
                  name: 'Continue',
                },
              },
              targetDescription: 'role=button name="Continue"',
            },
          ],
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
            text: '{"rootSelector":"#root","nodeCount":2,"truncated":false,"nodes":[{"role":"heading","name":"Details","level":1}]}',
          },
          {
            uri: 'arcade://preview/captures/capture-demo/dom-layout-style',
            mimeType: 'application/json',
            text: '{"rootSelector":"#root","capturedElementCount":4,"truncated":false,"tree":{"tagName":"div"}}',
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
      capturePreviewEvidence,
      previewCaptureTtlMs: 50,
    })
    const state = await server.start()

    const toolResponse = await postJson(state.url, {
      jsonrpc: '2.0',
      id: 61,
      method: 'tools/call',
      params: {
        name: 'capture_preview_evidence',
        arguments: {
          pageId: 'page02',
          viewportSize: 'MD',
          layers: ['screenshot', 'accessibility', 'dom_layout_style', 'frame'],
          screenshotScope: 'region',
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
    await expect(toolResponse.json()).resolves.toEqual({
      jsonrpc: '2.0',
      id: 61,
      result: {
        content: [
          {
            type: 'text',
            text: 'Captured Preview evidence: Captured Details (page02) in dark MD preview with screenshot, accessibility, DOM/layout/style and frame evidence (region).',
          },
        ],
        structuredContent: {
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
          interactions: {
            requested: [
              {
                action: 'click',
                target: {
                  role: 'button',
                  name: 'Continue',
                },
              },
            ],
            executed: [
              {
                index: 0,
                step: {
                  action: 'click',
                  target: {
                    role: 'button',
                    name: 'Continue',
                  },
                },
                targetDescription: 'role=button name="Continue"',
              },
            ],
          },
          safeActivity: {
            toolName: 'capture_preview_evidence',
            operationTypes: ['screenshot', 'accessibility', 'dom_layout_style', 'frame'],
            timestamp: '2026-06-16T12:30:00.000Z',
          },
        },
      },
    })
    expect(server.getState()).toMatchObject({
      lastActivity: {
        toolName: 'capture_preview_evidence',
        operationTypes: ['screenshot', 'accessibility', 'dom_layout_style', 'frame'],
        timestamp: '2026-06-16T12:30:00.000Z',
      },
    })

    const accessibilityResponse = await postJson(state.url, {
      jsonrpc: '2.0',
      id: 62,
      method: 'resources/read',
      params: {
        uri: 'arcade://preview/captures/capture-demo/accessibility',
      },
    })
    expect(accessibilityResponse.status).toBe(200)
    await expect(accessibilityResponse.json()).resolves.toEqual({
      jsonrpc: '2.0',
      id: 62,
      result: {
        contents: [
          {
            uri: 'arcade://preview/captures/capture-demo/accessibility',
            mimeType: 'application/json',
            text: '{"rootSelector":"#root","nodeCount":2,"truncated":false,"nodes":[{"role":"heading","name":"Details","level":1}]}',
          },
        ],
      },
    })

    const manifestResponse = await postJson(state.url, {
      jsonrpc: '2.0',
      id: 63,
      method: 'resources/read',
      params: {
        uri: 'arcade://preview/captures/capture-demo/manifest',
      },
    })
    expect(manifestResponse.status).toBe(200)
    await expect(manifestResponse.json()).resolves.toEqual({
      jsonrpc: '2.0',
      id: 63,
      result: {
        contents: [
          {
            uri: 'arcade://preview/captures/capture-demo/manifest',
            mimeType: 'application/json',
            text: '{"captureId":"capture-demo"}',
          },
        ],
      },
    })

    const screenshotResponse = await postJson(state.url, {
      jsonrpc: '2.0',
      id: 64,
      method: 'resources/read',
      params: {
        uri: 'arcade://preview/captures/capture-demo/screenshot',
      },
    })
    expect(screenshotResponse.status).toBe(200)
    await expect(screenshotResponse.json()).resolves.toEqual({
      jsonrpc: '2.0',
      id: 64,
      result: {
        contents: [
          {
            uri: 'arcade://preview/captures/capture-demo/screenshot',
            mimeType: 'image/svg+xml',
            text: '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
          },
        ],
      },
    })

    const accessibilityRepeatResponse = await postJson(state.url, {
      jsonrpc: '2.0',
      id: 65,
      method: 'resources/read',
      params: {
        uri: 'arcade://preview/captures/capture-demo/accessibility',
      },
    })
    expect(accessibilityRepeatResponse.status).toBe(200)
    await expect(accessibilityRepeatResponse.json()).resolves.toEqual({
      jsonrpc: '2.0',
      id: 65,
      result: {
        contents: [
          {
            uri: 'arcade://preview/captures/capture-demo/accessibility',
            mimeType: 'application/json',
            text: '{"rootSelector":"#root","nodeCount":2,"truncated":false,"nodes":[{"role":"heading","name":"Details","level":1}]}',
          },
        ],
      },
    })

    const domLayoutStyleResponse = await postJson(state.url, {
      jsonrpc: '2.0',
      id: 66,
      method: 'resources/read',
      params: {
        uri: 'arcade://preview/captures/capture-demo/dom-layout-style',
      },
    })
    expect(domLayoutStyleResponse.status).toBe(200)
    await expect(domLayoutStyleResponse.json()).resolves.toEqual({
      jsonrpc: '2.0',
      id: 66,
      result: {
        contents: [
          {
            uri: 'arcade://preview/captures/capture-demo/dom-layout-style',
            mimeType: 'application/json',
            text: '{"rootSelector":"#root","capturedElementCount":4,"truncated":false,"tree":{"tagName":"div"}}',
          },
        ],
      },
    })

    await new Promise((resolve) => setTimeout(resolve, 75))
    const expiredResponse = await postJson(state.url, {
      jsonrpc: '2.0',
      id: 67,
      method: 'resources/read',
      params: {
        uri: 'arcade://preview/captures/capture-demo/screenshot',
      },
    })
    expect(expiredResponse.status).toBe(200)
    await expect(expiredResponse.json()).resolves.toEqual({
      jsonrpc: '2.0',
      id: 67,
      error: {
        code: -32002,
        message:
          'Desktop Arcade MCP resource "arcade://preview/captures/capture-demo/screenshot" is unavailable because the Preview capture does not exist or has expired.',
        data: {
          code: 'resource-not-found',
          resourceUri: 'arcade://preview/captures/capture-demo/screenshot',
        },
      },
    })
    expect(capturePreviewEvidence).toHaveBeenCalledWith({
      pageId: 'page02',
      viewportSize: 'MD',
      layers: ['screenshot', 'accessibility', 'dom_layout_style', 'frame'],
      screenshotScope: 'region',
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
    })
  })

  it('rejects invalid bounded interaction arguments before routing capture_preview_evidence', async () => {
    const capturePreviewEvidence = vi.fn()
    const server = createManagedServer({ port: 0, capturePreviewEvidence })
    const state = await server.start()

    const invalidWaitForResponse = await postJson(state.url, {
      jsonrpc: '2.0',
      id: 68,
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

    expect(invalidWaitForResponse.status).toBe(200)
    await expect(invalidWaitForResponse.json()).resolves.toEqual({
      jsonrpc: '2.0',
      id: 68,
      error: {
        code: -32602,
        message:
          'capture_preview_evidence interactions[0] waitFor steps require exactly one of text, target, or renderIdle.',
        data: {
          code: 'invalid-tool-arguments',
          toolName: 'capture_preview_evidence',
        },
      },
    })
    expect(capturePreviewEvidence).not.toHaveBeenCalled()
  })

  it('redacts raw interaction payload details from capture_preview_evidence failure responses', async () => {
    const sentinel = 'TOPSECRET-PAYLOAD-CHECK-123'
    const capturePreviewEvidence = vi.fn<
      (request: Record<string, unknown>) => Promise<CapturePreviewFailure>
    >().mockResolvedValue({
      ok: false,
      code: 'invalid-capture-target',
      message: 'Preview interaction text target did not match a Preview element.',
      currentPageId: 'page01',
      interactions: {
        requested: [
          {
            action: 'click',
            target: {
              text: sentinel,
            },
          },
        ],
        executed: [],
        failedStep: {
          index: 0,
          step: {
            action: 'click',
            target: {
              text: sentinel,
            },
          },
          reason: 'Preview interaction text target did not match a Preview element.',
        },
      },
    })
    const server = createManagedServer({ port: 0, capturePreviewEvidence })
    const state = await server.start()

    const response = await postJson(state.url, {
      jsonrpc: '2.0',
      id: 69,
      method: 'tools/call',
      params: {
        name: 'capture_preview_evidence',
        arguments: {
          pageId: 'page01',
          interactions: [
            {
              action: 'click',
              target: {
                text: sentinel,
              },
            },
          ],
        },
      },
    })

    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload).toEqual({
      jsonrpc: '2.0',
      id: 69,
      result: {
        content: [
          {
            type: 'text',
            text: 'Preview interaction text target did not match a Preview element.',
          },
        ],
        isError: true,
        structuredContent: {
          code: 'invalid-capture-target',
          toolName: 'capture_preview_evidence',
          message: 'Preview interaction text target did not match a Preview element.',
          interactions: {
            requested: [
              {
                action: 'click',
              },
            ],
            executed: [],
            failedStep: {
              index: 0,
              step: {
                action: 'click',
              },
              reason: 'Preview interaction text target did not match a Preview element.',
            },
          },
          currentPageId: 'page01',
        },
      },
    })
    expect(JSON.stringify(payload)).not.toContain(sentinel)
  })

  it('routes apply_changes through the injected project writer and preserves MCP tool-result semantics', async () => {
    const applyChanges = vi
      .fn<(request: Record<string, unknown>) => Promise<ApplyChangesResult>>()
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

    const server = createManagedServer({ port: 0, applyChanges })
    const state = await server.start()

    const successResponse = await postJson(state.url, {
      jsonrpc: '2.0',
      id: 51,
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
    expect(successResponse.status).toBe(200)
    await expect(successResponse.json()).resolves.toEqual({
      jsonrpc: '2.0',
      id: 51,
      result: {
        content: [
          {
            type: 'text',
            text: 'Applied changes: Create a landing page',
          },
        ],
        structuredContent: {
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
          nextSteps: [
            'Read arcade://project/diagnostics to confirm the batch is healthy.',
            'Run capture_preview_evidence({ pageId }) to inspect the rendered result.',
          ],
        },
      },
    })
    expect(server.getState()).toMatchObject({
      lastActivity: {
        toolName: 'apply_changes',
        operationTypes: ['create_page', 'select_active_page'],
        timestamp: '2026-06-16T12:00:00.000Z',
      },
    })

    const staleResponse = await postJson(state.url, {
      jsonrpc: '2.0',
      id: 52,
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
    expect(staleResponse.status).toBe(200)
    await expect(staleResponse.json()).resolves.toEqual({
      jsonrpc: '2.0',
      id: 52,
      result: {
        content: [
          {
            type: 'text',
            text: 'Working copy save failed.',
          },
        ],
        isError: true,
        structuredContent: {
          code: 'persistence-failed',
          toolName: 'apply_changes',
          message: 'Working copy save failed.',
        },
      },
    })

    expect(applyChanges).toHaveBeenNthCalledWith(1, {
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
    })
    expect(applyChanges).toHaveBeenNthCalledWith(2, {
      summary: 'Retry with stale revision',
      expectedProjectRevision: 'rev-old',
      operations: [
        {
          type: 'rename_project',
          name: 'Renamed project',
        },
      ],
    })
  })

  it('reads the Desktop MCP guide and capabilities resources', async () => {
    const server = createManagedServer({ port: 0 })
    const state = await server.start()

    const toolsResponse = await postJson(state.url, {
      jsonrpc: '2.0',
      id: 80,
      method: 'tools/list',
    })
    const toolsPayload = await toolsResponse.json()
    const resourcesResponse = await postJson(state.url, {
      jsonrpc: '2.0',
      id: 81,
      method: 'resources/list',
    })
    const resourcesPayload = await resourcesResponse.json()

    const operatingGuideResponse = await postJson(state.url, {
      jsonrpc: '2.0',
      id: 8,
      method: 'resources/read',
      params: {
        uri: 'arcade://desktop/operating-guide',
        _meta: {
          progressToken: 'resource-progress',
        },
      },
    })
    expect(operatingGuideResponse.status).toBe(200)
    const operatingGuidePayload = await operatingGuideResponse.json()
    expect(operatingGuidePayload.result.contents).toEqual([
      expect.objectContaining({
        uri: 'arcade://desktop/operating-guide',
        mimeType: 'text/markdown',
      }),
    ])
    expect(operatingGuidePayload.result.contents[0].text).toContain(
      'do not edit repository files, package metadata, or the local filesystem'
    )
    expect(operatingGuidePayload.result.contents[0].text).toContain(
      'read `arcade://project/manifest`'
    )
    expect(operatingGuidePayload.result.contents[0].text).toContain(
      '`create_page.newPageRef`, later lifecycle `tempPageRef` targets, and `{{pageRef:name}}` placeholders'
    )
    expect(operatingGuidePayload.result.contents[0].text).toContain(
      '`capture_preview_evidence({ pageId })` is the normal autonomous inspection path'
    )
    expect(operatingGuidePayload.result.contents[0].text).toContain(
      'Start with `tools/list`, `resources/list`, and `resources/read`'
    )
    expect(operatingGuidePayload.result.contents[0].text).toContain(
      'tool-only clients can call `read_resource({ uri })` for the same resources'
    )
    expect(operatingGuidePayload.result.contents[0].text).toContain(
      '`arcade://desktop/capabilities` is the shortest single place to inspect the published contract'
    )
    expect(operatingGuidePayload.result.contents[0].text).toContain(
      'If `apply_changes` returns `project-unavailable`, wait for an active Desktop Arcade window'
    )
    expect(operatingGuidePayload.result.contents[0].text).toContain(
      'Product-chrome checks such as Desktop Settings copy, Web/Desktop UI boundaries, portable share/package contents, host-process logs, and window-close lifecycle are intentionally outside the MCP surface'
    )
    expect(operatingGuidePayload.result.contents[0].text).toContain(
      'Preview capture supports `screenshot`, `accessibility`, `dom_layout_style`, and `frame` layers'
    )
    expect(operatingGuidePayload.result.contents[0].text).toContain(
      'Preview capture interactions support click, fill, select, press, scroll, waitFor'
    )
    expect(operatingGuidePayload.result.contents[0].text).toContain(
      'Preview interactions block browser/external navigation targets'
    )

    const authoringGuideResponse = await postJson(state.url, {
      jsonrpc: '2.0',
      id: 82,
      method: 'resources/read',
      params: {
        uri: 'arcade://desktop/authoring-guide',
      },
    })
    expect(authoringGuideResponse.status).toBe(200)
    const authoringGuidePayload = await authoringGuideResponse.json()
    expect(authoringGuidePayload.result.contents).toEqual([
      expect.objectContaining({
        uri: 'arcade://desktop/authoring-guide',
        mimeType: 'text/markdown',
      }),
    ])
    expect(authoringGuidePayload.result.contents[0].text).toContain(
      'Source is **import-free**'
    )
    expect(authoringGuidePayload.result.contents[0].text).toContain('Global config')
    expect(authoringGuidePayload.result.contents[0].text).toContain(
      '`{{pageRef:name}}` placeholders'
    )
    expect(authoringGuidePayload.result.contents[0].text).toContain('goToPage')
    expect(authoringGuidePayload.result.contents[0].text).toContain('arcade://aksel/catalog')
    expect(authoringGuidePayload.result.contents[0].text).toContain('https://aksel.nav.no/llm.md')

    const capabilitiesResponse = await postJson(state.url, {
      jsonrpc: '2.0',
      id: 83,
      method: 'resources/read',
      params: {
        uri: 'arcade://desktop/capabilities',
      },
    })
    expect(capabilitiesResponse.status).toBe(200)
    const capabilitiesPayload = await capabilitiesResponse.json()
    expect(capabilitiesPayload.result.contents).toEqual([
      expect.objectContaining({
        uri: 'arcade://desktop/capabilities',
        mimeType: 'application/json',
      }),
    ])

    const capabilities = JSON.parse(capabilitiesPayload.result.contents[0].text)
    expect(capabilities).toMatchObject({
      serverName: 'aksel-arcade',
      serverVersion: '0.0.0',
      endpoint: 'http://127.0.0.1:3846/mcp',
      transport: 'HTTP (MCP Streamable HTTP)',
      requiresAuth: false,
      authDescription: 'No token/header required.',
      discoveryAdvice: {
        preferredFirstResourceUri: 'arcade://desktop/start-here',
        preferredDiscoveryMethods: ['tools/list', 'resources/list', 'resources/read', 'read_resource'],
      },
      smokeChecklistRequirements: {
        requiresClientResourceReads: true,
      },
      applyChangesOperationTypes: [
        'replace_source',
        'create_page',
        'rename_page',
        'delete_page',
        'set_start_page',
        'select_active_page',
        'set_preview_context',
        'rename_project',
      ],
      pageRefPlaceholderSyntax: '{{pageRef:name}}',
      captureLayers: ['screenshot', 'accessibility', 'dom_layout_style', 'frame'],
      screenshotScopes: ['viewport', 'full_page', 'region'],
      interactionActions: ['click', 'fill', 'select', 'press', 'scroll', 'waitFor'],
      interactionWaitModes: ['text', 'target', 'renderIdle'],
      limits: {
        requestBodyBytes: 1024 * 1024,
        previewInteractionSteps: 10,
        previewInteractionTotalTimeMs: 10000,
        previewInteractionWaitTimeoutMs: 5000,
      },
    })
    expect(capabilities.toolNames).toEqual(
      toolsPayload.result.tools.map((tool: { name: string }) => tool.name)
    )
    expect(capabilities.stableResourceUris).toEqual(
      resourcesPayload.result.resources.map((resource: { uri: string }) => resource.uri)
    )
    expect(capabilities.dynamicSourceUriTemplates).toEqual([
      'arcade://project/source/global/jsx',
      'arcade://project/source/global/hooks',
      'arcade://project/source/pages/{pageId}/jsx',
      'arcade://project/source/pages/{pageId}/hooks',
    ])
    expect(capabilities.previewEvidenceUriTemplates).toEqual([
      'arcade://preview/captures/{captureId}/manifest',
      'arcade://preview/captures/{captureId}/screenshot',
      'arcade://preview/captures/{captureId}/frame',
      'arcade://preview/captures/{captureId}/accessibility',
      'arcade://preview/captures/{captureId}/dom-layout-style',
    ])
    expect(capabilities.captureLayerPurposes).toMatchObject({
      screenshot: 'visual appearance and spatial gestalt',
      accessibility:
        'semantic roles, accessible names, landmarks, focusable controls, and semantic hierarchy',
      dom_layout_style:
        'actionable hierarchy, bounds, styles, spacing, colors, typography, and overflow',
      frame: 'viewport, theme, page, scroll, diagnostics, truncation, and capture metadata',
    })
    expect(capabilities.implementationStatus).toMatchObject({
      stableDesktopResourceReads: 'available',
      projectResourceReads: 'available when an active project reader is connected',
      toolExecution: {
        capture_preview_evidence:
          'available when an active preview capture bridge is connected',
        apply_changes: 'available when an active project writer is connected',
      },
      captureLayers: {
        screenshot: 'available',
        accessibility: 'available',
        dom_layout_style: 'available',
        frame: 'available',
      },
      screenshotScopes: {
        viewport: 'available',
        full_page: 'available',
        region: 'available',
      },
      interactionActions: {
        click: 'available',
        fill: 'available',
        select: 'available',
        press: 'available',
        scroll: 'available',
        waitFor: 'available',
      },
    })
    expect(capabilities.implementationStatus.previewEvidenceUriTemplates).toMatchObject({
      'arcade://preview/captures/{captureId}/manifest':
        'available after a successful capture until the capture expires',
      'arcade://preview/captures/{captureId}/screenshot':
        'available after a successful capture until the capture expires',
      'arcade://preview/captures/{captureId}/frame':
        'available after a successful capture until the capture expires',
      'arcade://preview/captures/{captureId}/accessibility':
        'available after a successful capture until the capture expires',
      'arcade://preview/captures/{captureId}/dom-layout-style':
        'available after a successful capture until the capture expires',
    })
    expect(capabilities.discoveryAdvice.note).toContain(
      'In tool-only clients, call read_resource({ uri }) for the same resources.'
    )
    expect(capabilities.smokeChecklistRequirements.note).toContain(
      'Tool-only hosts can call read_resource for stable resources, diagnostics, source, Aksel snippets, and capture-produced evidence resources.'
    )
    expect(capabilities.verificationBoundaries).toMatchObject({
      mcpVerifiable: expect.arrayContaining([
        'No token/header is required for the aksel-arcade MCP endpoint.',
        'Business failures stay structured and redacted in MCP tool/resource responses.',
        'Unknown browser Origins are rejected and GET/SSE entrypoints stay unsupported.',
      ]),
      hostOnly: expect.arrayContaining([
        'Desktop Settings shows MCP configuration instead of a pairing handoff.',
        'Desktop Arcade shows no public Agent access toggle, pairing credential, or pairing handoff UI.',
        'Web Arcade shows no MCP or Agent UI and exposes no Web MCP endpoint.',
        'Portable Web share URLs and Arcade project packages exclude MCP resources, evidence, diagnostics, instructions, and activity data.',
        'Closing Desktop Arcade windows leaves MCP project calls failing clearly without auto-opening or focusing UI.',
      ]),
    })
    expect(capabilities.verificationBoundaries.note).toContain(
      'hostOnly items are intentionally outside the MCP surface'
    )
    expect(capabilities.v1Omissions).toContain('No prompts surface.')
    expect(capabilities.contractNote).toContain('current implementation status')
  })

  it('serves the on-demand Aksel catalog index and per-component snippet resources', async () => {
    const server = createManagedServer({ port: 0 })
    const state = await server.start()

    const catalogResponse = await postJson(state.url, {
      jsonrpc: '2.0',
      id: 90,
      method: 'resources/read',
      params: {
        uri: 'arcade://aksel/catalog',
      },
    })
    expect(catalogResponse.status).toBe(200)
    const catalogPayload = await catalogResponse.json()
    expect(catalogPayload.result.contents[0].mimeType).toBe('application/json')
    const catalog = JSON.parse(catalogPayload.result.contents[0].text)
    expect(typeof catalog.akselVersion).toBe('string')
    expect(catalog.akselVersion).not.toBe('unknown')
    expect(catalog.componentResourceUriTemplate).toBe('arcade://aksel/components/{name}')
    expect(Array.isArray(catalog.components)).toBe(true)
    expect(catalog.components.length).toBeGreaterThan(0)
    const buttonIndex = catalog.components.find(
      (component: { name: string }) => component.name === 'Button'
    )
    expect(buttonIndex).toMatchObject({
      name: 'Button',
      resourceUri: 'arcade://aksel/components/Button',
    })

    const componentResponse = await postJson(state.url, {
      jsonrpc: '2.0',
      id: 91,
      method: 'resources/read',
      params: {
        uri: 'arcade://aksel/components/Button',
      },
    })
    expect(componentResponse.status).toBe(200)
    const componentPayload = await componentResponse.json()
    expect(componentPayload.result.contents[0].mimeType).toBe('application/json')
    const component = JSON.parse(componentPayload.result.contents[0].text)
    expect(component.akselVersion).toBe(catalog.akselVersion)
    expect(component.component.name).toBe('Button')
    expect(typeof component.component.snippet.jsx).toBe('string')
    expect(component.component.snippet.jsx).not.toMatch(/\bimport\b/)
    expect(component.component.snippet.jsx).not.toContain('${')
    expect(component.component.snippet.jsx).not.toMatch(/\{\{[\w]+\}\}/)

    const caseInsensitiveResponse = await postJson(state.url, {
      jsonrpc: '2.0',
      id: 92,
      method: 'resources/read',
      params: {
        uri: 'arcade://aksel/components/button',
      },
    })
    const caseInsensitivePayload = await caseInsensitiveResponse.json()
    expect(JSON.parse(caseInsensitivePayload.result.contents[0].text).component.name).toBe('Button')

    const spacedIndex = catalog.components.find((component: { name: string }) =>
      component.name.includes(' ')
    )
    if (spacedIndex) {
      const spacedResponse = await postJson(state.url, {
        jsonrpc: '2.0',
        id: 94,
        method: 'resources/read',
        params: {
          uri: spacedIndex.resourceUri,
        },
      })
      expect(spacedResponse.status).toBe(200)
      const spacedPayload = await spacedResponse.json()
      expect(spacedPayload.error).toBeUndefined()
      expect(JSON.parse(spacedPayload.result.contents[0].text).component.name).toBe(
        spacedIndex.name
      )
    }

    const unknownComponentResponse = await postJson(state.url, {
      jsonrpc: '2.0',
      id: 93,
      method: 'resources/read',
      params: {
        uri: 'arcade://aksel/components/NotARealComponent',
      },
    })
    const unknownComponentPayload = await unknownComponentResponse.json()
    expect(unknownComponentPayload.error).toMatchObject({
      code: -32002,
      data: {
        code: 'resource-not-found',
        resourceUri: 'arcade://aksel/components/NotARealComponent',
      },
    })
    expect(unknownComponentPayload.error.message).toContain('arcade://aksel/catalog')
  })

  it('serves the apply_changes operations reference and advertises Aksel snippet resources', async () => {
    const server = createManagedServer({ port: 0 })
    const state = await server.start()

    const operationsResponse = await postJson(state.url, {
      jsonrpc: '2.0',
      id: 94,
      method: 'resources/read',
      params: {
        uri: 'arcade://desktop/apply-changes-operations',
      },
    })
    expect(operationsResponse.status).toBe(200)
    const operationsPayload = await operationsResponse.json()
    expect(operationsPayload.result.contents[0].mimeType).toBe('text/markdown')
    const operationsText = operationsPayload.result.contents[0].text
    expect(operationsText).toContain('# apply_changes operations reference')
    for (const operationType of [
      'replace_source',
      'create_page',
      'rename_page',
      'delete_page',
      'set_start_page',
      'select_active_page',
      'set_preview_context',
      'rename_project',
    ]) {
      expect(operationsText).toContain(`\`${operationType}\``)
    }
    expect(operationsText).toContain('may target any matching')
    expect(operationsText).toContain('Final-state assertions')
    expect(operationsText).toContain('`pageId`')
    expect(operationsText).toContain('`tempPageRef`')

    const capabilitiesResponse = await postJson(state.url, {
      jsonrpc: '2.0',
      id: 95,
      method: 'resources/read',
      params: {
        uri: 'arcade://desktop/capabilities',
      },
    })
    const capabilities = JSON.parse((await capabilitiesResponse.json()).result.contents[0].text)
    expect(capabilities.applyChangesOperationsReferenceUri).toBe(
      'arcade://desktop/apply-changes-operations'
    )
    expect(capabilities.akselSnippetResources).toMatchObject({
      catalogUri: 'arcade://aksel/catalog',
      componentUriTemplate: 'arcade://aksel/components/{name}',
    })
    expect(typeof capabilities.akselSnippetResources.akselVersion).toBe('string')
  })

  it('returns clear JSON-RPC errors for unknown resources and rejects unsupported resource fields', async () => {
    const server = createManagedServer({ port: 0 })
    const state = await server.start()

    const unknownResourceResponse = await postJson(state.url, {
      jsonrpc: '2.0',
      id: 9,
      method: 'resources/read',
      params: {
        uri: 'arcade://desktop/missing',
      },
    })
    expect(unknownResourceResponse.status).toBe(200)
    await expect(unknownResourceResponse.json()).resolves.toEqual({
      jsonrpc: '2.0',
      id: 9,
      error: {
        code: -32002,
        message: 'Unknown Desktop Arcade MCP resource "arcade://desktop/missing".',
        data: {
          code: 'resource-not-found',
          resourceUri: 'arcade://desktop/missing',
        },
      },
    })

    const invalidResourceFieldsResponse = await postJson(state.url, {
      jsonrpc: '2.0',
      id: 10,
      method: 'resources/read',
      params: {
        uri: 'arcade://desktop/operating-guide',
        extra: true,
      },
    })
    expect(invalidResourceFieldsResponse.status).toBe(200)
    await expect(invalidResourceFieldsResponse.json()).resolves.toEqual({
      jsonrpc: '2.0',
      id: 10,
      error: {
        code: -32602,
        message: 'Desktop Arcade MCP resources/read params contain unsupported fields: extra.',
      },
    })
  })

  it('reads project resources through the injected project reader while keeping desktop resources out of scope', async () => {
    const readProjectResource = vi.fn(
      async ({ uri }: { uri: string }): Promise<ProjectResourceReadResult> => {
        if (uri === 'arcade://project/manifest') {
          return {
            ok: true,
            uri,
            mimeType: 'application/json',
            text: '{"name":"Desktop MCP project"}',
          }
        }

        if (uri === 'arcade://project/source/pages/page01/jsx') {
          return {
            ok: true,
            uri,
            mimeType: 'text/plain',
            text: '<Page />',
          }
        }

        return {
          ok: false,
          code: 'source-not-found',
          resourceUri: uri,
          message: `Missing ${uri}`,
        }
      }
    )
    const server = createManagedServer({ port: 0, readProjectResource })
    const state = await server.start()

    const manifestResponse = await postJson(state.url, {
      jsonrpc: '2.0',
      id: 13,
      method: 'resources/read',
      params: {
        uri: 'arcade://project/manifest',
      },
    })
    expect(manifestResponse.status).toBe(200)
    await expect(manifestResponse.json()).resolves.toEqual({
      jsonrpc: '2.0',
      id: 13,
      result: {
        contents: [
          {
            uri: 'arcade://project/manifest',
            mimeType: 'application/json',
            text: '{"name":"Desktop MCP project"}',
          },
        ],
      },
    })

    const pageSourceResponse = await postJson(state.url, {
      jsonrpc: '2.0',
      id: 14,
      method: 'resources/read',
      params: {
        uri: 'arcade://project/source/pages/page01/jsx',
      },
    })
    expect(pageSourceResponse.status).toBe(200)
    await expect(pageSourceResponse.json()).resolves.toEqual({
      jsonrpc: '2.0',
      id: 14,
      result: {
        contents: [
          {
            uri: 'arcade://project/source/pages/page01/jsx',
            mimeType: 'text/plain',
            text: '<Page />',
          },
        ],
      },
    })

    expect(readProjectResource).toHaveBeenNthCalledWith(1, {
      uri: 'arcade://project/manifest',
    })
    expect(readProjectResource).toHaveBeenNthCalledWith(2, {
      uri: 'arcade://project/source/pages/page01/jsx',
    })
  })

  it('returns clear project-unavailable errors for project resources when the project reader cannot serve them', async () => {
    const server = createManagedServer({
      port: 0,
      readProjectResource: async ({ uri }: { uri: string }) => ({
        ok: false,
        code: 'project-unavailable',
        resourceUri: uri,
        message: `Project unavailable for ${uri}`,
      }),
    })
    const state = await server.start()

    const response = await postJson(state.url, {
      jsonrpc: '2.0',
      id: 15,
      method: 'resources/read',
      params: {
        uri: 'arcade://project/diagnostics',
      },
    })
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      jsonrpc: '2.0',
      id: 15,
      error: {
        code: -32002,
        message: 'Project unavailable for arcade://project/diagnostics',
        data: {
          code: 'project-unavailable',
          resourceUri: 'arcade://project/diagnostics',
        },
      },
    })
  })

  it('rejects browser-originated requests and unsupported GET or SSE entrypoints', async () => {
    const server = createManagedServer({ port: 0 })
    const state = await server.start()

    const browserOriginResponse = await postJson(
      state.url,
      { jsonrpc: '2.0', id: 11, method: 'initialize' },
      { Origin: 'https://example.com' }
    )
    expect(browserOriginResponse.status).toBe(403)
    expect(await browserOriginResponse.text()).toContain('Remove the Origin header')

    const getResponse = await fetch(state.url, {
      method: 'GET',
      headers: {
        accept: 'text/event-stream',
      },
    })
    expect(getResponse.status).toBe(405)
    expect(getResponse.headers.get('allow')).toBe('POST')
    expect(await getResponse.text()).toContain('does not support GET or SSE streams')
  })

  it('returns protocol errors for malformed JSON and invalid JSON-RPC envelopes', async () => {
    const server = createManagedServer({ port: 0 })
    const state = await server.start()

    const invalidJsonResponse = await fetch(state.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{',
    })
    expect(invalidJsonResponse.status).toBe(400)
    await expect(invalidJsonResponse.json()).resolves.toEqual({
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32700,
        message: 'Desktop Arcade MCP request body must be valid JSON.',
      },
    })

    const invalidEnvelopeResponse = await postJson(state.url, {
      jsonrpc: '2.0',
      id: 12,
      method: 'tools/list',
      extra: true,
    })
    expect(invalidEnvelopeResponse.status).toBe(400)
    await expect(invalidEnvelopeResponse.json()).resolves.toEqual({
      jsonrpc: '2.0',
      id: 12,
      error: {
        code: -32600,
        message:
          'Desktop Arcade MCP requests must be single JSON-RPC 2.0 objects with a string method.',
      },
    })
  })

  it('reports a visible unavailable reason when the configured port is already in use', async () => {
    const occupiedServer = createServer((_request, response) => {
      response.statusCode = 204
      response.end()
    })
    occupiedServers.push(occupiedServer)

    await listenOnPort(occupiedServer, 0)
    const address = occupiedServer.address()
    if (!address || typeof address === 'string') {
      throw new Error('Expected occupied server to bind to a TCP port.')
    }

    const server = createManagedServer({ port: address.port })
    const state = await server.start()

    expect(state.availability).toEqual({
      status: 'unavailable',
      reason: `Port ${address.port} on 127.0.0.1 is already in use.`,
    })
    expect(new URL(state.url).port).toBe(String(address.port))
  })
})

const postJson = (
  url: string,
  payload: unknown,
  headers: Record<string, string> = {}
) =>
  fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(payload),
  })

const listenOnPort = (server: Server, port: number) =>
  new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => {
      server.off('error', reject)
      resolve()
    })
  })

const closeHttpServer = (server: Server) =>
  new Promise<void>((resolve, reject) => {
    server.close((error) => {
      const closeError = error as NodeJS.ErrnoException | null
      if (closeError && closeError.code !== 'ERR_SERVER_NOT_RUNNING') {
        reject(error)
        return
      }

      resolve()
    })
    if (typeof server.closeAllConnections === 'function') {
      server.closeAllConnections()
    }
  })
