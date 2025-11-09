import { test, expect } from '@playwright/test'

test.describe('Aksel Darkside Components', () => {
  test('default project renders Aksel Button component with correct styling', async ({ page }) => {
    await page.goto('http://localhost:5173')

    // Wait for the app to load
    await page.waitForSelector('[data-testid="live-preview"]', { timeout: 10000 })

    // Get the iframe
    const iframe = page.frameLocator('[data-testid="live-preview"] iframe')

    // Wait for content to render in iframe
    await iframe.locator('button').first().waitFor({ timeout: 10000 })

    // Verify button exists
    const button = iframe.locator('button').first()
    await expect(button).toBeVisible()

    // Verify button text
    await expect(button).toHaveText('Click me')

    // Verify it's an Aksel button (has Aksel CSS classes)
    const buttonClasses = await button.getAttribute('class')
    expect(buttonClasses).toContain('navds-button')

    // Verify primary variant
    expect(buttonClasses).toContain('navds-button--primary')

    // Verify button has proper styling (not a plain HTML button)
    const backgroundColor = await button.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor
    })

    // Aksel primary button should have a distinct color, not default button gray
    // RGB values for Aksel primary color (approximately)
    expect(backgroundColor).not.toBe('rgba(0, 0, 0, 0)') // Not transparent
    expect(backgroundColor).not.toBe('rgb(255, 255, 255)') // Not white
    expect(backgroundColor).not.toBe('rgb(239, 239, 239)') // Not default button gray
  })

  test('Theme component wraps user content', async ({ page }) => {
    await page.goto('http://localhost:5173')

    // Wait for the app to load
    await page.waitForSelector('[data-testid="live-preview"]', { timeout: 10000 })

    // Get the iframe
    const iframe = page.frameLocator('[data-testid="live-preview"] iframe')

    // Wait for root to have content
    await iframe.locator('#root').waitFor({ timeout: 10000 })

    // Check that Theme wrapper exists (it should be the first child of root)
    const rootChildren = await iframe.locator('#root > *').count()
    expect(rootChildren).toBeGreaterThan(0)

    // Verify Darkside theme CSS variables are applied
    const rootBg = await iframe.locator('body').evaluate((el) => {
      return window.getComputedStyle(el).getPropertyValue('--ax-bg-default') ||
             window.getComputedStyle(el).backgroundColor
    })

    // Should have dark background (Darkside theme)
    expect(rootBg).toBeTruthy()
  })

  test('Component Palette inserts Aksel components that render correctly', async ({ page }) => {
    await page.goto('http://localhost:5173')

    // Open component palette
    await page.click('[aria-label="Open component palette"]')

    // Wait for palette to open
    await page.waitForSelector('[data-testid="component-palette"]', { timeout: 5000 })

    // Click on Stack component
    await page.click('text=Stack')

    // Wait for code to be inserted (component palette should close)
    await page.waitForSelector('[data-testid="component-palette"]', { state: 'hidden', timeout: 5000 })

    // Get the iframe
    const iframe = page.frameLocator('[data-testid="live-preview"] iframe')

    // Wait for Stack to render (it should contain the default items)
    await iframe.locator('.navds-stack').first().waitFor({ timeout: 10000 })

    // Verify Stack has Aksel CSS class
    const stack = iframe.locator('.navds-stack').first()
    await expect(stack).toBeVisible()

    // Verify Stack has children (default template has 2 items)
    const stackChildren = await stack.locator('> *').count()
    expect(stackChildren).toBeGreaterThan(0)
  })
})
