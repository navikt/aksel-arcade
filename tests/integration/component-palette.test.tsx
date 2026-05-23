import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ComponentPalette } from '@/components/ComponentPalette'

describe('ComponentPalette', () => {
  afterEach(() => {
    cleanup()
  })

  it('does not render redundant category or experimental badge tags on cards', async () => {
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
    expect(container.querySelectorAll('.component-badge')).toHaveLength(0)
  })
})
