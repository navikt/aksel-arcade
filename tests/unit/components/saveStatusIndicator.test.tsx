import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SaveStatusIndicator } from '@/components/Header/SaveStatusIndicator'
import type { SaveStatus } from '@/hooks/useAutoSave'

describe('SaveStatusIndicator', () => {
  it.each<SaveStatus>(['idle', 'saving', 'saved'])('hides normal autosave %s status', (status) => {
    const { container } = render(<SaveStatusIndicator status={status} />)

    expect(container.firstChild).toBeNull()
  })

  it('surfaces autosave failures because reload safety is broken', () => {
    render(<SaveStatusIndicator status="error" />)

    expect(screen.getByText('Autosave failed')).toBeTruthy()
    expect(screen.getByTitle(/Reload safety is unavailable/)).toBeTruthy()
  })
})
