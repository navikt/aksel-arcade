import { act, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDefaultProject } from '@/utils/projectDefaults'
import type { WebArcadeWorkingCopyPreferences } from '@/services/storage'

const { saveProjectMock } = vi.hoisted(() => ({
  saveProjectMock: vi.fn(),
}))

vi.mock('@/services/storage', async () => {
  const actual = await vi.importActual<typeof import('@/services/storage')>('@/services/storage')

  return {
    ...actual,
    saveProject: saveProjectMock,
  }
})

import { useAutoSave } from '@/hooks/useAutoSave'

const project = createDefaultProject()

const Harness = () => {
  useAutoSave(project, {
    theme: 'dark',
    panelOrder: 'code-left',
    multiPageEnabled: false,
    pagePanelOpen: true,
    selectedEditTarget: 'page',
    previewFullscreen: false,
  })

  return null
}

const DynamicHarness = () => {
  const [projectState, setProjectState] = useState(() => createDefaultProject())
  const [preferences, setPreferences] = useState<WebArcadeWorkingCopyPreferences>({
    theme: 'dark',
    panelOrder: 'code-left',
    multiPageEnabled: false,
    pagePanelOpen: true,
    selectedEditTarget: 'page',
    previewFullscreen: false,
  })

  useAutoSave(projectState, preferences)

  return (
    <>
      <button
        onClick={() =>
          setPreferences((prev) => ({
            ...prev,
            previewFullscreen: !prev.previewFullscreen,
          }))
        }
      >
        Toggle preview fullscreen
      </button>
      <button
        onClick={() =>
          setPreferences((prev) => ({
            ...prev,
            theme: prev.theme === 'dark' ? 'light' : 'dark',
          }))
        }
      >
        Toggle theme
      </button>
      <button onClick={() => setProjectState((prev) => ({ ...prev, name: `${prev.name}!` }))}>
        Rename project
      </button>
    </>
  )
}

describe('useAutoSave', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('does not reschedule saves when only the preferences object identity changes', async () => {
    saveProjectMock.mockReturnValue({ success: true })
    vi.useFakeTimers()

    render(<Harness />)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4500)
    })

    expect(saveProjectMock).toHaveBeenCalledTimes(1)
  })

  it('persists preview fullscreen immediately without scheduling a second debounced save', async () => {
    saveProjectMock.mockReturnValue({ success: true })
    vi.useFakeTimers()

    render(<DynamicHarness />)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    saveProjectMock.mockClear()

    fireEvent.click(screen.getByRole('button', { name: 'Toggle preview fullscreen' }))

    expect(saveProjectMock).toHaveBeenCalledTimes(1)
    expect(saveProjectMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ name: 'Untitled Project' }),
      expect.objectContaining({
        updateLastModified: false,
        preferences: expect.objectContaining({ previewFullscreen: true }),
      })
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500)
    })

    expect(saveProjectMock).toHaveBeenCalledTimes(1)
  })

  it('includes the latest preview fullscreen value in later debounced autosaves', async () => {
    saveProjectMock.mockReturnValue({ success: true })
    vi.useFakeTimers()

    render(<DynamicHarness />)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    saveProjectMock.mockClear()

    fireEvent.click(screen.getByRole('button', { name: 'Toggle preview fullscreen' }))
    expect(saveProjectMock).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        updateLastModified: false,
        preferences: expect.objectContaining({ previewFullscreen: true }),
      })
    )

    saveProjectMock.mockClear()
    fireEvent.click(screen.getByRole('button', { name: 'Rename project' }))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })

    expect(saveProjectMock).toHaveBeenCalledTimes(1)
    expect(saveProjectMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ name: 'Untitled Project!' }),
      expect.objectContaining({
        preferences: expect.objectContaining({ previewFullscreen: true }),
      })
    )
  })
})
