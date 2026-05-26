import { describe, expect, it } from 'vitest'
import { MAX_PREVIEW_EVIDENCE_ELEMENTS, serializePreviewEvidence } from '@/services/previewEvidence'

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
