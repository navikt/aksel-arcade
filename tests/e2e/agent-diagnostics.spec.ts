import { expect, test, type Page } from '@playwright/test'

const LEGACY_AGENT_BRIDGE_GLOBAL = '__AKSEL_ARCADE_AGENT_BRIDGE__'
const TEST_AGENT_TRANSPORT_GLOBAL = '__AKSEL_ARCADE_TEST_AGENT_TRANSPORT__'

interface AgentBridgeCommandResult<TData> {
  ok: boolean
  data?: TData
}

interface AgentDiagnostics {
  status: string
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

interface TestAgentTransport {
  hasHandler: () => boolean
  route: (request: {
    id: string
    method: string
    params?: unknown
    sessionId?: string
  }) =>
    | {
        result: AgentBridgeCommandResult<unknown>
      }
    | {
        error: unknown
      }
}

const installDesktopAgentSurface = async (page: Page) => {
  await page.addInitScript(() => {
    const testTransportGlobal = '__AKSEL_ARCADE_TEST_AGENT_TRANSPORT__'
    let transportRequestHandler:
      | ((request: {
          id: string
          method: string
          params?: unknown
          sessionId: string
        }) => unknown)
      | null = null
    const endpoint = {
      endpoint: 'http://127.0.0.1:48123',
      sessionId: '11111111-1111-4111-8111-111111111111',
      authorizationHeader: 'Bearer copied-agent-secret',
    }

    window.__AKSEL_ARCADE_DESKTOP__ = {
      getShellCapabilities: async () => ({
        surface: 'desktop',
        shareUrl: { enabled: false },
        agentSessions: { enabled: true },
        projectPackages: {
          enabled: true,
          defaultExtension: '.akselarcade',
          legacyJsonImport: true,
        },
      }),
      startAgentTransportSession: async () => endpoint,
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
          sessionId: request.sessionId ?? endpoint.sessionId,
        }) as ReturnType<TestAgentTransport['route']>
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
        method: 'applySourceChange',
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
