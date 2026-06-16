import { render } from '@testing-library/react'
import { useRef } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DesktopMcpApplyChangesHandler } from '@/services/desktopMcpApplyChangesProtocol'
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
  updateProject = vi.fn(),
  updatePreviewState = vi.fn(),
  onDesktopMcpActivity = vi.fn(),
}: {
  theme?: 'dark' | 'light'
  setTheme?: (theme: 'dark' | 'light') => void
  updateProject?: (updates: Record<string, unknown>) => void
  updatePreviewState?: (updates: Record<string, unknown>) => void
  onDesktopMcpActivity?: (activity: {
    toolName: 'apply_changes' | 'capture_preview_evidence'
    operationTypes?: string[]
    timestamp: string
  }) => void
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
    updateProject,
    updatePreviewState,
    onDesktopMcpActivity,
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
    const updateProject = vi.fn()
    const updatePreviewState = vi.fn()
    const onDesktopMcpActivity = vi.fn()

    render(
      <HookHarness
        setTheme={setTheme}
        updateProject={updateProject}
        updatePreviewState={updatePreviewState}
        onDesktopMcpActivity={onDesktopMcpActivity}
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
    expect(updateProject).not.toHaveBeenCalled()
    expect(setTheme).not.toHaveBeenCalled()
    expect(updatePreviewState).not.toHaveBeenCalled()
    expect(onDesktopMcpActivity).not.toHaveBeenCalled()
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
})
