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

  it('passes composable Pagination insertion metadata through the Add menu boundary', async () => {
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
          jsx: expect.stringContaining('{...usePaginationState{{paginationSuffix}}()}'),
          hooks: expect.stringContaining(
            'export const usePaginationState{{paginationSuffix}} = (initialPage = 1) => {'
          ),
        }),
      })
    )
  })

  it('passes hook-backed DatePicker insertion metadata through the Add menu boundary', async () => {
    const user = userEvent.setup()
    const onInsertComponent = vi.fn()

    await act(async () => {
      render(<ComponentPalette open onClose={vi.fn()} onInsertComponent={onInsertComponent} />)
    })

    await user.type(screen.getByRole('textbox', { name: /search components/i }), 'DatePicker')
    await user.click(screen.getByRole('link', { name: 'DatePicker' }))

    expect(onInsertComponent).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'DatePicker',
        insertion: expect.objectContaining({
          jsx: '<DatePickerField{{datePickerFieldSuffix}} />',
          hooks: expect.stringContaining('const { datepickerProps, inputProps } = useDatepicker({'),
        }),
      })
    )
  })

  it('passes hook-backed Dialog insertion metadata through the Add menu boundary', async () => {
    const user = userEvent.setup()
    const onInsertComponent = vi.fn()

    await act(async () => {
      render(<ComponentPalette open onClose={vi.fn()} onInsertComponent={onInsertComponent} />)
    })

    await user.type(screen.getByRole('textbox', { name: /search components/i }), 'Dialog')
    await user.click(screen.getByRole('link', { name: 'Dialog' }))

    expect(onInsertComponent).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Dialog',
        insertion: expect.objectContaining({
          jsx: '<ReviewDialog{{dialogSuffix}} />',
          hooks: expect.stringContaining('export const ReviewDialog{{dialogSuffix}} = () => {'),
        }),
      })
    )
  })

  it('passes hook-backed Popover insertion metadata through the Add menu boundary', async () => {
    const user = userEvent.setup()
    const onInsertComponent = vi.fn()

    await act(async () => {
      render(<ComponentPalette open onClose={vi.fn()} onInsertComponent={onInsertComponent} />)
    })

    await user.type(screen.getByRole('textbox', { name: /search components/i }), 'Popover')
    await user.click(screen.getByRole('link', { name: 'Popover' }))

    expect(onInsertComponent).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Popover',
        insertion: expect.objectContaining({
          jsx: expect.stringContaining('<Button'),
          hooks: expect.stringContaining('const popoverId{{popoverSuffix}} = useId()'),
        }),
      })
    )
  })

  it('passes grouped Radio snippets through the Add menu boundary', async () => {
    const user = userEvent.setup()
    const onInsertComponent = vi.fn()

    await act(async () => {
      render(<ComponentPalette open onClose={vi.fn()} onInsertComponent={onInsertComponent} />)
    })

    await user.type(screen.getByRole('textbox', { name: /search components/i }), 'Radio')
    await user.click(screen.getByRole('link', { name: 'Radio' }))

    expect(onInsertComponent).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Radio',
        snippet: expect.stringContaining(
          '<RadioGroup legend="Choose delivery speed" defaultValue="standard" name="deliverySpeed">'
        ),
      })
    )
  })

  it('shows separate Chips Toggle and Chips Removable Add-menu entries from the shared catalog', async () => {
    const user = userEvent.setup()
    const onInsertComponent = vi.fn()

    await act(async () => {
      render(<ComponentPalette open onClose={vi.fn()} onInsertComponent={onInsertComponent} />)
    })

    await user.type(screen.getByRole('textbox', { name: /search components/i }), 'Chips')

    expect(screen.getByRole('heading', { name: 'Chips Toggle' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Chips Removable' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Chips' })).toBeNull()

    await user.click(screen.getByRole('link', { name: 'Chips Toggle' }))
    await user.click(screen.getByRole('link', { name: 'Chips Removable' }))

    expect(onInsertComponent).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        name: 'Chips Toggle',
        insertion: expect.objectContaining({
          jsx: expect.stringContaining('<Chips.Toggle'),
          hooks: expect.stringContaining(
            'const [selected{{chipsToggleSuffix}}, setSelected{{chipsToggleSuffix}}] = useState(0)'
          ),
        }),
      })
    )
    expect(onInsertComponent).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        name: 'Chips Removable',
        insertion: expect.objectContaining({
          jsx: expect.stringContaining('{filter{{chipsRemovableSuffix}}.map((c) => ('),
          hooks: expect.stringContaining(
            'const [filter{{chipsRemovableSuffix}}, setFilter{{chipsRemovableSuffix}}] = useState(options{{chipsRemovableSuffix}})'
          ),
        }),
      })
    )
  })

  it('passes hook-backed Tabs insertion metadata through the Add menu boundary', async () => {
    const user = userEvent.setup()
    const onInsertComponent = vi.fn()

    await act(async () => {
      render(<ComponentPalette open onClose={vi.fn()} onInsertComponent={onInsertComponent} />)
    })

    await user.type(screen.getByRole('textbox', { name: /search components/i }), 'Tabs')
    await user.click(screen.getByRole('link', { name: 'Tabs' }))

    expect(onInsertComponent).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Tabs',
        insertion: expect.objectContaining({
          jsx: expect.stringContaining('{...useTabsState{{tabsSuffix}}()}'),
          hooks: expect.stringContaining(
            'export const useTabsState{{tabsSuffix}} = (initialValue = "overview") => {'
          ),
        }),
      })
    )
  })
})
