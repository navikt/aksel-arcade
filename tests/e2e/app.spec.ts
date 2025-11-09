import { test, expect } from '@playwright/test'

test.describe('AkselArcade Core Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('should load the application with default project', async ({ page }) => {
    // Verify app header
    await expect(page.locator('header')).toBeVisible()
    await expect(page.getByText('AkselArcade')).toBeVisible()

    // Verify editor pane
    const editorPane = page.locator('.editor-pane')
    await expect(editorPane).toBeVisible()

    // Verify preview pane
    const previewPane = page.locator('.preview-pane')
    await expect(previewPane).toBeVisible()
  })

  test('should show default code in editor', async ({ page }) => {
    const editor = page.locator('.code-editor')
    await expect(editor).toBeVisible()

    // Check if default code is present
    const editorContent = await editor.textContent()
    expect(editorContent).toContain('Hello Aksel')
  })

  test('CRITICAL: Live Preview should render default code', async ({ page }) => {
    // Wait for iframe to load
    const iframe = page.frameLocator('.live-preview__iframe')
    
    // Wait for sandbox to be ready (give it up to 10 seconds for Aksel to load)
    await page.waitForTimeout(5000)

    // Check if button is rendered in preview
    const button = iframe.locator('button')
    await expect(button).toBeVisible({ timeout: 10000 })
    await expect(button).toHaveText('Hello Aksel!')
  })

  test('CRITICAL: should update preview when code changes', async ({ page }) => {
    // Wait for initial render
    await page.waitForTimeout(3000)

    // Get CodeMirror editor
    const editor = page.locator('.cm-content')
    await expect(editor).toBeVisible()

    // Clear and type new code
    await editor.click()
    await page.keyboard.press('Meta+A') // Select all
    await page.keyboard.type(`import { Heading } from "@navikt/ds-react";

export default function App() {
  return <Heading>Test Heading</Heading>;
}`, { delay: 10 })

    // Wait for transpilation and render
    await page.waitForTimeout(2000)

    // Check if heading is rendered
    const iframe = page.frameLocator('.live-preview__iframe')
    const heading = iframe.locator('h1, h2, h3')
    await expect(heading).toBeVisible({ timeout: 5000 })
    await expect(heading).toHaveText('Test Heading')
  })

  test('CRITICAL: Component Palette should insert at cursor position', async ({ page }) => {
    // Open component palette
    const addButton = page.getByRole('button', { name: /add component/i })
    await addButton.click()

    // Wait for modal
    await expect(page.locator('.component-palette')).toBeVisible()

    // Select a button component
    const buttonSnippet = page.locator('.component-palette__item').filter({ hasText: 'Button' }).first()
    await buttonSnippet.click()

    // Check editor content
    await page.waitForTimeout(500)
    const editor = page.locator('.cm-content')
    const content = await editor.textContent()
    
    // Should contain the button snippet
    expect(content).toContain('<Button')
  })

  test('should show Aksel components in preview', async ({ page }) => {
    // Wait for initial render
    await page.waitForTimeout(3000)

    const iframe = page.frameLocator('.live-preview__iframe')
    
    // Verify button renders with Aksel styles
    const button = iframe.locator('button')
    await expect(button).toBeVisible()
    
    // Check if button has Aksel CSS class
    const className = await button.getAttribute('class')
    expect(className).toBeTruthy()
  })

  test('should handle compile errors gracefully', async ({ page }) => {
    // Wait for initial render
    await page.waitForTimeout(2000)

    const editor = page.locator('.cm-content')
    await editor.click()
    await page.keyboard.press('Meta+A')
    
    // Type invalid code
    await page.keyboard.type(`export default function App() {
  return <InvalidComponent>
}`, { delay: 10 })

    // Wait for error
    await page.waitForTimeout(1000)

    // Should show error overlay
    const errorOverlay = page.locator('.error-overlay')
    await expect(errorOverlay).toBeVisible({ timeout: 3000 })
  })

  test('should switch between JSX and Hooks tabs', async ({ page }) => {
    // Click Hooks tab
    const hooksTab = page.getByRole('tab', { name: /hooks/i })
    await hooksTab.click()

    // Verify hooks code is shown
    const editor = page.locator('.cm-content')
    const content = await editor.textContent()
    expect(content).toContain('useState')
  })
})

test.describe('Visual Verification', () => {
  test('should render Aksel Button with correct styling', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(5000)

    const iframe = page.frameLocator('.live-preview__iframe')
    const button = iframe.locator('button')
    
    await expect(button).toBeVisible()
    
    // Take screenshot for visual verification
    await expect(iframe.locator('#root')).toHaveScreenshot('default-button.png', {
      maxDiffPixels: 100,
    })
  })
})
