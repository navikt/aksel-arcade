import { test, expect } from '@playwright/test'

test.describe('Aksel Theme Wrapper', () => {
  test('Button component should render with Aksel Darkside styling', async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:5173')

    // Wait for app to load
    await page.waitForSelector('[data-testid="editor-pane"]', { timeout: 10000 })

    // Wait for preview iframe to be ready
    const previewFrame = page.frameLocator('iframe[data-testid="preview-iframe"]')
    
    // Wait for the button to render in the preview
    await page.waitForTimeout(2000) // Give time for transpilation and rendering

    // Check if button exists in preview
    const button = previewFrame.locator('button')
    await expect(button).toBeVisible({ timeout: 5000 })

    // Verify button has Aksel classes (not plain HTML button)
    // Aksel buttons should have the 'navds-button' class
    const hasAkselClass = await button.evaluate((el) => {
      return el.classList.contains('navds-button')
    })
    
    expect(hasAkselClass).toBe(true)

    // Verify button has computed styles from Aksel (not default HTML button styles)
    const buttonStyles = await button.evaluate((el) => {
      const styles = window.getComputedStyle(el)
      return {
        backgroundColor: styles.backgroundColor,
        padding: styles.padding,
        borderRadius: styles.borderRadius,
      }
    })

    // Aksel buttons should have specific styling (not browser defaults)
    // Browser default buttons typically have no background color or very basic styling
    expect(buttonStyles.backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
    expect(buttonStyles.backgroundColor).not.toBe('transparent')
    
    console.log('Button styles:', buttonStyles)
  })

  test('Theme wrapper should be present in sandbox', async ({ page }) => {
    await page.goto('http://localhost:5173')
    await page.waitForSelector('[data-testid="editor-pane"]', { timeout: 10000 })

    const previewFrame = page.frameLocator('iframe[data-testid="preview-iframe"]')
    
    // Wait for rendering
    await page.waitForTimeout(2000)

    // Check if Theme wrapper div exists with aksel-theme class
    const themeWrapper = previewFrame.locator('.aksel-theme')
    await expect(themeWrapper).toBeVisible({ timeout: 5000 })
  })

  test('Multiple Aksel components should render correctly', async ({ page }) => {
    await page.goto('http://localhost:5173')
    await page.waitForSelector('[data-testid="editor-pane"]', { timeout: 10000 })

    // Update the JSX code to include multiple Aksel components
    const editor = page.locator('.cm-content[contenteditable="true"]').first()
    await editor.click()
    await page.keyboard.press('Meta+A') // Select all
    await editor.fill(`<div>
  <Heading size="large">Test Heading</Heading>
  <Button variant="primary">Primary Button</Button>
  <Button variant="secondary">Secondary Button</Button>
</div>`)

    // Wait for transpilation and rendering
    await page.waitForTimeout(2000)

    const previewFrame = page.frameLocator('iframe[data-testid="preview-iframe"]')
    
    // Verify all components render
    await expect(previewFrame.locator('h1')).toBeVisible({ timeout: 5000 })
    await expect(previewFrame.locator('button').first()).toBeVisible()
    await expect(previewFrame.locator('button').nth(1)).toBeVisible()

    // Check if components have Aksel classes
    const headingHasClass = await previewFrame.locator('h1').evaluate((el) => {
      return el.classList.contains('navds-heading')
    })
    expect(headingHasClass).toBe(true)
  })
})
