import { render } from '@testing-library/react'
import { useRef } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DesktopMcpApplyChangesHandler } from '@/services/desktopMcpApplyChangesProtocol'
import { createDesktopMcpProjectPageSourceUri } from '@/services/desktopMcpProjectResources'
import { useDesktopMcpProjectResourceBridge } from '@/hooks/useDesktopMcpProjectResourceBridge'
import { DEFAULT_WEB_ARCADE_WORKING_COPY_PREFERENCES, saveProject } from '@/services/storage'
import { createDefaultPreviewState, createDefaultProject } from '@/utils/projectDefaults'

let registeredApplyChangesHandler: DesktopMcpApplyChangesHandler | null = null

vi.mock('@/services/desktopMcpApplyChangesAdapter', () => ({
  registerDesktopPreloadMcpApplyChangesHandler: vi.fn((handler: DesktopMcpApplyChangesHandler) => {
    registeredApplyChangesHandler = handler
    return () => {
      registeredApplyChangesHandler = null
    }
  }),
}))

vi.mock('@/services/desktopMcpProjectResourceAdapter', () => ({
  registerDesktopPreloadMcpProjectResourceReadHandler: vi.fn(() => () => undefined),
}))

vi.mock('@/services/storage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/storage')>()
  return {
    ...actual,
    saveProject: vi.fn(),
  }
})

const mockedSaveProject = vi.mocked(saveProject)

const HookHarness = ({
  theme = 'dark',
  setTheme = vi.fn(),
  replaceProjectState = vi.fn(),
  updatePreviewState = vi.fn(),
}: {
  theme?: 'dark' | 'light'
  setTheme?: (theme: 'dark' | 'light') => void
  replaceProjectState?: (project: ReturnType<typeof createDefaultProject>) => void
  updatePreviewState?: (updates: Record<string, unknown>) => void
}) => {
  const project = createDefaultProject()
  const previewState = createDefaultPreviewState(project.viewportSize)
  const previewIframeRef = useRef<HTMLIFrameElement | null>(null)

  useDesktopMcpProjectResourceBridge({
    project,
    previewState,
    previewIframeRef,
    theme,
    workingCopyPreferences: {
      ...DEFAULT_WEB_ARCADE_WORKING_COPY_PREFERENCES,
      theme,
    },
    setTheme,
    replaceProjectState,
    updatePreviewState,
  })

  return null
}

describe('useDesktopMcpProjectResourceBridge', () => {
  beforeEach(() => {
    registeredApplyChangesHandler = null
    mockedSaveProject.mockReset()
  })

  it('does not mutate renderer state when persistence fails', () => {
    mockedSaveProject.mockReturnValue({
      success: false,
      sizeBytes: 0,
      error: 'Storage error: Quota exceeded',
    })

    const setTheme = vi.fn()
    const replaceProjectState = vi.fn()
    const updatePreviewState = vi.fn()

    render(
      <HookHarness
        setTheme={setTheme}
        replaceProjectState={replaceProjectState}
        updatePreviewState={updatePreviewState}
      />
    )

    expect(registeredApplyChangesHandler).not.toBeNull()
    const result = registeredApplyChangesHandler!({
      summary: 'Rename the project',
      operations: [{ type: 'rename_project', name: 'Renamed project' }],
    })

    expect(result).toEqual({
      ok: false,
      code: 'persistence-failed',
      message:
        'apply_changes could not persist the updated Arcade project. Storage error: Quota exceeded',
    })
    expect(replaceProjectState).not.toHaveBeenCalled()
    expect(setTheme).not.toHaveBeenCalled()
    expect(updatePreviewState).not.toHaveBeenCalled()
  })

  it('preserves payload-too-large semantics when full working-copy persistence overflows', () => {
    mockedSaveProject.mockReturnValue({
      success: false,
      sizeBytes: 5 * 1024 * 1024 + 1,
      error: 'Project size (5.0 MB) exceeds 5MB limit',
    })

    render(<HookHarness theme="dark" />)

    expect(registeredApplyChangesHandler).not.toBeNull()
    const result = registeredApplyChangesHandler!({
      summary: 'Switch preview theme',
      operations: [{ type: 'set_preview_context', theme: 'light' }],
    })

    expect(result).toEqual({
      ok: false,
      code: 'payload-too-large',
      message:
        'apply_changes could not persist the updated Arcade project. Project size (5.0 MB) exceeds 5MB limit',
    })
    expect(mockedSaveProject).toHaveBeenCalledWith(
      expect.objectContaining({
        lastModified: expect.any(String),
      }),
      {
        preferences: {
          ...DEFAULT_WEB_ARCADE_WORKING_COPY_PREFERENCES,
          theme: 'light',
        },
        updateLastModified: false,
      }
    )
  })

  it('replaces the renderer project state when page lifecycle batches persist successfully', () => {
    mockedSaveProject.mockReturnValue({
      success: true,
      sizeBytes: 1024,
    })

    const replaceProjectState = vi.fn()
    const updatePreviewState = vi.fn()

    render(
      <HookHarness
        replaceProjectState={replaceProjectState}
        updatePreviewState={updatePreviewState}
      />
    )

    expect(registeredApplyChangesHandler).not.toBeNull()
    const result = registeredApplyChangesHandler!({
      summary: 'Create a landing page and navigate to it',
      operations: [
        {
          type: 'create_page',
          newPageRef: 'landing',
          jsxCode: 'export default function LandingPage() {\n  return <div>Landing</div>\n}',
        },
        {
          type: 'replace_source',
          resourceUri: createDesktopMcpProjectPageSourceUri('page01', 'jsx'),
          content:
            'export default function PageOne() {\n  return <Button onClick={() => goToPage("{{pageRef:landing}}")}>Landing</Button>\n}',
        },
        {
          type: 'select_active_page',
          tempPageRef: 'landing',
        },
      ],
    })

    expect(result).toMatchObject({
      ok: true,
      changedResources: [
        'arcade://project/manifest',
        'arcade://project/source/pages/page02/jsx',
        'arcade://project/source/pages/page02/hooks',
        'arcade://project/source/pages/page01/jsx',
      ],
      tempPageRefMappings: {
        landing: {
          pageId: 'page02',
        },
      },
    })
    expect(replaceProjectState).toHaveBeenCalledWith(
      expect.objectContaining({
        activePageId: 'page02',
        source: expect.objectContaining({
          startPageId: 'page01',
          pages: expect.arrayContaining([
            expect.objectContaining({
              id: 'page02',
              name: 'Page 2',
            }),
          ]),
        }),
      })
    )
    expect(updatePreviewState).toHaveBeenCalledWith({
      status: 'transpiling',
      compileError: null,
      pendingCompileError: null,
      runtimeError: null,
    })
  })
})
