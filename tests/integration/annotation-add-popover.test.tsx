import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { LivePreview } from '@/components/Preview/LivePreview'
import type { SandboxToMainMessage } from '@/types/messages'
import type { ArcadeAnnotation } from '@/types/annotations'
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

const selectedTextTarget: ResolvedAnnotationTarget = {
  ...selectedTarget,
  snapshot: {
    ...selectedTarget.snapshot,
    selectedText: 'Use an active verb',
  },
}

const multiSelectTarget: ResolvedAnnotationTarget = {
  ...selectedTarget,
  snapshot: {
    ...selectedTarget.snapshot,
    element: 'button "Approve", button "Reject"',
    elementPath: 'main > button:nth-of-type(1) | main > button:nth-of-type(2)',
    fullPath:
      'html > body > div#root > main > button:nth-of-type(1) | html > body > div#root > main > button:nth-of-type(2)',
    isMultiSelect: true,
    targetIdentities: [
      {
        signature: 'approve-signature',
        tagName: 'button',
        accessibleName: 'Approve',
        text: 'Approve',
        cssClasses: 'aksel-button',
        elementPath: 'main > button:nth-of-type(1)',
        fullPath: 'html > body > div#root > main > button:nth-of-type(1)',
      },
      {
        signature: 'reject-signature',
        tagName: 'button',
        accessibleName: 'Reject',
        text: 'Reject',
        cssClasses: 'aksel-button',
        elementPath: 'main > button:nth-of-type(2)',
        fullPath: 'html > body > div#root > main > button:nth-of-type(2)',
      },
    ],
    boundingBox: { x: 24, y: 32, width: 240, height: 40 },
    elementBoundingBoxes: [
      { x: 24, y: 32, width: 120, height: 40 },
      { x: 144, y: 32, width: 120, height: 40 },
    ],
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

const edgeAnnotation: ArcadeAnnotation = {
  id: 'edge-annotation',
  pageId: 'page01',
  x: 98,
  y: 44,
  comment: 'Near the edge',
  element: 'div "Edge target"',
  elementPath: 'div.edge-target',
  timestamp: 1,
  kind: 'feedback',
  status: 'pending',
  createdAt: '2026-07-02T00:00:00.000Z',
  updatedAt: '2026-07-02T00:00:00.000Z',
  boundingBox: { x: 300, y: 32, width: 120, height: 40 },
}

const annotation = (overrides: Partial<ArcadeAnnotation> = {}): ArcadeAnnotation => ({
  id: 'annotation-1',
  pageId: 'page01',
  x: 50,
  y: 44,
  comment: 'Needs clearer copy near the primary action button.',
  element: 'button "Submit"',
  elementPath: 'main > button',
  cssClasses: 'aksel-button',
  timestamp: 1,
  kind: 'feedback',
  status: 'pending',
  createdAt: '2026-07-02T00:00:00.000Z',
  updatedAt: '2026-07-02T00:00:00.000Z',
  boundingBox: { x: 24, y: 32, width: 120, height: 40 },
  ...overrides,
})

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

    const textarea = await screen.findByLabelText(/^annotation text$/i)
    if (!(textarea instanceof HTMLTextAreaElement)) {
      throw new Error('Expected annotation textarea element')
    }
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

    expect(document.querySelector('.live-preview__annotation-add-anchor')).toBeTruthy()
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

  it('shows selected text context in the add and edit popovers', async () => {
    const user = userEvent.setup()
    const existingAnnotation = annotation({
      selectedText: 'Use an active verb',
    })
    const { iframeRef } = renderLivePreview({
      annotations: [existingAnnotation],
    })
    expect(iframeRef.current).toBeTruthy()

    postSandboxMessage(iframeRef.current!, {
      type: 'ANNOTATION_TARGET_SELECTED',
      payload: {
        status: 'resolved',
        target: selectedTextTarget,
        matchCount: 1,
      },
    })

    expect(await screen.findByText('Selected text')).toBeTruthy()
    expect(screen.getByText('"Use an active verb"')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /cancel/i }))
    await user.click(
      screen.getByRole('button', {
        name: /open annotation 1: needs clearer copy near the primary action button/i,
      })
    )

    expect(await screen.findAllByText('Selected text')).toHaveLength(1)
    expect(screen.getByText('"Use an active verb"')).toBeTruthy()
  })

  it('stores grouped target identities and shows a group label for multi-select annotations', async () => {
    const user = userEvent.setup()
    const { iframeRef, onAnnotationsChange } = renderLivePreview()
    expect(iframeRef.current).toBeTruthy()

    postSandboxMessage(iframeRef.current!, {
      type: 'ANNOTATION_TARGET_SELECTED',
      payload: {
        status: 'resolved',
        target: multiSelectTarget,
        targets: [multiSelectTarget],
        matchCount: 2,
      },
    })

    expect(await screen.findByText('2 selected elements')).toBeTruthy()

    const textarea = await screen.findByLabelText(/^annotation text$/i)
    await user.type(textarea, 'Review the grouped actions together')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    expect(onAnnotationsChange).toHaveBeenCalledWith([
      expect.objectContaining({
        pageId: 'page01',
        comment: 'Review the grouped actions together',
        isMultiSelect: true,
        targetIdentities: [
          expect.objectContaining({ signature: 'approve-signature' }),
          expect.objectContaining({ signature: 'reject-signature' }),
        ],
      }),
    ])
  })

  it('keeps saved marker positions visible when switching to a narrower breakpoint', () => {
    renderLivePreview({
      viewportWidth: 'XS',
      annotations: [edgeAnnotation],
    })

    const marker = screen.getByRole('button', { name: /annotation 1: near the edge/i })
    expect(marker.style.left).toBe('308px')
    expect(marker.style.left).not.toBe('420px')
  })

  it('shows marker tooltips on hover and focus and opens the edit popover from the marker', async () => {
    const user = userEvent.setup()
    const existingAnnotation = annotation()
    const { onAnnotationsChange } = renderLivePreview({
      annotations: [existingAnnotation],
    })

    const marker = screen.getByRole('button', {
      name: /open annotation 1: needs clearer copy near the primary action button/i,
    })

    await user.hover(marker)
    expect(await screen.findByText('Needs clearer copy near the primary action button.')).toBeTruthy()

    await user.unhover(marker)
    await user.tab()
    expect(document.activeElement).toBe(marker)
    expect(await screen.findByText('Needs clearer copy near the primary action button.')).toBeTruthy()

    await user.keyboard('{Enter}')
    const textarea = await screen.findByLabelText(/edit annotation text/i)
    if (!(textarea instanceof HTMLTextAreaElement)) {
      throw new Error('Expected edit annotation textarea element')
    }
    expect(textarea.value).toBe(existingAnnotation.comment)
    expect(screen.getByText('Button: Submit')).toBeTruthy()
    expect(screen.getByText(/Classes: aksel-button/i)).toBeTruthy()

    await user.clear(textarea)
    await user.type(textarea, 'Use a stronger CTA')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    expect(onAnnotationsChange).toHaveBeenCalledWith([
      expect.objectContaining({
        id: existingAnnotation.id,
        comment: 'Use a stronger CTA',
        status: 'pending',
      }),
    ])
  })

  it('cancels marker edits with Escape and restores focus to the marker button', async () => {
    const user = userEvent.setup()
    const existingAnnotation = annotation()
    renderLivePreview({
      annotations: [existingAnnotation],
    })

    const marker = screen.getByRole('button', {
      name: /open annotation 1: needs clearer copy near the primary action button/i,
    })

    await user.click(marker)
    const textarea = await screen.findByLabelText(/edit annotation text/i)
    await user.type(textarea, ' Updated')
    await user.keyboard('{Escape}')

    await waitFor(() => expect(marker.getAttribute('aria-expanded')).toBe('false'))
    await waitFor(() => expect(document.activeElement).toBe(marker))
  })

  it('cancels marker edits from the cancel button without saving changes', async () => {
    const user = userEvent.setup()
    const existingAnnotation = annotation()
    renderLivePreview({
      annotations: [existingAnnotation],
    })

    const marker = screen.getByRole('button', {
      name: /open annotation 1: needs clearer copy near the primary action button/i,
    })

    await user.click(marker)

    const textarea = await screen.findByLabelText(/edit annotation text/i)
    await user.clear(textarea)
    await user.type(textarea, 'Do not save this')
    await user.click(screen.getByRole('button', { name: /^cancel$/i }))

    await waitFor(() => expect(marker.getAttribute('aria-expanded')).toBe('false'))
    await waitFor(() => expect(document.activeElement).toBe(marker))
    expect(screen.queryByText('Do not save this')).toBeNull()
  })

  it('saves acknowledged marker edits back to pending while preserving thread history', async () => {
    const user = userEvent.setup()
    const existingAnnotation = annotation({
      status: 'acknowledged',
      thread: [{ id: 'thread-1', role: 'agent', content: 'Acknowledged', timestamp: 4 }],
    })
    const { onAnnotationsChange } = renderLivePreview({
      annotations: [existingAnnotation],
    })

    await user.click(
      screen.getByRole('button', {
        name: /open annotation 1: needs clearer copy near the primary action button/i,
      })
    )

    const textarea = await screen.findByLabelText(/edit annotation text/i)
    await user.clear(textarea)
    await user.type(textarea, 'Updated text for the agent')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    expect(onAnnotationsChange).toHaveBeenCalledWith([
      expect.objectContaining({
        id: existingAnnotation.id,
        comment: 'Updated text for the agent',
        status: 'pending',
        thread: existingAnnotation.thread,
      }),
    ])
  })

  it('hard-deletes an annotation from the edit popover', async () => {
    const user = userEvent.setup()
    const existingAnnotation = annotation()
    const { onAnnotationsChange } = renderLivePreview({
      annotations: [existingAnnotation],
    })

    await user.click(
      screen.getByRole('button', {
        name: /open annotation 1: needs clearer copy near the primary action button/i,
      })
    )
    await user.click(await screen.findByRole('button', { name: /^delete$/i }))

    expect(onAnnotationsChange).toHaveBeenCalledWith([])
  })
})
