import type { ComponentSnippet } from '@/types/snippets'

export const AKSEL_SNIPPETS: ComponentSnippet[] = [
  {
    id: 'box',
    name: 'Box',
    category: 'layout',
    keywords: ['box', 'container', 'layout', 'padding', 'wrapper'],
    template: '<Box padding="4">\n  ${1:Content}\n</Box>',
    description: 'Layout container with spacing control',
    import: "import { Box } from '@navikt/ds-react';",
  },
  {
    id: 'stack',
    name: 'Stack',
    category: 'layout',
    keywords: ['stack', 'vertical', 'column', 'layout', 'gap', 'spacing'],
    template: '<Stack gap="4">\n  ${1:First item}\n  ${2:Second item}\n</Stack>',
    description: 'Vertical layout stack with gap spacing',
    import: "import { Stack } from '@navikt/ds-react';",
  },
  {
    id: 'grid',
    name: 'Grid',
    category: 'layout',
    keywords: ['grid', 'layout', 'columns', 'responsive'],
    template:
      '<Grid columns={{ xs: 1, sm: 2, md: 3 }} gap="4">\n  ${1:Grid item 1}\n  ${2:Grid item 2}\n  ${3:Grid item 3}\n</Grid>',
    description: 'Responsive grid layout',
    import: "import { Grid } from '@navikt/ds-react';",
  },
  {
    id: 'button',
    name: 'Button',
    category: 'component',
    keywords: ['button', 'click', 'action', 'submit', 'primary', 'cta'],
    template: '<Button variant="primary">${1:Button text}</Button>',
    description: 'Action button with variants',
    import: "import { Button } from '@navikt/ds-react';",
  },
  {
    id: 'textfield',
    name: 'TextField',
    category: 'component',
    keywords: ['input', 'text', 'form', 'field', 'textbox'],
    template: '<TextField label="${1:Label}" placeholder="${2:Placeholder}" />',
    description: 'Text input field with label',
    import: "import { TextField } from '@navikt/ds-react';",
  },
  {
    id: 'select',
    name: 'Select',
    category: 'component',
    keywords: ['select', 'dropdown', 'options', 'form', 'menu'],
    template:
      '<Select label="${1:Label}">\n  <option value="">${2:Option 1}</option>\n  <option value="">${3:Option 2}</option>\n</Select>',
    description: 'Dropdown select menu',
    import: "import { Select } from '@navikt/ds-react';",
  },
  {
    id: 'checkbox',
    name: 'Checkbox',
    category: 'component',
    keywords: ['checkbox', 'check', 'toggle', 'form', 'boolean'],
    template: '<Checkbox>${1:Label}</Checkbox>',
    description: 'Checkbox input with label',
    import: "import { Checkbox } from '@navikt/ds-react';",
  },
  {
    id: 'radio',
    name: 'Radio',
    category: 'component',
    keywords: ['radio', 'option', 'choice', 'form', 'group'],
    template: '<Radio name="${1:group}">${2:Label}</Radio>',
    description: 'Radio button input',
    import: "import { Radio } from '@navikt/ds-react';",
  },
]

interface SearchOptions {
  category?: 'layout' | 'component'
  limit?: number
}

export const searchSnippets = (
  query: string,
  snippets: ComponentSnippet[] = AKSEL_SNIPPETS,
  options: SearchOptions = {}
): ComponentSnippet[] => {
  const lowerQuery = query.toLowerCase().trim()

  // Empty query returns all snippets (optionally filtered by category)
  if (!lowerQuery) {
    let results = snippets
    if (options.category) {
      results = results.filter((s) => s.category === options.category)
    }
    return results
  }

  // Filter by category first
  let filtered = snippets
  if (options.category) {
    filtered = filtered.filter((s) => s.category === options.category)
  }

  // Score each snippet
  const scored = filtered.map((snippet) => {
    let score = 0

    // Exact name match (highest priority)
    if (snippet.name.toLowerCase() === lowerQuery) {
      score += 100
    }
    // Name starts with query
    else if (snippet.name.toLowerCase().startsWith(lowerQuery)) {
      score += 50
    }
    // Name contains query
    else if (snippet.name.toLowerCase().includes(lowerQuery)) {
      score += 25
    }

    // Keyword exact match
    if (snippet.keywords.includes(lowerQuery)) {
      score += 40
    }
    // Keyword starts with query
    else if (snippet.keywords.some((kw) => kw.startsWith(lowerQuery))) {
      score += 20
    }
    // Keyword contains query
    else if (snippet.keywords.some((kw) => kw.includes(lowerQuery))) {
      score += 10
    }

    return { snippet, score }
  })

  // Filter out zero-score results
  const matches = scored.filter((s) => s.score > 0)

  // Sort by score (descending), then alphabetically
  matches.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score
    return a.snippet.name.localeCompare(b.snippet.name)
  })

  // Apply limit
  let results = matches.map((m) => m.snippet)
  if (options.limit) {
    results = results.slice(0, options.limit)
  }

  return results
}
