import { useCallback, useEffect } from 'react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppProvider, useProject } from '@/hooks/useProject'
import { SettingsProvider } from '@/contexts/SettingsContext'
import { AppHeader } from '@/components/Header/AppHeader'
import type { UseShareLinkOptions } from '@/hooks/useShareLink'
import type { AgentBridgeCommandResult } from '@/services/agentBridge'
import * as shareEncoding from '@/utils/shareEncoding'
import * as storage from '@/services/storage'
import type { CompressionStrategy } from '@/services/compressionStrategies'
import * as compressionStrategies from '@/services/compressionStrategies'
import {
  DESKTOP_ARCADE_CAPABILITIES,
  WEB_ARCADE_CAPABILITIES,
  type ShellCapabilities,
} from '@/services/shellCapabilities'

const TEST_ALERT_SNIPPET = Array.from({ length: 30 })
  .map((_, index) => `
  <Alert variant="warning" fullWidth>
    Auto-refresh sample ${index}
  </Alert>`)
  .join('\n')

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

interface HarnessProps {
  shareOptions?: UseShareLinkOptions
  shellCapabilities?: ShellCapabilities
}

const Harness = ({
  shareOptions,
  shellCapabilities = WEB_ARCADE_CAPABILITIES,
}: HarnessProps) => {
  const {
    project,
    setProject,
    updateProject,
    resetToIntro,
    loadFormSummaryTemplate,
    loadHooksDemo,
  } = useProject()

  const appendAlertSnippet = useCallback(() => {
    updateProject({ jsxCode: `${project.jsxCode}${TEST_ALERT_SNIPPET}` })
  }, [project.jsxCode, updateProject])

  useEffect(() => {
    const handleAppend = () => appendAlertSnippet()
    document.addEventListener('test:append-alert-snippet', handleAppend)
    return () => {
      document.removeEventListener('test:append-alert-snippet', handleAppend)
    }
  }, [appendAlertSnippet])

  return (
    <>
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
        shareOptions={shareOptions}
        shellCapabilities={shellCapabilities}
      />
      <button
        type="button"
        data-testid="append-alert-snippet"
        onClick={appendAlertSnippet}
        style={{ position: 'absolute', left: '-9999px', top: 'auto' }}
      >
        Append alert snippet
      </button>
    </>
  )
}

const renderHeader = (
  shareOptions?: UseShareLinkOptions,
  shellCapabilities: ShellCapabilities = WEB_ARCADE_CAPABILITIES
) => {
  return render(
    <SettingsProvider>
      <AppProvider>
        <Harness shareOptions={shareOptions} shellCapabilities={shellCapabilities} />
      </AppProvider>
    </SettingsProvider>
  )
}

const findAgentAccessButton = () => screen.findByRole('button', { name: /agent access/i })

const normalizeWhitespace = (value: string): string => value.replace(/\s+/g, ' ').trim()
const AGENT_CHECKPOINT_SUMMARY = 'Confidential checkpoint summary'
const AGENT_ARTIFACT_KEY_PATTERN =
  /agent|session|permission|activity|bridge|checkpoint|rollback|evidence|diagnostic/i

const callBridgeCommand = <TResult,>(command: () => TResult): TResult => {
  let result: TResult | undefined

  act(() => {
    result = command()
  })

  if (result === undefined) {
    throw new Error('Expected bridge command to return a result.')
  }

  return result
}

const expectBridgeSuccess = <TData,>(result: AgentBridgeCommandResult<TData>): TData => {
  expect(result.ok).toBe(true)

  if (!result.ok) {
    throw new Error(result.error.message)
  }

  return result.data
}

const collectObjectKeys = (value: unknown): string[] => {
  if (!value || typeof value !== 'object') {
    return []
  }

  if (Array.isArray(value)) {
    return value.flatMap(collectObjectKeys)
  }

  return Object.entries(value).flatMap(([key, nestedValue]) => [
    key,
    ...collectObjectKeys(nestedValue),
  ])
}

const readBlobText = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsText(blob)
  })

const startAgentAccess = async () => {
  fireEvent.click(await findAgentAccessButton())
  expect(await screen.findByText(/Gi agenter tilgang/i)).toBeTruthy()
  fireEvent.click(screen.getByRole('menuitemcheckbox', { name: /agent-tilgang/i }))

  await waitFor(() => expect(window.__AKSEL_ARCADE_AGENT_BRIDGE__).toBeDefined())
  const bridge = window.__AKSEL_ARCADE_AGENT_BRIDGE__
  if (!bridge) {
    throw new Error('Expected Agent bridge to be published after access starts.')
  }

  return bridge
}

const computeShareLinkChars = (payloadLength: number): number => {
  let workingEnvelope = {
    formatVersion: shareEncoding.SHARE_FORMAT_VERSION,
    metadataVersion: shareEncoding.SHARE_METADATA_VERSION,
    checksum: 'mock-checksum',
    compressed: 'X'.repeat(payloadLength),
    approxBytes: payloadLength,
    strategyId: shareEncoding.DEFAULT_COMPRESSION_STRATEGY_ID,
    warningThresholdHit: false,
    warningThreshold: shareEncoding.SHARE_URL_WARNING_THRESHOLD,
    charLimit: shareEncoding.SHARE_URL_CHAR_LIMIT,
  }

  const buildLinkInfo = () => {
    const token = shareEncoding.createShareToken(workingEnvelope)
    const link = shareEncoding.buildShareUrl(token)
    return { link, linkChars: link.length }
  }

  let { linkChars } = buildLinkInfo()
  const shouldWarn = linkChars >= shareEncoding.SHARE_URL_WARNING_THRESHOLD

  if (shouldWarn !== workingEnvelope.warningThresholdHit) {
    workingEnvelope = {
      ...workingEnvelope,
      warningThresholdHit: shouldWarn,
    }
    linkChars = buildLinkInfo().linkChars
  }

  return linkChars
}

const findShareLengthLabelForPayload = async (payloadLength: number) => {
  const shareCharsText = computeShareLinkChars(payloadLength).toLocaleString()
  const target = normalizeWhitespace(
    `Share URL length ${shareCharsText} / ${shareEncoding.SHARE_URL_CHAR_LIMIT.toLocaleString()} chars`,
  )

  const matches = await screen.findAllByText((_, element) => {
    const text = normalizeWhitespace(element?.textContent ?? '')
    return text.includes(target)
  })

  if (!matches.length) {
    throw new Error(`Unable to locate share length label for payload ${payloadLength}`)
  }

  return matches[0]
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
    expect(screen.queryByText(/Copied!/i)).toBeNull()
  })

  it('keeps Agent session artifacts out of Desktop export fallback payloads', async () => {
    const nextJsx = 'export default function App() { return <Heading>Fallback source</Heading> }'
    const nextHooks = 'export const useFallbackFixture = () => "current hooks"'
    let capturedExportBlob: Blob | null = null
    const originalCreateObjectURL = global.URL.createObjectURL
    const originalRevokeObjectURL = global.URL.revokeObjectURL

    global.URL.createObjectURL = ((blob: Blob | MediaSource) => {
      if (blob instanceof Blob) {
        capturedExportBlob = blob
      }
      return 'blob:agent-fallback-export'
    }) as typeof URL.createObjectURL
    global.URL.revokeObjectURL = (() => {}) as typeof URL.revokeObjectURL

    try {
      renderHeader(undefined, DESKTOP_ARCADE_CAPABILITIES)
      expect(screen.queryByLabelText(/share project/i)).toBeNull()

      const bridge = await startAgentAccess()
      const changeData = expectBridgeSuccess(
        callBridgeCommand(() =>
          bridge.applySourceChange({
            summary: AGENT_CHECKPOINT_SUMMARY,
            jsxCode: nextJsx,
            hooksCode: nextHooks,
            viewportSize: 'XS',
            theme: 'light',
            name: 'Fallback Export Project',
          })
        )
      )

      await waitFor(() => {
        expect(expectBridgeSuccess(callBridgeCommand(() => bridge.getProject()))).toMatchObject({
          name: 'Fallback Export Project',
          jsxCode: nextJsx,
          hooksCode: nextHooks,
        })
        expect(expectBridgeSuccess(callBridgeCommand(() => bridge.getPreviewContext()))).toEqual({
          theme: 'light',
          viewportSize: 'XS',
        })
      })
      expect(encodeSpy).not.toHaveBeenCalled()

      fireEvent.click(screen.getByRole('button', { name: /^Export$/i }))
      expect(capturedExportBlob).toBeInstanceOf(Blob)
      if (!capturedExportBlob) {
        throw new Error('Expected exportProject to create a JSON blob.')
      }

      const exportedText = await readBlobText(capturedExportBlob)
      const exported = JSON.parse(exportedText) as {
        name: string
        code: {
          jsxCode: string
          hooksCode: string
        }
        ui: {
          viewportSize: string
        }
      }

      expect(exported).toMatchObject({
        name: 'Fallback Export Project',
        code: {
          jsxCode: nextJsx,
          hooksCode: nextHooks,
        },
        ui: {
          viewportSize: 'XS',
        },
      })
      expect(exportedText).not.toContain(changeData.checkpointId)
      expect(exportedText).not.toContain(AGENT_CHECKPOINT_SUMMARY)
      expect(exportedText).not.toContain('__AKSEL_ARCADE_AGENT_BRIDGE__')
      expect(collectObjectKeys(exported).join(' ')).not.toMatch(AGENT_ARTIFACT_KEY_PATTERN)
    } finally {
      global.URL.createObjectURL = originalCreateObjectURL
      global.URL.revokeObjectURL = originalRevokeObjectURL
    }
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
    renderHeader({ generationDelayMs: 1500, slowGenerationThresholdMs: 900 })
    fireEvent.click(screen.getByLabelText(/share project/i))
    await Promise.resolve()
    expect(screen.getByText(/Link is being generated/i)).toBeTruthy()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(800)
    })
    expect(screen.queryByText(/This is taking longer than usual/i)).toBeNull()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(450)
    })
    await Promise.resolve()
    expect(screen.getByText(/This is taking longer than usual/i)).toBeTruthy()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    await Promise.resolve()
    await Promise.resolve()
    const copyButton = screen.getByRole('button', { name: /copy share link/i })
    expect((copyButton as HTMLButtonElement).disabled).toBe(false)
  }, 15000)

  it('states when projects are too large for sharing after encoding completes', async () => {
    const oversizeChars = shareEncoding.SHARE_URL_CHAR_LIMIT + 200
    const oversizeToken = shareEncoding.createShareToken({
      formatVersion: shareEncoding.SHARE_FORMAT_VERSION,
      metadataVersion: shareEncoding.SHARE_METADATA_VERSION,
      checksum: 'mock-checksum',
      compressed: 'X'.repeat(oversizeChars),
      approxBytes: oversizeChars,
      strategyId: shareEncoding.DEFAULT_COMPRESSION_STRATEGY_ID,
      warningThresholdHit: false,
      warningThreshold: shareEncoding.SHARE_URL_WARNING_THRESHOLD,
      charLimit: shareEncoding.SHARE_URL_CHAR_LIMIT,
    })
    const expectedOversizeChars = shareEncoding.buildShareUrl(oversizeToken).length
    strategySpy.mockReturnValue([
      createMockStrategy({
        estimateSize: () => 500,
        encode: async ({ serialized }) => ({
          payload: 'X'.repeat(oversizeChars),
          serialized: serialized ?? '{}',
        }),
      }),
    ])

    renderHeader()
    fireEvent.click(screen.getByLabelText(/share project/i))

    expect(await screen.findByText(/too large for a share link/i)).toBeTruthy()
    const oversizeDetails = await screen.findByText((content, element) => {
      const matchesTarget = element?.classList.contains('share-popover__oversize-details')
      if (!matchesTarget) {
        return false
      }
      return content.includes(
        `${expectedOversizeChars.toLocaleString()} / ${shareEncoding.SHARE_URL_CHAR_LIMIT.toLocaleString()}`,
      )
    })
    expect(oversizeDetails).toBeTruthy()
    expect(screen.getByRole('button', { name: /use export instead/i })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /copy share link/i })).toBeNull()
  })

  it('still encodes when estimates exceed the limit and reuses the measured result', async () => {
    const exportSpy = vi.spyOn(storage, 'exportProject').mockImplementation(() => undefined)

    strategySpy.mockReturnValue([
      createMockStrategy({
        estimateSize: () => shareEncoding.SHARE_URL_CHAR_LIMIT * 2,
        encode: async ({ serialized }) => ({
          payload: 'mock-token'.repeat(2),
          serialized: serialized ?? '{}',
        }),
      }),
    ])

    try {
      renderHeader()
      fireEvent.click(screen.getByLabelText(/share project/i))

      expect(await screen.findByText(/Share URL length/i)).toBeTruthy()
      expect(screen.queryByText(/too large for a share link/i)).toBeNull()
      expect(screen.queryByRole('button', { name: /use export instead/i })).toBeNull()
      expect(screen.getByRole('button', { name: /copy share link/i })).toBeTruthy()
      expect(exportSpy).not.toHaveBeenCalled()
    } finally {
      exportSpy.mockRestore()
    }
  })

  it('leans on the estimate badge without rendering a warning alert near the URL limit', async () => {
    strategySpy.mockReturnValue([
      createMockStrategy({
        estimateSize: () => shareEncoding.SHARE_URL_WARNING_THRESHOLD + 50,
      }),
    ])

    renderHeader()
    fireEvent.click(screen.getByLabelText(/share project/i))

    expect(await screen.findByText(/Share URL length/i)).toBeTruthy()
    expect(screen.queryByText(/Some browsers cap URLs at/i)).toBeNull()
    expect(screen.queryByRole('button', { name: /use export instead/i })).toBeNull()
    expect(screen.getByRole('button', { name: /copy share link/i })).toBeTruthy()
  })

  it('refreshes the share length when clicking the share button while the popover is open', async () => {
    let payloadLength = 100
    encodeSpy.mockImplementation(async (
      _snapshot: Parameters<typeof shareEncoding.encodeSharePayload>[0],
      options: Parameters<typeof shareEncoding.encodeSharePayload>[1],
    ) => {
      const compressed = 'X'.repeat(payloadLength)
      payloadLength += 137
      return {
        formatVersion: shareEncoding.SHARE_FORMAT_VERSION,
        metadataVersion: shareEncoding.SHARE_METADATA_VERSION,
        checksum: 'mock-checksum',
        compressed,
        approxBytes: compressed.length,
        strategyId: options?.strategyId ?? shareEncoding.DEFAULT_COMPRESSION_STRATEGY_ID,
        warningThresholdHit: false,
        warningThreshold: shareEncoding.SHARE_URL_WARNING_THRESHOLD,
        charLimit: shareEncoding.SHARE_URL_CHAR_LIMIT,
      }
    })

    renderHeader()
    const shareButton = screen.getByLabelText(/share project/i)
    fireEvent.click(shareButton)

    const shareTag = await screen.findByText(/Share URL length/i)
    const initialLength = shareTag.textContent

    fireEvent.click(shareButton)

    await waitFor(() => {
      const refreshedText = screen.getByText(/Share URL length/i).textContent
      expect(refreshedText).not.toEqual(initialLength)
    })
  })

  it('auto-regenerates the share length when the project changes while the popover is open', async () => {
    let payloadLength = 100
    encodeSpy.mockImplementation(async (
      _snapshot: Parameters<typeof shareEncoding.encodeSharePayload>[0],
      options: Parameters<typeof shareEncoding.encodeSharePayload>[1],
    ) => {
      const compressed = 'X'.repeat(payloadLength)
      return {
        formatVersion: shareEncoding.SHARE_FORMAT_VERSION,
        metadataVersion: shareEncoding.SHARE_METADATA_VERSION,
        checksum: 'mock-checksum',
        compressed,
        approxBytes: compressed.length,
        strategyId: options?.strategyId ?? shareEncoding.DEFAULT_COMPRESSION_STRATEGY_ID,
        warningThresholdHit: false,
        warningThreshold: shareEncoding.SHARE_URL_WARNING_THRESHOLD,
        charLimit: shareEncoding.SHARE_URL_CHAR_LIMIT,
      }
    })

    renderHeader()
    fireEvent.click(screen.getByLabelText(/share project/i))

    await findShareLengthLabelForPayload(payloadLength)

    payloadLength = 640
    document.dispatchEvent(new Event('test:append-alert-snippet'))

    await findShareLengthLabelForPayload(payloadLength)
  })

  it('closes the popover when clicking outside the share controls', async () => {
    const user = userEvent.setup()
    renderHeader()
    const shareButton = screen.getByLabelText(/share project/i)
    fireEvent.click(shareButton)

    await screen.findByTestId('share-popover')
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    await user.click(screen.getByText(/Untitled Project/i))

    await waitFor(() => {
      expect(shareButton.getAttribute('aria-expanded')).toBe('false')
    })
  })
})
