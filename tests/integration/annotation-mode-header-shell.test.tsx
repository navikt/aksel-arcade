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
  LivePreview: ({
    isAnnotationMode,
    annotations,
    onAnnotationsChange,
    previewPageId,
  }: {
    isAnnotationMode: boolean
    annotations: ArcadeAnnotation[]
    onAnnotationsChange: (annotations: ArcadeAnnotation[]) => void
    previewPageId: ArcadePageId
  }) => (
    <div data-testid="live-preview">
      {isAnnotationMode && (
        <>
          <button
            type="button"
            onClick={() =>
              onAnnotationsChange([
                ...annotations,
                annotation('created-from-preview', previewPageId, {
                  comment: 'Needs clearer copy',
                  boundingBox: { x: 16, y: 24, width: 120, height: 40 },
                }),
              ])
            }
          >
            Save fake annotation
          </button>
          {annotations
            .filter((item) => item.pageId === previewPageId)
            .map((item, index) => (
              <div key={item.id}>
                <button type="button" aria-label={`Annotation ${index + 1}: ${item.comment}`}>
                  {index + 1}
                </button>
                <button
                  type="button"
                  aria-label={`Delete annotation ${item.comment}`}
                  onClick={() =>
                    onAnnotationsChange(annotations.filter((annotationItem) => annotationItem.id !== item.id))
                  }
                >
                  Delete annotation
                </button>
              </div>
            ))}
        </>
      )}
    </div>
  ),
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

const createContextValue = (project: Project) => ({
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
})

const renderPreviewPane = (project: Project = createProjectWithAnnotations()) => {
  const contextValue = createContextValue(project)
  const renderResult = render(
    <SettingsProvider>
      <AppContext.Provider value={contextValue}>
        <PreviewPane />
      </AppContext.Provider>
    </SettingsProvider>
  )

  const rerenderProject = (nextProject: Project) =>
    renderResult.rerender(
      <SettingsProvider>
        <AppContext.Provider value={createContextValue(nextProject)}>
          <PreviewPane />
        </AppContext.Provider>
      </SettingsProvider>
    )

  return { ...renderResult, contextValue, rerenderProject }
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
    expect(screen.queryByText('Annotations')).toBeNull()

    await user.click(annotationToggle)

    expect(annotationToggle.getAttribute('aria-pressed')).toBe('true')
    const clearAllButton = screen.getByRole('button', { name: /clear all annotations/i })
    expect(clearAllButton).toBeTruthy()
    expect(
      clearAllButton.compareDocumentPosition(annotationToggle) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()

    fireEvent.keyDown(annotationToggle, { key: 'Escape' })

    await waitFor(() => {
      expect(annotationToggle.getAttribute('aria-pressed')).toBe('false')
    })
    expect(screen.queryByRole('button', { name: /clear all/i })).toBeNull()
  })

  it('hides zero counts and renders page-scoped single-digit and double-digit open annotation counts', () => {
    const { rerenderProject } = renderPreviewPane(createProjectWithAnnotations())
    expect(screen.queryByTestId('annotation-count-badge')).toBeNull()

    const singleCountProject = createProjectWithAnnotations([annotation('annotation-1')])
    rerenderProject(singleCountProject)
    expect(screen.getByTestId('annotation-count-badge').textContent).toBe('1')

    const doubleCountProject = createProjectWithAnnotations([
      ...Array.from({ length: 12 }, (_, index) => annotation(`annotation-${index}`)),
      annotation('other-page', 'page02'),
      annotation('resolved', 'page01', { status: 'resolved' }),
    ])
    rerenderProject(doubleCountProject)
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

  it('caps large badge counts to the Figma two-digit badge width', () => {
    renderPreviewPane(
      createProjectWithAnnotations(
        Array.from({ length: 120 }, (_, index) => annotation(`annotation-${index}`))
      )
    )

    expect(screen.getByTestId('annotation-count-badge').textContent).toBe('99+')
  })

  it('adds a single annotation through the preview flow and keeps markers mode-scoped', async () => {
    const user = userEvent.setup()
    const { contextValue, rerenderProject } = renderPreviewPane()

    await user.click(getAnnotationToggle())
    await user.click(screen.getByRole('button', { name: /save fake annotation/i }))

    expect(contextValue.updateProject).toHaveBeenCalledWith({
      annotations: [
        expect.objectContaining({
          id: 'created-from-preview',
          pageId: 'page01',
          comment: 'Needs clearer copy',
          kind: 'feedback',
          status: 'pending',
        }),
      ],
    })

    const projectWithAnnotation = createProjectWithAnnotations([
      annotation('created-from-preview', 'page01', { comment: 'Needs clearer copy' }),
    ])
    rerenderProject(projectWithAnnotation)
    expect(screen.getByRole('button', { name: /annotation 1: needs clearer copy/i })).toBeTruthy()
    expect(screen.getByTestId('annotation-count-badge').textContent).toBe('1')

    await user.click(getAnnotationToggle())
    expect(screen.queryByRole('button', { name: /annotation 1: needs clearer copy/i })).toBeNull()

    await user.click(getAnnotationToggle())
    expect(screen.getByRole('button', { name: /annotation 1: needs clearer copy/i })).toBeTruthy()
  })

  it('updates the active-page badge after deleting an annotation through the preview flow', async () => {
    const user = userEvent.setup()
    const initialProject = createProjectWithAnnotations([
      annotation('annotation-1', 'page01', { comment: 'Needs clearer copy' }),
    ])
    const { contextValue } = renderPreviewPane(initialProject)

    await user.click(getAnnotationToggle())
    expect(screen.getByTestId('annotation-count-badge').textContent).toBe('1')

    await user.click(screen.getByRole('button', { name: /delete annotation needs clearer copy/i }))

    expect(contextValue.updateProject).toHaveBeenCalledWith({
      annotations: [],
    })
  })
})
