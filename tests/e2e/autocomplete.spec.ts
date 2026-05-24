import { expect, test, type Page } from '@playwright/test'

const nestedIconSnippetStart = `<Page>
 <Page.Block width="lg">
 <Box padding="space-16" background="neutral-softA" borderRadius="8">
 `

async function replaceEditorText(page: Page, text: string) {
  const editor = page.locator('.cm-content').first()
  await expect(editor).toBeVisible()
  await editor.click()
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A')
  await page.keyboard.insertText(text)
}

test.describe('Aksel autocomplete', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('suggests DogHarnessIcon from mixed-case nested JSX icon prefixes', async ({ page }) => {
    await replaceEditorText(page, nestedIconSnippetStart)
    await page.keyboard.type('<Dogh', { delay: 20 })

    const autocomplete = page.locator('.cm-tooltip-autocomplete')
    await expect(autocomplete).toContainText('DogHarnessIcon')
    await expect(page.locator('.cm-tooltip-autocomplete [role="option"]').first()).toContainText(
      'DogHarnessIcon'
    )

    await page.locator('.cm-tooltip-autocomplete [role="option"]').first().click()

    await expect(page.locator('.cm-content')).toContainText(
      '<DogHarnessIcon title="a11y-title" fontSize="1.5rem" />'
    )
  })

  test('suggests DogHarnessIcon from lowercase nested JSX icon prefixes', async ({ page }) => {
    await replaceEditorText(page, nestedIconSnippetStart)
    await page.keyboard.type('<dogh', { delay: 20 })

    const autocomplete = page.locator('.cm-tooltip-autocomplete')
    await expect(autocomplete).toContainText('DogHarnessIcon')
    await expect(page.locator('.cm-tooltip-autocomplete [role="option"]').first()).toContainText(
      'DogHarnessIcon'
    )
  })

  test('refreshes stale generic tag suggestions for lowercase icon prefixes', async ({ page }) => {
    await replaceEditorText(page, nestedIconSnippetStart)
    await page.keyboard.type('<')

    await expect(page.locator('.cm-tooltip-autocomplete')).toBeVisible()

    await page.keyboard.type('dogh', { delay: 80 })

    const autocomplete = page.locator('.cm-tooltip-autocomplete')
    await expect(autocomplete).toContainText('DogHarnessIcon')
    await expect(autocomplete).not.toContainText('Dialog.Header')
    await expect(page.locator('.cm-tooltip-autocomplete [role="option"]').first()).toContainText(
      'DogHarnessIcon'
    )
  })
})
