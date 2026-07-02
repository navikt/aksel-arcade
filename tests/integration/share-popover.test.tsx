import { useCallback, useEffect } from 'react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppProvider, useProject } from '@/hooks/useProject'
import { SettingsProvider, useSettings } from '@/contexts/SettingsContext'
import { AppHeader } from '@/components/Header/AppHeader'
import type { UseShareLinkOptions } from '@/hooks/useShareLink'
import {
  createArcadePage,
  createArcadeSourceFile,
  getActiveSource,
} from '@/services/projectSource'
import * as shareEncoding from '@/utils/shareEncoding'
import * as storage from '@/services/storage'
import type { CompressionStrategy } from '@/services/compressionStrategies'
import * as compressionStrategies from '@/services/compressionStrategies'
import {
  WEB_ARCADE_CAPABILITIES,
  type ShellCapabilities,
} from '@/services/shellCapabilities'
import { createDefaultProject } from '@/utils/projectDefaults'

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
    supportsSerializedPayload: true,
    ...overrides,
  }
}

interface HarnessProps {
  shareOptions?: UseShareLinkOptions
  shellCapabilities?: ShellCapabilities
}

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

const Harness = ({
  shareOptions,
  shellCapabilities = WEB_ARCADE_CAPABILITIES,
}: HarnessProps) => {
  const {
    project,
    replaceProject,
    updateProject,
    resetToIntro,
    loadFormSummaryTemplate,
    loadHooksDemo,
  } = useProject()
  const { setMultiPageEnabled } = useSettings()

  const appendAlertSnippet = useCallback(() => {
    updateProject({ jsxCode: `${getActiveSource(project).jsx}${TEST_ALERT_SNIPPET}` })
  }, [project, updateProject])

  const loadLossyMultiPageProject = useCallback((enabled = true) => {
    replaceProject(createLossyMultiPageProject())
    setMultiPageEnabled(enabled)
  }, [replaceProject, setMultiPageEnabled])

  useEffect(() => {
    const handleAppend = () => appendAlertSnippet()
    document.addEventListener('test:append-alert-snippet', handleAppend)
    return () => {
      document.removeEventListener('test:append-alert-snippet', handleAppend)
    }
  }, [appendAlertSnippet])

  useEffect(() => {
    const handleLoad = (event: Event) => {
      const multiPageEnabled =
        event instanceof CustomEvent && typeof event.detail?.multiPageEnabled === 'boolean'
          ? event.detail.multiPageEnabled
          : true
      loadLossyMultiPageProject(multiPageEnabled)
    }
    document.addEventListener('test:load-lossy-multi-page-project', handleLoad)
    return () => {
      document.removeEventListener('test:load-lossy-multi-page-project', handleLoad)
    }
  }, [loadLossyMultiPageProject])

  return (
    <>
      <AppHeader
        projectName={project.name}
        onProjectNameChange={name => updateProject({ name })}
        currentProject={project}
        onProjectImported={replaceProject}
        saveStatus="idle"
        projectSizeBytes={0}
        onResetToIntro={resetToIntro}
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

const normalizeWhitespace = (value: string): string => value.replace(/\s+/g, ' ').trim()

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

    expect(await screen.findByText(/Web share URL is being generated/i)).toBeTruthy()

    const copyButton = await screen.findByRole('button', { name: /copy web share url/i })
    await waitFor(() => expect((copyButton as HTMLButtonElement).disabled).toBe(false))

    fireEvent.click(copyButton)

    await waitFor(() => expect(writeText).toHaveBeenCalled())
    expect(writeText.mock.calls[0][0]).toContain('?share=')
    expect(screen.queryByText(/Copied!/i)).toBeNull()
  })

  it('serializes only the clean full-project Web share payload when generating links', async () => {
    renderHeader()

    fireEvent.click(screen.getByLabelText(/share project/i))

    await waitFor(() => expect(encodeSpy).toHaveBeenCalled())
    const serialized = encodeSpy.mock.calls[0][1]?.serialized
    if (!serialized) {
      throw new Error('Expected share generation to pass a serialized payload.')
    }

    const payload = JSON.parse(serialized)
    expect(Object.keys(payload).sort()).toEqual(['project', 'theme'])
    expect(Object.keys(payload.project).sort()).toEqual([
      'annotations',
      'name',
      'preview',
      'source',
    ])
    expect(payload.project.annotations).toEqual([])
    expect(payload.project.name).toBe('Untitled Project')
    expect(payload.project.preview).toEqual({
      viewport: 'MD',
    })
    expect(payload.project.source.globalConfig).toEqual({
      jsx: '',
      hooks: '',
    })
    expect(payload.project.source.pages).toEqual([
      {
        id: 'page01',
        name: 'Page 1',
        source: {
          jsx: expect.any(String),
          hooks: expect.any(String),
        },
      },
    ])
    expect(payload.project.source.startPageId).toBe('page01')
    expect(payload.project.source.nextPageNumber).toBe(2)
    expect(payload.theme).toEqual('dark')
    expect(serialized).not.toContain('activePageId')
    expect(serialized).not.toContain('panelLayout')
    expect(serialized).not.toContain('createdAt')
    expect(serialized).not.toContain('lastModified')
    expect(serialized).not.toContain('version')
    expect(serialized).not.toContain('settings')
    expect(serialized).not.toContain('updatedAt')
    expect(serialized).not.toContain('warningThreshold')
    expect(serialized).not.toContain('charLimit')
  })

  it('includes preview fullscreen opening intent when share generation opts in', async () => {
    renderHeader({
      openingIntent: { previewFullscreen: true },
    })

    fireEvent.click(screen.getByLabelText(/share project/i))

    await waitFor(() => expect(encodeSpy).toHaveBeenCalled())
    const serialized = encodeSpy.mock.calls[0][1]?.serialized
    if (!serialized) {
      throw new Error('Expected share generation to pass a serialized payload.')
    }

    const payload = JSON.parse(serialized)
    expect(payload).toEqual({
      project: {
        annotations: [],
        name: 'Untitled Project',
        source: {
          globalConfig: {
            jsx: '',
            hooks: '',
          },
          pages: [
            {
              id: 'page01',
              name: 'Page 1',
              source: {
                jsx: expect.any(String),
                hooks: expect.any(String),
              },
            },
          ],
          startPageId: 'page01',
          nextPageNumber: 2,
        },
        preview: {
          viewport: 'MD',
        },
      },
      theme: 'dark',
      previewFullscreen: true,
    })
  })

  it('regenerates an open share link when opening intent changes', async () => {
    const view = renderHeader()

    fireEvent.click(screen.getByLabelText(/share project/i))

    await waitFor(() => expect(encodeSpy).toHaveBeenCalledTimes(1))
    encodeSpy.mockClear()

    view.rerender(
      <SettingsProvider>
        <AppProvider>
          <Harness shareOptions={{ openingIntent: { previewFullscreen: true } }} />
        </AppProvider>
      </SettingsProvider>
    )

    await waitFor(() => expect(encodeSpy).toHaveBeenCalled())
    const serialized = encodeSpy.mock.calls.at(-1)?.[1]?.serialized
    if (!serialized) {
      throw new Error('Expected regenerated share payload to be serialized.')
    }

    expect(JSON.parse(serialized)).toMatchObject({
      previewFullscreen: true,
    })
  })

  it('shares the full multi-page project source without warning', async () => {
    renderHeader()
    act(() => {
      document.dispatchEvent(new Event('test:load-lossy-multi-page-project'))
    })

    fireEvent.click(screen.getByLabelText(/share project/i))

    await waitFor(() => expect(encodeSpy).toHaveBeenCalled())
    expect(screen.queryByRole('alert')).toBeNull()

    const serialized = encodeSpy.mock.calls.at(-1)?.[1]?.serialized
    if (!serialized) {
      throw new Error('Expected share generation to pass a serialized payload.')
    }

    const payload = JSON.parse(serialized)
    expect(payload.project).toEqual({
      annotations: [],
      name: 'Lossy Multi-page Project',
      source: {
        globalConfig: {
          jsx: 'const SharedChrome = () => <Box>Shared chrome</Box>',
          hooks: 'export const sharedConfig = "shared"',
        },
        pages: [
          {
            id: 'page01',
            name: 'Page 1',
            source: {
              jsx: '<Box>Non-start page</Box>',
              hooks: 'export const useFirstPage = () => "first"',
            },
          },
          {
            id: 'page02',
            name: 'Page 2',
            source: {
              jsx: '<Box>Portable start page</Box>',
              hooks: 'export const usePortableStartPage = () => "start"',
            },
          },
        ],
        startPageId: 'page02',
        nextPageNumber: 3,
      },
      preview: {
        viewport: 'MD',
      },
    })
    expect(payload.theme).toBe('dark')
  })

  it('exports a multi-page project directly because packages are lossless', async () => {
    const exportSpy = vi.spyOn(storage, 'exportProject').mockImplementation(() => undefined)

    try {
      renderHeader()
      act(() => {
        document.dispatchEvent(new Event('test:load-lossy-multi-page-project'))
      })

      fireEvent.click(screen.getByRole('button', { name: /^Export$/i }))

      expect(exportSpy).toHaveBeenCalledTimes(1)
      expect(screen.queryByRole('alertdialog', { name: /confirm export/i })).toBeNull()
    } finally {
      exportSpy.mockRestore()
    }
  })

  it('still exports a multi-page project directly when the legacy flag is false', async () => {
    const exportSpy = vi.spyOn(storage, 'exportProject').mockImplementation(() => undefined)

    try {
      renderHeader()
      act(() => {
        document.dispatchEvent(
          new CustomEvent('test:load-lossy-multi-page-project', {
            detail: { multiPageEnabled: false },
          })
        )
      })

      fireEvent.click(screen.getByRole('button', { name: /^Export$/i }))

      expect(exportSpy).toHaveBeenCalledTimes(1)
      expect(screen.queryByRole('alertdialog', { name: /confirm export/i })).toBeNull()
    } finally {
      exportSpy.mockRestore()
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
    const copyButton = await screen.findByRole('button', { name: /copy web share url/i })
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
    expect(screen.getByText(/Web share URL is being generated/i)).toBeTruthy()

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
    vi.useRealTimers()
    const copyButton = await screen.findByRole('button', { name: /copy web share url/i })
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

    expect(await screen.findByText(/too large for a Web share URL/i)).toBeTruthy()
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
    expect(screen.queryByRole('button', { name: /copy web share url/i })).toBeNull()
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
      expect(screen.queryByText(/too large for a Web share URL/i)).toBeNull()
      expect(screen.queryByRole('button', { name: /use export instead/i })).toBeNull()
      expect(screen.getByRole('button', { name: /copy web share url/i })).toBeTruthy()
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
    expect(screen.getByRole('button', { name: /copy web share url/i })).toBeTruthy()
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
    act(() => {
      document.dispatchEvent(new Event('test:append-alert-snippet'))
    })

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
