import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppProvider, useProject } from '@/hooks/useProject'
import { SettingsProvider } from '@/contexts/SettingsContext'
import { AppHeader } from '@/components/Header/AppHeader'
import {
  DESKTOP_ARCADE_CAPABILITIES,
  WEB_ARCADE_CAPABILITIES,
  type ShellCapabilities,
} from '@/services/shellCapabilities'
import type { DesktopMcpServerState } from '@/services/desktopMcp'

interface HeaderHarnessProps {
  shellCapabilities: ShellCapabilities
  desktopMcpServerState?: DesktopMcpServerState | null
}

const AVAILABLE_MCP_STATE: DesktopMcpServerState = {
  serverName: 'desktop-arcade',
  transportLabel: 'HTTP (MCP Streamable HTTP)',
  url: 'http://127.0.0.1:3846/mcp',
  requiresAuth: false,
  authDescription: 'No token/header required.',
  availability: { status: 'available' },
}

const HeaderHarness = ({ shellCapabilities, desktopMcpServerState = null }: HeaderHarnessProps) => {
  const {
    project,
    replaceProject,
    updateProject,
    resetToIntro,
    loadFormSummaryTemplate,
    loadHooksDemo,
  } = useProject()

  return (
    <AppHeader
      projectName={project.name}
      onProjectNameChange={(name) => updateProject({ name })}
      currentProject={project}
      onProjectImported={replaceProject}
      saveStatus="saved"
      projectSizeBytes={0}
      onResetToIntro={resetToIntro}
      onLoadFormSummaryTemplate={loadFormSummaryTemplate}
      onLoadHooksDemo={loadHooksDemo}
      shellCapabilities={shellCapabilities}
      desktopMcpServerState={desktopMcpServerState}
    />
  )
}

const renderHeader = ({
  shellCapabilities,
  desktopMcpServerState = null,
}: HeaderHarnessProps) =>
  render(
    <SettingsProvider>
      <AppProvider>
        <HeaderHarness
          shellCapabilities={shellCapabilities}
          desktopMcpServerState={desktopMcpServerState}
        />
      </AppProvider>
    </SettingsProvider>
  )

describe('Desktop Arcade MCP settings', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  afterEach(() => {
    sessionStorage.clear()
    vi.restoreAllMocks()
  })

  it('shows the fixed MCP configuration and copy actions in Desktop Arcade settings', async () => {
    const user = userEvent.setup()
    renderHeader({
      shellCapabilities: DESKTOP_ARCADE_CAPABILITIES,
      desktopMcpServerState: AVAILABLE_MCP_STATE,
    })

    expect(screen.queryByTestId('agent-session-menu')).toBeNull()
    await user.click(screen.getByRole('button', { name: /settings/i }))

    expect(await screen.findByText('Desktop Arcade MCP')).toBeTruthy()
    expect(await screen.findByText('Status: Available')).toBeTruthy()
    expect(screen.getByText('Server name: desktop-arcade')).toBeTruthy()
    expect(screen.getByText('Type: HTTP (MCP Streamable HTTP)')).toBeTruthy()
    expect(screen.getByText('URL: http://127.0.0.1:3846/mcp')).toBeTruthy()
    expect(screen.getByText('No token/header required.')).toBeTruthy()
    expect(screen.getByText('Last activity: No MCP activity yet.')).toBeTruthy()
    expect(await screen.findByRole('menuitem', { name: /copy server name/i })).toBeTruthy()
    expect(await screen.findByRole('menuitem', { name: /copy transport type/i })).toBeTruthy()
    expect(await screen.findByRole('menuitem', { name: /copy mcp url/i })).toBeTruthy()
  })

  it('shows only safe Desktop MCP last-activity metadata in settings', async () => {
    const user = userEvent.setup()
    renderHeader({
      shellCapabilities: DESKTOP_ARCADE_CAPABILITIES,
      desktopMcpServerState: {
        ...AVAILABLE_MCP_STATE,
        lastActivity: {
          toolName: 'apply_changes',
          operationTypes: ['replace_source', 'rename_project'],
          timestamp: '2026-06-16T12:00:00.000Z',
        },
      },
    })

    await user.click(screen.getByRole('button', { name: /settings/i }))

    expect(
      await screen.findByText(
        'Last activity: apply_changes (replace_source, rename_project) at 2026-06-16T12:00:00.000Z'
      )
    ).toBeTruthy()
  })

  it('shows the unavailable reason when Desktop Arcade cannot bind the fixed MCP port', async () => {
    const user = userEvent.setup()
    renderHeader({
      shellCapabilities: DESKTOP_ARCADE_CAPABILITIES,
      desktopMcpServerState: {
        ...AVAILABLE_MCP_STATE,
        availability: {
          status: 'unavailable',
          reason: 'Port 3846 on 127.0.0.1 is already in use.',
        },
      },
    })

    await user.click(screen.getByRole('button', { name: /settings/i }))

    expect(
      await screen.findByText('Status: Unavailable: Port 3846 on 127.0.0.1 is already in use.')
    ).toBeTruthy()
    expect(
      screen.getByText('Connection details are available once Desktop Arcade owns the MCP endpoint.')
    ).toBeTruthy()
    expect(screen.queryByText('URL: http://127.0.0.1:3846/mcp')).toBeNull()
    expect(screen.queryByText('No token/header required.')).toBeNull()
    expect(screen.queryByRole('menuitem', { name: /copy server name/i })).toBeNull()
    expect(screen.queryByRole('menuitem', { name: /copy transport type/i })).toBeNull()
    expect(screen.queryByRole('menuitem', { name: /copy mcp url/i })).toBeNull()
  })

  it('keeps the MCP section out of Web Arcade settings', async () => {
    const user = userEvent.setup()
    renderHeader({ shellCapabilities: WEB_ARCADE_CAPABILITIES })

    expect(screen.queryByTestId('agent-session-menu')).toBeNull()
    await user.click(screen.getByRole('button', { name: /settings/i }))

    expect(screen.queryByText('Desktop Arcade MCP')).toBeNull()
  })
})
