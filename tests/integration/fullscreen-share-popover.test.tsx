import { useCallback, type ReactNode } from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppHeader } from '@/components/Header/AppHeader'
import { PreviewPane } from '@/components/Preview/PreviewPane'
import { SettingsProvider, useSettings } from '@/contexts/SettingsContext'
import { AppProvider, useProject } from '@/hooks/useProject'
import { type CompressionStrategy } from '@/services/compressionStrategies'
import * as compressionStrategies from '@/services/compressionStrategies'
import {
  DESKTOP_ARCADE_CAPABILITIES,
  WEB_ARCADE_CAPABILITIES,
  type ShellCapabilities,
} from '@/services/shellCapabilities'
import { MULTI_PAGE_WEB_SHARE_WARNING } from '@/services/storage'
import { createArcadePage, createArcadeSourceFile } from '@/services/projectSource'
import { createDefaultProject } from '@/utils/projectDefaults'
import * as shareEncoding from '@/utils/shareEncoding'
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

vi.mock('@/components/Layout/ThemeProvider', () => ({
  ThemeProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

const createMockStrategy = (overrides?: Partial<CompressionStrategy>): CompressionStrategy => {
  return {
    id: 'lz-string-uri',
    label: 'Mock strategy',
    estimateSize: () => 500,
    encode: async ({ serialized }) => ({ payload: 'mock-token', serialized: serialized ?? '{}' }),
    decode: async () => {
      throw new Error('decode not implemented in tests')
    },
    avgCpuMs: { encode: 1, decode: 1 },
    libraryCostKb: 1,
    supportsSerializedPayload: true,
    ...overrides,
  }
}

const createMockEnvelope = (
  options?: Parameters<typeof shareEncoding.encodeSharePayload>[1]
): Awaited<ReturnType<typeof shareEncoding.encodeSharePayload>> => ({
  formatVersion: shareEncoding.SHARE_FORMAT_VERSION,
  metadataVersion: shareEncoding.SHARE_METADATA_VERSION,
  checksum: 'mock-checksum',
  compressed: options?.compressed ?? 'mock-token',
  approxBytes: (options?.compressed ?? 'mock-token').length,
  strategyId: options?.strategyId ?? shareEncoding.DEFAULT_COMPRESSION_STRATEGY_ID,
  warningThresholdHit: options?.warningThresholdHit ?? false,
  warningThreshold: shareEncoding.SHARE_URL_WARNING_THRESHOLD,
  charLimit: shareEncoding.SHARE_URL_CHAR_LIMIT,
})

const createLossyMultiPageProject = () => {
  const project = createDefaultProject()
  project.name = 'Lossy Multi-page Project'
  project.source = {
    globalConfig: createArcadeSourceFile(
      'const SharedChrome = () => <Box>Shared chrome</Box>',
      'export const sharedConfig = "shared"'
    ),
    pages: [
      createArcadePage(
        'page01',
        'Page 1',
        createArcadeSourceFile(
          '<Box>Non-start page</Box>',
          'export const useFirstPage = () => "first"'
        )
      ),
      createArcadePage(
        'page02',
        'Page 2',
        createArcadeSourceFile(
          '<Box>Portable start page</Box>',
          'export const usePortableStartPage = () => "start"'
        )
      ),
    ],
    startPageId: 'page02',
    nextPageNumber: 3,
  }
  project.activePageId = 'page02'
  return project
}

const createDeferred = <TValue,>() => {
  let resolve!: (value: TValue) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<TValue>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

interface HarnessProps {
  shellCapabilities?: ShellCapabilities
}

const FullscreenShareHarness = ({ shellCapabilities = WEB_ARCADE_CAPABILITIES }: HarnessProps) => {
  const {
    project,
    replaceProject,
    updateProject,
    resetToIntro,
    loadFormSummaryTemplate,
    loadHooksDemo,
  } = useProject()
  const { setMultiPageEnabled } = useSettings()

  const loadLossyMultiPageProject = useCallback(() => {
    replaceProject(createLossyMultiPageProject())
    setMultiPageEnabled(true)
  }, [replaceProject, setMultiPageEnabled])

  return (
    <>
      <AppHeader
        projectName={project.name}
        onProjectNameChange={(name) => updateProject({ name })}
        currentProject={project}
        onProjectImported={replaceProject}
        saveStatus="saved"
        projectSizeBytes={0}
        onResetToIntro={resetToIntro}
        onLoadFormSummaryTemplate={loadFormSummaryTemplate}
        onLoadHooksDemo={loadHooksDemo}
        shellCapabilities={shellCapabilities}
      />
      <PreviewPane shellCapabilities={shellCapabilities} />
      <button
        type="button"
        data-testid="load-lossy-multi-page-project"
        onClick={loadLossyMultiPageProject}
        style={{ position: 'absolute', left: '-9999px', top: 'auto' }}
      >
        Load lossy multi-page project
      </button>
    </>
  )
}

const renderHarness = (shellCapabilities: ShellCapabilities = WEB_ARCADE_CAPABILITIES) => {
  return render(
    <SettingsProvider>
      <AppProvider>
        <FullscreenShareHarness shellCapabilities={shellCapabilities} />
      </AppProvider>
    </SettingsProvider>
  )
}

describe('Fullscreen share popover integration', () => {
  let strategySpy: ReturnType<typeof vi.spyOn>
  let encodeSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    setupLocalStorageMock()
    setupSessionStorageMock()
    resetLocalStorageMock()
    resetSessionStorageMock()
    vi.clearAllMocks()
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: true,
    })
    strategySpy = vi
      .spyOn(compressionStrategies, 'listCompressionStrategies')
      .mockReturnValue([createMockStrategy()])
    encodeSpy = vi
      .spyOn(shareEncoding, 'encodeSharePayload')
      .mockImplementation(async (_snapshot, options) => createMockEnvelope(options))
  })

  afterEach(() => {
    vi.useRealTimers()
    encodeSpy.mockRestore()
    strategySpy.mockRestore()
    vi.restoreAllMocks()
  })

  it('shows the fullscreen share button only in fullscreen, keeps it last, and adds fullscreen intent', async () => {
    const user = userEvent.setup()

    renderHarness()

    expect(screen.queryByRole('button', { name: 'Share fullscreen preview' })).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Enter preview fullscreen' }))

    const shareButton = screen.getByRole('button', { name: 'Share fullscreen preview' })
    const rightControls = screen.getByTestId('preview-header-controls-right')
    const rightControlButtons = within(rightControls).getAllByRole('button')

    expect(rightControlButtons[rightControlButtons.length - 1]).toBe(shareButton)

    await user.click(shareButton)

    expect(await screen.findByText('opens in fullscreen')).toBeTruthy()
    await waitFor(() => expect(encodeSpy).toHaveBeenCalled())

    const serialized = encodeSpy.mock.calls[0]?.[1]?.serialized
    if (!serialized) {
      throw new Error('Expected fullscreen share generation to pass a serialized payload.')
    }

    const payload = JSON.parse(serialized)
    expect(payload.previewFullscreen).toBe(true)
  })

  it('closes the fullscreen share popover on Escape before exiting fullscreen', async () => {
    const user = userEvent.setup()

    renderHarness()

    await user.click(screen.getByRole('button', { name: 'Enter preview fullscreen' }))
    await user.click(screen.getByRole('button', { name: 'Share fullscreen preview' }))

    const copyButton = await screen.findByRole('button', { name: 'Copy Web share URL' })
    copyButton.focus()

    await user.keyboard('{Escape}')

    await waitFor(() => {
      expect(screen.queryAllByTestId('share-popover')).toHaveLength(0)
    })
    const exitFullscreenButton = screen.getByRole('button', { name: 'Exit preview fullscreen' })

    expect(exitFullscreenButton).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Share fullscreen preview' })).toBeTruthy()

    exitFullscreenButton.focus()
    await user.keyboard('{Escape}')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Enter preview fullscreen' })).toBeTruthy()
    })
  })

  it('keeps the multi-page warning and Start-page-only payload in fullscreen sharing', async () => {
    const user = userEvent.setup()

    renderHarness()
    fireEvent.click(screen.getByTestId('load-lossy-multi-page-project'))

    await user.click(screen.getByRole('button', { name: 'Enter preview fullscreen' }))
    await user.click(screen.getByRole('button', { name: 'Share fullscreen preview' }))

    expect(
      (await screen.findAllByText(MULTI_PAGE_WEB_SHARE_WARNING)).length
    ).toBeGreaterThan(0)
    await waitFor(() => expect(encodeSpy).toHaveBeenCalled())

    const serialized = encodeSpy.mock.calls.at(-1)?.[1]?.serialized
    if (!serialized) {
      throw new Error('Expected fullscreen share generation to pass a serialized payload.')
    }

    const payload = JSON.parse(serialized)
    expect(payload.previewFullscreen).toBe(true)
    expect(payload.source).toEqual({
      jsx: '<Box>Portable start page</Box>',
      hooks: 'export const usePortableStartPage = () => "start"',
    })
    expect(serialized).not.toContain('Non-start page')
    expect(serialized).not.toContain('Shared chrome')
    expect(serialized).not.toContain('sharedConfig')
  })

  it('omits the fullscreen share button when Web share URLs are unavailable', async () => {
    const user = userEvent.setup()

    renderHarness(DESKTOP_ARCADE_CAPABILITIES)

    await user.click(screen.getByRole('button', { name: 'Enter preview fullscreen' }))

    expect(screen.queryByRole('button', { name: 'Share fullscreen preview' })).toBeNull()
  })

  it('closes and resets the normal share popover when entering fullscreen', async () => {
    const user = userEvent.setup()
    const firstEncode =
      createDeferred<Awaited<ReturnType<typeof shareEncoding.encodeSharePayload>>>()

    encodeSpy.mockRestore()
    encodeSpy = vi
      .spyOn(shareEncoding, 'encodeSharePayload')
      .mockImplementationOnce(() => firstEncode.promise)
      .mockImplementation(async (_snapshot, options) => createMockEnvelope(options))

    renderHarness()

    await user.click(screen.getByRole('button', { name: 'Share project' }))
    expect(await screen.findByText(/Web share URL is being generated/i)).toBeTruthy()
    await waitFor(() => expect(encodeSpy).toHaveBeenCalledTimes(1))

    await user.click(screen.getByRole('button', { name: 'Enter preview fullscreen' }))

    await waitFor(() => {
      expect(screen.queryAllByTestId('share-popover')).toHaveLength(0)
    })

    firstEncode.resolve(createMockEnvelope())
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    await user.click(screen.getByRole('button', { name: 'Exit preview fullscreen' }))
    await user.click(screen.getByRole('button', { name: 'Share project' }))

    await waitFor(() => expect(encodeSpy).toHaveBeenCalledTimes(2))
  })

  it('closes and resets the fullscreen share popover when exiting fullscreen', async () => {
    const user = userEvent.setup()
    const firstEncode =
      createDeferred<Awaited<ReturnType<typeof shareEncoding.encodeSharePayload>>>()

    encodeSpy.mockRestore()
    encodeSpy = vi
      .spyOn(shareEncoding, 'encodeSharePayload')
      .mockImplementationOnce(() => firstEncode.promise)
      .mockImplementation(async (_snapshot, options) => createMockEnvelope(options))

    renderHarness()

    await user.click(screen.getByRole('button', { name: 'Enter preview fullscreen' }))
    await user.click(screen.getByRole('button', { name: 'Share fullscreen preview' }))

    expect(await screen.findByText(/Web share URL is being generated/i)).toBeTruthy()
    await waitFor(() => expect(encodeSpy).toHaveBeenCalledTimes(1))

    await user.click(screen.getByRole('button', { name: 'Exit preview fullscreen' }))

    await waitFor(() => {
      expect(screen.queryAllByTestId('share-popover')).toHaveLength(0)
    })

    firstEncode.resolve(createMockEnvelope())
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    await user.click(screen.getByRole('button', { name: 'Enter preview fullscreen' }))
    await user.click(screen.getByRole('button', { name: 'Share fullscreen preview' }))

    await waitFor(() => expect(encodeSpy).toHaveBeenCalledTimes(2))
  })
})
