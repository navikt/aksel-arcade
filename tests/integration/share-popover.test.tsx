import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AppProvider, useProject } from '@/hooks/useProject'
import { SettingsProvider } from '@/contexts/SettingsContext'
import { AppHeader } from '@/components/Header/AppHeader'
import * as shareEncoding from '@/utils/shareEncoding'
import * as storage from '@/services/storage'
import type { CompressionStrategy } from '@/services/compressionStrategies'
import * as compressionStrategies from '@/services/compressionStrategies'

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
    ...overrides,
  }
}

const noop = () => {}

const Harness = () => {
  const {
    project,
    setProject,
    updateProject,
    resetToIntro,
    loadFormSummaryTemplate,
    loadHooksDemo,
  } = useProject()

  return (
    <AppHeader
      projectName={project.name}
      onProjectNameChange={name => updateProject({ name })}
      currentProject={project}
      onProjectImported={setProject}
      saveStatus="idle"
      projectSizeBytes={0}
      onResetToIntro={resetToIntro}
      onClearStorage={noop}
      onLoadFormSummaryTemplate={loadFormSummaryTemplate}
      onLoadHooksDemo={loadHooksDemo}
    />
  )
}

const renderHeader = () => {
  return render(
    <SettingsProvider>
      <AppProvider>
        <Harness />
      </AppProvider>
    </SettingsProvider>
  )
}

describe('Share popover integration', () => {
  let strategySpy: ReturnType<typeof vi.spyOn>
  let encodeSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    // Clear persisted compression multipliers so each test starts from a clean slate
    window.localStorage.clear()
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: true,
    })
    window.__AXEL_SHARE_DEBUG_CONFIG__ = undefined
    strategySpy = vi
      .spyOn(compressionStrategies, 'listCompressionStrategies')
      .mockReturnValue([createMockStrategy()])
    encodeSpy = vi.spyOn(shareEncoding, 'encodeSharePayload').mockImplementation(async (_snapshot, options) => ({
      formatVersion: shareEncoding.SHARE_FORMAT_VERSION,
      metadataVersion: shareEncoding.SHARE_METADATA_VERSION,
      checksum: 'mock-checksum',
      compressed: options?.compressed ?? 'mock-token',
      approxBytes: (options?.compressed ?? 'mock-token').length,
      strategyId: options?.strategyId ?? shareEncoding.DEFAULT_COMPRESSION_STRATEGY_ID,
      warningThresholdHit: options?.warningThresholdHit ?? false,
      warningThreshold: shareEncoding.SHARE_URL_WARNING_THRESHOLD,
      charLimit: shareEncoding.SHARE_URL_CHAR_LIMIT,
    }))
  })

  afterEach(() => {
    vi.useRealTimers()
    window.__AXEL_SHARE_DEBUG_CONFIG__ = undefined
    encodeSpy?.mockRestore()
    strategySpy?.mockRestore()
  })

  it('generates a share link and copies it to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, {
      clipboard: {
        writeText,
      },
    })

    renderHeader()

    fireEvent.click(screen.getByLabelText(/share project/i))

    expect(await screen.findByText(/Link is being generated/i)).toBeTruthy()

    const copyButton = await screen.findByRole('button', { name: /copy share link/i })
    await waitFor(() => expect((copyButton as HTMLButtonElement).disabled).toBe(false))

    fireEvent.click(copyButton)

    await waitFor(() => expect(writeText).toHaveBeenCalled())
    expect(writeText.mock.calls[0][0]).toContain('?share=')
    expect(screen.getByText(/Copied!/i)).toBeTruthy()
  })

  it('surfaces offline errors with retry guidance', async () => {
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: false,
    })

    renderHeader()

    fireEvent.click(screen.getByLabelText(/share project/i))

    expect(screen.getByText(/You appear to be offline/i)).toBeTruthy()
    const copyButton = await screen.findByRole('button', { name: /copy share link/i })
    expect((copyButton as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByRole('button', { name: /Retry generation/i })).toBeTruthy()
  })

  it('warns when storage access is unavailable', () => {
    const storageProto = Object.getPrototypeOf(window.localStorage)
    const setItemSpy = vi.spyOn(storageProto, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })

    renderHeader()
    fireEvent.click(screen.getByLabelText(/share project/i))

    expect(screen.getByText(/storage is blocked/i)).toBeTruthy()
    setItemSpy.mockRestore()
  })

  it('shows the >9s apology within 500ms once the threshold passes', async () => {
    vi.useFakeTimers()
    window.__AXEL_SHARE_DEBUG_CONFIG__ = {
      delayMs: 1500,
      apologyThresholdMs: 900,
    }

    renderHeader()
    fireEvent.click(screen.getByLabelText(/share project/i))
    await Promise.resolve()
    expect(screen.getByText(/Link is being generated/i)).toBeTruthy()

    await vi.advanceTimersByTimeAsync(800)
    expect(screen.queryByText(/This is taking longer than usual/i)).toBeNull()

    await vi.advanceTimersByTimeAsync(450)
    await Promise.resolve()
    expect(screen.getByText(/This is taking longer than usual/i)).toBeTruthy()

    await vi.advanceTimersByTimeAsync(1000)
    await Promise.resolve()
    await Promise.resolve()
    const copyButton = screen.getByRole('button', { name: /copy share link/i })
    expect((copyButton as HTMLButtonElement).disabled).toBe(false)
  }, 15000)

  it('states when projects are too large for sharing after encoding completes', async () => {
    strategySpy.mockReturnValue([
      createMockStrategy({
        estimateSize: () => 500,
        encode: async ({ serialized }) => ({
          payload: 'X'.repeat(shareEncoding.SHARE_URL_CHAR_LIMIT + 200),
          serialized: serialized ?? '{}',
        }),
      }),
    ])

    renderHeader()
    fireEvent.click(screen.getByLabelText(/share project/i))

    expect(await screen.findByText(/too large for a share link/i)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /copy share link/i })).toBeNull()
  })

  it('short-circuits oversize payloads with an export CTA', async () => {
    const exportSpy = vi.spyOn(storage, 'exportProject').mockImplementation(() => undefined)

    strategySpy.mockReturnValue([
      createMockStrategy({
        estimateSize: () => shareEncoding.SHARE_URL_CHAR_LIMIT * 2,
      }),
    ])

    try {
      renderHeader()
      fireEvent.click(screen.getByLabelText(/share project/i))

      expect(await screen.findByText(/too large for a share link/i)).toBeTruthy()
      expect(screen.getByText(/Estimated/i)).toBeTruthy()
      const cta = screen.getByRole('button', { name: /use export instead/i })
      fireEvent.click(cta)
      expect(exportSpy).toHaveBeenCalled()
    } finally {
      exportSpy.mockRestore()
    }
  })

  it('renders warning badge and export CTA when nearing the URL limit', async () => {
    strategySpy.mockReturnValue([
      createMockStrategy({
        estimateSize: () => shareEncoding.SHARE_URL_WARNING_THRESHOLD + 50,
      }),
    ])

    renderHeader()
    fireEvent.click(screen.getByLabelText(/share project/i))

    expect(await screen.findByText(/Long link detected/i)).toBeTruthy()
    expect(screen.getByText(/Estimated/i)).toBeTruthy()
    const exportButton = screen.getByRole('button', { name: /use export instead/i })
    expect(exportButton).toBeTruthy()
  })
})
