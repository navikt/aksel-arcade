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
      unionOutlineCount: document.querySelectorAll('.aksel-arcade-annotation-box--multi-select').length,
    }))

    expect(duringDrag.selection).toBe('')
    expect(duringDrag.dragBoxDisplay).toBe('block')
    expect(duringDrag.highlightCount).toBeGreaterThanOrEqual(2)
    expect(afterDrag.selection).toBe('')
    expect(afterDrag.dragHighlightCount).toBe(0)
    expect(afterDrag.unionOutlineCount).toBe(1)
  })
})
