import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AppProvider, useProject } from '@/hooks/useProject'
import { SettingsProvider } from '@/contexts/SettingsContext'
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

  return (
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
    expect(window.__AKSEL_ARCADE_AGENT_BRIDGE__).toMatchObject({
      sessionId: '11111111-1111-4111-8111-111111111111',
      status: 'active',
      readScope: 'arcade-session',
      permissions: {
        sourceChanges: true,
        previewSettings: true,
        previewEvidence: true,
        projectMetadata: false,
      },
      commandNames: [],
    })

    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: /stop temporary agent access/i }))

    expect(screen.getByRole('status').textContent).toMatch(/access revoked/i)
    expect(window.__AKSEL_ARCADE_AGENT_BRIDGE__).toBeUndefined()

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
})
