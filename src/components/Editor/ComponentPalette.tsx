import { useState } from 'react'
import { Modal, TextField, Tabs } from '@navikt/ds-react'
import { searchSnippets, AKSEL_SNIPPETS } from '@/services/componentLibrary'
import type { ComponentSnippet, SnippetCategory } from '@/types/snippets'
import './ComponentPalette.css'

interface ComponentPaletteProps {
  isOpen: boolean
  onClose: () => void
  onSelectSnippet: (snippet: ComponentSnippet) => void
}

export const ComponentPalette = ({ isOpen, onClose, onSelectSnippet }: ComponentPaletteProps) => {
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<SnippetCategory | undefined>(undefined)

  const results = searchSnippets(query, AKSEL_SNIPPETS, { category: activeCategory })

  const handleSelect = (snippet: ComponentSnippet) => {
    onSelectSnippet(snippet)
    setQuery('')
    onClose()
  }

  return (
    <Modal open={isOpen} onClose={onClose} header={{ heading: 'Add Component' }}>
      <Modal.Body>
        <div className="component-palette">
          <TextField
            label="Search components"
            hideLabel
            placeholder="Search components..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />

          <Tabs
            value={activeCategory || 'all'}
            onChange={(value) => setActiveCategory(value === 'all' ? undefined : (value as SnippetCategory))}
          >
            <Tabs.List>
              <Tabs.Tab value="all" label="All" />
              <Tabs.Tab value="layout" label="Layout" />
              <Tabs.Tab value="component" label="Components" />
            </Tabs.List>
          </Tabs>

          <div className="component-palette__results">
            {results.length === 0 ? (
              <p className="component-palette__empty">No components found</p>
            ) : (
              results.map((snippet) => (
                <button
                  key={snippet.id}
                  className="component-palette__item"
                  onClick={() => handleSelect(snippet)}
                >
                  <div className="component-palette__item-name">{snippet.name}</div>
                  <div className="component-palette__item-desc">{snippet.description}</div>
                </button>
              ))
            )}
          </div>
        </div>
      </Modal.Body>
    </Modal>
  )
}
