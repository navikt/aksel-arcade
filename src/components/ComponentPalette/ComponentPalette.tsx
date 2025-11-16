import { useState, useMemo } from 'react';
import { Modal, Tabs, TextField, VStack, HStack, BoxNew, Heading, BodyShort } from '@navikt/ds-react';
import { MagnifyingGlassIcon } from '@navikt/aksel-icons';
import { ComponentMetadata, getComponentsByCategory, searchComponents } from '../../data/akselComponents';
import './ComponentPalette.css';

interface ComponentPaletteProps {
  open: boolean;
  onClose: () => void;
  onInsertComponent: (snippet: string) => void;
}

export const ComponentPalette = ({ open, onClose, onInsertComponent }: ComponentPaletteProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'layout' | 'component'>('component');

  // Filter components based on search and active tab
  const filteredComponents = useMemo(() => {
    if (searchQuery.trim()) {
      return searchComponents(searchQuery);
    }
    return getComponentsByCategory(activeTab);
  }, [searchQuery, activeTab]);

  const handleInsert = (component: ComponentMetadata) => {
    onInsertComponent(component.snippet);
  };

  const handleClose = () => {
    setSearchQuery(''); // Reset search when closing
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      className="component-palette-modal"
      closeOnBackdropClick
      aria-label="Add Component"
    >
      <Modal.Header>
        <Heading level="2" size="medium">
          Add Component
        </Heading>
      </Modal.Header>

      <Modal.Body className="component-palette-body">
        <VStack gap="space-4" className="component-palette-content">
          {/* Search Field */}
          <TextField
            label="Search components"
            hideLabel
            placeholder="Search components..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            // @ts-expect-error - icon prop exists
            icon={<MagnifyingGlassIcon />}
            size="small"
          />

          {/* Tabs */}
          <Tabs value={activeTab} onChange={(value) => setActiveTab(value as 'layout' | 'component')}>
            <Tabs.List>
              <Tabs.Tab value="layout" label="Layout" />
              <Tabs.Tab value="component" label="Components" />
            </Tabs.List>
          </Tabs>

          {/* Component Grid */}
          <div className="component-grid-wrapper">
            <div className="component-grid">
            {filteredComponents.length === 0 ? (
              <BoxNew padding="space-8" className="no-results">
                <BodyShort>No components found matching "{searchQuery}"</BodyShort>
              </BoxNew>
            ) : (
              filteredComponents.map((component) => (
                <ComponentCard
                  key={component.name}
                  component={component}
                  onInsert={handleInsert}
                />
              ))
            )}
            </div>
          </div>
        </VStack>
      </Modal.Body>
    </Modal>
  );
};

interface ComponentCardProps {
  component: ComponentMetadata;
  onInsert: (component: ComponentMetadata) => void;
}

const ComponentCard = ({ component, onInsert }: ComponentCardProps) => {
  return (
    <BoxNew
      className="component-card"
      padding="3"
      borderRadius="medium"
      borderWidth="1"
      borderColor="neutral-subtleA"
      onClick={(e) => {
        e.stopPropagation();
        onInsert(component);
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          onInsert(component);
        }
      }}
    >
      <VStack gap="space-2">
        <HStack justify="space-between" align="center">
          <Heading level="3" size="xsmall">
            {component.name}
          </Heading>
          {component.category === 'layout' && (
            <span className="component-badge layout-badge">Layout</span>
          )}
        </HStack>
        {component.description && (
          <BodyShort size="small" className="component-description">
            {component.description}
          </BodyShort>
        )}
        <div className="component-props">
          {component.props.slice(0, 3).map((prop) => (
            <span key={prop.name} className="prop-tag">
              {prop.name}
              {prop.required && <span className="required">*</span>}
            </span>
          ))}
          {component.props.length > 3 && (
            <span className="prop-tag more">+{component.props.length - 3} more</span>
          )}
        </div>
      </VStack>
    </BoxNew>
  );
};
