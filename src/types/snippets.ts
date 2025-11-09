export type SnippetCategory = 'layout' | 'component'

export interface ComponentSnippet {
  id: string // Unique identifier (e.g., "button")
  name: string // Display name (e.g., "Button")
  category: SnippetCategory // Layout or Component
  keywords: string[] // Search terms (e.g., ["button", "click"])
  template: string // JSX snippet with placeholders
  description: string // Short description for palette
  import: string // Import statement (e.g., "import { Button } from '@navikt/ds-react';")
}
