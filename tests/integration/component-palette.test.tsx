import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
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

  it('passes Pagination insertion metadata through the Add menu boundary', async () => {
    const user = userEvent.setup()
    const onInsertComponent = vi.fn()

    await act(async () => {
      render(<ComponentPalette open onClose={vi.fn()} onInsertComponent={onInsertComponent} />)
    })

    await user.type(screen.getByRole('textbox', { name: /search components/i }), 'Pagination')
    await user.click(screen.getByRole('link', { name: 'Pagination' }))

    expect(onInsertComponent).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Pagination',
        insertion: expect.objectContaining({
          jsx: expect.stringContaining('page={pageState{{paginationSuffix}}}'),
          componentSetup: expect.stringContaining(
            'const [pageState{{paginationSuffix}}, setPageState{{paginationSuffix}}] = useState(1)'
          ),
        }),
      })
    )
  })

  it('passes an uncontrolled Tabs snippet through the Add menu boundary', async () => {
    const user = userEvent.setup()
    const onInsertComponent = vi.fn()

    await act(async () => {
      render(<ComponentPalette open onClose={vi.fn()} onInsertComponent={onInsertComponent} />)
    })

    await user.type(screen.getByRole('textbox', { name: /search components/i }), 'Tabs')
    await user.click(screen.getByRole('link', { name: /^Tabs$/ }))

    expect(onInsertComponent).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Tabs',
        snippet: expect.stringContaining('<Tabs defaultValue="tab1">'),
      })
    )
  })

  it('can hide page-scoped insertions from the Add menu', async () => {
    const user = userEvent.setup()

    await act(async () => {
      render(
        <ComponentPalette
          open
          onClose={vi.fn()}
          onInsertComponent={vi.fn()}
          isComponentAvailable={(component) => !(component.insertion?.hooks || component.insertion?.componentSetup)}
        />
      )
    })

    await user.type(screen.getByRole('textbox', { name: /search components/i }), 'Pagination')

    expect(screen.getByText('No components found matching "Pagination"')).toBeTruthy()
  })
})
