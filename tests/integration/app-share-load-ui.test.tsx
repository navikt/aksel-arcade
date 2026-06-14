import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '@/App'
import { useSettings } from '@/contexts/SettingsContext'
import { AppContext } from '@/hooks/useProject'
import { SettingsProvider } from '@/contexts/SettingsContext'
import { createShareSnapshot } from '@/services/storage'
import {
  createDefaultEditorState,
  createDefaultPreviewState,
  createDefaultProject,
} from '@/utils/projectDefaults'

vi.mock('@/hooks/useAutoSave', () => ({
  useAutoSave: () => ({ saveStatus: 'idle', saveError: null }),
}))

vi.mock('@/components/Layout/ThemeProvider', () => ({
  ThemeProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock('@/components/Header/AppHeader', () => ({
  AppHeader: () => <div data-testid="app-header" />,
}))

vi.mock('@/components/Editor/EditorPane', () => ({
  EditorPane: () => <div data-testid="editor-pane" />,
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

vi.mock('@/components/Layout/SplitPane', () => ({
  SplitPane: ({ left, right }: { left: ReactNode; right: ReactNode }) => (
    <div>
      {left}
      {right}
    </div>
  ),
}))

const SettingsProbe = () => {
  const { previewFullscreen } = useSettings()

  return <div data-testid="settings-preview-fullscreen">{String(previewFullscreen)}</div>
}

describe('App share-load warning', () => {
  it('uses Web share URL wording without sender metadata', async () => {
    const user = userEvent.setup()
    const project = createDefaultProject()
    const snapshot = createShareSnapshot(project)
    snapshot.updatedAt = Date.UTC(2025, 0, 1)
    const applySharedSnapshot = vi.fn()
    const dismissShareHydration = vi.fn()

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
            shareHydration: { status: 'ready', snapshot },
            applySharedSnapshot,
            dismissShareHydration,
          }}
        >
          <SettingsProbe />
          <App />
        </AppContext.Provider>
      </SettingsProvider>
    )

    expect(screen.getByText('Load Web share URL?')).toBeTruthy()
    expect(
      screen.getByText(
        'Loading this Web share URL will replace only this Web Arcade working copy.'
      )
    ).toBeTruthy()
    expect(screen.queryByText(/shared snapshot/i)).toBeNull()
    expect(screen.queryByText(/last updated/i)).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Load Web share URL' }))
    expect(applySharedSnapshot).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Keep my work' }))
    expect(dismissShareHydration).toHaveBeenCalledTimes(1)
  })

  it('keeps fullscreen off until accept and moves the share-load warning into the fullscreen flow', async () => {
    const user = userEvent.setup()
    const project = createDefaultProject()
    const snapshot = createShareSnapshot(project)

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
            shareHydration: {
              status: 'ready',
              snapshot,
              openingIntent: { previewFullscreen: true },
            },
            applySharedSnapshot: vi.fn(),
            dismissShareHydration: vi.fn(),
          }}
        >
          <SettingsProbe />
          <App />
        </AppContext.Provider>
      </SettingsProvider>
    )

    expect(screen.getByTestId('settings-preview-fullscreen').textContent).toBe('false')
    expect(screen.getByRole('button', { name: 'Enter preview fullscreen' })).toBeTruthy()

    const warningBeforeFullscreen = screen
      .getByText('Load Web share URL?')
      .closest('.app-shell__notifications')
    expect(warningBeforeFullscreen?.className).toBe('app-shell__notifications')

    await user.click(screen.getByRole('button', { name: 'Enter preview fullscreen' }))

    expect(screen.getByTestId('settings-preview-fullscreen').textContent).toBe('true')
    expect(screen.getByRole('button', { name: 'Exit preview fullscreen' })).toBeTruthy()

    const warningInFullscreen = screen
      .getByText('Load Web share URL?')
      .closest('.app-shell__notifications')
    expect(warningInFullscreen?.className).toContain('app-shell__notifications--inline')
  })
})
