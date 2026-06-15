import { expect, test, type Page } from '@playwright/test'

const LEGACY_AGENT_BRIDGE_GLOBAL = '__AKSEL_ARCADE_AGENT_BRIDGE__'
const TEST_AGENT_TRANSPORT_GLOBAL = '__AKSEL_ARCADE_TEST_AGENT_TRANSPORT__'
const COPIED_AGENT_HANDOFF_GLOBAL = '__AKSEL_ARCADE_COPIED_AGENT_HANDOFF__'

interface AgentBridgeCommandResult<TData> {
  ok: boolean
  data?: TData
  error?: {
    code: string
    message: string
  }
}

interface AgentInstructionsPayload {
  instructionsMarkdown: string
  endpoint: string
  authorizationHeader: string
  permissions: {
    previewEvidence: boolean
  }
  commandNames: string[]
  protocol: {
    transport: string
    format: string
  }
}

interface AgentProject {
  name: string
  pageMode: 'multi-page'
  jsxCode: string
  hooksCode: string
  globalConfig: {
    jsxCode: string
    hooksCode: string
  }
  pages: Array<{
    id: string
    name: string
    jsxCode: string
    hooksCode: string
  }>
  startPageId: string
  activePageId: string
}

interface AgentDiagnostics {
  status: string
  compileError: unknown | null
  runtimeError: {
    message: string
    componentStack: string | null
    stack: string
  } | null
  sandboxConsoleMessages: Array<{
    level: string
    message: string
  }>
}

interface AgentChangeResult {
  changedFields: string[]
}

interface PreviewEvidenceElement {
  tagName: string
  text?: string
  children?: PreviewEvidenceElement[]
}

interface PreviewEvidence {
  frame: {
    rootSelector: string
    capturedElementCount: number
    truncated: boolean
  }
  tree: PreviewEvidenceElement
}

type AgentJsonRpcId = string | number | null

interface AgentJsonRpcRequest {
  jsonrpc: '2.0'
  id: AgentJsonRpcId
  method: string
  params?: unknown
}

interface AgentJsonRpcResponse {
  jsonrpc: '2.0'
  id: AgentJsonRpcId
  result?: AgentBridgeCommandResult<unknown>
  error?: {
    code: number
    message: string
    data?: unknown
  }
}

interface ParsedAgentPairingHandoff {
  endpoint: string
  authorizationHeader: string
  body: AgentJsonRpcRequest
}

interface TestAgentTransport {
  hasHandler: () => boolean
  route: (request: { id: AgentJsonRpcId; method: string; params?: unknown; sessionId?: string }) =>
    | {
        jsonrpc?: '2.0'
        id?: AgentJsonRpcId
        result: AgentBridgeCommandResult<unknown>
      }
    | {
        jsonrpc?: '2.0'
        id?: AgentJsonRpcId
        error: unknown
      }
  routeJsonRpc: (request: {
    endpoint: string
    authorizationHeader: string
    body: AgentJsonRpcRequest
  }) => Promise<AgentJsonRpcResponse>
}

const installDesktopAgentSurface = async (page: Page) => {
  await page.addInitScript(() => {
    const testTransportGlobal = '__AKSEL_ARCADE_TEST_AGENT_TRANSPORT__'
    const copiedAgentHandoffGlobal = '__AKSEL_ARCADE_COPIED_AGENT_HANDOFF__'
    let transportRequestHandler:
      | ((request: {
          id: AgentJsonRpcId
          method: string
          params?: unknown
          sessionId: string
        }) => unknown)
      | null = null
    const endpointFixture = {
      endpoint: 'http://127.0.0.1:48123',
      sessionId: '11111111-1111-4111-8111-111111111111',
      authorizationHeader: 'Bearer copied-agent-secret',
    }
    let activeEndpoint = { ...endpointFixture }

    Object.defineProperty(navigator, 'userAgent', {
      value: `${navigator.userAgent} Electron/42.0.0`,
      configurable: true,
    })
    ;(window as unknown as Record<string, string>)[copiedAgentHandoffGlobal] = ''
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: (text: string) => {
          ;(window as unknown as Record<string, string>)[copiedAgentHandoffGlobal] = text
          return Promise.resolve()
        },
      },
      configurable: true,
    })

    window.__AKSEL_ARCADE_DESKTOP__ = {
      getShellCapabilities: async () => ({
        surface: 'desktop',
        shareUrl: { enabled: false },
        agentSessions: { enabled: true },
        projectPackages: {
          enabled: true,
          defaultExtension: '.akselarcade',
          legacyJsonImport: false,
        },
      }),
      startAgentTransportSession: async (session) => {
        activeEndpoint = { ...endpointFixture, sessionId: session.id }
        return activeEndpoint
      },
      stopAgentTransportSession: async () => {
        transportRequestHandler = null
      },
      setAgentTransportRequestHandler: (handler: typeof transportRequestHandler) => {
        transportRequestHandler = handler
      },
    }
    ;(window as unknown as Record<string, TestAgentTransport>)[testTransportGlobal] = {
      hasHandler: () => Boolean(transportRequestHandler),
      route: (request) => {
        if (!transportRequestHandler) {
          throw new Error('Desktop Agent transport handler is not registered.')
        }

        return transportRequestHandler({
          ...request,
          sessionId: request.sessionId ?? activeEndpoint.sessionId,
        }) as ReturnType<TestAgentTransport['route']>
      },
      routeJsonRpc: async (request) => {
        if (request.endpoint !== activeEndpoint.endpoint) {
          return {
            jsonrpc: '2.0',
            id: request.body.id,
            error: {
              code: -32001,
              message: 'Agent endpoint does not match the active Desktop transport endpoint.',
            },
          }
        }

        if (request.authorizationHeader !== activeEndpoint.authorizationHeader) {
          return {
            jsonrpc: '2.0',
            id: request.body.id,
            error: {
              code: -32002,
              message: 'Agent Authorization header does not match the active pairing credential.',
            },
          }
        }

        if (!transportRequestHandler) {
          throw new Error('Desktop Agent transport handler is not registered.')
        }

        return (await transportRequestHandler({
          id: request.body.id,
          method: request.body.method,
          params: request.body.params,
          sessionId: activeEndpoint.sessionId,
        })) as AgentJsonRpcResponse
      },
    }
  })
}

const startAgentAccess = async (page: Page) => {
  await page.getByTestId('agent-session-menu').click()
  await page.getByRole('menuitemcheckbox', { name: 'Agent-tilgang' }).click()
  await page.waitForFunction(
    (globalName) =>
      Boolean((window as unknown as Record<string, TestAgentTransport>)[globalName]?.hasHandler()),
    TEST_AGENT_TRANSPORT_GLOBAL
  )
  await expect
    .poll(() =>
      page.evaluate(
        (globalName) => (window as unknown as Record<string, unknown>)[globalName] === undefined,
        LEGACY_AGENT_BRIDGE_GLOBAL
      )
    )
    .toBe(true)
}

const copyAgentPairingHandoff = async (page: Page): Promise<string> => {
  const copyItem = page.getByRole('menuitem', { name: 'Kopier agentkommando' })
  if (!(await copyItem.isVisible())) {
    await page.getByTestId('agent-session-menu').click()
  }
  await expect(copyItem).toBeVisible()
  await copyItem.click()

  const copiedCommandHandle = await page.waitForFunction<string | null, string>(
    (globalName) => (window as unknown as Record<string, string>)[globalName] || null,
    COPIED_AGENT_HANDOFF_GLOBAL
  )
  const copiedCommand = await copiedCommandHandle.jsonValue()
  if (!copiedCommand) {
    throw new Error('Agent pairing handoff was not copied.')
  }

  return copiedCommand
}

const parseAgentPairingHandoff = (command: string): ParsedAgentPairingHandoff => {
  const match = command.match(
    /^curl -sS -X POST '([^']+)' -H 'Authorization: ([^']+)' -H 'Content-Type: application\/json' --data '([^']+)'$/
  )
  if (!match) {
    throw new Error(`Unexpected Agent pairing handoff shape: ${command}`)
  }

  const body = JSON.parse(match[3] ?? '{}') as AgentJsonRpcRequest
  expect(body).toMatchObject({
    jsonrpc: '2.0',
    id: 'agent-instructions-1',
    method: 'getAgentInstructions',
  })

  return {
    endpoint: match[1] ?? '',
    authorizationHeader: match[2] ?? '',
    body,
  }
}

const callAgentJsonRpc = async <TData,>(
  page: Page,
  endpoint: string,
  authorizationHeader: string,
  body: AgentJsonRpcRequest
): Promise<AgentBridgeCommandResult<TData>> =>
  page.evaluate(
    async ({ authorizationHeader, body, endpoint, globalName }) => {
      const transport = (window as unknown as Record<string, TestAgentTransport>)[globalName]
      if (!transport) {
        throw new Error('Agent transport is not available.')
      }

      const response = await transport.routeJsonRpc({
        endpoint,
        authorizationHeader,
        body,
      })
      if (response.error) {
        throw new Error(`Agent JSON-RPC request failed: ${response.error.message}`)
      }
      if (!response.result) {
        throw new Error('Agent JSON-RPC response did not include a result.')
      }

      return response.result as AgentBridgeCommandResult<TData>
    },
    {
      authorizationHeader,
      body,
      endpoint,
      globalName: TEST_AGENT_TRANSPORT_GLOBAL,
    }
  )

const callAgentCommand = async <TData,>(
  page: Page,
  instructions: AgentInstructionsPayload,
  method: string,
  params?: unknown
): Promise<AgentBridgeCommandResult<TData>> =>
  callAgentJsonRpc<TData>(page, instructions.endpoint, instructions.authorizationHeader, {
    jsonrpc: '2.0',
    id: `${method}-1`,
    method,
    ...(params === undefined ? {} : { params }),
  })

const expectAgentResultData = <TData,>(result: AgentBridgeCommandResult<TData>): TData => {
  expect(result.ok).toBe(true)
  if (!result.ok || result.data === undefined) {
    throw new Error(result.error?.message ?? 'Agent bridge command failed.')
  }

  return result.data
}

const waitForDiagnosticsToSettle = async (
  page: Page,
  instructions: AgentInstructionsPayload
): Promise<AgentDiagnostics> => {
  let settledDiagnostics: AgentDiagnostics | null = null

  await expect
    .poll(
      async () => {
        const diagnostics = expectAgentResultData(
          await callAgentCommand<AgentDiagnostics>(page, instructions, 'getDiagnostics')
        )
        if (diagnostics.status === 'idle' || diagnostics.status === 'error') {
          settledDiagnostics = diagnostics
        }

        return diagnostics.status
      },
      { timeout: 10_000 }
    )
    .toMatch(/^(idle|error)$/)

  if (!settledDiagnostics) {
    throw new Error('Diagnostics did not settle.')
  }

  return settledDiagnostics
}

const evidenceTreeContainsText = (element: PreviewEvidenceElement, text: string): boolean => {
  if (element.text?.includes(text)) {
    return true
  }

  return element.children?.some((child) => evidenceTreeContainsText(child, text)) ?? false
}

const readDiagnostics = async (page: Page): Promise<AgentDiagnostics> =>
  page.evaluate((globalName) => {
    const transport = (window as unknown as Record<string, TestAgentTransport>)[globalName]
    if (!transport) {
      throw new Error('Agent transport is not available.')
    }

    const response = transport.route({
      id: 'diagnostics-1',
      method: 'getDiagnostics',
    })
    if ('error' in response) {
      throw new Error('Agent diagnostics transport read failed.')
    }

    const result = response.result as AgentBridgeCommandResult<AgentDiagnostics>
    if (!result.ok || !result.data) {
      throw new Error('Agent diagnostics read failed.')
    }

    return result.data
  }, TEST_AGENT_TRANSPORT_GLOBAL)

test.describe('Agent diagnostics', () => {
  test('validates the Agent operating instructions happy path from the copied handoff', async ({
    page,
  }) => {
    await installDesktopAgentSurface(page)
    await page.goto('/')

    const iframe = page.frameLocator('.live-preview__iframe')
    await expect(iframe.getByText('Welcome to Aksel Arcade!')).toBeVisible({ timeout: 10_000 })

    await startAgentAccess(page)

    const handoffCommand = await copyAgentPairingHandoff(page)
    expect(handoffCommand).not.toContain('\n')
    expect(handoffCommand).toContain('"method":"getAgentInstructions"')
    expect(handoffCommand).not.toMatch(/\b(Copilot|provider-specific)\b/i)

    const handoff = parseAgentPairingHandoff(handoffCommand)
    const instructionsResult = await callAgentJsonRpc<AgentInstructionsPayload>(
      page,
      handoff.endpoint,
      handoff.authorizationHeader,
      handoff.body
    )
    const instructions = expectAgentResultData(instructionsResult)
    const serializedInstructions = JSON.stringify(instructions)

    expect(instructions.instructionsMarkdown).toMatch(/authoritative/i)
    expect(instructions.instructionsMarkdown).toMatch(/Call getProject first/i)
    expect(instructions.instructionsMarkdown).toMatch(
      /poll getDiagnostics until the preview settles/i
    )
    expect(instructions.instructionsMarkdown).not.toMatch(/experimental multi-page/i)
    expect(instructions.commandNames).toEqual(
      expect.arrayContaining([
        'getProject',
        'getDiagnostics',
        'getPreviewEvidence',
        'applyAgentChange',
        'createPage',
        'renamePage',
        'deletePage',
        'setStartPage',
        'selectActivePage',
      ])
    )
    expect(instructions.protocol).toMatchObject({
      transport: 'desktop-loopback-http',
      format: 'json-rpc-2.0',
    })
    expect(serializedInstructions).not.toContain('Welcome to Aksel Arcade')
    expect(serializedInstructions).not.toContain('Untitled Project')
    expect(serializedInstructions).not.toContain('A browser-based React playground')
    expect(serializedInstructions).not.toMatch(/\b(Copilot|provider-specific)\b/i)

    const initialProject = expectAgentResultData(
      await callAgentCommand<AgentProject>(page, instructions, 'getProject')
    )
    expect(initialProject).toMatchObject({
      name: 'Untitled Project',
      pageMode: 'multi-page',
      globalConfig: {
        jsxCode: '',
        hooksCode: '',
      },
      pages: [expect.objectContaining({ id: 'page01', name: 'Page 1' })],
      startPageId: 'page01',
      activePageId: 'page01',
    })
    expect(initialProject.jsxCode).toContain('Welcome to Aksel Arcade')

    const happyPathText = 'Agent happy path verified'
    const nextHooks = 'export const useAgentHappyPath = () => "ready"'
    const nextJsx = `export default function App() {
  return (
    <Box padding="space-16">
      <Heading size="medium" level="1">
        ${happyPathText}
      </Heading>
      <Button variant="primary">Done</Button>
    </Box>
  )
}`
    const changeResult = expectAgentResultData(
      await callAgentCommand<AgentChangeResult>(page, instructions, 'applyAgentChange', {
        summary: 'Validate Agent operating instructions happy path',
        target: { type: 'page', pageId: initialProject.activePageId },
        jsxCode: nextJsx,
        hooksCode: nextHooks,
        viewportSize: 'SM',
        theme: 'light',
        name: 'Agent happy path',
      })
    )

    expect(changeResult.changedFields).toEqual([
      'jsxCode',
      'hooksCode',
      'viewportSize',
      'theme',
      'name',
    ])

    const diagnostics = await waitForDiagnosticsToSettle(page, instructions)
    expect(diagnostics.status).toBe('idle')
    expect(diagnostics.compileError).toBeNull()
    expect(diagnostics.runtimeError).toBeNull()

    await expect(iframe.getByText(happyPathText)).toBeVisible({ timeout: 10_000 })

    const updatedProject = expectAgentResultData(
      await callAgentCommand<AgentProject>(page, instructions, 'getProject')
    )
    expect(updatedProject).toMatchObject({
      name: 'Agent happy path',
      pageMode: 'multi-page',
      jsxCode: nextJsx,
      hooksCode: nextHooks,
      globalConfig: {
        jsxCode: '',
        hooksCode: '',
      },
      pages: [
        {
          id: 'page01',
          name: 'Page 1',
          jsxCode: nextJsx,
          hooksCode: nextHooks,
        },
      ],
      startPageId: 'page01',
      activePageId: 'page01',
    })

    if (instructions.permissions.previewEvidence) {
      const evidence = expectAgentResultData(
        await callAgentCommand<PreviewEvidence>(page, instructions, 'getPreviewEvidence')
      )
      expect(evidence.frame).toMatchObject({
        rootSelector: '#root',
        truncated: false,
      })
      expect(evidence.frame.capturedElementCount).toBeGreaterThan(0)
      expect(evidenceTreeContainsText(evidence.tree, happyPathText)).toBe(true)
    }
  })

  test('surfaces sandbox React render failures as structured runtime diagnostics', async ({
    page,
  }) => {
    await installDesktopAgentSurface(page)
    await page.goto('/')

    const iframe = page.frameLocator('.live-preview__iframe')
    await expect(iframe.locator('#root > *')).toBeVisible({ timeout: 10_000 })

    await startAgentAccess(page)

    const applyResult = await page.evaluate((globalName) => {
      const transport = (window as unknown as Record<string, TestAgentTransport>)[globalName]
      if (!transport) {
        throw new Error('Agent transport is not available.')
      }

      const response = transport.route({
        id: 'change-1',
        method: 'applyAgentChange',
        params: {
          summary: 'Trigger render failure',
          jsxCode: `export default function App() {
  throw new Error('Agent render exploded')
}`,
        },
      })
      if ('error' in response) {
        throw new Error('Agent change transport request failed.')
      }

      return response.result
    }, TEST_AGENT_TRANSPORT_GLOBAL)

    expect(applyResult.ok).toBe(true)

    await expect
      .poll(async () => (await readDiagnostics(page)).runtimeError?.message ?? null, {
        timeout: 5_000,
      })
      .toContain('Agent render exploded')

    const diagnostics = await readDiagnostics(page)
    expect(diagnostics.status).toBe('error')
    expect(diagnostics.runtimeError?.componentStack).toContain('App')
  })
})
