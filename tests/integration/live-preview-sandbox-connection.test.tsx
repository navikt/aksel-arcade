import { act, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LivePreview } from '@/components/Preview/LivePreview'
import type { ArcadeAnnotation } from '@/types/annotations'
import type { SandboxToMainMessage } from '@/types/messages'

const {
  postMessageToSandboxMock,
  registerSandboxMessagePortMock,
  unregisterSandboxMessagePortMock,
} = vi.hoisted(() => ({
  postMessageToSandboxMock: vi.fn(),
  registerSandboxMessagePortMock: vi.fn(),
  unregisterSandboxMessagePortMock: vi.fn(),
}))

vi.mock('@/utils/sandboxMessaging', () => ({
  postMessageToSandbox: postMessageToSandboxMock,
  registerSandboxMessagePort: registerSandboxMessagePortMock,
  unregisterSandboxMessagePort: unregisterSandboxMessagePortMock,
}))

class FakeMessagePort {
  onmessage: ((event: MessageEvent) => void) | null = null
  postMessage = vi.fn()
  start = vi.fn()
  close = vi.fn()
}

const createdPorts: FakeMessagePort[] = []

class FakeMessageChannel {
  port1 = new FakeMessagePort()
  port2 = new FakeMessagePort()

  constructor() {
    createdPorts.push(this.port1, this.port2)
  }
}

const annotationFixture: ArcadeAnnotation = {
  id: 'annotation-1',
  pageId: 'page01',
  comment: 'Visible note',
  x: 24,
  y: 32,
  element: 'button "Submit"',
  elementPath: 'main > button',
  cssClasses: 'aksel-button',
  timestamp: 1,
  kind: 'feedback',
  status: 'pending',
  createdAt: '2026-07-02T00:00:00.000Z',
  updatedAt: '2026-07-02T00:00:00.000Z',
}

const renderLivePreview = (props: Partial<Parameters<typeof LivePreview>[0]> = {}) => {
  const iframeRef = { current: null as HTMLIFrameElement | null }
  const result = render(
    <LivePreview
      iframeRef={iframeRef}
      transpiledCode="export default function App() { return null }"
      onRenderSuccess={vi.fn()}
      onCompileError={vi.fn()}
      onRuntimeError={vi.fn()}
      onConsoleMessage={vi.fn()}
      onPreviewPageChange={vi.fn()}
      previewPageId="page01"
      viewportWidth="MD"
      isInspectMode={false}
      isAnnotationMode={false}
      annotations={[]}
      onAnnotationsChange={vi.fn()}
      theme="light"
      {...props}
    />
  )

  return { ...result, iframeRef }
}

const postSandboxWindowMessage = (
  iframe: HTMLIFrameElement,
  message: { type: 'SANDBOX_READY' } | SandboxToMainMessage
) => {
  act(() => {
    window.dispatchEvent(
      new MessageEvent('message', {
        data: message,
        source: iframe.contentWindow,
      })
    )
  })
}

describe('LivePreview sandbox connection', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    postMessageToSandboxMock.mockClear()
    registerSandboxMessagePortMock.mockClear()
    unregisterSandboxMessagePortMock.mockClear()
    createdPorts.length = 0
  })

  it('keeps the sandbox message channel connected when annotations are replaced', async () => {
    const originalMessageChannel = globalThis.MessageChannel
    vi.stubGlobal('MessageChannel', FakeMessageChannel)

    try {
      const { iframeRef, rerender } = renderLivePreview()
      expect(iframeRef.current).toBeTruthy()

      postSandboxWindowMessage(iframeRef.current!, { type: 'SANDBOX_READY' })
      const hostPort = createdPorts[0]
      expect(hostPort).toBeTruthy()

      act(() => {
        hostPort.onmessage?.(
          new MessageEvent('message', {
            data: { type: 'SANDBOX_CONNECTED' } satisfies SandboxToMainMessage,
          })
        )
      })

      await waitFor(() => expect(postMessageToSandboxMock).toHaveBeenCalled())
      await waitFor(() => expect(hostPort.postMessage).toHaveBeenCalled())
      hostPort.postMessage.mockClear()
      unregisterSandboxMessagePortMock.mockClear()
      hostPort.close.mockClear()

      await act(async () => {
        rerender(
          <LivePreview
            iframeRef={iframeRef}
            transpiledCode="export default function App() { return 'updated' }"
            onRenderSuccess={vi.fn()}
            onCompileError={vi.fn()}
            onRuntimeError={vi.fn()}
            onConsoleMessage={vi.fn()}
            onPreviewPageChange={vi.fn()}
            previewPageId="page01"
            viewportWidth="MD"
            isInspectMode={false}
            isAnnotationMode={false}
            annotations={[annotationFixture]}
            onAnnotationsChange={vi.fn()}
            theme="light"
          />
        )
      })

      expect(unregisterSandboxMessagePortMock.mock.calls.length).toBe(0)
      expect(hostPort.close.mock.calls.length).toBe(0)
    } finally {
      vi.stubGlobal('MessageChannel', originalMessageChannel)
    }
  })
})
