import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { forwardRef, useImperativeHandle } from 'react'
import { SettingsProvider, useSettings } from '@/contexts/SettingsContext'
import { AppProvider, useProject } from '@/hooks/useProject'
import { EditorPane } from '@/components/Editor/EditorPane'
import { DEFAULT_WEB_ARCADE_WORKING_COPY_PREFERENCES, saveProject } from '@/services/storage'
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

const getCodeEditor = () =>
  screen.getByRole('textbox', { name: 'Code editor' }) as HTMLTextAreaElement

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

    const globalConfigButton = screen.getByRole('button', { name: /global config/i })
    const detailsButton = screen.getByRole('button', { name: /^details/i })
    expect(screen.getByTestId('selected-edit-target').textContent).toBe('global-config')
    expect(screen.getByTestId('active-page-id').textContent).toBe('page02')
    expect(getCodeEditor().value).toContain('Shared chrome')
    expect(globalConfigButton.getAttribute('data-active-page')).toBe('true')
    expect(detailsButton.getAttribute('data-active-page')).toBe('false')
    expect(detailsButton.getAttribute('aria-current')).toBeNull()

    fireEvent.change(getCodeEditor(), { target: { value: '<Box>Shared chrome updated</Box>' } })

    expect(screen.getByTestId('global-config-jsx').textContent).toContain('Shared chrome updated')
    expect(screen.getByTestId('page-02-jsx').textContent).toContain('Page 2 content')

    await user.click(screen.getByRole('button', { name: /^page 1/i }))

    await waitFor(() => {
      expect(screen.getByTestId('selected-edit-target').textContent).toBe('page')
      expect(screen.getByTestId('active-page-id').textContent).toBe('page01')
      expect(getCodeEditor().value).toContain('Page 1 content')
    })
    expect(globalConfigButton.getAttribute('data-active-page')).toBe('false')

    fireEvent.change(getCodeEditor(), { target: { value: '<Box>Page 1 updated</Box>' } })

    expect(screen.getByTestId('page-01-jsx').textContent).toContain('Page 1 updated')
    expect(screen.getByTestId('global-config-jsx').textContent).toContain('Shared chrome updated')

    await user.click(screen.getByRole('button', { name: /hide pages/i }))
    expect(screen.queryByLabelText('Config')).toBeNull()

    await user.click(screen.getByRole('button', { name: /show pages/i }))
    expect(await screen.findByLabelText('Config')).toBeTruthy()
  })

  it('defaults the page panel closed and keeps a visible Show pages control in the header', async () => {
    const user = userEvent.setup()
    const project = createStoredMultiPageProject()
    saveProject(project, {
      preferences: {
        ...DEFAULT_WEB_ARCADE_WORKING_COPY_PREFERENCES,
        multiPageEnabled: true,
        pagePanelOpen: false,
        selectedEditTarget: 'page',
      },
    })

    renderHarness()

    const showPagesButton = await screen.findByRole('button', { name: /^show pages$/i })
    expect(showPagesButton.textContent).toContain('Show pages')
    expect(screen.queryByLabelText('Config')).toBeNull()

    await user.click(showPagesButton)

    expect(await screen.findByLabelText('Config')).toBeTruthy()
    expect(screen.getByRole('button', { name: /^hide pages$/i })).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /^hide pages$/i }))

    expect(screen.getByRole('button', { name: /^show pages$/i }).textContent).toContain(
      'Show pages'
    )
    expect(screen.queryByLabelText('Config')).toBeNull()
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
    const renameRow = renameInput.closest('.page-panel__rename')
    if (!(renameRow instanceof HTMLElement)) {
      throw new Error('Expected rename row to be rendered')
    }

    expect(within(renameRow).queryByText('page03')).toBeNull()
    expect(screen.getByRole('button', { name: /save name for page 3/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /cancel rename for page 3/i })).toBeTruthy()
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

  it('shows the home page as an icon and keeps the active page state out of the visible labels', async () => {
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

    const pageOneRow = await screen.findByRole('button', { name: /^Page 1/i })
    const detailsRow = screen.getByRole('button', { name: /^Details/i })

    expect(pageOneRow.querySelector('[aria-label="Home page"]')).toBeTruthy()
    expect(detailsRow.getAttribute('aria-current')).toBe('page')
    expect(pageOneRow.textContent).not.toMatch(/Start page/i)
    expect(detailsRow.textContent).not.toMatch(/Active page/i)

    await openPageActions(user, 'Details')
    expect(await screen.findByText('Actions')).toBeTruthy()
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
      deleteAction.getAttribute('aria-disabled') === 'true' ||
        deleteAction.hasAttribute('data-disabled')
    ).toBe(true)
  })

  it('shows delete impact counts and page-level broken-navigation indicators for stale references', async () => {
    const user = userEvent.setup()
    let project = createStoredMultiPageProject()
    project = updatePageSource(project, 'page01', {
      jsx: "<Button onClick={() => goToPage('page02')}>Open details</Button>",
    })
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
    await user.click(await screen.findByRole('menuitem', { name: /delete page/i }))

    const deleteDialog = await screen.findByRole('alertdialog', { name: /delete page/i })
    expect(deleteDialog.textContent).toMatch(/1 stale page reference/i)
    expect(deleteDialog.textContent).toMatch(/across 1 page/i)

    await user.click(screen.getByRole('button', { name: /delete page/i }))

    await waitFor(() => {
      expect(screen.getByTestId('page-summary').textContent).toBe('page01:Page 1')
      expect(
        screen
          .getByRole('button', { name: /^Page 1/i })
          .querySelector('[aria-label="Broken page navigation"]')
      ).toBeTruthy()
    })

    fireEvent.change(getCodeEditor(), { target: { value: '<Box>Page 1 recovered</Box>' } })

    await waitFor(() => {
      expect(
        screen
          .getByRole('button', { name: /^Page 1/i })
          .querySelector('[aria-label="Broken page navigation"]')
      ).toBeNull()
    })
  })

  it('updates broken-navigation indicators live when Global config stale references are fixed', async () => {
    const user = userEvent.setup()
    const project = updateGlobalConfigSource(createStoredMultiPageProject(), {
      jsx: '<Link href="page02">Shared details</Link>',
    })
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
    await user.click(await screen.findByRole('menuitem', { name: /delete page/i }))
    await user.click(await screen.findByRole('button', { name: /delete page/i }))

    await waitFor(() => {
      expect(
        screen
          .getByRole('button', { name: /^Page 1/i })
          .querySelector('[aria-label="Broken page navigation"]')
      ).toBeTruthy()
    })

    await user.click(screen.getByRole('button', { name: /global config/i }))
    fireEvent.change(getCodeEditor(), { target: { value: '<Box>Shared chrome fixed</Box>' } })

    await waitFor(() => {
      expect(
        screen
          .getByRole('button', { name: /^Page 1/i })
          .querySelector('[aria-label="Broken page navigation"]')
      ).toBeNull()
    })
  })

  it('shows broken-navigation for an inactive page without start-page status', async () => {
    const user = userEvent.setup()
    let project = createStoredMultiPageProject()
    project = updatePageSource(project, 'page01', {
      jsx: "<Button onClick={() => goToPage('page02')}>Open details</Button>",
    })
    project = createPage(project)
    project = renamePage(project, 'page03', 'Review')
    project = setActivePage(project, 'page03')
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
      expect(screen.getByTestId('active-page-id').textContent).toBe('page03')
    })

    await openPageActions(user, 'Details')
    await user.click(await screen.findByRole('menuitem', { name: /delete page/i }))
    await user.click(await screen.findByRole('button', { name: /delete page/i }))

    await waitFor(() => {
      expect(screen.getByTestId('page-summary').textContent).toBe('page01:Page 1|page03:Review')
      expect(screen.getByTestId('start-page-id').textContent).toBe('page01')
      expect(screen.getByTestId('active-page-id').textContent).toBe('page03')
      expect(
        screen
          .getByRole('button', { name: /^Page 1/i })
          .querySelector('[aria-label="Broken page navigation"]')
      ).toBeTruthy()
    })
  })
})
