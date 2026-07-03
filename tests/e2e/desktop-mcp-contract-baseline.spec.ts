import { execFileSync } from 'node:child_process'
import { expect, test, type Page } from '@playwright/test'
import { _electron as electron, type ElectronApplication } from 'playwright'

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const desktopRendererUrl = 'aksel-arcade://app/index.html'
const desktopMcpUrl = 'http://127.0.0.1:3846/mcp'
const desktopMcpPath = '/mcp'
const expectedInstructionLines = [
  'Desktop Arcade is a live sandbox for prototyping any UI with the Aksel design system. Build whatever the task needs — it is not limited to any one kind of screen.',
  'Start by reading arcade://desktop/start-here — it is self-sufficient: one read plus arcade://project/manifest is enough to author. If your MCP host exposes only tools, call read_resource({ uri: "arcade://desktop/start-here" }).',
  'Source is import-free: React, Aksel components, Aksel icons, and hooks are injected globals — never add import statements.',
  'Each Arcade page (and Global config) has two source tabs: jsx and hooks. The jsx source is inlined into return ( … ), so it must be a single JSX element/expression and must never be wrapped in { … }; put page-level top-level hook bindings such as const [value, setValue] = useState(...) in the page Hooks tab, and treat Global config hooks as module scope where you define shared custom hooks, helpers, constants, and components and never call hooks at the top level.',
  'Use real Aksel components and props; do not hand-roll raw HTML or guess prop names. If an Aksel component resource resolves to a replacement payload, follow the sanctioned replacement instead of authoring the hidden/deprecated component. Per-component usage and runnable, version-matched snippets are available on demand — do not load them until you reach for a given component.',
  'Navigate between pages with goToPage("pageNN"), or an Aksel Link/LinkCard whose href/to is a bare page id; the current page id is injected read-only as currentPageId. There is no router and no <a href> navigation.',
  'Page ids are assigned by the app. Within one apply_changes batch, link pages with {{pageRef:name}} placeholders targeting any create_page.newPageRef declared in that batch.',
  'Annotation work is Arcade-native: list open work with list_annotations, read arcade://project/annotations or arcade://project/pages/{pageId}/annotations for non-dead history, and treat hidden targets as real work even when they are outside the current viewport.',
  'Working loop: apply_changes, then read arcade://project/diagnostics, then capture_preview_evidence to inspect. Capture is an isolated throwaway render — it never changes the durable Active page.',
  'Deeper references are on demand, not required before authoring: arcade://desktop/authoring-guide (depth + Aksel snippet reach paths), arcade://desktop/apply-changes-operations, the workflow guides, and the Aksel catalog.',
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
          uniqueItems: true,
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
              type: 'number',
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

const expectedStartHereText = `# Desktop Arcade MCP start-here

This is the only on-ramp you need: reading this once plus \`arcade://project/manifest\` is enough to start authoring. Treat this MCP server as the only source of truth for the active Desktop Arcade project — do not inspect the repository or local files.

## First steps
1. If your client has resource methods, read \`arcade://project/manifest\`. If it only has tools, call \`read_resource\` with that URI.
2. Read the source URIs listed in the manifest before editing existing work.
3. For annotation review work, call \`list_annotations\` first or read \`arcade://project/annotations\` / \`arcade://project/pages/{pageId}/annotations\` for non-dead history and counts. Use \`watch_annotations\` for pending-only long-polling and \`acknowledge_annotation\` / \`resolve_annotation\` / \`dismiss_annotation\` / \`reply_to_annotation\` to change annotation state or thread history.
4. Make durable edits with \`apply_changes\`, then read \`arcade://project/diagnostics\`, then use \`capture_preview_evidence\` for rendered proof.

## Authoring mechanics you cannot infer (read before writing source)
- **Import-free:** React, Aksel components, Aksel icons, and hooks are injected globals. Never write \`import\` statements.
- **jsx vs hooks:** every Arcade page (and Global config) has two source tabs, \`jsx\` and \`hooks\`. The \`jsx\` source is inlined into \`return ( … )\`, so it must be a single JSX element/expression and must **never** be wrapped in \`{ … }\` (a leading \`{\` parses as an object literal and breaks the whole preview). In a page \`hooks\` tab, top-level hook bindings such as \`const [value, setValue] = useState(...)\` or \`const id = useId()\` are hoisted into that page component, so page state belongs there. Global config \`hooks\` is module scope: define shared custom hooks, helpers, constants, and components there, but never call hooks at its top level.
- **Navigation:** move between pages with \`goToPage("pageNN")\`, or an Aksel \`Link\`/\`LinkCard\` whose \`href\`/\`to\` is a bare page id. The current page id is injected read-only as \`currentPageId\`. There is no router and no \`<a href>\` navigation.
- **Page ids are app-assigned.** Within one \`apply_changes\` batch, link pages with \`{{pageRef:name}}\` placeholders targeting any \`create_page.newPageRef\` declared in that batch.
- **Use real Aksel components and props** — do not hand-roll raw HTML or guess prop names. If an Aksel component resource resolves to a replacement payload, follow the sanctioned replacement instead of reintroducing the hidden/deprecated component. Pull per-component usage on demand (see on-demand references); do not preload it.
- **Annotations are page-scoped review data.** \`list_annotations\` defaults to open work on the active page. Use \`watch_annotations\` for pending-only long-polling and the annotation mutation tools when you need to change state. The annotation resources keep non-dead history, while hidden-but-resolved targets still count as real work.
- **Global config** is shared code in scope for every page; it never renders as a page on its own.
- **Pages are independent screens.** They do not share React state; build a stateful flow as one page.
- **Capture is ephemeral:** \`capture_preview_evidence\` renders in an isolated throwaway frame, so in-capture interactions and \`goToPage\` never change the human-visible Active page or durable source — never try to "restore" the Active page after a capture.

## On-demand references (optional — fetch only when you need the depth)
- \`arcade://desktop/authoring-guide\` — fuller authoring rules and the priority order for fetching Aksel component usage/snippets.
- \`arcade://desktop/apply-changes-operations\` — the per-operation field matrix for \`apply_changes\`.
- \`arcade://desktop/workflows/replace-project\` — before replacing existing project content.
- \`arcade://desktop/workflows/multi-page-navigation\` — page-flow patterns in depth.
- \`arcade://aksel/catalog\` (+ one \`arcade://aksel/components/{name}\` at a time) — version-matched, import-free component snippets.`

const waitForDefaultPreview = async (page: Page) => {
  await expect(page.locator('[data-testid="preview-iframe"]')).toBeVisible({ timeout: 15_000 })
}

const parseResponseBody = async (response: Response) => {
  const text = await response.text()
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
      })
      expect(initialize.response.status).toBe(200)
      expect(initialize.payload).toEqual({
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
          instructions: expectedInstructionLines.join('\n'),
        },
      })

      const toolsList = await sendJsonRpcRequest({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
      })
      expect(toolsList.response.status).toBe(200)
      expect(toolsList.payload).toEqual({
        jsonrpc: '2.0',
        id: 2,
        result: {
          tools: expectedToolDefinitions,
        },
      })

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
      expect(stableResources).toEqual(expectedStableResources)

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
      expect(
        listedResources.map((resource) => resource.uri)
      ).toEqual(
        expect.arrayContaining([
          ...manifest.pages.flatMap((entry) => [
            `arcade://project/pages/${entry.id}/annotations`,
          ]),
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
      expect(startHereRead.payload).toEqual({
        jsonrpc: '2.0',
        id: 5,
        result: {
          contents: [
            {
              uri: 'arcade://desktop/start-here',
              mimeType: 'text/markdown',
              text: expectedStartHereText,
            },
          ],
        },
      })

      const readResourceSuccess = await sendJsonRpcRequest({
        jsonrpc: '2.0',
        id: 6,
        method: 'tools/call',
        params: {
          name: 'read_resource',
          arguments: {
            uri: 'arcade://desktop/start-here',
          },
        },
      })
      expect(readResourceSuccess.response.status).toBe(200)
      expect(readResourceSuccess.payload).toEqual({
        jsonrpc: '2.0',
        id: 6,
        result: {
          content: [
            {
              type: 'text',
              text: expectedStartHereText,
            },
          ],
          structuredContent: {
            ok: true,
            uri: 'arcade://desktop/start-here',
            mimeType: 'text/markdown',
            text: expectedStartHereText,
          },
        },
      })

      const readResourceDomainError = await sendJsonRpcRequest({
        jsonrpc: '2.0',
        id: 7,
        method: 'tools/call',
        params: {
          name: 'read_resource',
          arguments: {
            uri: 'arcade://desktop/not-a-resource',
          },
        },
      })
      expect(readResourceDomainError.response.status).toBe(200)
      expect(readResourceDomainError.payload).toEqual({
        jsonrpc: '2.0',
        id: 7,
        result: {
          content: [
            {
              type: 'text',
              text: 'Unknown Desktop Arcade MCP resource "arcade://desktop/not-a-resource".',
            },
          ],
          isError: true,
          structuredContent: {
            code: 'resource-not-found',
            toolName: 'read_resource',
            message: 'Unknown Desktop Arcade MCP resource "arcade://desktop/not-a-resource".',
            resourceUri: 'arcade://desktop/not-a-resource',
          },
        },
      })

      const wrongPath = await sendRequest({
        path: '/not-mcp',
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 8,
          method: 'tools/list',
        }),
      })
      expect(wrongPath.response.status).toBe(404)
      expect(wrongPath.payload).toBe('Desktop Arcade MCP endpoint not found.')

      const getRequest = await sendRequest({
        method: 'GET',
      })
      expect(getRequest.response.status).toBe(405)
      expect(getRequest.response.headers.get('allow')).toBe('POST')
      expect(getRequest.payload).toBe(
        'Desktop Arcade MCP v1 supports POST JSON-RPC requests only and does not support GET or SSE streams.'
      )

      const malformedJson = await sendRequest({
        headers: {
          'content-type': 'application/json',
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
          id: 9,
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
