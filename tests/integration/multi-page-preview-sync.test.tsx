import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { forwardRef, useImperativeHandle } from 'react'
import { SettingsProvider, useSettings } from '@/contexts/SettingsContext'
import { AppProvider, useProject } from '@/hooks/useProject'
import { EditorPane } from '@/components/Editor/EditorPane'
import { PreviewPane } from '@/components/Preview/PreviewPane'
import { collectPreviewDiagnostics } from '@/services/previewDiagnostics'
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

const { postMessageToSandboxMock } = vi.hoisted(() => ({
  postMessageToSandboxMock: vi.fn(),
}))

vi.mock('@/utils/sandboxMessaging', () => ({
  postMessageToSandbox: postMessageToSandboxMock,
  registerSandboxMessagePort: vi.fn(),
  unregisterSandboxMessagePort: vi.fn(),
}))

vi.mock('@/components/ComponentPalette', () => ({
  ComponentPalette: () => null,
}))

vi.mock('@/components/Editor/CodeEditor', () => ({
  CodeEditor: forwardRef<
    { undo: () => void; redo: () => void },
    { value: string; onChange: (value: string) => void; onFocusChange?: (focused: boolean) => void }
  >(({ value, onChange, onFocusChange }, ref) => {
    useImperativeHandle(ref, () => ({
      undo: () => undefined,
      redo: () => undefined,
    }))

    return (
      <textarea
        aria-label="Code editor"
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        onFocus={() => onFocusChange?.(true)}
        onBlur={() => onFocusChange?.(false)}
      />
    )
  }),
}))

const PreviewHarness = () => {
  const { project, previewState } = useProject()
  const { selectedEditTarget } = useSettings()
  const diagnostics = collectPreviewDiagnostics(previewState)

  return (
    <>
      <div data-testid="selected-edit-target">{selectedEditTarget}</div>
      <div data-testid="active-page-id">{project.activePageId}</div>
      <div data-testid="diagnostics-status">{diagnostics.status}</div>
      <div data-testid="diagnostics-compile-error">{diagnostics.compileError?.message ?? ''}</div>
      <div data-testid="diagnostics-runtime-error">{diagnostics.runtimeError?.message ?? ''}</div>
      <EditorPane />
      <PreviewPane />
    </>
  )
}

const renderHarness = () =>
  render(
    <SettingsProvider>
      <AppProvider>
        <PreviewHarness />
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
    jsx: 'export const SharedChrome = () => <Box>Shared chrome</Box>',
    hooks: 'export const useSharedChrome = () => "shared"',
  })
  project = createPage(project)
  project = renamePage(project, 'page02', 'Details')
  project = updatePageSource(project, 'page02', {
    jsx: '<Box>Page 2 content</Box>',
    hooks: 'export const usePageTwo = () => "page-two"',
  })

  return setActivePage(project, 'page01')
}

const createStoredSinglePageProject = () => {
  let project = createDefaultProject()

  project = updatePageSource(project, 'page01', {
    jsx: '<Box>Only page content</Box>',
    hooks: 'export const useOnlyPage = () => "only-page"',
  })
  project = updateGlobalConfigSource(project, {
    jsx: 'export const SharedChrome = () => <Box>Shared chrome</Box>',
    hooks: 'export const useSharedChrome = () => "shared"',
  })

  return project
}

const dispatchSandboxMessage = (data: unknown) => {
  const iframe = screen.getByTestId('preview-iframe') as HTMLIFrameElement
  if (!iframe.contentWindow) {
    throw new Error('Expected preview iframe to have a contentWindow.')
  }

  act(() => {
    window.dispatchEvent(
      new MessageEvent('message', {
        data,
        origin: window.location.origin,
        source: iframe.contentWindow,
      })
    )
  })
}

const getLastPostedMessage = (type: string) => {
  const matchingCalls = postMessageToSandboxMock.mock.calls.filter(
    (call) => call[1] && typeof call[1] === 'object' && call[1].type === type
  )
  const lastCall = matchingCalls[matchingCalls.length - 1]
  return lastCall?.[1] as { type: string; payload?: Record<string, string> } | undefined
}

const openPageActions = async (user: ReturnType<typeof userEvent.setup>, pageName: string) => {
  await user.click(
    screen.getByRole('button', {
      name: new RegExp(`page actions for ${pageName}`, 'i'),
    })
  )
}

describe('Multi-page preview sync', () => {
  beforeEach(() => {
    setupLocalStorageMock()
    setupSessionStorageMock()
    resetLocalStorageMock()
    resetSessionStorageMock()
    postMessageToSandboxMock.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
    cleanup()
  })

  it('syncs host selection with preview navigation and keeps the preview mounted under the Global config placeholder', async () => {
    const user = userEvent.setup()
    const project = createStoredMultiPageProject()
    saveProject(project, {
      preferences: {
        ...DEFAULT_WEB_ARCADE_WORKING_COPY_PREFERENCES,
        multiPageEnabled: false,
        pagePanelOpen: true,
        selectedEditTarget: 'page',
      },
    })

    renderHarness()

    const previewIframe = await screen.findByTestId('preview-iframe')
    dispatchSandboxMessage({ type: 'SANDBOX_CONNECTED' })
    dispatchSandboxMessage({ type: 'RENDER_SUCCESS' })

    await user.click(screen.getByRole('button', { name: /^Details/i }))

    await waitFor(() => {
      expect(screen.getByTestId('active-page-id').textContent).toBe('page02')
      expect((screen.getByRole('textbox', { name: 'Code editor' }) as HTMLTextAreaElement).value).toBe(
        '<Box>Page 2 content</Box>'
      )
      expect(getLastPostedMessage('NAVIGATE_TO_PAGE')?.payload?.pageId).toBe('page02')
    })

    dispatchSandboxMessage({
      type: 'PREVIEW_PAGE_CHANGED',
      payload: { pageId: 'page01' },
    })

    await waitFor(() => {
      expect(screen.getByTestId('active-page-id').textContent).toBe('page01')
      expect(screen.getByTestId('selected-edit-target').textContent).toBe('page')
      expect((screen.getByRole('textbox', { name: 'Code editor' }) as HTMLTextAreaElement).value).toBe(
        '<Box>Page 1 content</Box>'
      )
    })

    await user.click(screen.getByRole('button', { name: /global config/i }))

    await waitFor(() => {
      expect(screen.getByText('Global config has no preview')).toBeTruthy()
      expect(screen.getByTestId('selected-edit-target').textContent).toBe('global-config')
      expect(screen.getByTestId('preview-iframe')).toBe(previewIframe)
    })

    dispatchSandboxMessage({
      type: 'PREVIEW_PAGE_CHANGED',
      payload: { pageId: 'page02' },
    })

    await waitFor(() => {
      expect(screen.getByTestId('active-page-id').textContent).toBe('page02')
      expect(screen.getByTestId('selected-edit-target').textContent).toBe('global-config')
      expect(screen.getByText('Global config has no preview')).toBeTruthy()
    })
  })

  it('keeps one-page projects on the same pages-based preview model when the legacy flag is false', async () => {
    const user = userEvent.setup()
    const project = createStoredSinglePageProject()
    saveProject(project, {
      preferences: {
        ...DEFAULT_WEB_ARCADE_WORKING_COPY_PREFERENCES,
        multiPageEnabled: false,
        pagePanelOpen: true,
        selectedEditTarget: 'global-config',
      },
    })

    renderHarness()

    const previewIframe = await screen.findByTestId('preview-iframe')
    dispatchSandboxMessage({ type: 'SANDBOX_CONNECTED' })
    dispatchSandboxMessage({ type: 'RENDER_SUCCESS' })

    await waitFor(() => {
      expect(screen.getByText('Global config has no preview')).toBeTruthy()
      expect(screen.getByTestId('selected-edit-target').textContent).toBe('global-config')
      expect(screen.getByTestId('preview-iframe')).toBe(previewIframe)
      expect(getLastPostedMessage('NAVIGATE_TO_PAGE')?.payload?.pageId).toBe('page01')
    })

    await user.click(screen.getByRole('button', { name: /^Page 1/i }))

    await waitFor(() => {
      expect(screen.getByTestId('selected-edit-target').textContent).toBe('page')
      expect((screen.getByRole('textbox', { name: 'Code editor' }) as HTMLTextAreaElement).value).toBe(
        '<Box>Only page content</Box>'
      )
    })
  })

  it('shows the page-panel error indicator for runtime errors on a page', async () => {
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

    screen.getByTestId('preview-iframe')
    dispatchSandboxMessage({ type: 'SANDBOX_CONNECTED' })
    dispatchSandboxMessage({ type: 'RENDER_SUCCESS' })
    dispatchSandboxMessage({
      type: 'RUNTIME_ERROR',
      payload: {
        message: 'Details page exploded',
        componentStack: '\n    at DetailsPage',
        stack: 'Error: Details page exploded',
        pageId: 'page02',
      },
    })

    const detailsRow = await screen.findByRole('button', { name: /^Details/i })

    await waitFor(() => {
      expect(detailsRow.querySelector('[aria-label="Page error"]')).toBeTruthy()
    })
  })

  it('keeps the page error indicator visible when a page also has broken navigation', async () => {
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

    await screen.findByTestId('preview-iframe')
    dispatchSandboxMessage({ type: 'SANDBOX_CONNECTED' })
    dispatchSandboxMessage({ type: 'RENDER_SUCCESS' })

    await openPageActions(user, 'Details')
    await user.click(await screen.findByRole('menuitem', { name: /delete page/i }))
    await user.click(await screen.findByRole('button', { name: /delete page/i }))

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /^Page 1/i }).querySelector(
          '[aria-label="Broken page navigation"]'
        )
      ).toBeTruthy()
    })

    dispatchSandboxMessage({
      type: 'RUNTIME_ERROR',
      payload: {
        message: 'Start page exploded',
        componentStack: '\n    at StartPage',
        stack: 'Error: Start page exploded',
        pageId: 'page01',
      },
    })

    await waitFor(() => {
      const pageOneRow = screen.getByRole('button', { name: /^Page 1/i })
      expect(pageOneRow.querySelector('[aria-label="Page error"]')).toBeTruthy()
      expect(pageOneRow.querySelector('[aria-label="Broken page navigation"]')).toBeNull()
    })
  })

  it('hides a page-scoped runtime error overlay when a different page becomes active', async () => {
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

    await screen.findByTestId('preview-iframe')
    dispatchSandboxMessage({ type: 'SANDBOX_CONNECTED' })
    dispatchSandboxMessage({ type: 'RENDER_SUCCESS' })

    await user.click(screen.getByRole('button', { name: /^Details/i }))

    dispatchSandboxMessage({
      type: 'RUNTIME_ERROR',
      payload: {
        message: 'Details page exploded',
        componentStack: '\n    at DetailsPage',
        stack: 'Error: Details page exploded',
        pageId: 'page02',
      },
    })

    await screen.findByText('Runtime Error')

    await user.click(screen.getByRole('button', { name: /^Page 1/i }))

    await waitFor(() => {
      expect(screen.getByTestId('active-page-id').textContent).toBe('page01')
      expect(screen.queryByText('Runtime Error')).toBeNull()
      expect(
        screen.getByRole('button', { name: /^Details/i }).querySelector('[aria-label="Page error"]')
      ).toBeTruthy()
    })
  })

  it('surfaces a compile error from another page even when a different page is active', async () => {
    let project = createStoredMultiPageProject()
    // "Details" (page02) has broken JSX; page01 stays active and valid. A compile
    // error fails the whole combined module, so it must be visible from any page.
    project = updatePageSource(project, 'page02', {
      jsx: '{(() => (<Box>broken</Box>))()',
      hooks: '',
    })
    project = setActivePage(project, 'page01')
    saveProject(project, {
      preferences: {
        ...DEFAULT_WEB_ARCADE_WORKING_COPY_PREFERENCES,
        multiPageEnabled: true,
        pagePanelOpen: true,
        selectedEditTarget: 'page',
      },
    })
    renderHarness()

    const errorHeading = await screen.findByText(/Compile Error/i, undefined, { timeout: 5000 })
    expect(screen.getByTestId('active-page-id').textContent).toBe('page01')
    // The overlay names the offending page since the user is viewing a different one.
    expect(errorHeading.textContent).toContain('Details')
    expect(screen.getByTestId('diagnostics-compile-error').textContent).not.toBe('')
  })

  it('does not surface a visible compile error while the user is still in the first edit step', async () => {
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

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 600))
    })
    const editors = screen.getAllByRole('textbox', { name: 'Code editor' })
    const editor = editors[editors.length - 1]
    if (!editor) {
      throw new Error('Expected a code editor to be rendered.')
    }

    fireEvent.focus(editor)
    fireEvent.change(editor, { target: { value: '<' } })

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 1_000))
    })

    expect(screen.queryByText('Compile Error')).toBeNull()
    expect(screen.getByTestId('diagnostics-status').textContent).toBe('error')
    expect(screen.getByTestId('diagnostics-compile-error').textContent).toMatch(
      /Unexpected token/i
    )
  })

  it('drops a pending compile error when a newer runtime error arrives first', async () => {
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

    await screen.findByTestId('preview-iframe')
    dispatchSandboxMessage({ type: 'SANDBOX_CONNECTED' })
    dispatchSandboxMessage({ type: 'RENDER_SUCCESS' })

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 600))
    })

    const editors = screen.getAllByRole('textbox', { name: 'Code editor' })
    const editor = editors[editors.length - 1]
    if (!editor) {
      throw new Error('Expected a code editor to be rendered.')
    }

    fireEvent.focus(editor)
    fireEvent.change(editor, { target: { value: '<' } })

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 1_000))
    })

    dispatchSandboxMessage({
      type: 'RUNTIME_ERROR',
      payload: {
        message: 'Existing preview exploded',
        componentStack: '\n    at StartPage',
        stack: 'Error: Existing preview exploded',
        pageId: 'page01',
      },
    })

    fireEvent.blur(editor)

    await waitFor(() => {
      expect(screen.getByText('Runtime Error')).toBeTruthy()
      expect(screen.queryByText('Compile Error')).toBeNull()
      expect(screen.getByTestId('diagnostics-compile-error').textContent).toBe('')
      expect(screen.getByTestId('diagnostics-runtime-error').textContent).toBe(
        'Existing preview exploded'
      )
    })
  })

  it('clears a stale runtime overlay when a newer compile error is queued while focused', async () => {
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

    await screen.findByTestId('preview-iframe')
    dispatchSandboxMessage({ type: 'SANDBOX_CONNECTED' })
    dispatchSandboxMessage({ type: 'RENDER_SUCCESS' })
    dispatchSandboxMessage({
      type: 'RUNTIME_ERROR',
      payload: {
        message: 'Existing preview exploded',
        componentStack: '\n    at StartPage',
        stack: 'Error: Existing preview exploded',
        pageId: 'page01',
      },
    })

    await screen.findByText('Runtime Error')

    const editors = screen.getAllByRole('textbox', { name: 'Code editor' })
    const editor = editors[editors.length - 1]
    if (!editor) {
      throw new Error('Expected a code editor to be rendered.')
    }

    fireEvent.focus(editor)
    fireEvent.change(editor, { target: { value: '<' } })

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 1_000))
    })

    expect(screen.queryByText('Runtime Error')).toBeNull()
    expect(screen.queryByText('Compile Error')).toBeNull()
    expect(screen.getByTestId('diagnostics-compile-error').textContent).toMatch(/Unexpected token/i)
    expect(screen.getByTestId('diagnostics-runtime-error').textContent).toBe('')
  })
})
