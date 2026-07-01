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
})
