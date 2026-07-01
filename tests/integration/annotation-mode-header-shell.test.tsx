import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppContext } from '@/hooks/useProject'
import { SettingsProvider } from '@/contexts/SettingsContext'
import { PreviewPane } from '@/components/Preview/PreviewPane'
import type { ArcadeAnnotation } from '@/types/annotations'
import type { ArcadePageId, Project } from '@/types/project'
import {
  createDefaultEditorState,
  createDefaultPreviewState,
  createDefaultProject,
} from '@/utils/projectDefaults'

vi.mock('@/components/Preview/LivePreview', () => ({
  LivePreview: () => <div data-testid="live-preview" />,
}))

vi.mock('@/services/transpiler', () => ({
  transpileProjectSource: vi.fn().mockResolvedValue({ success: true, code: 'compiled preview' }),
}))

const annotation = (
  id: string,
  pageId: ArcadePageId = 'page01',
  overrides: Partial<ArcadeAnnotation> = {}
): ArcadeAnnotation => ({
  id,
  pageId,
  x: 10,
  y: 20,
  comment: 'Review this',
  element: 'Button',
  elementPath: 'main > button',
  timestamp: 1,
  kind: 'feedback',
  status: 'pending',
  createdAt: '2026-07-01T08:00:00.000Z',
  updatedAt: '2026-07-01T08:00:00.000Z',
  ...overrides,
})

const createProjectWithAnnotations = (annotations: ArcadeAnnotation[] = []): Project => ({
  ...createDefaultProject(),
  id: `project-${annotations.length}`,
  activePageId: 'page01',
  annotations,
})

const renderPreviewPane = (project: Project = createProjectWithAnnotations()) => {
  const contextValue = {
    project,
    editorState: createDefaultEditorState(),
    previewState: createDefaultPreviewState(project.viewportSize),
    previewIframeRef: { current: null },
    isComponentPaletteOpen: false,
    isSettingsOpen: false,
    updateProject: vi.fn(),
    replaceProjectState: vi.fn(),
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
    shareHydration: { status: 'idle' as const },
    applySharedSnapshot: vi.fn(),
    dismissShareHydration: vi.fn(),
  }

  return render(
    <SettingsProvider>
      <AppContext.Provider value={contextValue}>
        <PreviewPane />
      </AppContext.Provider>
    </SettingsProvider>
  )
}

const getAnnotationToggle = () =>
  screen.getByRole('button', {
    name: /annotation mode/i,
  })

describe('Annotation mode preview-header shell', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    window.sessionStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts off, toggles Clear all visibility, and exits with Escape', async () => {
    const user = userEvent.setup()
    renderPreviewPane()

    const annotationToggle = getAnnotationToggle()
    expect(annotationToggle.getAttribute('aria-pressed')).toBe('false')
    expect(screen.queryByRole('button', { name: /clear all/i })).toBeNull()

    await user.click(annotationToggle)

    expect(annotationToggle.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: /clear all/i })).toBeTruthy()

    fireEvent.keyDown(annotationToggle, { key: 'Escape' })

    await waitFor(() => {
      expect(annotationToggle.getAttribute('aria-pressed')).toBe('false')
    })
    expect(screen.queryByRole('button', { name: /clear all/i })).toBeNull()
  })

  it('renders page-scoped zero, single-digit, and double-digit open annotation counts', () => {
    const { rerender } = renderPreviewPane(createProjectWithAnnotations())
    expect(screen.getByTestId('annotation-count-badge').textContent).toBe('0')

    const singleCountProject = createProjectWithAnnotations([annotation('annotation-1')])
    rerender(
      <SettingsProvider>
        <AppContext.Provider
          value={{
            project: singleCountProject,
            editorState: createDefaultEditorState(),
            previewState: createDefaultPreviewState(singleCountProject.viewportSize),
            previewIframeRef: { current: null },
            isComponentPaletteOpen: false,
            isSettingsOpen: false,
            updateProject: vi.fn(),
            replaceProjectState: vi.fn(),
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
          <PreviewPane />
        </AppContext.Provider>
      </SettingsProvider>
    )
    expect(screen.getByTestId('annotation-count-badge').textContent).toBe('1')

    const doubleCountProject = createProjectWithAnnotations([
      ...Array.from({ length: 12 }, (_, index) => annotation(`annotation-${index}`)),
      annotation('other-page', 'page02'),
      annotation('resolved', 'page01', { status: 'resolved' }),
    ])
    rerender(
      <SettingsProvider>
        <AppContext.Provider
          value={{
            project: doubleCountProject,
            editorState: createDefaultEditorState(),
            previewState: createDefaultPreviewState(doubleCountProject.viewportSize),
            previewIframeRef: { current: null },
            isComponentPaletteOpen: false,
            isSettingsOpen: false,
            updateProject: vi.fn(),
            replaceProjectState: vi.fn(),
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
          <PreviewPane />
        </AppContext.Provider>
      </SettingsProvider>
    )
    expect(screen.getByTestId('annotation-count-badge').textContent).toBe('12')
  })

  it('keeps Annotation mode and Inspect mode mutually exclusive', async () => {
    const user = userEvent.setup()
    renderPreviewPane()

    const annotationToggle = getAnnotationToggle()
    const inspectToggle = screen.getByRole('button', { name: /enable inspect mode/i })

    await user.click(inspectToggle)
    expect(inspectToggle.getAttribute('aria-pressed')).toBe('true')

    await user.click(annotationToggle)
    expect(annotationToggle.getAttribute('aria-pressed')).toBe('true')
    expect(inspectToggle.getAttribute('aria-pressed')).toBe('false')

    await user.click(inspectToggle)
    expect(inspectToggle.getAttribute('aria-pressed')).toBe('true')
    expect(annotationToggle.getAttribute('aria-pressed')).toBe('false')
    expect(screen.queryByRole('button', { name: /clear all/i })).toBeNull()
  })
})
