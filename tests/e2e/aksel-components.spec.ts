import { expect, test, type FrameLocator, type Page } from '@playwright/test'

const stackSource = `export default function App() {
  return (
    <VStack gap="space-8">
      <BodyShort>First item</BodyShort>
      <BodyShort>Second item</BodyShort>
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

test.describe('Aksel components', () => {
  test('default project renders the intro preview content', async ({ page }) => {
    const previewFrame = await openArcade(page)

    await expect(
      previewFrame.getByRole('heading', { name: /welcome to aksel arcade/i })
    ).toBeVisible()
    await expect(previewFrame.getByText(/browser-based React playground/i)).toBeVisible()
  })

  test('preview sandbox exposes Aksel theme variables', async ({ page }) => {
    const previewFrame = await openArcade(page)

    const themeBackgroundToken = await previewFrame.locator('body').evaluate((el) =>
      window.getComputedStyle(el).getPropertyValue('--ax-bg-default').trim()
    )

    expect(themeBackgroundToken).not.toBe('')
  })

  test('edited JSX renders grouped Aksel content in preview', async ({ page }) => {
    const previewFrame = await openArcade(page)
    await replaceJsx(page, stackSource)

    await expect(previewFrame.getByText('First item')).toBeVisible({ timeout: 10000 })
    await expect(previewFrame.getByText('Second item')).toBeVisible()
  })
})
