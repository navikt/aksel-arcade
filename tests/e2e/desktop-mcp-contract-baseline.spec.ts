import { execFileSync } from 'node:child_process'
import { expect, test, type Page } from '@playwright/test'
import { _electron as electron, type ElectronApplication } from 'playwright'

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const desktopRendererUrl = 'aksel-arcade://app/index.html'
const desktopMcpUrl = 'http://127.0.0.1:3846/mcp'
const desktopMcpPath = '/mcp'
const expectedInstructionLines = [
  'Desktop Arcade is a live sandbox for prototyping any UI with the Aksel design system. Build whatever the task needs — it is not limited to any one kind of screen.',
  'Start by reading arcade://desktop/start-here — it is self-sufficient: one read plus arcade://project/manifest is enough to author. If your MCP host exposes only tools, call read_resource({ uri: "arcade://desktop/start-here" }). For editable source URIs from the manifest, prefer read_source so large source can be paged safely.',
  'Source is import-free: React, Aksel components, Aksel icons, and hooks are injected globals — never add import statements.',
  'Each Arcade page (and Global config) has two source tabs: jsx and hooks. The jsx source is inlined into return ( … ), so it must be a single JSX element/expression and must never be wrapped in { … }; put page-level top-level hook bindings such as const [value, setValue] = useState(...) in the page Hooks tab, and treat Global config hooks as module scope where you define shared custom hooks, helpers, constants, and components and never call hooks at the top level.',
  'Use real Aksel components and props; do not hand-roll raw HTML or guess prop names. If an Aksel component resource resolves to a replacement payload, follow the sanctioned replacement instead of authoring the hidden/deprecated component. Per-component usage and runnable, version-matched snippets are available on demand — do not load them until you reach for a given component.',
  'Navigate between pages with goToPage("pageNN"), or an Aksel Link/LinkCard whose href/to is a bare page id; the current page id is injected read-only as currentPageId. There is no router and no <a href> navigation.',
  'Page ids are assigned by the app. Within one apply_changes batch, link pages with {{pageRef:name}} placeholders targeting any create_page.newPageRef declared in that batch.',
  'Annotation work is Arcade-native: list open work with list_annotations, read arcade://project/annotations or arcade://project/pages/{pageId}/annotations for non-dead history, and treat hidden targets as real work even when they are outside the current viewport.',
  'Working loop: apply_changes, then read arcade://project/diagnostics, then capture_preview_evidence to inspect. Capture is an isolated throwaway render — it never changes the durable Active page.',
  'Deeper references are on demand, not required before authoring: arcade://desktop/authoring-guide (depth + Aksel snippet reach paths), arcade://desktop/apply-changes-operations, the workflow guides, and the Aksel catalog.',
]

const expectedToolNames = [
  'read_resource',
  'read_source',
  'list_annotations',
  'watch_annotations',
  'acknowledge_annotation',
  'resolve_annotation',
  'dismiss_annotation',
  'reply_to_annotation',
  'capture_preview_evidence',
  'apply_changes',
]

const expectedToolDefinitions = [
  {
    name: 'read_resource',
    description:
      'Read a Desktop Arcade MCP resource by URI. Use this first in tool-only MCP clients to fetch arcade://desktop/start-here, the project manifest, annotation resources, diagnostics, source resources, Aksel snippets, and Preview evidence resources.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['uri'],
      properties: {
        uri: {
          type: 'string',
          minLength: 1,
          description: 'Resource URI to read, e.g. arcade://desktop/start-here.',
        },
      },
    },
  },
  {
    name: 'read_source',
    description:
      'Read editable Arcade project source with pagination. Prefer this over read_resource/resources/read for source URIs from arcade://project/manifest, especially large JSX or Hooks files.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['uri'],
      properties: {
        uri: {
          type: 'string',
          minLength: 1,
          description: 'Editable source URI from arcade://project/manifest.',
        },
        offset: {
          type: 'integer',
          minimum: 0,
          description: 'Zero-based character offset to start reading from. Defaults to 0.',
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 20000,
          description: 'Maximum characters to return. Defaults to 8000.',
        },
      },
    },
  },
  {
    name: 'list_annotations',
    description:
      'List non-dead annotations for the active Arcade page by default. Supports explicit page or whole-project scope plus status filters for open, pending, acknowledged, resolved, dismissed, or all.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        scope: {
          type: 'string',
          enum: ['page', 'project'],
          description: 'Optional annotation scope. Defaults to the active Arcade page.',
        },
        pageId: {
          type: 'string',
          description: 'Optional Arcade page id. Omit to use the active page when scope is "page".',
        },
        status: {
          type: 'string',
          enum: ['pending', 'acknowledged', 'resolved', 'dismissed', 'all'],
          description:
            'Optional status filter. Defaults to "open" (pending + acknowledged). Use "all" for full non-dead history.',
        },
      },
    },
  },
  {
    name: 'watch_annotations',
    description:
      'Watch for pending annotations on the active Arcade page by default. Supports explicit page or whole-project scope, returns existing pending annotations immediately, waits for the first pending annotation for up to 120 seconds by default, then batches for 10 seconds after the first hit. Maximum wait is 300 seconds and maximum batch window is 60 seconds.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        scope: {
          type: 'string',
          enum: ['page', 'project'],
          description: 'Optional annotation scope. Defaults to the active Arcade page.',
        },
        pageId: {
          type: 'string',
          description: 'Optional Arcade page id. Omit to use the active page when scope is "page".',
        },
        waitTimeoutSeconds: {
          type: 'integer',
          minimum: 1,
          maximum: 300,
          description:
            'Optional upper bound, in seconds, for waiting for the first pending annotation. Defaults to 120 seconds.',
        },
        batchWindowSeconds: {
          type: 'integer',
          minimum: 1,
          maximum: 60,
          description:
            'Optional batching window, in seconds, after the first pending annotation appears. Defaults to 10 seconds.',
        },
      },
    },
  },
  {
    name: 'acknowledge_annotation',
    description:
      'Acknowledge a single non-dead annotation by annotationId. Updates status, timestamps, and agent actor metadata only.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['annotationId'],
      properties: {
        annotationId: {
          type: 'string',
          minLength: 1,
          description: 'Globally unique annotation id.',
        },
      },
    },
  },
  {
    name: 'resolve_annotation',
    description:
      'Resolve a single non-dead annotation by annotationId. Updates status, timestamps, and agent metadata, and may append an optional summary thread message.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['annotationId'],
      properties: {
        annotationId: {
          type: 'string',
          minLength: 1,
          description: 'Globally unique annotation id.',
        },
        summary: {
          type: 'string',
          description: 'Optional summary thread message to append before resolving.',
        },
      },
    },
  },
  {
    name: 'dismiss_annotation',
    description:
      'Dismiss a single non-dead annotation by annotationId. Updates status, timestamps, and agent metadata and requires a reason thread message.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['annotationId', 'reason'],
      properties: {
        annotationId: {
          type: 'string',
          minLength: 1,
          description: 'Globally unique annotation id.',
        },
        reason: {
          type: 'string',
          minLength: 1,
          description: 'Reason thread message to append before dismissing.',
        },
      },
    },
  },
  {
    name: 'reply_to_annotation',
    description:
      'Append an agent thread message to a single non-dead annotation by annotationId without changing status.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['annotationId', 'message'],
      properties: {
        annotationId: {
          type: 'string',
          minLength: 1,
          description: 'Globally unique annotation id.',
        },
        message: {
          type: 'string',
          minLength: 1,
          description: 'Agent reply text to append to the annotation thread.',
        },
      },
    },
  },
  {
    name: 'capture_preview_evidence',
    description:
      'Capture targeted Preview evidence for the active Arcade project across screenshot, accessibility, DOM/layout/style, and frame layers. Captures run in an isolated, throwaway render: in-capture interactions and goToPage navigation never change the human-visible Active page or durable source, so no restore is needed afterward. When interactions navigate, the frame/manifest add page.navigatedToId/navigatedToName so all layers agree. For Arcade authoring rules and how to fetch Aksel component usage on demand, read arcade://desktop/authoring-guide.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        pageId: {
          type: 'string',
          description: 'Optional Arcade page id to capture.',
        },
        viewportSize: {
          type: 'string',
          enum: ['2XL', 'XL', 'LG', 'MD', 'SM', 'XS'],
          description: 'Optional capture-only viewport override.',
        },
        theme: {
          type: 'string',
          enum: ['light', 'dark'],
          description: 'Optional capture-only theme override.',
        },
        layers: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['screenshot', 'accessibility', 'dom_layout_style', 'frame'],
          },
          description:
            'Optional requested evidence layers. screenshot = visual appearance and spatial gestalt; accessibility = roles, names, landmarks, focusable controls, and semantic hierarchy; dom_layout_style = actionable hierarchy, bounds, styles, spacing, colors, typography, and overflow; frame = viewport, theme, page, scroll, diagnostics, truncation, and capture metadata. Omit to capture all available layers.',
        },
        screenshotScope: {
          type: 'string',
          enum: ['viewport', 'full_page', 'region'],
          description: 'Optional screenshot scope for the capture.',
        },
        includeAnnotationOverlays: {
          type: 'boolean',
          description:
            'When true, screenshot evidence includes visible Annotation mode markers/outlines for the captured page and viewport. Durable annotation history still lives in annotation resources.',
        },
        target: {
          type: 'object',
          additionalProperties: false,
          properties: {
            selector: {
              type: 'string',
              description: 'Preview-root-scoped CSS selector for region screenshots.',
            },
            role: {
              type: 'string',
              description: 'Accessibility role filter for region screenshots.',
            },
            name: {
              type: 'string',
              description: 'Accessible name filter for region screenshots.',
            },
            text: {
              type: 'string',
              description: 'Visible text filter for region screenshots.',
            },
            label: {
              type: 'string',
              description: 'Associated label filter for region screenshots.',
            },
          },
          description:
            'Optional preview-root selector or accessibility target for region screenshots.',
        },
        interactions: {
          type: 'array',
          maxItems: 10,
          description:
            'Optional bounded, capture-only Preview interaction sequence. Each step must use one of click, fill, select, press, scroll, or waitFor. Accessibility targets are preferred; selector fallback is scoped to the Preview root only. Interactions are ephemeral and do not mutate durable project or host UI state.',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['action'],
            properties: {
              action: {
                type: 'string',
                enum: ['click', 'fill', 'select', 'press', 'scroll', 'waitFor'],
              },
              target: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  selector: {
                    type: 'string',
                    description: 'Preview-root-scoped CSS selector fallback.',
                  },
                  role: {
                    type: 'string',
                    description: 'Accessibility role filter.',
                  },
                  name: {
                    type: 'string',
                    description: 'Accessible name filter.',
                  },
                  text: {
                    type: 'string',
                    description: 'Visible text filter.',
                  },
                  label: {
                    type: 'string',
                    description: 'Associated label filter.',
                  },
                },
              },
              value: {
                type: 'string',
                description: 'Fill/select value when the action requires a string value.',
              },
              checked: {
                type: 'boolean',
                description: 'Checkbox/radio state for select interactions.',
              },
              key: {
                type: 'string',
                description:
                  'Bounded press key such as Enter, Escape, Tab, Arrow keys, Backspace, Delete, Home, End, PageUp, PageDown, Space, or a single printable character.',
              },
              x: {
                type: 'number',
                description: 'Horizontal scroll delta for scroll interactions.',
              },
              y: {
                type: 'number',
                description: 'Vertical scroll delta for scroll interactions.',
              },
              text: {
                type: 'string',
                description: 'Visible Preview text to wait for during waitFor interactions.',
              },
              renderIdle: {
                type: 'boolean',
                description: 'Wait for the Preview render to settle.',
              },
              timeoutMs: {
                type: 'number',
                description: 'Optional bounded waitFor timeout in milliseconds (max 5000).',
              },
            },
          },
        },
      },
    },
  },
  {
    name: 'apply_changes',
    description:
      'Apply a validated, durable batch of Arcade project changes. Read arcade://desktop/start-here and arcade://desktop/apply-changes-operations before editing. Use assertions to keep replacements scoped.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['summary', 'operations'],
      properties: {
        summary: {
          type: 'string',
          minLength: 1,
          description: 'Required human-readable summary for the batch.',
        },
        expectedProjectRevision: {
          type: 'string',
          description: 'Optional stale-state protection revision.',
        },
        operations: {
          type: 'array',
          minItems: 1,
          description:
            'Ordered batch operations for source, page lifecycle, preview, or project metadata.',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['type'],
            properties: {
              type: {
                type: 'string',
                enum: [
                  'replace_source',
                  'create_page',
                  'rename_page',
                  'delete_page',
                  'set_start_page',
                  'select_active_page',
                  'set_preview_context',
                  'rename_project',
                ],
              },
              resourceUri: {
                type: 'string',
                description: 'Existing source resource URI from the project manifest.',
              },
              content: {
                type: 'string',
                description:
                  'Full source replacement content for replace_source operations. Supports {{pageRef:name}} placeholders for create_page.newPageRef values declared anywhere in the same batch.',
              },
              pageId: {
                type: 'string',
                description: 'Existing permanent Arcade page id for page lifecycle operations.',
              },
              tempPageRef: {
                type: 'string',
                description:
                  'Temporary page ref declared by create_page.newPageRef earlier in the same batch.',
              },
              newPageRef: {
                type: 'string',
                description:
                  'Optional temporary page ref that later operations and {{pageRef:name}} placeholders can use inside the same batch.',
              },
              jsxCode: {
                type: 'string',
                description:
                  'Optional initial JSX source for create_page operations. Supports {{pageRef:name}} placeholders for same-batch create_page.newPageRef values.',
              },
              hooksCode: {
                type: 'string',
                description:
                  'Optional initial Hooks source for create_page operations. Supports {{pageRef:name}} placeholders for same-batch create_page.newPageRef values.',
              },
              viewportSize: {
                type: 'string',
                enum: ['2XL', 'XL', 'LG', 'MD', 'SM', 'XS'],
              },
              theme: {
                type: 'string',
                enum: ['light', 'dark'],
              },
              name: {
                type: 'string',
                description: 'Replacement project name for rename_project operations.',
              },
            },
          },
        },
        assertions: {
          type: 'object',
          additionalProperties: false,
          description:
            'Optional final-state assertions. Use for replacement tasks to prevent wasteful or incoherent output.',
          properties: {
            pageCount: {
              type: 'integer',
              description: 'Expected final number of Arcade pages.',
            },
            startPage: {
              type: 'string',
              description: 'Expected final Start page id, or "first" for the first ordered page.',
            },
            activePage: {
              type: 'string',
              description: 'Expected final Active page id, or "first" for the first ordered page.',
            },
            forbidImports: {
              type: 'boolean',
              description: 'When true, reject final source containing import statements.',
            },
          },
        },
      },
    },
  },
]

const stripSchemaMetadata = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(stripSchemaMetadata)
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== '$schema' && key !== 'description')
        .map(([key, entryValue]) => [key, stripSchemaMetadata(entryValue)])
    )
  }

  return value
}

const expectedStableResources = [
  {
    uri: 'arcade://desktop/start-here',
    name: 'Desktop Arcade MCP start-here guide',
    description: 'Minimal first-read guide for zero-knowledge MCP clients.',
    mimeType: 'text/markdown',
  },
  {
    uri: 'arcade://desktop/workflows/replace-project',
    name: 'Desktop Arcade replace-project workflow',
    description: 'Scoped workflow for replacing existing Arcade project content without waste.',
    mimeType: 'text/markdown',
  },
  {
    uri: 'arcade://desktop/workflows/multi-page-navigation',
    name: 'Desktop Arcade multi-page navigation workflow',
    description: 'Rules and examples for page navigation in Arcade source.',
    mimeType: 'text/markdown',
  },
  {
    uri: 'arcade://desktop/operating-guide',
    name: 'Desktop Arcade MCP operating guide',
    description: 'Short operating instructions for the Desktop Arcade MCP server.',
    mimeType: 'text/markdown',
  },
  {
    uri: 'arcade://desktop/authoring-guide',
    name: 'Desktop Arcade MCP authoring guide',
    description: 'Short Arcade authoring guidance for MCP clients.',
    mimeType: 'text/markdown',
  },
  {
    uri: 'arcade://desktop/capabilities',
    name: 'Desktop Arcade MCP capabilities',
    description: 'Machine-readable Desktop Arcade MCP contract and omissions.',
    mimeType: 'application/json',
  },
  {
    uri: 'arcade://desktop/apply-changes-operations',
    name: 'Desktop Arcade apply_changes operations reference',
    description: 'Per-operation field matrix and batch ordering rules for apply_changes.',
    mimeType: 'text/markdown',
  },
  {
    uri: 'arcade://aksel/catalog',
    name: 'Aksel component catalog (version-matched)',
    description:
      'On-demand index of Aksel components available in Arcade, each with a snippet-resource URI. Pull one component at a time.',
    mimeType: 'application/json',
  },
  {
    uri: 'arcade://project/manifest',
    name: 'Active Arcade project manifest',
    description: 'Primary discovery resource for the active Arcade project.',
    mimeType: 'application/json',
  },
  {
    uri: 'arcade://project/annotations',
    name: 'Active Arcade project annotations',
    description:
      'Project-wide non-dead annotations, including resolved and dismissed history plus per-status counts.',
    mimeType: 'application/json',
  },
  {
    uri: 'arcade://project/preview-context',
    name: 'Active Arcade project preview context',
    description: 'Saved preview theme and viewport preferences for the active Arcade project.',
    mimeType: 'application/json',
  },
  {
    uri: 'arcade://project/diagnostics',
    name: 'Active Arcade project diagnostics',
    description: 'Compact Arcade-scoped diagnostics for the active Arcade project.',
    mimeType: 'application/json',
  },
]

const waitForDefaultPreview = async (page: Page) => {
  await expect(page.locator('[data-testid="preview-iframe"]')).toBeVisible({ timeout: 15_000 })
}

const parseResponseBody = async (response: Response) => {
  const text = await response.text()
  if (text.startsWith('event:')) {
    const dataLines = text
      .split('\n')
      .filter((line) => line.startsWith('data: '))
      .map((line) => line.slice('data: '.length))

    return JSON.parse(dataLines.join('\n')) as Record<string, unknown>
  }

  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    return text
  }
}

const sendRequest = async ({
  path = desktopMcpPath,
  method = 'POST',
  headers = {},
  body,
}: {
  path?: string
  method?: string
  headers?: Record<string, string>
  body?: string
}) => {
  const response = await fetch(new URL(path, desktopMcpUrl), {
    method,
    headers,
    body,
  })

  return {
    response,
    payload: await parseResponseBody(response),
  }
}

const sendJsonRpcRequest = async (
  payload: Record<string, unknown>,
  headers: Record<string, string> = {}
) =>
  sendRequest({
    headers: {
      accept: 'application/json, text/event-stream',
      'content-type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(payload),
  })

test.describe('Issue #343 Desktop MCP contract baseline', () => {
  test.beforeAll(() => {
    execFileSync(npmCommand, ['run', 'desktop:build'], { stdio: 'inherit' })
  })

  test('locks the public Desktop MCP contract at the HTTP seam', async () => {
    test.setTimeout(180_000)

    const app: ElectronApplication = await electron.launch({
      args: ['desktop/main.cjs'],
      env: {
        ...process.env,
        AKSEL_ARCADE_RENDERER_URL: desktopRendererUrl,
      },
    })

    try {
      const page = await app.firstWindow()
      await waitForDefaultPreview(page)

      const initialize = await sendJsonRpcRequest({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: {
            name: 'playwright',
            version: '1.0.0',
          },
        },
      })
      expect(initialize.response.status).toBe(200)
      const initializeInstructions = (initialize.payload as { result: { instructions: string } }).result
        .instructions
      expect((initialize.payload as { result: { protocolVersion: string } }).result.protocolVersion).toBe(
        '2025-06-18'
      )
      expect(initialize.payload).toMatchObject({
        jsonrpc: '2.0',
        id: 1,
        result: {
          protocolVersion: '2025-06-18',
          capabilities: {
            tools: {
              listChanged: false,
            },
            resources: {
              subscribe: false,
              listChanged: false,
            },
          },
          serverInfo: {
            name: 'aksel-arcade',
            version: expect.any(String),
          },
          instructions: expect.stringContaining('arcade://desktop/start-here'),
        },
      })
      for (const line of expectedInstructionLines) {
        expect(initializeInstructions).toContain(line)
      }

      const toolsList = await sendJsonRpcRequest({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
      })
      expect(toolsList.response.status).toBe(200)
      const listedTools = (toolsList.payload as { result: { tools: Array<Record<string, unknown>> } }).result.tools
      expect(listedTools.map((tool) => tool.name)).toEqual(expectedToolNames)
      expect(
        listedTools.map((tool) => ({
          name: tool.name,
          inputSchema: stripSchemaMetadata(tool.inputSchema),
        }))
      ).toMatchObject(
        expectedToolDefinitions.map(({ name, inputSchema }) => ({
          name,
          inputSchema: stripSchemaMetadata(inputSchema),
        }))
      )

      const resourcesList = await sendJsonRpcRequest({
        jsonrpc: '2.0',
        id: 3,
        method: 'resources/list',
      })
      expect(resourcesList.response.status).toBe(200)
      expect(resourcesList.payload).toMatchObject({
        jsonrpc: '2.0',
        id: 3,
      })

      const listedResources = (resourcesList.payload as { result: { resources: Array<Record<string, unknown>> } })
        .result.resources
      const stableResources = listedResources.filter((resource) =>
        expectedStableResources.some((expectedResource) => expectedResource.uri === resource.uri)
      )
      expect(
        stableResources.map((resource) => ({
          uri: resource.uri,
          mimeType: resource.mimeType,
        }))
      ).toEqual(
        expectedStableResources.map((resource) => ({
          uri: resource.uri,
          mimeType: resource.mimeType,
        }))
      )

      const manifestRead = await sendJsonRpcRequest({
        jsonrpc: '2.0',
        id: 4,
        method: 'resources/read',
        params: {
          uri: 'arcade://project/manifest',
        },
      })
      expect(manifestRead.response.status).toBe(200)
      expect(manifestRead.payload).toMatchObject({
        jsonrpc: '2.0',
        id: 4,
        result: {
          contents: [
            {
              uri: 'arcade://project/manifest',
              mimeType: 'application/json',
              text: expect.any(String),
            },
          ],
        },
      })

      const manifest = JSON.parse(
        (
          manifestRead.payload as {
            result: { contents: Array<{ text: string }> }
          }
        ).result.contents[0].text
      ) as {
        activePageId: string
        projectRevision: string
        globalConfig: {
          source: {
            jsx: { uri: string }
            hooks: { uri: string }
          }
        }
        pages: Array<{
          id: string
          source: {
            jsx: { uri: string }
            hooks: { uri: string }
          }
        }>
      }
      expect(manifest.projectRevision).toEqual(expect.any(String))
      expect(manifest.activePageId).toEqual(expect.any(String))
      expect(manifest.pages.length).toBeGreaterThan(0)
      expect(manifest.globalConfig).toMatchObject({
        source: {
          jsx: { uri: 'arcade://project/source/global/jsx' },
          hooks: { uri: 'arcade://project/source/global/hooks' },
        },
      })
      expect(listedResources.map((resource) => resource.uri)).toEqual(
        expect.arrayContaining([
          ...manifest.pages.flatMap((entry) => [`arcade://project/pages/${entry.id}/annotations`]),
        ])
      )

      const startHereRead = await sendJsonRpcRequest({
        jsonrpc: '2.0',
        id: 5,
        method: 'resources/read',
        params: {
          uri: 'arcade://desktop/start-here',
        },
      })
      expect(startHereRead.response.status).toBe(200)
      expect(startHereRead.payload).toMatchObject({
        jsonrpc: '2.0',
        id: 5,
        result: {
          contents: [
            {
              uri: 'arcade://desktop/start-here',
              mimeType: 'text/markdown',
              text: expect.any(String),
            },
          ],
        },
      })
      const startHereText = (
        startHereRead.payload as {
          result: { contents: Array<{ text: string }> }
        }
      ).result.contents[0].text
      expect(startHereText).toContain('# Desktop Arcade MCP start-here')
      expect(startHereText).toContain('This is the only on-ramp you need')
      expect(startHereText).toContain('Never write `import` statements.')
      expect(startHereText).toContain('Make durable edits with `apply_changes`')

      const capabilitiesRead = await sendJsonRpcRequest({
        jsonrpc: '2.0',
        id: 6,
        method: 'resources/read',
        params: {
          uri: 'arcade://desktop/capabilities',
        },
      })
      expect(capabilitiesRead.response.status).toBe(200)
      const capabilitiesText = (
        capabilitiesRead.payload as {
          result: { contents: Array<{ uri: string; mimeType: string; text: string }> }
        }
      ).result.contents[0]
      expect(capabilitiesText).toMatchObject({
        uri: 'arcade://desktop/capabilities',
        mimeType: 'application/json',
      })
      const capabilities = JSON.parse(capabilitiesText.text) as {
        endpoint: string
        requiresAuth: boolean
        toolNames: string[]
        stableResourceUris: string[]
      }
      expect(capabilities.endpoint).toBe(desktopMcpUrl)
      expect(capabilities.requiresAuth).toBe(false)
      expect(capabilities.toolNames).toEqual(expectedToolNames)
      expect(capabilities.stableResourceUris).toEqual(
        expect.arrayContaining(expectedStableResources.map((resource) => resource.uri))
      )

      const readResourceSuccess = await sendJsonRpcRequest({
        jsonrpc: '2.0',
        id: 7,
        method: 'tools/call',
        params: {
          name: 'read_resource',
          arguments: {
            uri: 'arcade://desktop/start-here',
          },
        },
      })
      expect(readResourceSuccess.response.status).toBe(200)
      expect(readResourceSuccess.payload).toMatchObject({
        jsonrpc: '2.0',
        id: 7,
        result: {
          content: [
            {
              type: 'text',
            },
          ],
          structuredContent: {
            ok: true,
            uri: 'arcade://desktop/start-here',
            mimeType: 'text/markdown',
            text: expect.any(String),
          },
        },
      })
      expect(
        (
          readResourceSuccess.payload as {
            result: {
              structuredContent: { text: string }
            }
          }
        ).result.structuredContent.text
      ).toContain('# Desktop Arcade MCP start-here')

      const listAnnotationsSuccess = await sendJsonRpcRequest({
        jsonrpc: '2.0',
        id: 8,
        method: 'tools/call',
        params: {
          name: 'list_annotations',
          arguments: {},
        },
      })
      expect(listAnnotationsSuccess.response.status).toBe(200)
      expect(listAnnotationsSuccess.payload).toMatchObject({
        jsonrpc: '2.0',
        id: 8,
        result: {
          structuredContent: {
            ok: true,
            scope: 'page',
            status: 'open',
            resourceUri: `arcade://project/pages/${manifest.activePageId}/annotations`,
            annotations: expect.any(Array),
          },
        },
      })

      const readResourceDomainError = await sendJsonRpcRequest({
        jsonrpc: '2.0',
        id: 9,
        method: 'tools/call',
        params: {
          name: 'read_resource',
          arguments: {
            uri: 'arcade://desktop/not-a-resource',
          },
        },
      })
      expect(readResourceDomainError.response.status).toBe(200)
      expect(readResourceDomainError.payload).toMatchObject({
        jsonrpc: '2.0',
        id: 9,
        result: {
          isError: true,
          structuredContent: {
            code: 'resource-not-found',
            toolName: 'read_resource',
            message: expect.any(String),
            resourceUri: 'arcade://desktop/not-a-resource',
          },
        },
      })
      expect(
        (
          readResourceDomainError.payload as {
            result: { structuredContent: { message: string } }
          }
        ).result.structuredContent.message
      ).toContain('arcade://desktop/not-a-resource')

      const invalidCaptureArguments = await sendJsonRpcRequest({
        jsonrpc: '2.0',
        id: 10,
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
      expect(invalidCaptureArguments.response.status).toBe(200)
      expect(invalidCaptureArguments.payload).toMatchObject({
        jsonrpc: '2.0',
        id: 10,
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

      const wrongPath = await sendRequest({
        path: '/not-mcp',
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 11,
          method: 'tools/list',
        }),
      })
      expect(wrongPath.response.status).toBe(404)
      expect(wrongPath.payload).toBe('Desktop Arcade MCP endpoint not found.')

      const getRequest = await sendRequest({
        method: 'GET',
        headers: {
          accept: 'application/json, text/event-stream',
        },
      })
      expect(getRequest.response.status).toBe(405)
      expect(getRequest.response.headers.get('allow')).toBe('POST')
      expect(getRequest.payload).toBe(
        'Desktop Arcade MCP v1 supports POST JSON-RPC requests only and does not support GET or SSE streams.'
      )

      const malformedJson = await sendRequest({
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
        },
        body: '{invalid',
      })
      expect(malformedJson.response.status).toBe(400)
      expect(malformedJson.payload).toEqual({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32700,
          message: 'Desktop Arcade MCP request body must be valid JSON.',
        },
      })

      const oversizedRequest = await sendRequest({
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
        },
        body: `${'x'.repeat(1024 * 1024 + 1)}`,
      })
      expect(oversizedRequest.response.status).toBe(413)
      expect(oversizedRequest.payload).toEqual({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32000,
          message: 'Desktop Arcade MCP request body exceeds the 1MB limit.',
        },
      })

      const browserOrigin = await sendJsonRpcRequest(
        {
          jsonrpc: '2.0',
          id: 12,
          method: 'tools/list',
        },
        {
          origin: 'https://example.com',
        }
      )
      expect(browserOrigin.response.status).toBe(403)
      expect(browserOrigin.payload).toBe(
        'Desktop Arcade MCP accepts only non-browser local MCP clients. Remove the Origin header and use POST JSON-RPC requests.'
      )
    } finally {
      await app.close()
    }
  })
})
