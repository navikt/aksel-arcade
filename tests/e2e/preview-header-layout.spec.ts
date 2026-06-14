import { expect, test, type Page } from '@playwright/test'

interface Rect {
  left: number
  right: number
  width: number
}

interface HeaderLayoutMetrics {
  header: Rect
  rightControls: Rect
  toggleGroup: Rect
}

const measurePreviewHeader = async (page: Page): Promise<HeaderLayoutMetrics> => {
  return page.evaluate(() => {
    const readRect = (selector: string) => {
      const element = document.querySelector(selector)
      if (!element) {
        throw new Error(`Missing preview header selector: ${selector}`)
      }

      const rect = element.getBoundingClientRect()
      return {
        left: rect.left,
        right: rect.right,
        width: rect.width,
      }
    }

    return {
      header: readRect('[data-testid="preview-header"]'),
      rightControls: readRect('[data-testid="preview-header-controls-right"]'),
      toggleGroup: readRect('.preview-pane__viewport-toggle .aksel-toggle-group__wrapper'),
    }
  })
}

const expectRightAlignedPreviewControls = (metrics: HeaderLayoutMetrics) => {
  expect(metrics.rightControls.width).toBeLessThan(metrics.header.width * 0.7)
  expect(metrics.toggleGroup.width).toBeLessThan(metrics.header.width * 0.6)
  expect(metrics.header.right - metrics.rightControls.right).toBeLessThanOrEqual(24)
}

test.describe('Preview header layout', () => {
  test('keeps Inspect and viewport controls right-aligned without stretching in normal and fullscreen modes', async ({
    page,
  }) => {
    await page.goto('/aksel-arcade/')
    await page.waitForLoadState('networkidle')

    expectRightAlignedPreviewControls(await measurePreviewHeader(page))

    await page.getByRole('button', { name: 'Enter preview fullscreen' }).click()
    await expect(page.getByRole('button', { name: 'Exit preview fullscreen' })).toBeVisible()

    expectRightAlignedPreviewControls(await measurePreviewHeader(page))
  })
})
