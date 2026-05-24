import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Modal,
  Tabs,
  TextField,
  VStack,
  HStack,
  Box,
  HGrid,
  Heading,
  BodyShort,
  Link,
  Tag,
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
    <Box
      className="component-card"
      padding="space-12"
      borderRadius="8"
      borderWidth="1"
      borderColor="neutral-subtleA"
      onClick={(e) => {
        e.stopPropagation()
        onInsert(component)
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          e.stopPropagation()
          onInsert(component)
        }
      }}
    >
      <VStack gap="space-8">
        <HStack justify="space-between" align="center">
          <Heading level="3" size="xsmall">
            {component.name}
          </Heading>
        </HStack>
        {component.description && (
          <BodyShort size="small" className="component-description">
            {component.description}
          </BodyShort>
        )}
        <HStack gap="space-8" align="center" wrap>
          {component.props.length > 0 && (
            <>
              {component.props.slice(0, 3).map((prop) => (
                <Tag
                  key={prop.name}
                  size="xsmall"
                  variant="moderate"
                  data-color={prop.required ? 'danger' : 'neutral'}
                  className="prop-tag"
                >
                  {prop.name}
                  {prop.required && '*'}
                </Tag>
              ))}
              {component.props.length > 3 && (
                <Tag size="xsmall" variant="moderate" data-color="info" className="prop-tag">
                  +{component.props.length - 3} more
                </Tag>
              )}
            </>
          )}
          {component.docs && (
            <Link
              className="component-docs-link"
              href={component.docs}
              variant="action"
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              Docs
            </Link>
          )}
        </HStack>
      </VStack>
    </Box>
  )
}
