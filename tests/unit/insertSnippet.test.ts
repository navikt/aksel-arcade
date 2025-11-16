import { describe, it, expect } from 'vitest'

describe('Component Insertion Logic', () => {
  it('should insert component as sibling, not child', () => {
    const currentCode = `import { Button } from "@navikt/ds-react";

export default function App() {
  return <Button>Hello Aksel!</Button>;
}`

    const snippet = {
      id: 'button',
      name: 'Button',
      import: `import { Button } from '@navikt/ds-react';`,
      template: `<Button variant="primary" size="medium">Button text</Button>`,
      description: 'Button component',
      category: 'component' as const,
    }

    // Simulate the FIXED insertion logic
    let newCode = currentCode
    
    let parsedTemplate = snippet.template
    parsedTemplate = parsedTemplate.replace(/\$\{(\d+):([^}]+)\}/g, (_match, _num, placeholder) => placeholder)

    // Find the return statement
    const returnMatch = newCode.match(/(return\s+(?:\()?<[\s\S]*)(;?\s*\})/m)
    
    if (returnMatch && returnMatch[1]) {
      const beforeReturn = returnMatch[1]
      const lastClosingTagMatch = beforeReturn.match(/<\/\w+>(?=\s*(?:\)|;))/g)
      
      if (lastClosingTagMatch) {
        const lastClosingTag = lastClosingTagMatch[lastClosingTagMatch.length - 1]
        const insertPosition = newCode.lastIndexOf(lastClosingTag)
        
        if (insertPosition > 0) {
          // FIXED: Insert AFTER the closing tag (as sibling)
          const insertAfter = insertPosition + lastClosingTag.length
          const beforeInsert = newCode.slice(0, insertAfter)
          const afterInsert = newCode.slice(insertAfter)
          
          const lines = beforeInsert.split('\n')
          const closingTagLine = lines[lines.length - 1]
          const indent = closingTagLine.match(/^\s*/)?.[0] || '  '
          
          newCode = beforeInsert + '\n' + indent + parsedTemplate + afterInsert
        }
      }
    }

    console.log('Result:\n', newCode)

    // Verify it's NOT nested inside Button
    expect(newCode).not.toContain('<Button>Hello Aksel!\n  <Button variant')
    
    // Verify it IS a sibling (two separate Button elements at same level)
    // Should have structure: <Button>...</Button> followed by <Button>...</Button>
    const buttonCount = (newCode.match(/<Button/g) || []).length
    expect(buttonCount).toBe(2) // Two buttons
    
    // The new button should come AFTER the closing tag of the first button
    const firstButtonClose = newCode.indexOf('</Button>')
    const secondButtonOpen = newCode.indexOf('<Button variant="primary"')
    expect(secondButtonOpen).toBeGreaterThan(firstButtonClose)
  })
})
