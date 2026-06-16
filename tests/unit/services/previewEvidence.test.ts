import { afterEach, describe, expect, it } from 'vitest'
import {
  MAX_PREVIEW_EVIDENCE_ELEMENTS,
  capturePreviewEvidenceSnapshot,
  serializePreviewEvidence,
} from '@/services/previewEvidence'

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
