import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '@/App'
import { AppContext } from '@/hooks/useProject'
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

vi.mock('@/components/Preview/PreviewPane', () => ({
  PreviewPane: () => <div data-testid="preview-pane" />,
}))

vi.mock('@/components/Layout/SplitPane', () => ({
  SplitPane: ({ left, right }: { left: ReactNode; right: ReactNode }) => (
    <div>
      {left}
      {right}
    </div>
  ),
}))

describe('App share-load warning', () => {
  it('uses shared project wording without sender metadata', async () => {
    const user = userEvent.setup()
    const project = createDefaultProject()
    const snapshot = createShareSnapshot(project)
    snapshot.updatedAt = Date.UTC(2025, 0, 1)
    const applySharedSnapshot = vi.fn()
    const dismissShareHydration = vi.fn()

    render(
      <AppContext.Provider
        value={{
          project,
          editorState: createDefaultEditorState(),
          previewState: createDefaultPreviewState(),
          previewIframeRef: { current: null },
          isComponentPaletteOpen: false,
          isSettingsOpen: false,
          updateProject: vi.fn(),
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
        <App />
      </AppContext.Provider>
    )

    expect(screen.getByText('Load shared project?')).toBeTruthy()
    expect(
      screen.getByText('Loading this shared project will replace your current work.')
    ).toBeTruthy()
    expect(screen.queryByText(/shared snapshot/i)).toBeNull()
    expect(screen.queryByText(/last updated/i)).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Load shared project' }))
    expect(applySharedSnapshot).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Keep my work' }))
    expect(dismissShareHydration).toHaveBeenCalledTimes(1)
  })
})
