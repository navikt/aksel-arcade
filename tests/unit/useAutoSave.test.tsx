import { act, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDefaultProject } from '@/utils/projectDefaults'

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
  })

  return null
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
})
