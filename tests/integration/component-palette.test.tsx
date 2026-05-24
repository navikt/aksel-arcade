import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ComponentPalette } from '@/components/ComponentPalette'

describe('ComponentPalette', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders palette items as LinkCards without docs links or tags', async () => {
    let container: HTMLElement | undefined

    await act(async () => {
      container = render(
        <ComponentPalette open onClose={vi.fn()} onInsertComponent={vi.fn()} />
      ).container
    })

    if (!container) throw new Error('ComponentPalette did not render')

    expect(screen.getByRole('tab', { name: 'Layout' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Components' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Icons' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'FormProgress' })).toBeTruthy()
    expect(container.querySelectorAll('.aksel-link-card').length).toBeGreaterThan(0)
    expect(container.querySelectorAll('.component-badge')).toHaveLength(0)
    expect(container.querySelectorAll('.prop-tag')).toHaveLength(0)
    expect(container.querySelectorAll('.component-docs-link')).toHaveLength(0)
    expect(screen.queryByRole('link', { name: 'Docs' })).toBeNull()
  })
})
