import { test, expect } from '@playwright/test'

const enableInspectMode = async (page: Parameters<typeof test>[0]['page']) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  const toggle = page.locator('.inspect-mode-button')
  await expect(toggle).toBeVisible()
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
}

test.describe('Inspect overlays', () => {
  test('renders hover overlays with light-mode tokens (visual)', async ({ page }) => {
    await enableInspectMode(page)

    const iframe = page.frameLocator('.live-preview__iframe')
    const target = iframe.getByRole('button').first()

    await target.hover()
    await page.waitForTimeout(300)

    const overlay = iframe.locator('.inspect-overlay-root')
    await expect(overlay).toBeVisible()

    // Visual regression: overlays use light-mode Aksel tokens
    await expect(overlay).toHaveScreenshot('inspect-overlay-hover.png', {
      maxDiffPixels: 250,
    })
  })

  test('shows inspection popover with gap value', async ({ page }) => {
    await enableInspectMode(page)

    const iframe = page.frameLocator('.live-preview__iframe')
    const target = iframe.getByRole('button').first()

    await target.hover()
    await page.waitForTimeout(300)

    const popover = page.getByTestId('inspection-popover')
    await expect(popover).toBeVisible({ timeout: 5000 })
    await expect(popover.getByText('Gap:')).toBeVisible()
  })
})
