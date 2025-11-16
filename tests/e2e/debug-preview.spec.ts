import { test, expect } from '@playwright/test'

test.describe('Debug Live Preview', () => {
  test('should render content in preview iframe', async ({ page }) => {
    // Enable console logging to see what's happening
    page.on('console', msg => console.log(`PAGE: ${msg.text()}`))
    
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    
    console.log('✅ Page loaded')
    
    // Wait for iframe to exist
    const iframe = page.frameLocator('.live-preview__iframe')
    await page.waitForSelector('.live-preview__iframe', { timeout: 5000 })
    console.log('✅ Iframe element found')
    
    // Wait for sandbox to be ready (Aksel loading)
    await page.waitForTimeout(8000) // Give Aksel time to load from CDN
    console.log('⏱️ Waited for Aksel to load')
    
    // Check iframe content
    const iframeElement = page.locator('.live-preview__iframe')
    const iframeSrc = await iframeElement.getAttribute('src')
    console.log(`📄 Iframe src: ${iframeSrc}`)
    
    // Try to find content in iframe
    try {
      const root = iframe.locator('#root')
      await expect(root).toBeVisible({ timeout: 5000 })
      console.log('✅ #root element is visible')
      
      const rootContent = await root.textContent()
      console.log(`📝 Root content: "${rootContent}"`)
      
      // Check if button exists
      const button = iframe.locator('button')
      const buttonExists = await button.count() > 0
      console.log(`🔘 Button exists: ${buttonExists}`)
      
      if (buttonExists) {
        const buttonText = await button.textContent()
        console.log(`📝 Button text: "${buttonText}"`)
        await expect(button).toBeVisible()
        expect(buttonText).toContain('Hello')
      } else {
        console.log('❌ No button found in iframe')
        
        // Get full HTML of root to see what's there
        const rootHTML = await root.innerHTML()
        console.log(`📄 Root HTML: ${rootHTML.substring(0, 500)}`)
      }
    } catch (error) {
      console.log(`❌ Error checking iframe: ${error}`)
      
      // Take screenshot for debugging
      await page.screenshot({ path: 'debug-preview-blank.png' })
      console.log('📸 Screenshot saved as debug-preview-blank.png')
      
      throw error
    }
  })
  
  test('should show transpilation process in console', async ({ page }) => {
    const logs: string[] = []
    
    page.on('console', msg => {
      const text = msg.text()
      logs.push(text)
      console.log(`CONSOLE: ${text}`)
    })
    
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)
    
    console.log('\n=== ALL CONSOLE LOGS ===')
    logs.forEach(log => console.log(log))
    console.log('========================\n')
    
    // Check for expected logs
    const hasTranspileSuccess = logs.some(log => log.includes('Transpilation successful'))
    const hasExecuteCode = logs.some(log => log.includes('EXECUTE_CODE'))
    const hasSandboxReady = logs.some(log => log.includes('Sandbox ready'))
    
    console.log(`✅ Transpile success: ${hasTranspileSuccess}`)
    console.log(`✅ Execute code sent: ${hasExecuteCode}`)
    console.log(`✅ Sandbox ready: ${hasSandboxReady}`)
    
    expect(hasTranspileSuccess).toBe(true)
    expect(hasExecuteCode).toBe(true)
  })
})
