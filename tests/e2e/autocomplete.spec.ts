import { expect, test, type Page } from '@playwright/test'

const nestedIconSnippetStart = `<Page>
 <Page.Block width="lg">
 <Box padding="space-16" background="neutral-softA" borderRadius="8">
  `
const autocompleteOption = '.cm-tooltip-autocomplete [role="option"]'

async function replaceEditorText(page: Page, text: string) {
  const editor = page.locator('.cm-content').first()
  await expect(editor).toBeVisible()
  await editor.click()
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A')
  await page.keyboard.insertText(text)
}

async function openAutocompleteFor(page: Page, seed: string, typed: string) {
  await replaceEditorText(page, seed)
  await page.keyboard.type(typed, { delay: 20 })
  await page.keyboard.press('Control+Space')

  const autocomplete = page.locator('.cm-tooltip-autocomplete')
  await expect(autocomplete).toBeVisible({ timeout: 5000 })
  return autocomplete
}

test.describe('Aksel autocomplete', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('suggests component and subcomponent tags in the browser editor', async ({ page }) => {
    const componentAutocomplete = await openAutocompleteFor(page, '', '<But')
    await expect(componentAutocomplete).toContainText('Button')
    await expect(componentAutocomplete).not.toContainText('PlusIcon')

    await page.keyboard.press('Escape')

    const subcomponentAutocomplete = await openAutocompleteFor(page, '', '<Page.')
    await expect(subcomponentAutocomplete).toContainText('Page.Block')
  })

  test('suggests props and enum values across formatted JSX tags', async ({ page }) => {
    const propAutocomplete = await openAutocompleteFor(page, '<Button\n  variant="primary"\n  ', 'd')
    await expect(propAutocomplete).toContainText('disabled')

    await page.keyboard.press('Escape')

    const enumAutocomplete = await openAutocompleteFor(page, '<Button variant="secondary-', 'n')
    await expect(enumAutocomplete).toContainText('secondary-neutral')
  })

  test('suggests v8 token, data-color, and Box styling values', async ({ page }) => {
    const spacingAutocomplete = await openAutocompleteFor(page, '<HStack gap="space-', '1')
    await expect(spacingAutocomplete).toContainText('space-12')
    await expect(spacingAutocomplete).toContainText('space-16')
    await expect(spacingAutocomplete).not.toContainText('4')

    await page.keyboard.press('Escape')

    const boxAutocomplete = await openAutocompleteFor(page, '<Box background="neutral-', 's')
    await expect(boxAutocomplete).toContainText('neutral-soft')

    await page.keyboard.press('Escape')

    const defaultBackgroundAutocomplete = await openAutocompleteFor(page, '<Box background="bg-', 'd')
    await expect(defaultBackgroundAutocomplete).toContainText('bg-default')

    await page.keyboard.press('Escape')

    const dataColorAutocomplete = await openAutocompleteFor(page, '<Page data-color="brand-', 'm')
    await expect(dataColorAutocomplete).toContainText('brand-magenta')
  })

  test('suggests icons only in icon-aware browser contexts', async ({ page }) => {
    const defaultTagAutocomplete = await openAutocompleteFor(page, '', '<')
    await expect(defaultTagAutocomplete).toContainText('Button')
    await expect(defaultTagAutocomplete).not.toContainText('PlusIcon')

    await page.keyboard.press('Escape')

    const iconPropAutocomplete = await openAutocompleteFor(page, '<Button icon={<', 'PlusI')
    await expect(iconPropAutocomplete).toContainText('PlusIcon')
    await expect(page.locator(autocompleteOption).first()).toContainText('PlusIcon')
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
