import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { AppProvider, useProject } from '@/hooks/useProject'
import { SettingsProvider, useSettings } from '@/contexts/SettingsContext'
import { AppHeader } from '@/components/Header/AppHeader'

const noop = () => {}

const Harness = () => {
  const {
    project,
    setProject,
    updateProject,
    previewState,
    resetToIntro,
    loadFormSummaryTemplate,
    loadHooksDemo,
  } = useProject()
  const { setTheme } = useSettings()

  return (
    <>
      <AppHeader
        projectName={project.name}
        onProjectNameChange={(name) => updateProject({ name })}
        currentProject={project}
        shareViewport={previewState.currentViewport}
        onProjectImported={setProject}
        saveStatus="idle"
        projectSizeBytes={0}
        onResetToIntro={resetToIntro}
        onClearStorage={noop}
        onLoadFormSummaryTemplate={loadFormSummaryTemplate}
        onLoadHooksDemo={loadHooksDemo}
      />
      <button
        type="button"
        onClick={() => {
          updateProject({
            name: 'Updated Agent Project',
            jsxCode: 'export default function App() { return <Heading>Updated</Heading> }',
            hooksCode: 'export const useAgentFixture = () => "updated"',
            viewportSize: 'LG',
          })
          setTheme('light')
        }}
      >
        Update Agent read fixture
      </button>
    </>
  )
}

const renderHeader = () => {
  return render(
    <SettingsProvider>
      <AppProvider>
        <Harness />
      </AppProvider>
    </SettingsProvider>
  )
}

const collectObjectKeys = (value: unknown): string[] => {
  if (!value || typeof value !== 'object') {
    return []
  }

  if (Array.isArray(value)) {
    return value.flatMap(collectObjectKeys)
  }

  return Object.entries(value).flatMap(([key, nestedValue]) => [
    key,
    ...collectObjectKeys(nestedValue),
  ])
}

describe('ProjectControls layout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete window.__AKSEL_ARCADE_AGENT_BRIDGE__
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete window.__AKSEL_ARCADE_AGENT_BRIDGE__
  })

  it('keeps Import → Share → Agent → Settings order and surfaces share metrics', async () => {
    renderHeader()

    const importButton = screen.getByRole('button', { name: /^import$/i })
    const shareButton = screen.getByLabelText(/share project/i)
    const agentButton = screen.getByRole('button', { name: /agent access/i })
    const settingsButton = screen.getByRole('button', { name: /settings/i })

    expect(
      importButton.compareDocumentPosition(shareButton) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(
      shareButton.compareDocumentPosition(agentButton) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(
      agentButton.compareDocumentPosition(settingsButton) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()

    fireEvent.click(shareButton)

    expect(await screen.findByText(/Share URL length/i)).toBeTruthy()
    expect(screen.getByText(/Strategy:/i)).toBeTruthy()

    fireEvent.click(settingsButton)
    expect(await screen.findByText(/Switch to light theme/i)).toBeTruthy()
    expect(screen.queryByText(/Switch to light mode/i)).toBeNull()
  })

  it('keeps Agent bridge inactive by default and publishes it only for a temporary session', async () => {
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(
      '11111111-1111-4111-8111-111111111111'
    )
    const { unmount } = renderHeader()

    expect(window.__AKSEL_ARCADE_AGENT_BRIDGE__).toBeUndefined()

    fireEvent.click(screen.getByRole('button', { name: /agent access/i }))

    expect(await screen.findByText(/Agent session/i)).toBeTruthy()
    expect(screen.getByText(/Arcade-scoped read access is mandatory/i)).toBeTruthy()
    const inactiveStatus = screen.getByRole('status').textContent ?? ''
    expect(inactiveStatus).toMatch(/inactive/i)
    expect(inactiveStatus).not.toMatch(/connected|disconnected/i)

    const accessItem = screen.getByRole('menuitemcheckbox', {
      name: /start temporary agent access/i,
    })
    const sourcePermission = screen.getByRole('menuitemcheckbox', {
      name: /allow source changes/i,
    })
    const previewPermission = screen.getByRole('menuitemcheckbox', {
      name: /allow preview setting changes/i,
    })
    const evidencePermission = screen.getByRole('menuitemcheckbox', {
      name: /allow preview evidence reads/i,
    })
    const metadataPermission = screen.getByRole('menuitemcheckbox', {
      name: /allow project metadata changes/i,
    })

    expect(accessItem.getAttribute('aria-checked')).toBe('false')
    expect(sourcePermission.getAttribute('aria-checked')).toBe('true')
    expect(previewPermission.getAttribute('aria-checked')).toBe('true')
    expect(evidencePermission.getAttribute('aria-checked')).toBe('true')
    expect(metadataPermission.getAttribute('aria-checked')).toBe('false')

    fireEvent.click(accessItem)

    expect((await screen.findByRole('status')).textContent).toMatch(/active/i)
    const activeBridge = window.__AKSEL_ARCADE_AGENT_BRIDGE__
    expect(activeBridge).toMatchObject({
      sessionId: '11111111-1111-4111-8111-111111111111',
      status: 'active',
      readScope: 'arcade-session',
      permissions: {
        sourceChanges: true,
        previewSettings: true,
        previewEvidence: true,
        projectMetadata: false,
      },
      commandNames: ['getProject', 'getPreviewContext', 'getSessionState'],
    })
    expect(activeBridge?.getProject).toEqual(expect.any(Function))
    expect(activeBridge?.getPreviewContext).toEqual(expect.any(Function))
    expect(activeBridge?.getSessionState).toEqual(expect.any(Function))

    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: /stop temporary agent access/i }))

    expect(screen.getByRole('status').textContent).toMatch(/access revoked/i)
    expect(window.__AKSEL_ARCADE_AGENT_BRIDGE__).toBeUndefined()
    expect(activeBridge?.getProject()).toMatchObject({
      ok: false,
      command: 'getProject',
      error: {
        code: 'session-revoked',
      },
    })

    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: /start temporary agent access/i }))
    expect(window.__AKSEL_ARCADE_AGENT_BRIDGE__).toBeDefined()

    unmount()
    expect(window.__AKSEL_ARCADE_AGENT_BRIDGE__).toBeUndefined()

    renderHeader()
    expect(window.__AKSEL_ARCADE_AGENT_BRIDGE__).toBeUndefined()

    fireEvent.click(screen.getByRole('button', { name: /agent access/i }))
    expect(
      (
        await screen.findByRole('menuitemcheckbox', {
          name: /start temporary agent access/i,
        })
      ).getAttribute('aria-checked')
    ).toBe('false')
    expect(screen.getByRole('status').textContent).toMatch(/inactive/i)
  })

  it('copies external-agent instructions with commands, permissions, and the Arcade contract', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })

    renderHeader()

    fireEvent.click(screen.getByRole('button', { name: /agent access/i }))
    expect(await screen.findByText(/Agent session/i)).toBeTruthy()

    fireEvent.click(
      screen.getByRole('menuitemcheckbox', {
        name: /allow project metadata changes/i,
      })
    )
    fireEvent.click(screen.getByRole('button', { name: /copy agent instructions/i }))

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))

    const instructions = writeText.mock.calls[0]?.[0] ?? ''
    expect(instructions).toContain('window.__AKSEL_ARCADE_AGENT_BRIDGE__')
    expect(instructions).toContain('getProject()')
    expect(instructions).toContain('getPreviewContext()')
    expect(instructions).toContain('getSessionState()')
    expect(instructions).toContain('sourceChanges: true')
    expect(instructions).toContain('previewSettings: true')
    expect(instructions).toContain('previewEvidence: true')
    expect(instructions).toContain('projectMetadata: true')
    expect(instructions).toMatch(/human must start temporary Agent access/i)
    expect(instructions).toMatch(/Arcade authoring contract/i)
    expect(instructions).toMatch(/import-free Arcade JSX and Hooks code/i)
  })

  it('returns Arcade-scoped read state and records Agent read activity', async () => {
    renderHeader()

    fireEvent.click(screen.getByRole('button', { name: /agent access/i }))
    expect(await screen.findByText(/Agent session/i)).toBeTruthy()
    fireEvent.click(
      screen.getByRole('menuitemcheckbox', {
        name: /start temporary agent access/i,
      })
    )

    const bridge = window.__AKSEL_ARCADE_AGENT_BRIDGE__
    expect(bridge).toBeDefined()
    if (!bridge) {
      throw new Error('Expected Agent bridge to be published after access starts.')
    }

    let projectResult: ReturnType<typeof bridge.getProject>
    act(() => {
      projectResult = bridge.getProject()
    })
    expect(projectResult).toMatchObject({
      ok: true,
      command: 'getProject',
    })
    if (!projectResult.ok) {
      throw new Error(projectResult.error.message)
    }
    expect(projectResult.data).toEqual({
      name: expect.any(String),
      jsxCode: expect.any(String),
      hooksCode: expect.any(String),
    })
    expect(projectResult.data).not.toHaveProperty('id')

    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toMatch(/Last agent read: getProject/i)
    })

    let previewResult: ReturnType<typeof bridge.getPreviewContext>
    act(() => {
      previewResult = bridge.getPreviewContext()
    })
    expect(previewResult).toMatchObject({
      ok: true,
      command: 'getPreviewContext',
      data: {
        theme: 'dark',
        viewportSize: 'MD',
      },
    })

    let sessionResult: ReturnType<typeof bridge.getSessionState>
    act(() => {
      sessionResult = bridge.getSessionState()
    })
    expect(sessionResult).toMatchObject({
      ok: true,
      command: 'getSessionState',
      data: {
        status: 'active',
        permissions: {
          sourceChanges: true,
          previewSettings: true,
          previewEvidence: true,
          projectMetadata: false,
        },
        readScope: 'arcade-session',
        commandNames: ['getProject', 'getPreviewContext', 'getSessionState'],
      },
    })

    const exposedReadKeys = collectObjectKeys({
      project: projectResult.data,
      preview: previewResult.ok ? previewResult.data : null,
      session: sessionResult.ok ? sessionResult.data : null,
    }).join(' ')
    expect(exposedReadKeys).not.toMatch(/share|export|storage|clipboard|cookie/i)
  })

  it('returns current project, preview, and permission state through captured bridge references', async () => {
    renderHeader()

    fireEvent.click(screen.getByRole('button', { name: /agent access/i }))
    expect(await screen.findByText(/Agent session/i)).toBeTruthy()
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: /start temporary agent access/i }))

    const bridge = window.__AKSEL_ARCADE_AGENT_BRIDGE__
    expect(bridge).toBeDefined()
    if (!bridge) {
      throw new Error('Expected Agent bridge to be published after access starts.')
    }

    fireEvent.click(screen.getByRole('button', { name: /update agent read fixture/i }))

    let updatedProject: ReturnType<typeof bridge.getProject>
    act(() => {
      updatedProject = bridge.getProject()
    })
    expect(updatedProject).toMatchObject({
      ok: true,
      data: {
        name: 'Updated Agent Project',
        jsxCode: 'export default function App() { return <Heading>Updated</Heading> }',
        hooksCode: 'export const useAgentFixture = () => "updated"',
      },
    })

    let updatedPreview: ReturnType<typeof bridge.getPreviewContext>
    act(() => {
      updatedPreview = bridge.getPreviewContext()
    })
    expect(updatedPreview).toMatchObject({
      ok: true,
      data: {
        theme: 'light',
        viewportSize: 'LG',
      },
    })

    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: /allow project metadata changes/i }))

    expect(bridge.permissions.projectMetadata).toBe(true)
    expect(window.__AKSEL_ARCADE_AGENT_BRIDGE__?.permissions.projectMetadata).toBe(true)

    let updatedSession: ReturnType<typeof bridge.getSessionState>
    act(() => {
      updatedSession = bridge.getSessionState()
    })
    expect(updatedSession).toMatchObject({
      ok: true,
      data: {
        permissions: {
          projectMetadata: true,
        },
      },
    })
  })
})
