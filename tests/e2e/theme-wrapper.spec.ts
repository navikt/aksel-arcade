import { expect, test, type FrameLocator, type Page } from '@playwright/test'

const buttonSource = `export default function App() {
  return <Button variant="primary">Primary Button</Button>
}`

const multiComponentSource = `export default function App() {
  return (
    <VStack gap="space-8">
      <Heading size="medium" level="1">Test Heading</Heading>
      <Button variant="primary">Primary Button</Button>
      <Button variant="secondary">Secondary Button</Button>
    </VStack>
  )
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

test.describe('Aksel theme wrapper', () => {
  test('default preview is wrapped in aksel-theme', async ({ page }) => {
    const previewFrame = await openArcade(page)

    const hasThemeWrapper = await previewFrame.locator('body').evaluate(() =>
      Boolean(document.querySelector('.aksel-theme'))
    )

    expect(hasThemeWrapper).toBe(true)
  })

  test('edited JSX renders a Button with Aksel classes', async ({ page }) => {
    const previewFrame = await openArcade(page)
    await replaceJsx(page, buttonSource)

    const button = previewFrame.getByRole('button', { name: 'Primary Button' })
    await expect(button).toBeVisible({ timeout: 10000 })

    const buttonClasses = await button.getAttribute('class')
    expect(buttonClasses).toContain('aksel-button')

    const backgroundColor = await button.evaluate((el) => window.getComputedStyle(el).backgroundColor)
    expect(backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
    expect(backgroundColor).not.toBe('transparent')
  })

  test('edited JSX renders multiple Aksel components inside the theme wrapper', async ({ page }) => {
    const previewFrame = await openArcade(page)
    await replaceJsx(page, multiComponentSource)

    await expect(previewFrame.getByRole('heading', { name: 'Test Heading' })).toBeVisible({
      timeout: 10000,
    })
    await expect(previewFrame.getByRole('button', { name: 'Primary Button' })).toBeVisible()
    await expect(previewFrame.getByRole('button', { name: 'Secondary Button' })).toBeVisible()
  })
})
