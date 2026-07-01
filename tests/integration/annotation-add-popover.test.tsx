import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { LivePreview } from '@/components/Preview/LivePreview'
import type { SandboxToMainMessage } from '@/types/messages'
import type { ResolvedAnnotationTarget } from '@/services/annotationTargets'

const selectedTarget: ResolvedAnnotationTarget = {
  identity: {
    signature: 'button-signature',
    tagName: 'button',
    accessibleName: 'Submit',
    text: 'Submit',
    cssClasses: 'aksel-button',
    elementPath: 'main > button',
    fullPath: 'html > body > div#root > main > button',
  },
  snapshot: {
    x: 50,
    y: 44,
    element: 'button "Submit"',
    elementPath: 'main > button',
    fullPath: 'html > body > div#root > main > button',
    cssClasses: 'aksel-button',
    nearbyText: 'Submit',
    boundingBox: { x: 24, y: 32, width: 120, height: 40 },
  },
  visibility: 'visible',
}

const inlineMessageTarget: ResolvedAnnotationTarget = {
  identity: {
    signature: 'inline-message-signature',
    tagName: 'div',
    role: 'div',
    text: 'Informasjon: Quick tip: Delete this intro and start coding! You can always reset via Settings -> Reset editor.',
    cssClasses: 'aksel-inline-message aksel-body-long aksel-body-long--medium',
    elementPath:
      'div "Welcome" > div "Informasjon: Quick tip: Delete this" > div "Informasjon: Quick tip: Delete this"',
    fullPath: ':scope > div:nth-of-type(1) > div:nth-of-type(2)',
  },
  snapshot: {
    x: 50,
    y: 44,
    element: 'div "Informasjon: Quick tip: Delete this intr"',
    elementPath:
      'div "Welcome" > div "Informasjon: Quick tip: Delete this" > div "Informasjon: Quick tip: Delete this"',
    fullPath: ':scope > div:nth-of-type(1) > div:nth-of-type(2)',
    cssClasses: 'aksel-inline-message aksel-body-long aksel-body-long--medium',
    nearbyText:
      'Features: Two tabs: JSX for components, Hooks for custom logic Live preview: S Informasjon: Quick tip: Delete this intro and start coding! You can always reset',
    boundingBox: { x: 24, y: 32, width: 420, height: 56 },
  },
  visibility: 'visible',
}

const renderLivePreview = (props: Partial<Parameters<typeof LivePreview>[0]> = {}) => {
  const iframeRef = { current: null as HTMLIFrameElement | null }
  const onAnnotationsChange = vi.fn()
  const result = render(
    <LivePreview
      iframeRef={iframeRef}
      transpiledCode={null}
      onRenderSuccess={vi.fn()}
      onCompileError={vi.fn()}
      onRuntimeError={vi.fn()}
      onConsoleMessage={vi.fn()}
      onPreviewPageChange={vi.fn()}
      previewPageId="page01"
      viewportWidth="MD"
      isInspectMode={false}
      isAnnotationMode
      annotations={[]}
      onAnnotationsChange={onAnnotationsChange}
      theme="light"
      {...props}
    />
  )

  return { ...result, iframeRef, onAnnotationsChange }
}

const postSandboxMessage = (iframe: HTMLIFrameElement, message: SandboxToMainMessage) => {
  act(() => {
    window.dispatchEvent(
      new MessageEvent('message', {
        data: message,
        source: iframe.contentWindow,
      })
    )
  })
}

describe('Annotation add popover', () => {
  it('opens from a selected sandbox target, blocks blank save, and saves Enter while Shift+Enter inserts a newline', async () => {
    const user = userEvent.setup()
    const { iframeRef, onAnnotationsChange } = renderLivePreview()
    expect(iframeRef.current).toBeTruthy()

    postSandboxMessage(iframeRef.current!, {
      type: 'ANNOTATION_TARGET_SELECTED',
      payload: {
        status: 'resolved',
        target: selectedTarget,
        matchCount: 1,
      },
    })

    const textarea = await screen.findByLabelText(/annotation text/i)
    await waitFor(() => expect(document.activeElement).toBe(textarea))
    expect(screen.getByRole<HTMLButtonElement>('button', { name: /save/i }).disabled).toBe(true)

    await user.type(textarea, 'Needs clearer copy')
    await user.keyboard('{Shift>}{Enter}{/Shift}')
    await user.type(textarea, 'Use an active verb')
    expect((textarea as HTMLTextAreaElement).value).toBe('Needs clearer copy\nUse an active verb')

    await user.keyboard('{Enter}')
    expect(onAnnotationsChange).toHaveBeenCalledWith([
      expect.objectContaining({
        pageId: 'page01',
        comment: 'Needs clearer copy\nUse an active verb',
        element: 'button "Submit"',
        elementPath: 'main > button',
        kind: 'feedback',
        status: 'pending',
      }),
    ])
  })

  it('does not crash when hover metadata arrives from a sandboxed iframe with inaccessible window state', async () => {
    const { iframeRef } = renderLivePreview()
    expect(iframeRef.current).toBeTruthy()

    Object.defineProperty(iframeRef.current!, 'contentWindow', {
      configurable: true,
      value: Object.defineProperty({}, 'scrollY', {
        get() {
          throw new DOMException('Blocked a frame with origin from accessing a cross-origin frame.', 'SecurityError')
        },
      }),
    })

    postSandboxMessage(iframeRef.current!, {
      type: 'ANNOTATION_TARGET_HOVERED',
      payload: {
        status: 'resolved',
        target: selectedTarget,
        matchCount: 1,
      },
    })

    expect(screen.getByRole('button', { name: /selected annotation target/i })).toBeTruthy()
  })

  it('shows a short target identifier instead of element subtree context for InlineMessage targets', async () => {
    const { iframeRef } = renderLivePreview()
    expect(iframeRef.current).toBeTruthy()

    postSandboxMessage(iframeRef.current!, {
      type: 'ANNOTATION_TARGET_SELECTED',
      payload: {
        status: 'resolved',
        target: inlineMessageTarget,
        matchCount: 1,
      },
    })

    expect(await screen.findByText('InlineMessage: Quick tip: Delete this...')).toBeTruthy()
    expect(screen.queryByText(/Features: Two tabs/i)).toBeNull()
    expect(screen.queryByText(/aksel-inline-message\\.aksel-body-long/i)).toBeNull()
  })
})
