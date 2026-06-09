import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
import {
  resetLocalStorageMock,
  resetSessionStorageMock,
  setupLocalStorageMock,
  setupSessionStorageMock,
} from '../helpers/mockLocalStorage'

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
      <div data-testid="start-page-id">{project.source.startPageId}</div>
      <div data-testid="global-config-jsx">{project.source.globalConfig.jsx}</div>
      <div data-testid="page-01-jsx">{project.source.pages[0]?.source.jsx}</div>
      <div data-testid="page-02-jsx">{project.source.pages[1]?.source.jsx}</div>
      <div data-testid="page-03-jsx">{project.source.pages[2]?.source.jsx}</div>
      <div data-testid="page-summary">
        {project.source.pages.map((page) => `${page.id}:${page.name}`).join('|')}
      </div>
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

const openPageActions = async (user: ReturnType<typeof userEvent.setup>, pageName: string) => {
  await user.click(
    screen.getByRole('button', {
      name: new RegExp(`page actions for ${pageName}`, 'i'),
    })
  )
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
    const user = userEvent.setup()
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

    await user.click(screen.getByRole('button', { name: /^page 1/i }))

    await waitFor(() => {
      expect(screen.getByTestId('selected-edit-target').textContent).toBe('page')
      expect(screen.getByTestId('active-page-id').textContent).toBe('page01')
      expect(getCodeEditor().value).toContain('Page 1 content')
    })

    fireEvent.change(getCodeEditor(), { target: { value: '<Box>Page 1 updated</Box>' } })

    expect(screen.getByTestId('page-01-jsx').textContent).toContain('Page 1 updated')
    expect(screen.getByTestId('global-config-jsx').textContent).toContain('Shared chrome updated')

    await user.click(screen.getByRole('button', { name: /hide pages/i }))
    expect(screen.queryByLabelText('Config')).toBeNull()

    await user.click(screen.getByRole('button', { name: /show pages/i }))
    expect(await screen.findByLabelText('Config')).toBeTruthy()
  })

  it('adds a page from Global config and renames it inline with Escape and Enter', async () => {
    const user = userEvent.setup()
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

    await screen.findByRole('button', { name: /add page/i })

    await user.click(screen.getByRole('button', { name: /add page/i }))

    await waitFor(() => {
      expect(screen.getByTestId('selected-edit-target').textContent).toBe('page')
      expect(screen.getByTestId('active-page-id').textContent).toBe('page03')
      expect(screen.getByTestId('page-summary').textContent).toContain('page03:Page 3')
    })

    await openPageActions(user, 'Page 3')
    await user.click(await screen.findByRole('menuitem', { name: /rename/i }))

    const renameInput = screen.getByRole('textbox', { name: /rename page 3/i })
    await user.clear(renameInput)
    await user.type(renameInput, 'Checkout{Escape}')

    expect(screen.queryByRole('textbox', { name: /rename page 3/i })).toBeNull()
    expect(screen.getByTestId('page-summary').textContent).toContain('page03:Page 3')

    await openPageActions(user, 'Page 3')
    await user.click(await screen.findByRole('menuitem', { name: /rename/i }))

    const renameInputAfterReopen = screen.getByRole('textbox', { name: /rename page 3/i })
    await user.clear(renameInputAfterReopen)
    await user.type(renameInputAfterReopen, 'Checkout{Enter}')

    await waitFor(() => {
      expect(screen.queryByRole('textbox', { name: /rename page 3/i })).toBeNull()
      expect(screen.getByTestId('page-summary').textContent).toContain('page03:Checkout')
    })
  })

  it('sets the start page, deletes with confirmation, and protects the last remaining page', async () => {
    const user = userEvent.setup()
    const project = createStoredMultiPageProject()
    saveProject(project, {
      preferences: {
        ...DEFAULT_WEB_ARCADE_WORKING_COPY_PREFERENCES,
        multiPageEnabled: true,
        pagePanelOpen: true,
        selectedEditTarget: 'page',
      },
    })

    renderHarness()

    await openPageActions(user, 'Details')
    await user.click(await screen.findByRole('menuitem', { name: /set as start page/i }))

    await waitFor(() => {
      expect(screen.getByTestId('start-page-id').textContent).toBe('page02')
    })

    await openPageActions(user, 'Details')
    await user.click(await screen.findByRole('menuitem', { name: /delete page/i }))

    expect(await screen.findByRole('alertdialog', { name: /delete page/i })).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /delete page/i }))

    await waitFor(() => {
      expect(screen.queryByRole('alertdialog', { name: /delete page/i })).toBeNull()
      expect(screen.getByTestId('start-page-id').textContent).toBe('page01')
      expect(screen.getByTestId('active-page-id').textContent).toBe('page01')
      expect(screen.getByTestId('page-summary').textContent).toBe('page01:Page 1')
    })

    await openPageActions(user, 'Page 1')
    const deleteAction = await screen.findByRole('menuitem', { name: /delete page/i })

    expect(
      deleteAction.getAttribute('aria-disabled') === 'true' || deleteAction.hasAttribute('data-disabled')
    ).toBe(true)
  })
})
