import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Dialog,
  Tabs,
  TextField,
  VStack,
  Box,
  HGrid,
  BodyShort,
  LinkCard,
  Button,
} from '@navikt/ds-react'
import { MagnifyingGlassIcon, XMarkIcon } from '@navikt/aksel-icons'
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

    const components = getComponentsByCategory(activeTab)

    if (activeTab !== 'component') {
      return components
    }

    return [...components].sort((left, right) => left.name.localeCompare(right.name))
  }, [searchQuery, activeTab])

  const handleInsert = (component: ComponentMetadata) => {
    onInsertComponent(component.snippet)
  }

  const handleClose = () => {
    setSearchQuery('') // Reset search when closing
    onClose()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          handleClose()
        }
      }}
    >
      <Dialog.Popup
        className="component-palette-modal"
        closeOnOutsideClick
        aria-label="Add Component"
        data-testid="component-palette"
      >
        <Dialog.Header>
          <Dialog.Title>Add Component</Dialog.Title>
          <Dialog.CloseTrigger>
            <Button
              type="button"
              variant="tertiary"
              data-color="neutral"
              size="small"
              icon={<XMarkIcon aria-hidden />}
              aria-label="Close Add Component"
            />
          </Dialog.CloseTrigger>
        </Dialog.Header>

        <Dialog.Body className="component-palette-body">
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
        </Dialog.Body>
      </Dialog.Popup>
    </Dialog>
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
