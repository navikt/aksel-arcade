import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '@/App'
import { AppContext } from '@/hooks/useProject'
import { SettingsProvider } from '@/contexts/SettingsContext'
import { WEB_ARCADE_WORKING_COPY_STORAGE_KEY } from '@/services/storage'
import {
  createDefaultEditorState,
  createDefaultPreviewState,
  createDefaultProject,
} from '@/utils/projectDefaults'
import {
  resetLocalStorageMock,
  resetSessionStorageMock,
  setupLocalStorageMock,
  setupSessionStorageMock,
} from '../helpers/mockLocalStorage'

vi.mock('@/components/Layout/ThemeProvider', () => ({
  ThemeProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock('@/components/Header/AppHeader', () => ({
  AppHeader: () => <button type="button">Header control</button>,
}))

vi.mock('@/components/Editor/EditorPane', () => ({
  EditorPane: () => <button type="button">Editor control</button>,
}))

vi.mock('@/components/Preview/PreviewPane', async () => {
  const settings = await vi.importActual<typeof import('@/contexts/SettingsContext')>(
    '@/contexts/SettingsContext'
  )

  return {
    PreviewPane: () => {
      const { previewFullscreen, togglePreviewFullscreen } = settings.useSettings()

      return (
        <div data-testid="preview-pane">
          <button
            type="button"
            aria-label={previewFullscreen ? 'Exit preview fullscreen' : 'Enter preview fullscreen'}
            aria-pressed={previewFullscreen}
            onClick={togglePreviewFullscreen}
          >
            Toggle preview fullscreen
          </button>
        </div>
      )
    },
  }
})

describe('App preview fullscreen layout', () => {
  beforeEach(() => {
    setupLocalStorageMock()
    setupSessionStorageMock()
    resetLocalStorageMock()
    resetSessionStorageMock()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('hides the normal Arcade header and editor, preserves history, and saves fullscreen without touching lastModified', async () => {
    const user = userEvent.setup()
    const project = createDefaultProject()
    project.lastModified = '2026-06-14T00:00:00.000Z'

    const pushStateSpy = vi.spyOn(window.history, 'pushState')
    const replaceStateSpy = vi.spyOn(window.history, 'replaceState')

    window.history.replaceState({}, '', '/?baseline=1')
    pushStateSpy.mockClear()
    replaceStateSpy.mockClear()

    const hrefBefore = window.location.href
    const historyLengthBefore = window.history.length

    render(
      <SettingsProvider>
        <AppContext.Provider
          value={{
            project,
            editorState: createDefaultEditorState(),
            previewState: createDefaultPreviewState(),
            previewIframeRef: { current: null },
            isComponentPaletteOpen: false,
            isSettingsOpen: false,
            updateProject: vi.fn(),
            createPage: vi.fn(),
            renamePage: vi.fn(),
            deletePage: vi.fn(),
            setStartPage: vi.fn(),
            replaceProject: vi.fn(),
            updateEditorState: vi.fn(),
            updatePreviewState: vi.fn(),
            recordSandboxConsoleMessage: vi.fn(),
            toggleComponentPalette: vi.fn(),
            closeComponentPalette: vi.fn(),
            toggleSettings: vi.fn(),
            insertSnippet: vi.fn(),
            resetToIntro: vi.fn(),
            loadFormSummaryTemplate: vi.fn(),
            loadHooksDemo: vi.fn(),
            shareHydration: { status: 'idle' },
            applySharedSnapshot: vi.fn(),
            dismissShareHydration: vi.fn(),
          }}
        >
          <App />
        </AppContext.Provider>
      </SettingsProvider>
    )

    expect(screen.getByRole('button', { name: 'Header control' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Editor control' })).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Enter preview fullscreen' }))

    expect(
      screen.getByRole('button', { name: 'Exit preview fullscreen' }).getAttribute('aria-pressed')
    ).toBe('true')
    expect(screen.queryByRole('button', { name: 'Header control' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Editor control' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Header control', hidden: true })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Editor control', hidden: true })).toBeTruthy()

    expect(window.location.href).toBe(hrefBefore)
    expect(window.history.length).toBe(historyLengthBefore)
    expect(pushStateSpy).not.toHaveBeenCalled()
    expect(replaceStateSpy).not.toHaveBeenCalled()

    await waitFor(() => {
      const stored = sessionStorage.getItem(WEB_ARCADE_WORKING_COPY_STORAGE_KEY)
      expect(stored).not.toBeNull()

      const parsed = JSON.parse(stored!)
      expect(parsed.preferences.previewFullscreen).toBe(true)
      expect(parsed.project.lastModified).toBe(project.lastModified)
    })
  })
})
