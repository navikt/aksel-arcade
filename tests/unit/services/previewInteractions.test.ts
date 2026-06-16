import { afterEach, describe, expect, it } from 'vitest'
import { runPreviewInteractionSequence } from '@/services/previewEvidence'

afterEach(() => {
  document.body.innerHTML = ''
})

describe('preview interactions', () => {
  it('clicks interactive targets and records the executed step', async () => {
    document.body.innerHTML = `
      <div id="root">
        <button id="toggle" aria-expanded="false">Toggle details</button>
        <section id="panel" hidden>Expanded details</section>
      </div>
    `

    const root = requireRoot()
    const button = document.getElementById('toggle') as HTMLButtonElement
    const panel = document.getElementById('panel') as HTMLElement
    button.addEventListener('click', () => {
      const nextExpanded = button.getAttribute('aria-expanded') !== 'true'
      button.setAttribute('aria-expanded', nextExpanded ? 'true' : 'false')
      panel.hidden = !nextExpanded
    })

    const result = await runPreviewInteractionSequence(
      root,
      [{ action: 'click', target: { role: 'button', name: 'Toggle details' } }],
      { currentPageId: 'page01' },
      window
    )

    expect(result).toMatchObject({
      ok: true,
      interactionState: {
        executed: [
          {
            index: 0,
            targetDescription: 'role=button name="Toggle details"',
          },
        ],
      },
    })
    expect(button.getAttribute('aria-expanded')).toBe('true')
    expect(panel.hidden).toBe(false)
  })

  it('fills inputs by associated label text', async () => {
    document.body.innerHTML = `
      <div id="root">
        <label for="full-name">Full name</label>
        <input id="full-name" />
        <p id="mirror">empty</p>
      </div>
    `

    const root = requireRoot()
    const input = document.getElementById('full-name') as HTMLInputElement
    const mirror = document.getElementById('mirror') as HTMLElement
    input.addEventListener('input', () => {
      mirror.textContent = input.value || 'empty'
    })

    const result = await runPreviewInteractionSequence(
      root,
      [{ action: 'fill', target: { label: 'Full name' }, value: 'Ada Lovelace' }],
      { currentPageId: 'page01' },
      window
    )

    expect(result).toMatchObject({ ok: true })
    expect(input.value).toBe('Ada Lovelace')
    expect(mirror.textContent).toBe('Ada Lovelace')
  })

  it('selects option values on native select controls', async () => {
    document.body.innerHTML = `
      <div id="root">
        <label for="planet">Planet</label>
        <select id="planet">
          <option value="earth">Earth</option>
          <option value="mars">Mars</option>
        </select>
        <p id="selection">earth</p>
      </div>
    `

    const root = requireRoot()
    const select = document.getElementById('planet') as HTMLSelectElement
    const selection = document.getElementById('selection') as HTMLElement
    select.addEventListener('change', () => {
      selection.textContent = select.value
    })

    const result = await runPreviewInteractionSequence(
      root,
      [{ action: 'select', target: { label: 'Planet' }, value: 'mars' }],
      { currentPageId: 'page01' },
      window
    )

    expect(result).toMatchObject({ ok: true })
    expect(select.value).toBe('mars')
    expect(selection.textContent).toBe('mars')
  })

  it('supports bounded press interactions for clickable controls', async () => {
    document.body.innerHTML = `
      <div id="root">
        <button id="confirm">Confirm</button>
        <p id="status">idle</p>
      </div>
    `

    const root = requireRoot()
    const button = document.getElementById('confirm') as HTMLButtonElement
    const status = document.getElementById('status') as HTMLElement
    button.addEventListener('click', () => {
      status.textContent = 'confirmed'
    })

    const result = await runPreviewInteractionSequence(
      root,
      [{ action: 'press', target: { role: 'button', name: 'Confirm' }, key: 'Enter' }],
      { currentPageId: 'page01' },
      window
    )

    expect(result).toMatchObject({ ok: true })
    expect(status.textContent).toBe('confirmed')
  })

  it('scrolls targeted preview elements without leaving the preview root', async () => {
    document.body.innerHTML = `
      <div id="root">
        <div id="scroller"><div style="height: 400px">Long content</div></div>
      </div>
    `

    const root = requireRoot()
    const scroller = document.getElementById('scroller') as HTMLElement
    scroller.scrollTop = 0

    const result = await runPreviewInteractionSequence(
      root,
      [{ action: 'scroll', target: { selector: '#scroller' }, y: 80 }],
      { currentPageId: 'page01' },
      window
    )

    expect(result).toMatchObject({ ok: true })
    expect(scroller.scrollTop).toBe(80)
  })

  it('waits for async text and render-idle states before continuing', async () => {
    document.body.innerHTML = `
      <div id="root">
        <button id="load">Load async state</button>
        <p id="status">Idle</p>
      </div>
    `

    const root = requireRoot()
    const button = document.getElementById('load') as HTMLButtonElement
    const status = document.getElementById('status') as HTMLElement
    button.addEventListener('click', () => {
      window.setTimeout(() => {
        status.textContent = 'Loading…'
      }, 10)
      window.setTimeout(() => {
        status.textContent = 'Loaded'
      }, 35)
    })

    const result = await runPreviewInteractionSequence(
      root,
      [
        { action: 'click', target: { role: 'button', name: 'Load async state' } },
        { action: 'waitFor', text: 'Loaded', timeoutMs: 400 },
        { action: 'waitFor', renderIdle: true, timeoutMs: 400 },
      ],
      { currentPageId: 'page01' },
      window
    )

    expect(result).toMatchObject({ ok: true })
    expect(status.textContent).toBe('Loaded')
  })

  it('waits for selector targets that appear later in the preview', async () => {
    document.body.innerHTML = `
      <button id="outside">Settings</button>
      <div id="root">
        <button id="create">Create ready marker</button>
      </div>
    `

    const root = requireRoot()
    const button = document.getElementById('create') as HTMLButtonElement
    button.addEventListener('click', () => {
      window.setTimeout(() => {
        const marker = document.createElement('div')
        marker.id = 'ready-marker'
        marker.textContent = 'Ready'
        root.appendChild(marker)
      }, 15)
    })

    const result = await runPreviewInteractionSequence(
      root,
      [
        { action: 'click', target: { role: 'button', name: 'Create ready marker' } },
        { action: 'waitFor', target: { selector: '#ready-marker' }, timeoutMs: 300 },
      ],
      { currentPageId: 'page01' },
      window
    )

    expect(result).toMatchObject({ ok: true })
    expect(root.querySelector('#ready-marker')?.textContent).toBe('Ready')
  })

  it('fails fast for missing targets and keeps executed steps bounded', async () => {
    document.body.innerHTML = `
      <div id="root">
        <button>Only target</button>
      </div>
    `

    const root = requireRoot()
    const result = await runPreviewInteractionSequence(
      root,
      [{ action: 'click', target: { selector: '#missing-target' } }],
      { currentPageId: 'page01' },
      window
    )

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: 'invalid-capture-target',
      },
      captureMeta: {
        currentPageId: 'page01',
        interactions: {
          executed: [],
          failedStep: {
            index: 0,
          },
        },
      },
    })
  })

  it('blocks selectors outside the preview root and external navigation targets for click and press', async () => {
    document.body.innerHTML = `
      <button id="outside">Settings</button>
      <div id="root">
        <a href="https://example.com">External docs</a>
      </div>
    `

    const root = requireRoot()

    const outsideSelectorResult = await runPreviewInteractionSequence(
      root,
      [{ action: 'click', target: { selector: '#outside' } }],
      { currentPageId: 'page01' },
      window
    )
    expect(outsideSelectorResult).toMatchObject({
      ok: false,
      error: {
        code: 'invalid-capture-target',
      },
    })

    const externalLinkResult = await runPreviewInteractionSequence(
      root,
      [{ action: 'click', target: { role: 'link', name: 'External docs' } }],
      { currentPageId: 'page01' },
      window
    )
    expect(externalLinkResult).toMatchObject({
      ok: false,
      error: {
        code: 'invalid-capture-target',
        message:
          'Preview interactions block browser/external navigation targets. Only in-prototype Arcade page references are allowed.',
      },
    })

    const externalPressResult = await runPreviewInteractionSequence(
      root,
      [{ action: 'press', target: { role: 'link', name: 'External docs' }, key: 'Enter' }],
      { currentPageId: 'page01' },
      window
    )
    expect(externalPressResult).toMatchObject({
      ok: false,
      error: {
        code: 'invalid-capture-target',
        message:
          'Preview interactions block browser/external navigation targets. Only in-prototype Arcade page references are allowed.',
      },
    })
  })

  it('times out bounded waitFor steps when the requested state never appears', async () => {
    document.body.innerHTML = `
      <div id="root">
        <p>Still idle</p>
      </div>
    `

    const root = requireRoot()
    const result = await runPreviewInteractionSequence(
      root,
      [{ action: 'waitFor', text: 'Never appears', timeoutMs: 50 }],
      { currentPageId: 'page01' },
      window
    )

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: 'render-timeout',
      },
    })
  })
})

const requireRoot = (): HTMLElement => {
  const root = document.getElementById('root')
  if (!(root instanceof HTMLElement)) {
    throw new Error('Expected preview root element to exist.')
  }

  return root
}
