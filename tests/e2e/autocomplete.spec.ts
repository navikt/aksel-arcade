import { expect, test, type Page } from '@playwright/test'

const nestedIconSnippetStart = `<Page>
 <Page.Block width="lg">
 <Box padding="space-16" background="neutral-softA" borderRadius="8">
  `
const autocompleteOption = '.cm-tooltip-autocomplete [role="option"]'
const spacingTokenLabels = [
  'space-0',
  'space-1',
  'space-2',
  'space-4',
  'space-6',
  'space-8',
  'space-12',
  'space-16',
  'space-20',
  'space-24',
  'space-28',
  'space-32',
  'space-36',
  'space-40',
  'space-44',
  'space-48',
  'space-56',
  'space-64',
  'space-72',
  'space-80',
  'space-96',
  'space-128',
]

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

async function autocompleteOptionLabels(page: Page) {
  return page.locator(autocompleteOption).evaluateAll((options) =>
    options.map((option) => {
      const label = option.querySelector('.cm-completionLabel')
      return (label?.textContent ?? option.textContent ?? '').trim()
    })
  )
}

test.describe('Aksel autocomplete', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('suggests top-level tags and only contextual child tags in the browser editor', async ({ page }) => {
    const componentAutocomplete = await openAutocompleteFor(page, '', '<But')
    await expect(componentAutocomplete).toContainText('Button')
    await expect(componentAutocomplete).not.toContainText('PlusIcon')

    await page.keyboard.press('Escape')

    const curatedDottedAutocomplete = await openAutocompleteFor(page, '', '<Page.')
    await expect(curatedDottedAutocomplete).toContainText('Page.Block')

    await page.keyboard.press('Escape')

    const contextualAutocomplete = await openAutocompleteFor(page, '<Accordion>\n  ', '<')
    await expect(contextualAutocomplete).toContainText('Accordion.Item')
    await expect(contextualAutocomplete).not.toContainText('Button')
  })

  test('suggests props and enum values across formatted JSX tags', async ({ page }) => {
    const propAutocomplete = await openAutocompleteFor(page, '<Button\n  variant="primary"\n  ', 'd')
    await expect(propAutocomplete).toContainText('disabled')

    await page.keyboard.press('Escape')

    const enumAutocomplete = await openAutocompleteFor(page, '<Button variant="secondary-', 'n')
    await expect(enumAutocomplete).toContainText('secondary-neutral')
  })

  test('filters prop value suggestions while typing after the list opens', async ({ page }) => {
    const sizeAutocomplete = await openAutocompleteFor(page, '<Button size="', '')
    await expect(sizeAutocomplete).toContainText('medium')

    await page.keyboard.type('s', { delay: 20 })
    await expect(sizeAutocomplete).toContainText('small')
    await expect(sizeAutocomplete).not.toContainText('medium')
    await expect(sizeAutocomplete).not.toContainText('xsmall')

    await page.keyboard.press('Escape')

    const backgroundAutocomplete = await openAutocompleteFor(page, '<Box background="', '')
    await expect(backgroundAutocomplete).toContainText('default')

    await page.keyboard.type('bg-d', { delay: 20 })
    await expect(backgroundAutocomplete).toContainText('bg-default')
    await expect(backgroundAutocomplete).not.toContainText('neutral-soft')
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

  test('shows primitive spacing values in chronological order without compound duplicates', async ({ page }) => {
    await openAutocompleteFor(page, '<HStack gap="', '')
    await expect.poll(() => autocompleteOptionLabels(page)).toEqual(spacingTokenLabels)
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
