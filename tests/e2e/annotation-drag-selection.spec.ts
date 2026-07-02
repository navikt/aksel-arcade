import { expect, test, type Page } from '@playwright/test'

const enableAnnotationMode = async (page: Page) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  const toggle = page.getByRole('button', { name: /annotation mode/ })
  await expect(toggle).toBeVisible()
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
}

test.describe('Annotation drag selection', () => {
  test('shows included element frames while dragging without selecting page text', async ({ page }) => {
    await enableAnnotationMode(page)

    const iframeElement = await page.locator('.live-preview__iframe').elementHandle()
    const iframeBox = await iframeElement?.boundingBox()
    const frame = page.frames().find((candidate) => candidate.url().includes('sandbox.html'))
    expect(iframeBox).toBeTruthy()
    expect(frame).toBeTruthy()

    await frame!.evaluate(() => {
      const root = document.querySelector('#root')
      if (!root) {
        throw new Error('Missing sandbox root')
      }

      root.innerHTML = `
        <div style="padding:40px; display:grid; gap:16px; max-width:420px">
          <button type="button" style="width:180px;height:48px">Approve claim</button>
          <button type="button" style="width:180px;height:48px">Reject claim</button>
          <p>This paragraph should not become selected during a button-area drag.</p>
        </div>`
    })

    await page.mouse.move(iframeBox!.x + 25, iframeBox!.y + 25)
    await page.mouse.down()
    await page.mouse.move(iframeBox!.x + 280, iframeBox!.y + 185, { steps: 12 })
    await page.waitForTimeout(80)

    const duringDrag = await frame!.evaluate(() => ({
      selection: window.getSelection()?.toString() ?? '',
      dragBoxDisplay: getComputedStyle(
        document.querySelector('.aksel-arcade-annotation-box--drag') as Element
      ).display,
      highlightCount: document.querySelectorAll('.aksel-arcade-annotation-drag-highlight').length,
    }))

    await page.mouse.up()
    await page.waitForTimeout(80)

    const afterDrag = await frame!.evaluate(() => ({
      selection: window.getSelection()?.toString() ?? '',
      dragHighlightCount: document.querySelectorAll('.aksel-arcade-annotation-drag-highlight').length,
      selectedElementOutlineCount: document.querySelectorAll(
        '.aksel-arcade-annotation-box--selected-element'
      ).length,
      unionOutlineCount: document.querySelectorAll('.aksel-arcade-annotation-box--multi-select').length,
    }))

    expect(duringDrag.selection).toBe('')
    expect(duringDrag.dragBoxDisplay).toBe('block')
    expect(duringDrag.highlightCount).toBeGreaterThanOrEqual(2)
    expect(afterDrag.selection).toBe('')
    expect(afterDrag.dragHighlightCount).toBe(0)
    expect(afterDrag.selectedElementOutlineCount).toBeGreaterThanOrEqual(2)
    expect(afterDrag.unionOutlineCount).toBe(1)
  })

  test('opens the group popover when additive multi-select modifiers are released', async ({
    page,
  }) => {
    await enableAnnotationMode(page)

    const frame = page.frames().find((candidate) => candidate.url().includes('sandbox.html'))
    expect(frame).toBeTruthy()

    await frame!.evaluate(() => {
      const root = document.querySelector('#root')
      if (!root) {
        throw new Error('Missing sandbox root')
      }

      root.innerHTML = `
        <div style="padding:40px; display:grid; gap:16px; max-width:420px">
          <button type="button">Approve claim</button>
          <button type="button">Reject claim</button>
        </div>`
    })

    const modifierKey = await frame!.evaluate(() =>
      /(Mac|iPhone|iPod|iPad)/i.test(navigator.platform || navigator.userAgent) ? 'Meta' : 'Control'
    )
    await frame!.evaluate((activeModifierKey) => {
      const buttons = Array.from(document.querySelectorAll('button'))
      const createMouseEvent = (type: string, button: HTMLButtonElement) => {
        const rect = button.getBoundingClientRect()
        return new MouseEvent(type, {
          bubbles: true,
          cancelable: true,
          button: 0,
          clientX: rect.left + rect.width / 2,
          clientY: rect.top + rect.height / 2,
          ctrlKey: activeModifierKey === 'Control',
          metaKey: activeModifierKey === 'Meta',
          shiftKey: true,
        })
      }

      for (const button of buttons) {
        button.dispatchEvent(createMouseEvent('mousedown', button as HTMLButtonElement))
        button.dispatchEvent(createMouseEvent('mouseup', button as HTMLButtonElement))
        button.dispatchEvent(createMouseEvent('click', button as HTMLButtonElement))
      }
    }, modifierKey)

    await expect(page.getByLabel(/^annotation text$/i)).not.toBeVisible()

    await frame!.evaluate((activeModifierKey) => {
      document.dispatchEvent(
        new KeyboardEvent('keyup', {
          key: activeModifierKey,
          bubbles: true,
          cancelable: true,
          ctrlKey: false,
          metaKey: false,
          shiftKey: true,
        })
      )
    }, modifierKey)

    await expect(page.getByText('2 selected elements')).toBeVisible()
    await expect(page.getByLabel(/^annotation text$/i)).toBeVisible()
  })
})
