import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { forwardRef, useImperativeHandle } from 'react'
import { SettingsProvider, useSettings } from '@/contexts/SettingsContext'
import { AppProvider, useProject } from '@/hooks/useProject'
import { EditorPane } from '@/components/Editor/EditorPane'
import {
  DEFAULT_WEB_ARCADE_WORKING_COPY_PREFERENCES,
  saveProject,
} from '@/services/storage'
import {
  createPage,
  renamePage,
  setActivePage,
  updateGlobalConfigSource,
  updatePageSource,
} from '@/services/projectSource'
import { createDefaultProject } from '@/utils/projectDefaults'
import { resetLocalStorageMock, resetSessionStorageMock, setupLocalStorageMock, setupSessionStorageMock } from '../helpers/mockLocalStorage'

vi.mock('@/components/ComponentPalette', () => ({
  ComponentPalette: () => null,
}))

vi.mock('@/components/Editor/CodeEditor', () => ({
  CodeEditor: forwardRef<
    { undo: () => void; redo: () => void },
    { value: string; onChange: (value: string) => void }
  >(({ value, onChange }, ref) => {
    useImperativeHandle(ref, () => ({
      undo: () => undefined,
      redo: () => undefined,
    }))

    return (
      <textarea
        aria-label="Code editor"
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    )
  }),
}))

const EditorHarness = () => {
  const { project } = useProject()
  const { selectedEditTarget } = useSettings()

  return (
    <>
      <div data-testid="selected-edit-target">{selectedEditTarget}</div>
      <div data-testid="active-page-id">{project.activePageId}</div>
      <div data-testid="global-config-jsx">{project.source.globalConfig.jsx}</div>
      <div data-testid="page-01-jsx">{project.source.pages[0]?.source.jsx}</div>
      <div data-testid="page-02-jsx">{project.source.pages[1]?.source.jsx}</div>
      <EditorPane />
    </>
  )
}

const renderHarness = () =>
  render(
    <SettingsProvider>
      <AppProvider>
        <EditorHarness />
      </AppProvider>
    </SettingsProvider>
  )

const createStoredMultiPageProject = () => {
  let project = createDefaultProject()

  project = updatePageSource(project, 'page01', {
    jsx: '<Box>Page 1 content</Box>',
    hooks: 'export const usePageOne = () => "page-one"',
  })
  project = updateGlobalConfigSource(project, {
    jsx: '<Box>Shared chrome</Box>',
    hooks: 'export const useSharedChrome = () => "shared"',
  })
  project = createPage(project)
  project = renamePage(project, 'page02', 'Details')
  project = updatePageSource(project, 'page02', {
    jsx: '<Box>Page 2 content</Box>',
    hooks: 'export const usePageTwo = () => "page-two"',
  })

  return setActivePage(project, 'page02')
}

describe('Multi-page page panel', () => {
  beforeEach(() => {
    setupLocalStorageMock()
    setupSessionStorageMock()
    resetLocalStorageMock()
    resetSessionStorageMock()
  })

  afterEach(() => {
    cleanup()
  })

  it('restores the page panel, switches editor targets, and writes to the selected source', async () => {
    const project = createStoredMultiPageProject()
    saveProject(project, {
      preferences: {
        ...DEFAULT_WEB_ARCADE_WORKING_COPY_PREFERENCES,
        multiPageEnabled: true,
        pagePanelOpen: true,
        selectedEditTarget: 'global-config',
      },
    })

    renderHarness()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /hide pages/i })).toBeTruthy()
    })

    const getCodeEditor = () =>
      screen.getByRole('textbox', { name: 'Code editor' }) as HTMLTextAreaElement

    expect(screen.getByTestId('selected-edit-target').textContent).toBe('global-config')
    expect(screen.getByTestId('active-page-id').textContent).toBe('page02')
    expect(getCodeEditor().value).toContain('Shared chrome')

    fireEvent.change(getCodeEditor(), { target: { value: '<Box>Shared chrome updated</Box>' } })

    expect(screen.getByTestId('global-config-jsx').textContent).toContain('Shared chrome updated')
    expect(screen.getByTestId('page-02-jsx').textContent).toContain('Page 2 content')

    fireEvent.click(screen.getByRole('button', { name: /page 1/i }))

    await waitFor(() => {
      expect(screen.getByTestId('selected-edit-target').textContent).toBe('page')
      expect(screen.getByTestId('active-page-id').textContent).toBe('page01')
      expect(getCodeEditor().value).toContain('Page 1 content')
    })

    fireEvent.change(getCodeEditor(), { target: { value: '<Box>Page 1 updated</Box>' } })

    expect(screen.getByTestId('page-01-jsx').textContent).toContain('Page 1 updated')
    expect(screen.getByTestId('global-config-jsx').textContent).toContain('Shared chrome updated')

    fireEvent.click(screen.getByRole('button', { name: /hide pages/i }))
    expect(screen.queryByLabelText('Config')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /show pages/i }))
    expect(await screen.findByLabelText('Config')).toBeTruthy()
  })
})
