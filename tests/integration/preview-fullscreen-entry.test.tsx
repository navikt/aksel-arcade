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
    const previewIframe = await screen.findByTestId('preview-iframe')

    expect(toggle.getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByTestId('settings-preview-fullscreen').textContent).toBe('false')

    await user.click(toggle)

    expect(toggle.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByTestId('settings-preview-fullscreen').textContent).toBe('true')
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /preview fullscreen/i }))
    expect(screen.getByTestId('preview-iframe')).toBe(previewIframe)
  })
})
