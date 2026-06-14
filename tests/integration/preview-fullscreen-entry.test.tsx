import type { ComponentProps } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppProvider } from '@/hooks/useProject'
import { PreviewPane } from '@/components/Preview/PreviewPane'
import { SettingsProvider, useSettings } from '@/contexts/SettingsContext'
import {
  resetLocalStorageMock,
  resetSessionStorageMock,
  setupLocalStorageMock,
  setupSessionStorageMock,
} from '../helpers/mockLocalStorage'

vi.mock('@navikt/ds-react', async () => {
  const actual = await vi.importActual<typeof import('@navikt/ds-react')>('@navikt/ds-react')

  return {
    ...actual,
    Button: ({ size, ...props }: ComponentProps<typeof actual.Button>) => (
      <actual.Button {...props} size={size} data-size={size} />
    ),
  }
})

vi.mock('@/utils/sandboxMessaging', () => ({
  postMessageToSandbox: vi.fn(),
  registerSandboxMessagePort: vi.fn(),
  unregisterSandboxMessagePort: vi.fn(),
}))

const SettingsProbe = () => {
  const { previewFullscreen } = useSettings()

  return <div data-testid="settings-preview-fullscreen">{String(previewFullscreen)}</div>
}

describe('Preview fullscreen entry control', () => {
  beforeEach(() => {
    setupLocalStorageMock()
    setupSessionStorageMock()
    resetLocalStorageMock()
    resetSessionStorageMock()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('toggles preview fullscreen from the preview header without remounting the preview iframe', async () => {
    const user = userEvent.setup()

    render(
      <SettingsProvider>
        <AppProvider>
          <SettingsProbe />
          <PreviewPane />
        </AppProvider>
      </SettingsProvider>
    )

    const toggle = screen.getByRole('button', { name: /preview fullscreen/i })
    const inspect = screen.getByRole('button', { name: 'Enable inspect mode' })
    const previewIframe = await screen.findByTestId('preview-iframe')

    expect(toggle.getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByTestId('settings-preview-fullscreen').textContent).toBe('false')
    expect(toggle.getAttribute('data-size')).toBe('small')
    expect(inspect.getAttribute('data-size')).toBe('small')

    await user.click(toggle)

    expect(toggle.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByTestId('settings-preview-fullscreen').textContent).toBe('true')
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /preview fullscreen/i }))
    expect(screen.getByTestId('preview-iframe')).toBe(previewIframe)
    expect(toggle.getAttribute('data-size')).toBe('small')
  })

  it('keeps inspect and viewport state while exiting fullscreen from chrome and restores focus to the toggle', async () => {
    const user = userEvent.setup()

    render(
      <SettingsProvider>
        <AppProvider>
          <SettingsProbe />
          <PreviewPane />
        </AppProvider>
      </SettingsProvider>
    )

    const previewIframe = await screen.findByTestId('preview-iframe')
    const enterToggle = screen.getByRole('button', { name: 'Enter preview fullscreen' })
    const viewportButton = screen.getByLabelText('Tablet Landscape (1024px)')

    await user.click(screen.getByRole('button', { name: 'Enable inspect mode' }))
    await user.click(viewportButton)
    await user.click(enterToggle)

    const exitToggle = screen.getByRole('button', { name: 'Exit preview fullscreen' })
    const header = screen.getByTestId('preview-header')
    const headerControlsRight = screen.getByTestId('preview-header-controls-right')
    const activeInspectButton = screen.getByRole('button', { name: 'Disable inspect mode' })
    const activeViewportButton = screen.getByLabelText('Tablet Landscape (1024px)')

    expect(screen.getByTestId('settings-preview-fullscreen').textContent).toBe('true')
    expect(document.activeElement).toBe(exitToggle)
    expect(header.className).toContain('preview-pane__header--fullscreen')
    expect(headerControlsRight.className).toContain('preview-pane__header-controls-right')
    expect(headerControlsRight.querySelector('.preview-pane__viewport-toggle')).toBeTruthy()
    expect(activeInspectButton.getAttribute('aria-pressed')).toBe('true')
    expect(
      activeViewportButton.getAttribute('aria-pressed') ??
        activeViewportButton.getAttribute('aria-checked')
    ).toBe('true')
    expect(screen.getByTestId('preview-iframe')).toBe(previewIframe)

    activeInspectButton.focus()
    expect(document.activeElement).toBe(activeInspectButton)

    await user.keyboard('{Escape}')

    const restoredEnterToggle = screen.getByRole('button', { name: 'Enter preview fullscreen' })

    expect(screen.getByTestId('settings-preview-fullscreen').textContent).toBe('false')
    expect(document.activeElement).toBe(restoredEnterToggle)
    expect(screen.getByRole('button', { name: 'Disable inspect mode' }).getAttribute('aria-pressed')).toBe(
      'true'
    )
    expect(
      (
        screen.getByLabelText('Tablet Landscape (1024px)').getAttribute('aria-pressed') ??
        screen.getByLabelText('Tablet Landscape (1024px)').getAttribute('aria-checked')
      )
    ).toBe('true')
    expect(screen.getByTestId('preview-iframe')).toBe(previewIframe)
  })
})
