import { test, expect } from '@playwright/test'

test.describe('Component Palette Insertion', () => {
  test('should insert component at cursor position, not at end', async ({ page }) => {
    page.on('console', msg => console.log(`PAGE: ${msg.text()}`))
    
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(5000) // Wait for Aksel to load
    
    // Get the CodeMirror editor
    const editor = page.locator('.cm-content[contenteditable="true"]')
    await expect(editor).toBeVisible()
    
    // Clear default content and add simple code
    await editor.click()
    await page.keyboard.press('Meta+A')
    await page.keyboard.type(`import { Box } from "@navikt/ds-react";

export default function App() {
  return <Box>Content</Box>;
}`, { delay: 5 })
    
    await page.waitForTimeout(500)
    
    // Place cursor on line 4 (inside the Box tag, after "Content")
    // Click after "Content" word
    await editor.click()
    await page.keyboard.press('Meta+A') // Select all
    
    // Use arrow keys to position cursor precisely
    // Go to start, then down 3 lines, then right to position
    await page.keyboard.press('Home') // Start of selection
    await page.keyboard.press('ArrowDown') // Line 2
    await page.keyboard.press('ArrowDown') // Line 3  
    await page.keyboard.press('ArrowDown') // Line 4
    await page.keyboard.press('End') // End of line (after ';')
    
    console.log('✅ Cursor positioned')
    
    // Get current content before insertion
    const contentBefore = await editor.textContent()
    console.log(`📝 Content before insertion:\n${contentBefore}`)
    if (!contentBefore) throw new Error('No content before')
    
    const linesBefore = contentBefore.split('\n')
    console.log(`📊 Lines before: ${linesBefore.length}`)
    
    // Open component palette
    const addButton = page.getByRole('button', { name: /add component/i })
    await expect(addButton).toBeVisible()
    await addButton.click()
    
    await page.waitForTimeout(300)
    
    // Wait for palette modal
    await expect(page.locator('.component-palette')).toBeVisible()
    console.log('✅ Component palette opened')
    
    // Select Button component
    const buttonSnippet = page.locator('.component-palette__item').filter({ hasText: 'Button' }).first()
    await expect(buttonSnippet).toBeVisible()
    await buttonSnippet.click()
    
    await page.waitForTimeout(500)
    
    // Get content after insertion
    const contentAfter = await editor.textContent()
    console.log(`📝 Content after insertion:\n${contentAfter}`)
    if (!contentAfter) throw new Error('No content after')
    
    const linesAfter = contentAfter.split('\n')
    console.log(`📊 Lines after: ${linesAfter.length}`)
    
    // Verify Button import was added
    expect(contentAfter).toContain('Button')
    expect(contentAfter).toContain('import { Box, Button }') // Should merge imports
    
    // Find where the Button component was inserted
    const buttonInsertLine = linesAfter.findIndex(line => line.includes('<Button'))
    console.log(`📍 Button inserted at line: ${buttonInsertLine}`)
    
    // CRITICAL: Button should NOT be at the very end (last line)
    // It should be inserted near the cursor position (around line 4)
    const lastLineIndex = linesAfter.length - 1
    
    if (buttonInsertLine === lastLineIndex || buttonInsertLine === lastLineIndex - 1) {
      console.log(`❌ FAIL: Button inserted at end (line ${buttonInsertLine} of ${linesAfter.length})`)
      console.log(`Expected: near line 4, Got: line ${buttonInsertLine}`)
      throw new Error(`Component inserted at end of file (line ${buttonInsertLine}), not at cursor position`)
    } else {
      console.log(`✅ PASS: Button inserted at line ${buttonInsertLine}, not at end (${lastLineIndex})`)
    }
    
    // Button should be somewhere in the middle (lines 4-6 range)
    expect(buttonInsertLine).toBeGreaterThanOrEqual(3)
    expect(buttonInsertLine).toBeLessThan(8)
  })
  
  test('should insert at current cursor position in middle of code', async ({ page }) => {
    page.on('console', msg => console.log(`PAGE: ${msg.text()}`))
    
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(5000)
    
    const editor = page.locator('.cm-content[contenteditable="true"]')
    
    // Set up code with clear structure
    await editor.click()
    await page.keyboard.press('Meta+A')
    await page.keyboard.type(`export default function App() {
  // Line 2
  return <div>
    {/* Insert here */}
  </div>;
}`, { delay: 5 })
    
    await page.waitForTimeout(300)
    
    // Position cursor at line 4 (the comment line)
    await editor.click()
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('ArrowDown')
    }
    await page.keyboard.press('End')
    
    console.log('✅ Cursor positioned at line 4')
    
    // Insert Heading component
    await page.getByRole('button', { name: /add component/i }).click()
    await page.waitForTimeout(200)
    
    const headingSnippet = page.locator('.component-palette__item').filter({ hasText: 'Heading' }).first()
    await headingSnippet.click()
    
    await page.waitForTimeout(500)
    
    const contentAfter = await editor.textContent()
    if (!contentAfter) throw new Error('No content after insert')
    const lines = contentAfter.split('\n')
    
    console.log(`📝 Final content:\n${contentAfter}`)
    
    // Find Heading insertion
    const headingLine = lines.findIndex(line => line.includes('<Heading'))
    console.log(`📍 Heading inserted at line: ${headingLine}`)
    
    // Should be near line 4, not at the end
    expect(headingLine).toBeGreaterThanOrEqual(3)
    expect(headingLine).toBeLessThan(7)
    
    console.log('✅ Component inserted at cursor position')
  })
})
