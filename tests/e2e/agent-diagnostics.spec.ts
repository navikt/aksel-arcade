import { expect, test, type Page } from '@playwright/test'

const AGENT_BRIDGE_GLOBAL = '__AKSEL_ARCADE_AGENT_BRIDGE__'

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

interface BrowserAgentBridge {
  getDiagnostics: () => AgentBridgeCommandResult<AgentDiagnostics>
  applySourceChange: (request: {
    summary: string
    jsxCode: string
  }) => AgentBridgeCommandResult<unknown>
}

const installDesktopAgentSurface = async (page: Page) => {
  await page.addInitScript(() => {
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
    }
  })
}

const startAgentAccess = async (page: Page) => {
  await page.getByTestId('agent-session-menu').click()
  await page.getByRole('menuitemcheckbox', { name: 'Agent-tilgang' }).click()
  await page.waitForFunction(
    (globalName) => Boolean(window[globalName as keyof Window]),
    AGENT_BRIDGE_GLOBAL
  )
}

const readDiagnostics = async (page: Page): Promise<AgentDiagnostics> =>
  page.evaluate((globalName) => {
    const bridge = window[globalName as keyof Window] as BrowserAgentBridge | undefined
    if (!bridge) {
      throw new Error('Agent bridge is not available.')
    }

    const result = bridge.getDiagnostics()
    if (!result.ok || !result.data) {
      throw new Error('Agent diagnostics read failed.')
    }

    return result.data
  }, AGENT_BRIDGE_GLOBAL)

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
      const bridge = window[globalName as keyof Window] as BrowserAgentBridge | undefined
      if (!bridge) {
        throw new Error('Agent bridge is not available.')
      }

      return bridge.applySourceChange({
        summary: 'Trigger render failure',
        jsxCode: `export default function App() {
  throw new Error('Agent render exploded')
}`,
      })
    }, AGENT_BRIDGE_GLOBAL)

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
