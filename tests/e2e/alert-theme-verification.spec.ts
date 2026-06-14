import { expect, test, type FrameLocator, type Page } from '@playwright/test'

const alertSource = `export default function App() {
  return <Alert variant="info">Welcome to Aksel Arcade</Alert>
}`

const openArcade = async (page: Page): Promise<FrameLocator> => {
  await page.goto('/aksel-arcade/')
  await page.waitForLoadState('networkidle')
  await expect(page.getByTestId('preview-iframe')).toBeVisible({ timeout: 10000 })
  return page.frameLocator('[data-testid="preview-iframe"]')
}

const replaceJsx = async (page: Page, source: string) => {
  const editor = page.locator('.cm-content[contenteditable="true"]').first()
  await expect(editor).toBeVisible()
  await editor.click()
  await page.keyboard.press('ControlOrMeta+A')
  await page.keyboard.insertText(source)
}

const renderAlertPreview = async (page: Page) => {
  const previewFrame = await openArcade(page)
  await replaceJsx(page, alertSource)

  const alert = previewFrame.locator('.aksel-alert').first()
  await expect(alert).toBeVisible({ timeout: 10000 })

  return { previewFrame, alert }
}

test.describe('Alert component preview', () => {
  test('renders an Alert with Aksel classes in the preview iframe', async ({ page }) => {
    const { alert } = await renderAlertPreview(page)

    await expect(alert).toContainText('Welcome to Aksel Arcade')

    const alertClasses = await alert.getAttribute('class')
    expect(alertClasses).toContain('aksel-alert')
    expect(alertClasses).toContain('aksel-alert--info')
  })

  test('keeps the Alert inside the sandbox theme wrapper', async ({ page }) => {
    const { previewFrame } = await renderAlertPreview(page)

    const hasWrappedAlert = await previewFrame.locator('body').evaluate(() =>
      Boolean(document.querySelector('.aksel-theme .aksel-alert'))
    )

    expect(hasWrappedAlert).toBe(true)
  })

  test('applies non-default computed styles to the Alert', async ({ page }) => {
    const { alert } = await renderAlertPreview(page)

    const styles = await alert.evaluate((el) => {
      const computed = window.getComputedStyle(el)
      return {
        backgroundColor: computed.backgroundColor,
        padding: computed.padding,
        borderRadius: computed.borderRadius,
      }
    })

    expect(styles.backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
    expect(styles.padding).not.toBe('0px')
    expect(styles.borderRadius).not.toBe('0px')
  })
})
