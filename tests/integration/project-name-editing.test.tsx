import { afterEach, beforeEach, describe, expect, it } from 'vitest'
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

interface HeaderHarnessProps {
  shellCapabilities: ShellCapabilities
}

const HeaderHarness = ({ shellCapabilities }: HeaderHarnessProps) => {
  const {
    project,
    replaceProject,
    updateProject,
    resetToIntro,
    loadFormSummaryTemplate,
    loadHooksDemo,
  } = useProject()

  return (
    <>
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
      />
      <div data-testid="current-project-name">{project.name}</div>
    </>
  )
}

const renderHeader = (shellCapabilities: ShellCapabilities) =>
  render(
    <SettingsProvider>
      <AppProvider>
        <HeaderHarness shellCapabilities={shellCapabilities} />
      </AppProvider>
    </SettingsProvider>
  )

const capabilityCases = [
  ['web', WEB_ARCADE_CAPABILITIES],
  ['desktop', DESKTOP_ARCADE_CAPABILITIES],
] as const

describe('AppHeader project name editing', () => {
  beforeEach(() => {
    sessionStorage.clear()
    delete window.__AKSEL_ARCADE_DESKTOP__
  })

  afterEach(() => {
    sessionStorage.clear()
    delete window.__AKSEL_ARCADE_DESKTOP__
  })

  describe.each(capabilityCases)('%s arcade', (_surface, shellCapabilities) => {
    it('saves the edited project name inline', async () => {
      const user = userEvent.setup()
      renderHeader(shellCapabilities)

      await user.click(screen.getByRole('button', { name: /rediger prosjektnavn/i }))

      const input = screen.getByRole('textbox', { name: /prosjektnavn/i })
      await user.clear(input)
      await user.type(input, 'Nytt prosjektnavn')
      await user.click(screen.getByRole('button', { name: /lagre prosjektnavn/i }))

      expect(screen.queryByRole('textbox', { name: /prosjektnavn/i })).toBeNull()
      expect(screen.getByTestId('current-project-name').textContent).toBe('Nytt prosjektnavn')
      expect(screen.getByRole('button', { name: /rediger prosjektnavn/i })).toBeTruthy()
    })

    it('cancels the inline edit without changing the project name', async () => {
      const user = userEvent.setup()
      renderHeader(shellCapabilities)

      await user.click(screen.getByRole('button', { name: /rediger prosjektnavn/i }))

      const input = screen.getByRole('textbox', { name: /prosjektnavn/i })
      await user.clear(input)
      await user.type(input, 'Skal ikke lagres')
      await user.click(
        screen.getByRole('button', { name: /avbryt redigering av prosjektnavn/i })
      )

      expect(screen.queryByRole('textbox', { name: /prosjektnavn/i })).toBeNull()
      expect(screen.getByTestId('current-project-name').textContent).toBe('Untitled Project')
    })
  })
})
