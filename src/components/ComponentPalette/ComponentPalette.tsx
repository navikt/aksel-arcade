import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Modal,
  Tabs,
  TextField,
  VStack,
  Box,
  HGrid,
  Heading,
  BodyShort,
  LinkCard,
} from '@navikt/ds-react'
import { MagnifyingGlassIcon } from '@navikt/aksel-icons'
import {
  ComponentMetadata,
  getComponentsByCategory,
  searchComponents,
} from '../../data/akselComponents'
import type { AkselCatalogGroup } from '../../data/akselCatalog'
import './ComponentPalette.css'

interface ComponentPaletteProps {
  open: boolean
  onClose: () => void
  onInsertComponent: (snippet: string) => void
}

export const ComponentPalette = ({ open, onClose, onInsertComponent }: ComponentPaletteProps) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<AkselCatalogGroup>('component')
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return undefined

    const timeoutId = window.setTimeout(() => {
      searchInputRef.current?.focus()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [open])

  // Filter components based on search and active tab
  const filteredComponents = useMemo(() => {
    if (searchQuery.trim()) {
      return searchComponents(searchQuery)
    }
    return getComponentsByCategory(activeTab)
  }, [searchQuery, activeTab])

  const handleInsert = (component: ComponentMetadata) => {
    onInsertComponent(component.snippet)
  }

  const handleClose = () => {
    setSearchQuery('') // Reset search when closing
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      className="component-palette-modal"
      closeOnBackdropClick
      aria-label="Add Component"
      data-testid="component-palette"
    >
      <Modal.Header>
        <Heading level="2" size="medium">
          Add Component
        </Heading>
      </Modal.Header>

      <Modal.Body className="component-palette-body">
        <VStack gap="space-16" className="component-palette-content">
          {/* Search Field */}
          <TextField
            label="Search components"
            hideLabel
            placeholder="Search Aksel building blocks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            // @ts-expect-error - icon prop exists
            icon={<MagnifyingGlassIcon />}
            ref={searchInputRef}
            size="small"
            autoFocus
          />

          {/* Tabs */}
          <div className="component-palette-tabs">
            <Tabs value={activeTab} onChange={(value) => setActiveTab(value as AkselCatalogGroup)}>
              <Tabs.List>
                <Tabs.Tab value="layout" label="Layout" />
                <Tabs.Tab value="component" label="Components" />
                <Tabs.Tab value="icon" label="Icons" />
              </Tabs.List>
            </Tabs>
          </div>

          {/* Component Grid */}
          <div className="component-grid-wrapper">
            <HGrid
              columns="repeat(auto-fill, minmax(280px, 1fr))"
              gap="space-16"
              className="component-grid"
            >
              {filteredComponents.length === 0 ? (
                <Box padding="space-16" className="no-results">
                  <BodyShort>No components found matching "{searchQuery}"</BodyShort>
                </Box>
              ) : (
                filteredComponents.map((component) => (
                  <ComponentCard
                    key={component.name}
                    component={component}
                    onInsert={handleInsert}
                  />
                ))
              )}
            </HGrid>
          </div>
        </VStack>
      </Modal.Body>
    </Modal>
  )
}

interface ComponentCardProps {
  component: ComponentMetadata
  onInsert: (component: ComponentMetadata) => void
}

const ComponentCard = ({ component, onInsert }: ComponentCardProps) => {
  return (
    <LinkCard className="component-card" arrow={false} size="small">
      <LinkCard.Title as="h3">
        <LinkCard.Anchor
          href="#"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onInsert(component)
          }}
          onKeyDown={(e) => {
            if (e.key === ' ') {
              e.preventDefault()
              e.stopPropagation()
              onInsert(component)
            }
          }}
        >
          {component.name}
        </LinkCard.Anchor>
      </LinkCard.Title>
      {component.description && (
        <LinkCard.Description className="component-description">
          {component.description}
        </LinkCard.Description>
      )}
    </LinkCard>
  )
}
