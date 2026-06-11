import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ComponentPalette } from '@/components/ComponentPalette'

describe('ComponentPalette', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders palette items as LinkCards without docs links or tags', async () => {
    await act(async () => {
      render(<ComponentPalette open onClose={vi.fn()} onInsertComponent={vi.fn()} />)
    })

    const palette = screen.getByTestId('component-palette')

    expect(screen.getByRole('tab', { name: 'Layout' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Components' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Icons' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'FormProgress' })).toBeTruthy()
    expect(palette.querySelectorAll('.aksel-link-card').length).toBeGreaterThan(0)
    expect(palette.querySelectorAll('.component-badge')).toHaveLength(0)
    expect(palette.querySelectorAll('.prop-tag')).toHaveLength(0)
    expect(palette.querySelectorAll('.component-docs-link')).toHaveLength(0)
    expect(screen.queryByRole('link', { name: 'Docs' })).toBeNull()
  })

  it('sorts the Components tab alphabetically', async () => {
    await act(async () => {
      render(<ComponentPalette open onClose={vi.fn()} onInsertComponent={vi.fn()} />)
    })

    const componentNames = screen
      .getAllByRole('heading', { level: 3 })
      .map((heading) => heading.textContent?.trim() ?? '')

    expect(componentNames).toEqual(
      [...componentNames].sort((left, right) => left.localeCompare(right))
    )
  })
})
