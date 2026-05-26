import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { AppProvider, useProject } from '@/hooks/useProject'
import { SettingsProvider, useSettings } from '@/contexts/SettingsContext'
import { AppHeader } from '@/components/Header/AppHeader'
import { PreviewPane } from '@/components/Preview/PreviewPane'
import type {
  AgentBridge,
  AgentBridgeCommandResult,
  AgentBridgeErrorCode,
} from '@/services/agentBridge'

const noop = () => {}

interface HarnessProps {
  includePreview?: boolean
}

const Harness = ({ includePreview = false }: HarnessProps) => {
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
      {includePreview && <PreviewPane />}
    </>
  )
}

const renderHeader = (options?: HarnessProps) => {
  return render(
    <SettingsProvider>
      <AppProvider>
        <Harness {...options} />
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

const callBridgeCommand = <TResult,>(command: () => TResult): TResult => {
  let result: TResult | undefined

  act(() => {
    result = command()
  })

  if (result === undefined) {
    throw new Error('Expected bridge command to return a result.')
  }

  return result
}

const expectBridgeSuccess = <TData,>(result: AgentBridgeCommandResult<TData>): TData => {
  expect(result.ok).toBe(true)

  if (!result.ok) {
    throw new Error(result.error.message)
  }

  return result.data
}

const expectBridgeFailure = <TData,>(
  result: AgentBridgeCommandResult<TData>,
  code: AgentBridgeErrorCode
) => {
  expect(result).toMatchObject({
    ok: false,
    error: {
      code,
      message: expect.any(String),
    },
  })

  if (result.ok) {
    throw new Error('Expected bridge command to fail.')
  }

  expect(result.error.message.trim().length).toBeGreaterThan(0)
  return result.error
}

const getRollbackLabels = (): string[] =>
  screen
    .queryAllByRole('menuitem')
    .map((item) => item.textContent ?? '')
    .filter((label) => label.startsWith('Restore '))

const captureAgentState = (bridge: AgentBridge) => {
  const project = expectBridgeSuccess(callBridgeCommand(() => bridge.getProject()))
  const preview = expectBridgeSuccess(callBridgeCommand(() => bridge.getPreviewContext()))
  const session = expectBridgeSuccess(callBridgeCommand(() => bridge.getSessionState()))

  return {
    project,
    preview,
    permissions: session.permissions,
    statusText: screen.getByRole('status').textContent,
    rollbackLabels: getRollbackLabels(),
  }
}

const startAgentAccess = async () => {
  fireEvent.click(screen.getByRole('button', { name: /agent access/i }))
  expect(await screen.findByText(/Agent session/i)).toBeTruthy()
  fireEvent.click(screen.getByRole('menuitemcheckbox', { name: /start temporary agent access/i }))

  const bridge = window.__AKSEL_ARCADE_AGENT_BRIDGE__
  expect(bridge).toBeDefined()
  if (!bridge) {
    throw new Error('Expected Agent bridge to be published after access starts.')
  }

  return bridge
}

describe('ProjectControls layout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
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
      commandNames: ['getProject', 'getPreviewContext', 'getSessionState', 'applySourceChange'],
    })
    expect(activeBridge?.getProject).toEqual(expect.any(Function))
    expect(activeBridge?.getPreviewContext).toEqual(expect.any(Function))
    expect(activeBridge?.getSessionState).toEqual(expect.any(Function))
    expect(activeBridge?.applySourceChange).toEqual(expect.any(Function))
    expect(activeBridge?.commandNames).not.toContain('restoreCheckpoint')
    expect(activeBridge as unknown as Record<string, unknown>).not.toHaveProperty(
      'restoreCheckpoint'
    )

    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: /allow source changes/i }))
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: /allow preview setting changes/i }))
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: /allow preview evidence reads/i }))
    fireEvent.click(
      screen.getByRole('menuitemcheckbox', { name: /allow project metadata changes/i })
    )

    await waitFor(() => {
      expect(activeBridge?.permissions).toMatchObject({
        sourceChanges: false,
        previewSettings: false,
        previewEvidence: false,
        projectMetadata: true,
      })
    })

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
    expect(instructions).toContain('applySourceChange()')
    expect(instructions).toContain('viewportSize?')
    expect(instructions).toContain('theme?')
    expect(instructions).toContain('name?')
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

    const projectResult = callBridgeCommand(() => bridge.getProject())
    expect(projectResult).toMatchObject({
      ok: true,
      command: 'getProject',
    })
    const projectData = expectBridgeSuccess(projectResult)
    expect(projectData).toEqual({
      name: expect.any(String),
      jsxCode: expect.any(String),
      hooksCode: expect.any(String),
    })
    expect(projectData).not.toHaveProperty('id')

    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toMatch(/Last agent read: getProject/i)
    })

    const previewResult = callBridgeCommand(() => bridge.getPreviewContext())
    expect(previewResult).toMatchObject({
      ok: true,
      command: 'getPreviewContext',
      data: {
        theme: 'dark',
        viewportSize: 'MD',
      },
    })

    const sessionResult = callBridgeCommand(() => bridge.getSessionState())
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
        commandNames: ['getProject', 'getPreviewContext', 'getSessionState', 'applySourceChange'],
      },
    })

    const exposedReadKeys = collectObjectKeys({
      project: projectData,
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

    const updatedProject = callBridgeCommand(() => bridge.getProject())
    expect(updatedProject).toMatchObject({
      ok: true,
      data: {
        name: 'Updated Agent Project',
        jsxCode: 'export default function App() { return <Heading>Updated</Heading> }',
        hooksCode: 'export const useAgentFixture = () => "updated"',
      },
    })

    const updatedPreview = callBridgeCommand(() => bridge.getPreviewContext())
    expect(updatedPreview).toMatchObject({
      ok: true,
      data: {
        theme: 'light',
        viewportSize: 'LG',
      },
    })

    fireEvent.click(
      screen.getByRole('menuitemcheckbox', { name: /allow project metadata changes/i })
    )

    expect(bridge.permissions.projectMetadata).toBe(true)
    expect(window.__AKSEL_ARCADE_AGENT_BRIDGE__?.permissions.projectMetadata).toBe(true)

    const updatedSession = callBridgeCommand(() => bridge.getSessionState())
    expect(updatedSession).toMatchObject({
      ok: true,
      data: {
        permissions: {
          projectMetadata: true,
        },
      },
    })
  })

  it('applies source replacements with automatic Checkpoints and human rollback', async () => {
    renderHeader()

    const bridge = await startAgentAccess()
    const originalProject = expectBridgeSuccess(callBridgeCommand(() => bridge.getProject()))
    const nextJsx = 'export default function App() { return <Heading>Agent update</Heading> }'
    const nextHooks = 'export const useAgentFixture = () => "changed"'

    const changeResult = callBridgeCommand(() =>
      bridge.applySourceChange({
        summary: 'Replace source for demo',
        jsxCode: nextJsx,
        hooksCode: nextHooks,
      })
    )

    const changeData = expectBridgeSuccess(changeResult)
    expect(changeResult).toMatchObject({
      ok: true,
      command: 'applySourceChange',
    })
    expect(changeData).toEqual({
      checkpointId: expect.any(String),
      changedFields: ['jsxCode', 'hooksCode'],
    })
    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toMatch(
        /Last agent change: applySourceChange/i
      )
    })

    await waitFor(() => {
      const updatedProject = expectBridgeSuccess(callBridgeCommand(() => bridge.getProject()))
      expect(updatedProject.jsxCode).toBe(nextJsx)
      expect(updatedProject.hooksCode).toBe(nextHooks)
    })

    fireEvent.click(
      await screen.findByRole('menuitem', {
        name: /restore replace source for demo \(JSX \+ Hooks\)/i,
      })
    )

    await waitFor(() => {
      const restoredProject = expectBridgeSuccess(callBridgeCommand(() => bridge.getProject()))
      expect(restoredProject.jsxCode).toBe(originalProject.jsxCode)
      expect(restoredProject.hooksCode).toBe(originalProject.hooksCode)
    })
  })

  it('applies preview setting replacements when the preview permission is enabled', async () => {
    renderHeader()

    const bridge = await startAgentAccess()

    const result = callBridgeCommand(() =>
      bridge.applySourceChange({
        summary: 'Switch preview context',
        viewportSize: 'XS',
        theme: 'light',
      })
    )

    const changeData = expectBridgeSuccess(result)
    expect(changeData).toEqual({
      checkpointId: expect.any(String),
      changedFields: ['viewportSize', 'theme'],
    })

    await waitFor(() => {
      expect(callBridgeCommand(() => bridge.getPreviewContext())).toMatchObject({
        ok: true,
        data: {
          theme: 'light',
          viewportSize: 'XS',
        },
      })
    })
    expect(
      screen.getByRole('menuitem', {
        name: /restore switch preview context \(viewport \+ theme\)/i,
      })
    ).toBeTruthy()
  })

  it('keeps project metadata denied by default and applies names after opt-in', async () => {
    renderHeader()

    const bridge = await startAgentAccess()
    const originalProject = expectBridgeSuccess(callBridgeCommand(() => bridge.getProject()))

    const deniedResult = callBridgeCommand(() =>
      bridge.applySourceChange({
        summary: 'Rename project by default',
        name: 'Denied Agent Project',
      })
    )

    expectBridgeFailure(deniedResult, 'permission-denied')
    expect(expectBridgeSuccess(callBridgeCommand(() => bridge.getProject()))).toEqual(
      originalProject
    )
    expect(screen.queryByRole('menuitem', { name: /restore rename project by default/i })).toBeNull()

    fireEvent.click(
      screen.getByRole('menuitemcheckbox', { name: /allow project metadata changes/i })
    )

    const acceptedResult = callBridgeCommand(() =>
      bridge.applySourceChange({
        summary: 'Rename project after opt-in',
        name: 'Agent Named Project',
      })
    )

    const changeData = expectBridgeSuccess(acceptedResult)
    expect(changeData).toEqual({
      checkpointId: expect.any(String),
      changedFields: ['name'],
    })
    await waitFor(() => {
      expect(expectBridgeSuccess(callBridgeCommand(() => bridge.getProject())).name).toBe(
        'Agent Named Project'
      )
    })
  })

  it('applies combined source, preview, and metadata replacements atomically with rollback', async () => {
    renderHeader()

    const bridge = await startAgentAccess()
    const original = captureAgentState(bridge)
    const nextJsx = 'export default function App() { return <Heading>Combined</Heading> }'
    const nextHooks = 'export const useAgentFixture = () => "combined"'

    fireEvent.click(
      screen.getByRole('menuitemcheckbox', { name: /allow project metadata changes/i })
    )

    const result = callBridgeCommand(() =>
      bridge.applySourceChange({
        summary: 'Combined Agent update',
        jsxCode: nextJsx,
        hooksCode: nextHooks,
        viewportSize: 'LG',
        theme: 'light',
        name: 'Combined Agent Project',
      })
    )

    const changeData = expectBridgeSuccess(result)
    expect(changeData).toEqual({
      checkpointId: expect.any(String),
      changedFields: ['jsxCode', 'hooksCode', 'viewportSize', 'theme', 'name'],
    })

    await waitFor(() => {
      const updatedProject = expectBridgeSuccess(callBridgeCommand(() => bridge.getProject()))
      const updatedPreview = expectBridgeSuccess(callBridgeCommand(() => bridge.getPreviewContext()))

      expect(updatedProject).toMatchObject({
        name: 'Combined Agent Project',
        jsxCode: nextJsx,
        hooksCode: nextHooks,
      })
      expect(updatedPreview).toMatchObject({
        theme: 'light',
        viewportSize: 'LG',
      })
    })

    fireEvent.click(
      await screen.findByRole('menuitem', {
        name: /restore combined agent update \(JSX \+ Hooks \+ Viewport \+ Theme \+ Name\)/i,
      })
    )

    await waitFor(() => {
      const restoredProject = expectBridgeSuccess(callBridgeCommand(() => bridge.getProject()))
      const restoredPreview = expectBridgeSuccess(callBridgeCommand(() => bridge.getPreviewContext()))

      expect(restoredProject).toEqual(original.project)
      expect(restoredPreview).toEqual(original.preview)
    })
  })

  it('caps automatic source Checkpoints at ten recent entries', async () => {
    renderHeader()

    const bridge = await startAgentAccess()

    for (let index = 1; index <= 11; index += 1) {
      const result = callBridgeCommand(() =>
        bridge.applySourceChange({
          summary: `change ${index}`,
          jsxCode: `export default function App() { return <Heading>Change ${index}</Heading> }`,
        })
      )
      expectBridgeSuccess(result)
    }

    await waitFor(() => {
      const rollbackItems = screen
        .getAllByRole('menuitem')
        .filter((item) => item.textContent?.startsWith('Restore change'))
      expect(rollbackItems).toHaveLength(10)
    })
    expect(screen.queryByRole('menuitem', { name: /^Restore change 1 \(/i })).toBeNull()
    expect(screen.getByRole('menuitem', { name: /^Restore change 11 \(/i })).toBeTruthy()
  })

  it('rejects source replacements when source change permission is disabled', async () => {
    renderHeader()

    const bridge = await startAgentAccess()
    const originalProject = expectBridgeSuccess(callBridgeCommand(() => bridge.getProject()))

    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: /allow source changes/i }))
    expect(bridge.permissions.sourceChanges).toBe(false)

    const deniedResult = callBridgeCommand(() =>
      bridge.applySourceChange({
        summary: 'Denied source update',
        jsxCode: 'export default function App() { return <Heading>Denied</Heading> }',
      })
    )

    expect(deniedResult).toMatchObject({
      command: 'applySourceChange',
    })
    expectBridgeFailure(deniedResult, 'permission-denied')
    const unchangedProject = expectBridgeSuccess(callBridgeCommand(() => bridge.getProject()))
    expect(unchangedProject).toEqual(originalProject)
    expect(screen.queryByRole('menuitem', { name: /restore denied source update/i })).toBeNull()
  })

  it('rejects malformed and unsupported Agent change requests without mutating Agent state', async () => {
    renderHeader()

    const bridge = await startAgentAccess()
    expectBridgeSuccess(
      callBridgeCommand(() =>
        bridge.applySourceChange({
          summary: 'Seed checkpoint',
          jsxCode: 'export default function App() { return <Heading>Seed</Heading> }',
        })
      )
    )
    const before = captureAgentState(bridge)

    const invalidRequests: Array<{
      request: unknown
      code: AgentBridgeErrorCode
      message: RegExp
    }> = [
      {
        request: undefined,
        code: 'invalid-request',
        message: /provided as an object/i,
      },
      {
        request: null,
        code: 'invalid-request',
        message: /provided as an object/i,
      },
      {
        request: [],
        code: 'invalid-request',
        message: /provided as an object/i,
      },
      {
        request: { summary: 'No fields' },
        code: 'invalid-request',
        message: /jsxCode, hooksCode, viewportSize, theme, and\/or name/i,
      },
      {
        request: {
          summary: '   ',
          jsxCode: 'export default function App() { return <Heading>Blank</Heading> }',
        },
        code: 'invalid-request',
        message: /non-empty/i,
      },
      {
        request: { summary: 'Wrong type', jsxCode: 123 },
        code: 'invalid-request',
        message: /jsxCode must be a full-field string/i,
      },
      {
        request: { summary: 'Empty JSX', jsxCode: '' },
        code: 'invalid-request',
        message: /jsxCode must be a non-empty full-field string/i,
      },
      {
        request: { summary: 'Blank Hooks', hooksCode: '   ' },
        code: 'invalid-request',
        message: /hooksCode must be a non-empty full-field string/i,
      },
      {
        request: {
          summary: 'Unknown field',
          jsxCode: 'export default function App() { return <Heading>Changed</Heading> }',
          notes: 'Not part of the Agent change contract',
        },
        code: 'unsupported-field',
        message: /Unsupported Agent change field: notes/i,
      },
      {
        request: {
          summary: 'Invalid viewport',
          jsxCode: 'export default function App() { return <Heading>Changed</Heading> }',
          viewportSize: 'XXL',
        },
        code: 'invalid-request',
        message: /viewportSize/i,
      },
      {
        request: {
          summary: 'Invalid theme',
          hooksCode: 'export const useAgentFixture = () => "theme"',
          theme: 'system',
        },
        code: 'invalid-request',
        message: /theme/i,
      },
      {
        request: {
          summary: 'Invalid name type',
          name: 123,
        },
        code: 'invalid-request',
        message: /name must be a full-field string/i,
      },
      {
        request: {
          summary: 'Invalid blank name',
          name: '   ',
        },
        code: 'invalid-request',
        message: /name must be 1-100 characters/i,
      },
    ]

    for (const { request, code, message } of invalidRequests) {
      const result = callBridgeCommand(() => bridge.applySourceChange(request))
      const error = expectBridgeFailure(result, code)
      expect(error.message).toMatch(message)
      expect(screen.getByRole('status').textContent).toBe(before.statusText)
      expect(captureAgentState(bridge)).toEqual(before)
    }
  })

  it('rejects mixed Agent changes atomically when any requested permission is disabled', async () => {
    renderHeader()

    const bridge = await startAgentAccess()
    const before = captureAgentState(bridge)

    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: /allow preview setting changes/i }))
    expect(bridge.permissions.previewSettings).toBe(false)

    const result = callBridgeCommand(() =>
      bridge.applySourceChange({
        summary: 'Source plus denied preview',
        jsxCode: 'export default function App() { return <Heading>Changed</Heading> }',
        viewportSize: 'SM',
      })
    )

    const error = expectBridgeFailure(result, 'permission-denied')
    expect(error.message).toMatch(/preview setting changes/i)
    expect(screen.getByRole('status').textContent).toMatch(/permissions changed/i)
    expect(captureAgentState(bridge)).toEqual({
      ...before,
      permissions: {
        ...before.permissions,
        previewSettings: false,
      },
      statusText: screen.getByRole('status').textContent,
    })
  })

  it('rejects oversized source changes before mutation or Checkpoint creation', async () => {
    renderHeader()

    const bridge = await startAgentAccess()
    const before = captureAgentState(bridge)
    const oversizedJsx = `export default function App() {
  return <Heading>${'x'.repeat(5 * 1024 * 1024)}</Heading>
}`

    const result = callBridgeCommand(() =>
      bridge.applySourceChange({
        summary: 'Oversized source replacement',
        jsxCode: oversizedJsx,
      })
    )

    const error = expectBridgeFailure(result, 'payload-too-large')
    expect(error.message).toMatch(/exceeds 5MB limit/i)
    expect(screen.getByRole('status').textContent).toBe(before.statusText)
    expect(captureAgentState(bridge)).toEqual(before)
  })

  it('applies schema-valid invalid source and lets the normal preview report compile errors', async () => {
    renderHeader({ includePreview: true })

    const bridge = await startAgentAccess()
    const invalidJsx = `export default function App() {
  return <Button>Broken
}`

    const result = callBridgeCommand(() =>
      bridge.applySourceChange({
        summary: 'Introduce invalid JSX',
        jsxCode: invalidJsx,
      })
    )

    expectBridgeSuccess(result)
    const appliedProject = expectBridgeSuccess(callBridgeCommand(() => bridge.getProject()))
    expect(appliedProject.jsxCode).toBe(invalidJsx)
    expect(await screen.findByText(/Compile Error/i, undefined, { timeout: 5000 })).toBeTruthy()
  })
})
