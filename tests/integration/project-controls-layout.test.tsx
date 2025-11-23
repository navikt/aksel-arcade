import { describe, expect, it, beforeEach, vi } from 'vitest'
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
    resetToIntro,
    loadFormSummaryTemplate,
    loadHooksDemo,
  } = useProject()

  return (
    <AppHeader
      projectName={project.name}
      onProjectNameChange={name => updateProject({ name })}
      currentProject={project}
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
  })

  it('keeps Import → Share → Settings order and reminds about export', async () => {
    renderHeader()

    const importButton = screen.getByRole('button', { name: /^import$/i })
    const shareButton = screen.getByLabelText(/share project/i)
    const settingsButton = screen.getByRole('button', { name: /settings/i })

    expect(importButton.compareDocumentPosition(shareButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(shareButton.compareDocumentPosition(settingsButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    fireEvent.click(shareButton)

    expect(await screen.findByText(/Need an offline backup/i)).toBeTruthy()
  })
})
