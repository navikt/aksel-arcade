import { afterEach, describe, expect, it } from 'vitest'
import type { ArcadeAnnotation, AnnotationRect } from '@/types/annotations'
import {
  MAX_PREVIEW_EVIDENCE_ELEMENTS,
  PREVIEW_EVIDENCE_ANNOTATION_OVERLAY_NOTE,
  capturePreviewEvidenceSnapshot,
  serializePreviewEvidence,
} from '@/services/previewEvidence'
import { getAnnotationTargetIdentity } from '@/services/annotationTargets'

const originalWindowMetricDescriptors = {
  innerWidth: Object.getOwnPropertyDescriptor(window, 'innerWidth'),
  innerHeight: Object.getOwnPropertyDescriptor(window, 'innerHeight'),
  devicePixelRatio: Object.getOwnPropertyDescriptor(window, 'devicePixelRatio'),
  scrollX: Object.getOwnPropertyDescriptor(window, 'scrollX'),
  scrollY: Object.getOwnPropertyDescriptor(window, 'scrollY'),
}

afterEach(() => {
  document.body.innerHTML = ''
  document.body.removeAttribute('style')
  document.documentElement.removeAttribute('style')
  restoreWindowMetric('innerWidth')
  restoreWindowMetric('innerHeight')
  restoreWindowMetric('devicePixelRatio')
  restoreWindowMetric('scrollX')
  restoreWindowMetric('scrollY')
})

describe('preview evidence', () => {
  it('serializes useful layout facts from the preview root', () => {
    const { button, root } = renderPreviewFixture()

    const evidence = serializePreviewEvidence(root, window)

    expect(evidence.frame).toEqual({
      rootSelector: '#root',
      viewport: {
        width: 1024,
        height: 768,
        devicePixelRatio: 2,
      },
      scroll: {
        x: 0,
        y: 0,
      },
      capturedElementCount: 4,
      truncated: false,
    })
    expect(evidence.tree).toMatchObject({
      tagName: 'div',
      text: 'Root text',
      attributes: {
        'data-color': 'accent',
        id: 'root',
      },
      classNames: ['aksel-theme', 'dark'],
      boundingBox: {
        x: 10,
        y: 20,
        width: 300,
        height: 200,
      },
      computedStyle: {
        display: 'flex',
        paddingTop: '8px',
        rowGap: '12px',
      },
      children: [
        {
          tagName: 'section',
          attributes: {
            'data-agent-note': 'safe',
            'data-color': 'info',
          },
          classNames: ['aksel-box', 'custom'],
          computedStyle: {
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
          },
        },
      ],
    })
    expect(evidence.tree.children?.[0]?.children).toMatchObject([
      {
        tagName: 'h1',
        text: 'Preview title',
        attributes: {
          'aria-label': 'Title label',
        },
      },
      {
        tagName: 'button',
        text: 'Continue',
        attributes: {
          'data-color': 'accent',
        },
        computedStyle: {
          backgroundColor: 'rgb(4, 5, 6)',
        },
      },
    ])
    expect(button.getAttribute('onclick')).toBe('steal()')
  })

  it('excludes scripts, handlers, React internals, full CSS, and browser state references', () => {
    const { root, section } = renderPreviewFixture()
    const sectionWithReactInternals = section as HTMLElement & {
      __reactFiber$agentTest?: unknown
    }
    sectionWithReactInternals.__reactFiber$agentTest = { props: { secret: 'internal' } }

    const serialized = JSON.stringify(serializePreviewEvidence(root, window))

    expect(serialized).not.toContain('script')
    expect(serialized).not.toContain('onclick')
    expect(serialized).not.toContain('steal()')
    expect(serialized).not.toContain('data-reactroot')
    expect(serialized).not.toContain('__reactFiber')
    expect(serialized).not.toContain('localStorage')
    expect(serialized).not.toContain('document.cookie')
    expect(serialized).not.toContain('clipboard')
    expect(serialized).not.toContain('.unsafe-css')
  })

  it('is deterministic for the same preview DOM', () => {
    const { root } = renderPreviewFixture()

    expect(serializePreviewEvidence(root, window)).toEqual(serializePreviewEvidence(root, window))
  })

  it('caps large evidence trees deterministically', () => {
    document.body.innerHTML = `<div id="root">${'<span>Item</span>'.repeat(
      MAX_PREVIEW_EVIDENCE_ELEMENTS + 10
    )}</div>`
    const root = document.getElementById('root')
    if (!root) {
      throw new Error('Expected preview root to exist.')
    }

    const evidence = serializePreviewEvidence(root, window)

    expect(evidence.frame.capturedElementCount).toBe(MAX_PREVIEW_EVIDENCE_ELEMENTS)
    expect(evidence.frame.truncated).toBe(true)
  })

  it('falls back to the requested viewport dimensions when iframe window metrics are zero', () => {
    const { root } = renderPreviewFixture()

    Object.defineProperties(window, {
      innerWidth: { configurable: true, value: 0 },
      innerHeight: { configurable: true, value: 0 },
    })
    mockRect(root, { x: 0, y: 0, width: 0, height: 0 })

    const result = capturePreviewEvidenceSnapshot(
      root,
      {
        layers: ['screenshot'],
        viewportFallback: { width: 640, height: 480 },
      },
      window
    )
    if (!result.ok) {
      throw new Error(JSON.stringify(result))
    }

    expect(result).toMatchObject({
      ok: true,
      evidence: {
        frame: {
          viewport: {
            width: 640,
            height: 480,
            devicePixelRatio: 2,
          },
        },
      },
      screenshot: {
        width: 640,
        height: 480,
      },
    })
  })

  it('uses the preview canvas background when the body is transparent', () => {
    const { root } = renderPreviewFixture()

    document.body.style.backgroundColor = 'transparent'
    document.documentElement.style.backgroundColor = 'rgb(250, 251, 252)'

    const result = capturePreviewEvidenceSnapshot(root, { layers: ['screenshot'] }, window)

    expect(result).toMatchObject({
      ok: true,
      screenshot: {
        width: 1024,
        height: 768,
      },
    })
    if (!result.ok || !result.screenshot) {
      throw new Error('Expected screenshot capture to succeed.')
    }

    expect(result.screenshot.text).toMatch(/background-color:\s*rgb\(250,\s*251,\s*252\)/)
  })

  it('keeps requested annotation overlays empty when no visible annotations exist', () => {
    const { root } = renderPreviewFixture()

    const result = capturePreviewEvidenceSnapshot(
      root,
      {
        layers: ['screenshot'],
        includeAnnotationOverlays: true,
        annotations: [],
        currentPageId: 'page01',
      },
      window
    )
    if (!result.ok) {
      throw new Error(result.error.message)
    }

    expect(result).toMatchObject({
      ok: true,
      captureMeta: {
        annotationOverlays: {
          requested: true,
          included: true,
          visibleAnnotationCount: 0,
          note: PREVIEW_EVIDENCE_ANNOTATION_OVERLAY_NOTE,
        },
      },
    })
    if (!result.ok || !result.screenshot) {
      throw new Error('Expected screenshot capture with overlay metadata to succeed.')
    }

    expect(result.screenshot.text).not.toContain('data-preview-evidence-annotation-overlay')
  })

  it('renders a visible annotation marker and outline only in screenshot evidence when requested', () => {
    const { root, button } = renderPreviewFixture()
    const annotation = createStoredAnnotationFromElement(root, button, {
      id: 'annotation-visible',
      pageId: 'page01',
      comment: 'Focus the primary CTA',
    })

    const result = capturePreviewEvidenceSnapshot(
      root,
      {
        layers: ['screenshot', 'dom_layout_style'],
        includeAnnotationOverlays: true,
        annotations: [annotation],
        currentPageId: 'page01',
      },
      window
    )
    if (!result.ok) {
      throw new Error(result.error.message)
    }

    expect(result).toMatchObject({
      ok: true,
      captureMeta: {
        annotationOverlays: {
          requested: true,
          included: true,
          visibleAnnotationCount: 1,
          note: PREVIEW_EVIDENCE_ANNOTATION_OVERLAY_NOTE,
        },
      },
    })
    if (!result.ok || !result.screenshot) {
      throw new Error('Expected annotation overlay screenshot capture to succeed.')
    }

    expect(result.screenshot.text).toContain('data-preview-evidence-annotation-overlay="marker"')
    expect(result.screenshot.text).toContain('data-preview-evidence-annotation-overlay="outline"')
    expect(result.screenshot.text).toContain('data-preview-evidence-annotation-id="annotation-visible"')
    expect(JSON.stringify(result.evidence)).not.toContain('data-preview-evidence-annotation-overlay')
  })

  it('renders grouped overlay shapes for visible multi-element annotations', () => {
    document.body.innerHTML = `
      <div id="root">
        <section>
          <button>Approve</button>
          <button>Reject</button>
        </section>
      </div>
    `
    Object.defineProperties(window, {
      innerWidth: { configurable: true, value: 1024 },
      innerHeight: { configurable: true, value: 768 },
    })

    const root = document.getElementById('root')
    const buttons = Array.from(document.querySelectorAll('button'))
    if (!root || buttons.length !== 2) {
      throw new Error('Expected multi-select fixture buttons to exist.')
    }

    mockRect(root, { x: 0, y: 0, width: 260, height: 80 })
    mockRect(buttons[0], { x: 10, y: 10, width: 100, height: 40 })
    mockRect(buttons[1], { x: 130, y: 10, width: 100, height: 40 })

    const annotation = createStoredMultiSelectAnnotation(root, buttons, {
      id: 'annotation-multi',
      pageId: 'page01',
    })
    const result = capturePreviewEvidenceSnapshot(
      root,
      {
        layers: ['screenshot'],
        includeAnnotationOverlays: true,
        annotations: [annotation],
        currentPageId: 'page01',
      },
      window
    )
    if (!result.ok) {
      throw new Error(result.error.message)
    }
    if (!result.screenshot) {
      throw new Error('Expected grouped annotation overlay screenshot capture to succeed.')
    }

    expect(result.captureMeta?.annotationOverlays?.visibleAnnotationCount).toBe(1)
    expect(
      result.screenshot.text.match(/data-preview-evidence-annotation-overlay="outline"/g) ?? []
    ).toHaveLength(3)
    expect(result.screenshot.text).toContain(
      'data-preview-evidence-annotation-variant="selected-element"'
    )
    expect(result.screenshot.text).toContain('data-preview-evidence-annotation-variant="multi-select"')
  })

  it('excludes hidden and dead targets from capture overlays while leaving annotations durable', () => {
    document.body.innerHTML = `
      <div id="root">
        <button>Visible</button>
        <button>Hidden</button>
      </div>
    `
    Object.defineProperties(window, {
      innerWidth: { configurable: true, value: 800 },
      innerHeight: { configurable: true, value: 600 },
    })

    const root = document.getElementById('root')
    const buttons = Array.from(document.querySelectorAll('button'))
    if (!root || buttons.length !== 2) {
      throw new Error('Expected visibility fixture buttons to exist.')
    }

    mockRect(root, { x: 0, y: 0, width: 220, height: 980 })
    mockRect(buttons[0], { x: 10, y: 12, width: 100, height: 32 })
    mockRect(buttons[1], { x: 10, y: 900, width: 100, height: 32 })

    const hiddenAnnotation = createStoredAnnotationFromElement(root, buttons[1], {
      id: 'annotation-hidden',
      pageId: 'page01',
    })
    const deadAnnotation = {
      ...createStoredAnnotationFromElement(root, buttons[0], {
        id: 'annotation-dead',
        pageId: 'page01',
      }),
      targetIdentities: [
        {
          ...createStoredAnnotationFromElement(root, buttons[0], {
            id: 'temp',
            pageId: 'page01',
          }).targetIdentities![0],
          signature: 'ghost-signature',
          accessibleName: 'Ghost target',
          text: 'Ghost target',
          elementPath: 'button "Ghost target"',
          fullPath: ':scope > button:nth-of-type(99)',
        },
      ],
      element: 'button "Ghost target"',
      elementPath: 'button "Ghost target"',
      fullPath: ':scope > button:nth-of-type(99)',
    } satisfies ArcadeAnnotation

    const result = capturePreviewEvidenceSnapshot(
      root,
      {
        layers: ['screenshot'],
        includeAnnotationOverlays: true,
        annotations: [hiddenAnnotation, deadAnnotation],
        currentPageId: 'page01',
      },
      window
    )
    if (!result.ok || !result.screenshot) {
      throw new Error('Expected hidden/dead overlay capture to succeed.')
    }

    expect(result.captureMeta?.annotationOverlays).toEqual({
      requested: true,
      included: true,
      visibleAnnotationCount: 0,
      note: PREVIEW_EVIDENCE_ANNOTATION_OVERLAY_NOTE,
    })
    expect(result.screenshot.text).not.toContain('annotation-hidden')
    expect(result.screenshot.text).not.toContain('annotation-dead')
  })

  it('prefers the most specific matching element for region text targets', () => {
    const { root } = renderPreviewFixture()

    const result = capturePreviewEvidenceSnapshot(
      root,
      {
        layers: ['screenshot'],
        screenshotScope: 'region',
        target: { text: 'Continue' },
      },
      window
    )

    expect(result).toMatchObject({
      ok: true,
      screenshot: {
        width: 96,
        height: 32,
      },
      captureMeta: {
        targetDescription: 'text="Continue"',
      },
    })
  })

  it('captures accessibility roles, names, hierarchy, focusability, and states', () => {
    document.body.innerHTML = `
      <div id="root">
        <nav aria-label="Primary">
          <h2>Account</h2>
          <button aria-pressed="true">Open menu</button>
          <label>
            Accept terms
            <input id="accept" type="checkbox" />
          </label>
        </nav>
      </div>
    `

    const root = document.getElementById('root')
    const checkbox = document.getElementById('accept') as HTMLInputElement | null
    if (!root || !checkbox) {
      throw new Error('Expected accessibility fixture elements to exist.')
    }

    checkbox.checked = true

    const result = capturePreviewEvidenceSnapshot(root, { layers: ['accessibility'] }, window)
    expect(result).toMatchObject({
      ok: true,
      accessibility: {
        rootSelector: '#root',
        truncated: false,
      },
    })
    if (!result.ok || !result.accessibility) {
      throw new Error('Expected accessibility capture to succeed.')
    }

    expect(result.accessibility.nodes).toEqual([
      {
        role: 'navigation',
        name: 'Primary',
        children: [
          {
            role: 'heading',
            name: 'Account',
            level: 2,
          },
          {
            role: 'button',
            name: 'Open menu',
            focusable: true,
            states: {
              pressed: true,
            },
          },
          {
            role: 'checkbox',
            name: 'Accept terms',
            focusable: true,
            states: {
              checked: true,
            },
          },
        ],
      },
    ])
  })

  it('caps large accessibility trees deterministically', () => {
    document.body.innerHTML = `<div id="root">${'<button>Item</button>'.repeat(
      MAX_PREVIEW_EVIDENCE_ELEMENTS + 10
    )}</div>`
    const root = document.getElementById('root')
    if (!root) {
      throw new Error('Expected preview root to exist.')
    }

    const result = capturePreviewEvidenceSnapshot(root, { layers: ['accessibility'] }, window)
    if (!result.ok || !result.accessibility) {
      throw new Error('Expected accessibility capture to succeed.')
    }

    expect(result.accessibility.nodeCount).toBe(MAX_PREVIEW_EVIDENCE_ELEMENTS)
    expect(result.accessibility.truncated).toBe(true)
  })

  it('excludes script, style, and template text from accessibility names', () => {
    document.body.innerHTML = `
      <div id="root">
        <main>
          <h1>Unsafe root</h1>
          <button>Injected action</button>
          <script>window.__x = 1</script>
          <style>#unsafe-root { background: hotpink; }</style>
          <template><span>Hidden template text</span></template>
        </main>
      </div>
    `

    const root = document.getElementById('root')
    if (!root) {
      throw new Error('Expected preview root to exist.')
    }

    const result = capturePreviewEvidenceSnapshot(root, { layers: ['accessibility'] }, window)
    if (!result.ok || !result.accessibility) {
      throw new Error('Expected accessibility capture to succeed.')
    }

    expect(result.accessibility.nodes).toEqual([
      {
        role: 'main',
        children: [
          {
            role: 'heading',
            name: 'Unsafe root',
            level: 1,
          },
          {
            role: 'button',
            name: 'Injected action',
            focusable: true,
          },
        ],
      },
    ])

    const serializedAccessibility = JSON.stringify(result.accessibility)
    expect(serializedAccessibility).not.toContain('window.__x = 1')
    expect(serializedAccessibility).not.toContain('hotpink')
    expect(serializedAccessibility).not.toContain('Hidden template text')
  })

  it('matches browser-like accessible names for images, text inputs, and aria-hidden descendants', () => {
    document.body.innerHTML = `
      <div id="root">
        <main>
          <img alt="Hero art" />
          <input type="text" value="xyz" />
          <button>Run<span aria-hidden="true">hidden</span></button>
        </main>
      </div>
    `

    const root = document.getElementById('root')
    if (!root) {
      throw new Error('Expected preview root to exist.')
    }

    const result = capturePreviewEvidenceSnapshot(root, { layers: ['accessibility'] }, window)
    if (!result.ok || !result.accessibility) {
      throw new Error('Expected accessibility capture to succeed.')
    }

    expect(result.accessibility.nodes).toEqual([
      {
        role: 'main',
        children: [
          {
            role: 'img',
            name: 'Hero art',
          },
          {
            role: 'textbox',
            focusable: true,
          },
          {
            role: 'button',
            name: 'Run',
            focusable: true,
          },
        ],
      },
    ])

    const serializedAccessibility = JSON.stringify(result.accessibility)
    expect(serializedAccessibility).not.toContain('"xyz"')
    expect(serializedAccessibility).not.toContain('hidden')
  })
})

const renderPreviewFixture = () => {
  Object.defineProperties(window, {
    innerWidth: { configurable: true, value: 1024 },
    innerHeight: { configurable: true, value: 768 },
    devicePixelRatio: { configurable: true, value: 2 },
    scrollX: { configurable: true, value: 0 },
    scrollY: { configurable: true, value: 0 },
  })

  document.body.innerHTML = `
    <div
      id="root"
      class="dark aksel-theme"
      data-color="accent"
      data-reactroot=""
      onclick="evil()"
      style="display: flex; row-gap: 12px; padding: 8px; color: rgb(1, 2, 3);"
    >
      Root text
      <section
        class="custom aksel-box"
        data-color="info"
        data-agent-note="safe"
        style="display: grid; grid-template-columns: 1fr 1fr;"
      >
        <h1 class="aksel-heading" aria-label="Title label">Preview title</h1>
        <button
          class="aksel-button"
          data-color="accent"
          onclick="steal()"
          style="background-color: rgb(4, 5, 6);"
        >
          Continue
        </button>
        <script>window.localStorage.secret = document.cookie</script>
        <style>.unsafe-css { color: red; }</style>
      </section>
    </div>
  `

  const root = document.getElementById('root')
  const section = document.querySelector('section')
  const button = document.querySelector('button')

  if (!root || !section || !button) {
    throw new Error('Expected preview fixture elements to exist.')
  }

  mockRect(root, { x: 10, y: 20, width: 300, height: 200 })
  mockRect(section, { x: 18, y: 28, width: 260, height: 140 })
  mockRect(button, { x: 24, y: 86, width: 96, height: 32 })

  return { button, root, section }
}

const mockRect = (element: Element, rect: Pick<DOMRect, 'x' | 'y' | 'width' | 'height'>) => {
  const fullRect = {
    ...rect,
    top: rect.y,
    right: rect.x + rect.width,
    bottom: rect.y + rect.height,
    left: rect.x,
    toJSON: () => ({
      ...rect,
      top: rect.y,
      right: rect.x + rect.width,
      bottom: rect.y + rect.height,
      left: rect.x,
    }),
  } as DOMRect

  element.getBoundingClientRect = () => fullRect
}

const restoreWindowMetric = (key: keyof typeof originalWindowMetricDescriptors) => {
  const descriptor = originalWindowMetricDescriptors[key]
  if (descriptor) {
    Object.defineProperty(window, key, descriptor)
    return
  }

  delete window[key]
}

const createStoredAnnotationFromElement = (
  root: Element,
  element: Element,
  overrides: Partial<ArcadeAnnotation> & { id: string; pageId: string }
): ArcadeAnnotation => {
  const { id, pageId, ...restOverrides } = overrides
  const identity = getAnnotationTargetIdentity(root, element, window)
  const rect = element.getBoundingClientRect()
  const boundingBox = {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
  }
  const labelText = identity.accessibleName ?? identity.text ?? ''

  return {
    id,
    pageId,
    x: rect.x,
    y: rect.y,
    comment: overrides.comment ?? 'Needs attention',
    element: labelText ? `${identity.tagName} "${labelText}"` : identity.tagName,
    elementPath: identity.elementPath,
    timestamp: overrides.timestamp ?? 1,
    targetIdentities: [identity],
    boundingBox,
    cssClasses: identity.cssClasses,
    fullPath: identity.fullPath,
    accessibility: identity.role
      ? identity.accessibleName
        ? `role=${identity.role} name="${identity.accessibleName}"`
        : `role=${identity.role}`
      : undefined,
    clickOffsetX: rect.width / 2,
    clickOffsetY: rect.height / 2,
    ...restOverrides,
  }
}

const createStoredMultiSelectAnnotation = (
  root: Element,
  elements: Element[],
  overrides: Partial<ArcadeAnnotation> & { id: string; pageId: string }
): ArcadeAnnotation => {
  const { id, pageId, ...restOverrides } = overrides
  const targetIdentities = elements.map((element) => getAnnotationTargetIdentity(root, element, window))
  const elementBoundingBoxes = elements.map((element) => {
    const rect = element.getBoundingClientRect()
    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    }
  })
  const boundingBox = mergeAnnotationRects(elementBoundingBoxes)

  return {
    id,
    pageId,
    x: boundingBox.x,
    y: boundingBox.y,
    comment: overrides.comment ?? 'Review this group',
    element: `${elements.length} selected elements`,
    elementPath: targetIdentities[0]?.elementPath ?? 'group',
    timestamp: overrides.timestamp ?? 1,
    targetIdentities,
    boundingBox,
    elementBoundingBoxes,
    isMultiSelect: true,
    clickOffsetX: boundingBox.width / 2,
    clickOffsetY: boundingBox.height / 2,
    ...restOverrides,
  }
}

const mergeAnnotationRects = (rects: AnnotationRect[]): AnnotationRect => {
  const left = Math.min(...rects.map((rect) => rect.x))
  const top = Math.min(...rects.map((rect) => rect.y))
  const right = Math.max(...rects.map((rect) => rect.x + rect.width))
  const bottom = Math.max(...rects.map((rect) => rect.y + rect.height))

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  }
}
