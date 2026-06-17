import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AppProvider, useProject } from '@/hooks/useProject'
import { SettingsProvider, useSettings } from '@/contexts/SettingsContext'
import { AppHeader } from '@/components/Header/AppHeader'
import { PreviewPane } from '@/components/Preview/PreviewPane'
import {
  createArcadePage,
  createArcadeSourceFile,
  createSinglePageProjectSource,
  getActiveSource,
} from '@/services/projectSource'
import {
  ARCADE_PROJECT_IMPORT_ACCEPT,
  ARCADE_PROJECT_PACKAGE_EXTENSION,
  ARCADE_PROJECT_PACKAGE_MIME_TYPE,
  createArcadeProjectPackage,
} from '@/services/storage'
import {
  DESKTOP_ARCADE_CAPABILITIES,
  WEB_ARCADE_CAPABILITIES,
  type ShellCapabilities,
} from '@/services/shellCapabilities'
import { createDefaultProject } from '@/utils/projectDefaults'

interface HarnessProps {
  includePreview?: boolean
  shellCapabilities?: ShellCapabilities
}

const Harness = ({
  includePreview = false,
  shellCapabilities = DESKTOP_ARCADE_CAPABILITIES,
}: HarnessProps) => {
  const {
    project,
    editorState,
    replaceProject,
    updateProject,
    updateEditorState,
    resetToIntro,
    loadFormSummaryTemplate,
    loadHooksDemo,
  } = useProject()
  const { pagePanelOpen, setPagePanelOpen } = useSettings()

  return (
    <>
      <AppHeader
        projectName={project.name}
        onProjectNameChange={(name) => updateProject({ name })}
        currentProject={project}
        onProjectImported={replaceProject}
        saveStatus="idle"
        projectSizeBytes={0}
        onResetToIntro={resetToIntro}
        onLoadFormSummaryTemplate={loadFormSummaryTemplate}
        onLoadHooksDemo={loadHooksDemo}
        shellCapabilities={shellCapabilities}
      />
      <button type="button" onClick={() => updateEditorState({ activeTab: 'Hooks' })}>
        Set local Hooks tab
      </button>
      <button type="button" onClick={() => setPagePanelOpen(true)}>
        Open page panel
      </button>
      <div data-testid="project-jsx-code" hidden>
        {getActiveSource(project).jsx}
      </div>
      <div data-testid="project-active-page-id" hidden>
        {project.activePageId}
      </div>
      <div data-testid="editor-active-tab" hidden>
        {editorState.activeTab}
      </div>
      <div data-testid="settings-page-panel-open" hidden>
        {String(pagePanelOpen)}
      </div>
      {includePreview && <PreviewPane shellCapabilities={shellCapabilities} />}
    </>
  )
}

const renderHeader = (options?: HarnessProps) =>
  render(
    <SettingsProvider>
      <AppProvider>
        <Harness {...options} />
      </AppProvider>
    </SettingsProvider>
  )

const createProjectPackageFile = (text: string): File => {
  const file = new File([text], `project${ARCADE_PROJECT_PACKAGE_EXTENSION}`, {
    type: ARCADE_PROJECT_PACKAGE_MIME_TYPE,
  })
  Object.defineProperty(file, 'text', {
    value: async () => text,
  })
  return file
}

const createProjectPackageFileForCode = (name: string, jsxCode: string): File => {
  const project = createDefaultProject()
  project.name = name
  project.source = createSinglePageProjectSource(jsxCode, getActiveSource(project).hooks)

  return createProjectPackageFile(JSON.stringify(createArcadeProjectPackage(project)))
}

const createMultiPageProjectPackageFile = (): File => {
  const project = createDefaultProject()
  project.name = 'Imported multi-page package'
  project.source = {
    globalConfig: createArcadeSourceFile(
      'const SharedChrome = () => <Box>Shared chrome</Box>',
      'export const useSharedChrome = () => "shared"'
    ),
    pages: [
      createArcadePage(
        'page01',
        'Page 1',
        createArcadeSourceFile(
          'export default function App() { return <Heading>Overview page</Heading> }',
          'export const useOverviewPage = () => "overview"'
        )
      ),
      createArcadePage(
        'page02',
        'Page 2',
        createArcadeSourceFile(
          'export default function App() { return <Heading>Imported start page</Heading> }',
          'export const useImportedStartPage = () => "start"'
        )
      ),
    ],
    startPageId: 'page02',
    nextPageNumber: 3,
  }
  project.activePageId = 'page01'

  return createProjectPackageFile(JSON.stringify(createArcadeProjectPackage(project)))
}

describe('ProjectControls layout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    window.history.replaceState({}, '', '/')
    delete window.__AKSEL_ARCADE_DESKTOP__
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete window.__AKSEL_ARCADE_DESKTOP__
  })

  it('keeps Web Arcade Share URL available and agent access absent', async () => {
    renderHeader({ shellCapabilities: WEB_ARCADE_CAPABILITIES })

    const importButton = screen.getByRole('button', { name: /^import$/i })
    const importInput = screen.getByLabelText(
      /import \.akselarcade arcade project package/i
    ) as HTMLInputElement
    const shareButton = screen.getByLabelText(/share project/i)
    const settingsButton = screen.getByRole('button', { name: /settings/i })

    expect(importInput.accept).toBe(ARCADE_PROJECT_IMPORT_ACCEPT)
    expect(screen.queryByRole('button', { name: /connect an agent/i })).toBeNull()
    expect(
      importButton.compareDocumentPosition(shareButton) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(
      shareButton.compareDocumentPosition(settingsButton) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()

    fireEvent.click(shareButton)

    expect(await screen.findByText(/Share URL length/i)).toBeTruthy()
    expect(screen.getByText(/Strategy:/i)).toBeTruthy()
  })

  it('keeps Reset editor available without exposing browser-wide storage clearing', async () => {
    renderHeader({ shellCapabilities: WEB_ARCADE_CAPABILITIES })

    fireEvent.click(screen.getByRole('button', { name: /settings/i }))

    expect(await screen.findByRole('menuitem', { name: /Reset editor/i })).toBeTruthy()
    expect(screen.queryByRole('menuitem', { name: /Clear storage & reload/i })).toBeNull()
  })

  it('confirms import with an Aksel Dialog and custom action label', async () => {
    const nativeConfirmSpy = vi.spyOn(window, 'confirm')
    const inputClickSpy = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {})

    renderHeader({ shellCapabilities: WEB_ARCADE_CAPABILITIES })

    fireEvent.click(screen.getByRole('button', { name: /^Import$/i }))

    expect(nativeConfirmSpy).not.toHaveBeenCalled()
    expect(inputClickSpy).not.toHaveBeenCalled()
    expect(screen.getByRole('alertdialog', { name: /bekreft import/i })).toBeTruthy()
    expect(
      screen.getByText(
        'Importing this Arcade project package replaces only this Web Arcade working copy. Continue?'
      )
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Importer' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Importer' }))

    expect(inputClickSpy).toHaveBeenCalledTimes(1)
    await waitFor(() => {
      expect(
        screen.queryByText(
          'Importing this Arcade project package replaces only this Web Arcade working copy. Continue?'
        )
      ).toBeNull()
    })
  })

  it('imports full-source packages onto the Start page with JSX tab and the closed page-panel default', async () => {
    renderHeader({ shellCapabilities: WEB_ARCADE_CAPABILITIES })

    fireEvent.click(screen.getByRole('button', { name: /set local hooks tab/i }))
    fireEvent.click(screen.getByRole('button', { name: /open page panel/i }))

    expect(screen.getByTestId('editor-active-tab').textContent).toBe('Hooks')
    expect(screen.getByTestId('settings-page-panel-open').textContent).toBe('true')

    fireEvent.change(screen.getByLabelText(/import \.akselarcade arcade project package/i), {
      target: {
        files: [createMultiPageProjectPackageFile()],
      },
    })

    await waitFor(() => expect(screen.getByText('Imported multi-page package')).toBeTruthy())

    expect(screen.getByTestId('project-active-page-id').textContent).toBe('page02')
    expect(screen.getByTestId('project-jsx-code').textContent).toContain('Imported start page')
    expect(screen.getByTestId('project-jsx-code').textContent).not.toContain('Overview page')
    expect(screen.getByTestId('editor-active-tab').textContent).toBe('JSX')
    expect(screen.getByTestId('settings-page-panel-open').textContent).toBe('false')
  })

  it('keeps Desktop Arcade MCP available, Share URL absent, and the public Agent-session UI hidden', async () => {
    renderHeader({ shellCapabilities: DESKTOP_ARCADE_CAPABILITIES })

    const importButton = screen.getByRole('button', { name: /^import$/i })
    const settingsButton = screen.getByRole('button', { name: /settings/i })

    expect(screen.queryByLabelText(/share project/i)).toBeNull()
    expect(
      importButton.compareDocumentPosition(settingsButton) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(screen.queryByTestId('agent-session-menu')).toBeNull()

    fireEvent.click(settingsButton)
    expect(await screen.findByText('Desktop Arcade MCP')).toBeTruthy()
    expect(await screen.findByText(/Switch to light theme/i)).toBeTruthy()
    expect(screen.queryByText(/Switch to light mode/i)).toBeNull()
    expect(screen.queryByRole('menuitemcheckbox', { name: /agent bridge|agent-tilgang/i })).toBeNull()
  })

  it('does not restore Preview fullscreen when importing a clean package in Desktop Arcade', async () => {
    renderHeader({ includePreview: true, shellCapabilities: DESKTOP_ARCADE_CAPABILITIES })

    expect(screen.queryByRole('button', { name: 'Share fullscreen preview' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Enter preview fullscreen' }))

    expect(screen.getByRole('button', { name: 'Exit preview fullscreen' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Share fullscreen preview' })).toBeNull()

    fireEvent.change(screen.getByLabelText(/import \.akselarcade arcade project package/i), {
      target: {
        files: [
          createProjectPackageFileForCode(
            'Imported fullscreen boundary project',
            'export default function App() { return <Heading>Imported boundary</Heading> }'
          ),
        ],
      },
    })

    await waitFor(() =>
      expect(screen.getByText('Imported fullscreen boundary project')).toBeTruthy()
    )

    expect(screen.getByRole('button', { name: 'Enter preview fullscreen' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Exit preview fullscreen' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Share fullscreen preview' })).toBeNull()
  })

  it('hides the obsolete multiple-pages experiment controls in settings', async () => {
    renderHeader()

    fireEvent.click(screen.getByRole('button', { name: /settings/i }))

    expect(screen.queryByText('Experiments')).toBeNull()
    expect(screen.queryByRole('menuitemcheckbox', { name: /multiple pages/i })).toBeNull()
    expect(screen.queryByRole('menuitem', { name: /multiple pages/i })).toBeNull()
    expect(screen.getAllByRole('separator')).toHaveLength(3)
  })
})
