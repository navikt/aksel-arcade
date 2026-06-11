export type SnippetCategory = 'layout' | 'component' | 'icon'
export type SnippetStatus = 'current' | 'experimental' | 'legacy'

export interface ComponentInsertion {
  jsx: string
  hooks?: string
  componentSetup?: string
}

export interface ComponentSnippet {
  id: string // Unique identifier (e.g., "button")
  name: string // Display name (e.g., "Button")
  category: SnippetCategory // Layout, Component, or Icon
  keywords: string[] // Search terms (e.g., ["button", "click"])
  template: string // JSX snippet with placeholders
  description: string // Short description for palette
  import: string // Import statement (e.g., "import { Button } from '@navikt/ds-react';")
  status?: SnippetStatus
  docs?: string
  insertion?: ComponentInsertion
}
