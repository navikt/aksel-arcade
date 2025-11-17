/**
 * Aksel Darkside Component Metadata
 * Complete catalog of Aksel components with props for the Component Palette
 */

export interface ComponentProp {
  name: string;
  type: string;
  required?: boolean;
  default?: string;
  description?: string;
  values?: string[]; // For enums
}

export interface ComponentMetadata {
  name: string;
  category: 'layout' | 'component';
  import: string; // e.g., "@navikt/ds-react"
  props: ComponentProp[];
  snippet: string; // Default code snippet
  description?: string;
}

// ===== LAYOUT COMPONENTS =====

export const layoutComponents: ComponentMetadata[] = [
  {
    name: 'Page',
    category: 'layout',
    import: '@navikt/ds-react',
    description: 'Main page container with responsive layout',
    props: [
      { name: 'background', type: 'string', description: 'Background color token' },
      { name: 'contentWrapper', type: 'boolean', description: 'Wrap content with max-width' },
      { name: 'footer', type: 'ReactNode', description: 'Footer content' },
      { name: 'footerPosition', type: '"fixed" | "relative"', values: ['fixed', 'relative'] },
    ],
    snippet: '<Page>\n  {/* Page content */}\n</Page>',
  },
  {
    name: 'HGrid',
    category: 'layout',
    import: '@navikt/ds-react',
    description: 'Horizontal grid layout with responsive columns',
    props: [
      { name: 'columns', type: 'number | string | ResponsiveProp<string>', description: 'Grid column definition' },
      { name: 'gap', type: 'SpacingScale', description: 'Gap between grid items' },
      { name: 'align', type: '"start" | "center" | "end" | "stretch"', values: ['start', 'center', 'end', 'stretch'] },
    ],
    snippet: '<HGrid columns={2} gap="space-4">\n  <div>Column 1</div>\n  <div>Column 2</div>\n</HGrid>',
  },
  {
    name: 'HStack',
    category: 'layout',
    import: '@navikt/ds-react',
    description: 'Horizontal stack with flexbox',
    props: [
      { name: 'gap', type: 'SpacingScale', description: 'Space between items' },
      { name: 'align', type: '"start" | "center" | "end" | "baseline" | "stretch"', values: ['start', 'center', 'end', 'baseline', 'stretch'], default: 'stretch' },
      { name: 'justify', type: '"start" | "center" | "end" | "space-around" | "space-between" | "space-evenly"', values: ['start', 'center', 'end', 'space-around', 'space-between', 'space-evenly'] },
      { name: 'wrap', type: 'boolean', description: 'Enable flex-wrap' },
      { name: 'padding', type: 'SpacingScale', description: 'Padding around children' },
      { name: 'paddingInline', type: 'SpacingScale', description: 'Horizontal padding' },
      { name: 'paddingBlock', type: 'SpacingScale', description: 'Vertical padding' },
      { name: 'margin', type: 'SpacingScale', description: 'Margin around element' },
      { name: 'marginInline', type: 'SpacingScale', description: 'Horizontal margin' },
      { name: 'marginBlock', type: 'SpacingScale', description: 'Vertical margin' },
      { name: 'width', type: 'string', description: 'CSS width' },
      { name: 'height', type: 'string', description: 'CSS height' },
      { name: 'minWidth', type: 'string', description: 'CSS min-width' },
      { name: 'maxWidth', type: 'string', description: 'CSS max-width' },
      { name: 'minHeight', type: 'string', description: 'CSS min-height' },
      { name: 'maxHeight', type: 'string', description: 'CSS max-height' },
      { name: 'position', type: '"static" | "relative" | "absolute" | "fixed" | "sticky"', values: ['static', 'relative', 'absolute', 'fixed', 'sticky'] },
      { name: 'overflow', type: '"hidden" | "auto" | "visible" | "clip" | "scroll"', values: ['hidden', 'auto', 'visible', 'clip', 'scroll'] },
      { name: 'asChild', type: 'boolean', description: 'Merge with child element' },
      { name: 'as', type: 'string', description: 'HTML element to render as' },
    ],
    snippet: '<HStack gap="space-4" align="center">\n  <div>Item 1</div>\n  <div>Item 2</div>\n</HStack>',
  },
  {
    name: 'VStack',
    category: 'layout',
    import: '@navikt/ds-react',
    description: 'Vertical stack with flexbox',
    props: [
      { name: 'gap', type: 'SpacingScale', description: 'Space between items' },
      { name: 'align', type: '"start" | "center" | "end" | "stretch"', values: ['start', 'center', 'end', 'stretch'], default: 'stretch' },
      { name: 'justify', type: '"start" | "center" | "end" | "space-around" | "space-between" | "space-evenly"', values: ['start', 'center', 'end', 'space-around', 'space-between', 'space-evenly'] },
      { name: 'padding', type: 'SpacingScale', description: 'Padding around children' },
      { name: 'paddingInline', type: 'SpacingScale', description: 'Horizontal padding' },
      { name: 'paddingBlock', type: 'SpacingScale', description: 'Vertical padding' },
      { name: 'margin', type: 'SpacingScale', description: 'Margin around element' },
      { name: 'marginInline', type: 'SpacingScale', description: 'Horizontal margin' },
      { name: 'marginBlock', type: 'SpacingScale', description: 'Vertical margin' },
      { name: 'width', type: 'string', description: 'CSS width' },
      { name: 'height', type: 'string', description: 'CSS height' },
      { name: 'minWidth', type: 'string', description: 'CSS min-width' },
      { name: 'maxWidth', type: 'string', description: 'CSS max-width' },
      { name: 'minHeight', type: 'string', description: 'CSS min-height' },
      { name: 'maxHeight', type: 'string', description: 'CSS max-height' },
      { name: 'position', type: '"static" | "relative" | "absolute" | "fixed" | "sticky"', values: ['static', 'relative', 'absolute', 'fixed', 'sticky'] },
      { name: 'overflow', type: '"hidden" | "auto" | "visible" | "clip" | "scroll"', values: ['hidden', 'auto', 'visible', 'clip', 'scroll'] },
      { name: 'asChild', type: 'boolean', description: 'Merge with child element' },
      { name: 'as', type: 'string', description: 'HTML element to render as' },
    ],
    snippet: '<VStack gap="space-4">\n  <div>Item 1</div>\n  <div>Item 2</div>\n</VStack>',
  },
  {
    name: 'Box',
    category: 'layout',
    import: '@navikt/ds-react',
    description: 'Generic container with spacing and styling props',
    props: [
      { name: 'padding', type: 'SpacingScale', description: 'Padding around children' },
      { name: 'paddingInline', type: 'SpacingScale', description: 'Horizontal padding' },
      { name: 'paddingBlock', type: 'SpacingScale', description: 'Vertical padding' },
      { name: 'background', type: 'string', description: 'Background color token' },
      { name: 'borderColor', type: 'string', description: 'Border color token' },
      { name: 'borderRadius', type: 'string', description: 'Border radius token' },
      { name: 'borderWidth', type: '"0" | "1" | "2" | "3" | "4" | "5"', values: ['0', '1', '2', '3', '4', '5'] },
      { name: 'shadow', type: '"dialog"', values: ['dialog'] },
      { name: 'as', type: 'string', description: 'HTML element to render as' },
    ],
    snippet: '<Box padding="space-4">\n  {/* Content */}\n</Box>',
  },
  {
    name: 'BoxNew',
    category: 'layout',
    import: '@navikt/ds-react',
    description: 'Enhanced container with full Darkside styling and asChild support',
    props: [
      { name: 'padding', type: 'SpacingScale', description: 'Padding around children' },
      { name: 'paddingInline', type: 'SpacingScale', description: 'Horizontal padding' },
      { name: 'paddingBlock', type: 'SpacingScale', description: 'Vertical padding' },
      { name: 'margin', type: 'SpacingScale', description: 'Margin around element' },
      { name: 'marginInline', type: 'SpacingScale', description: 'Horizontal margin' },
      { name: 'marginBlock', type: 'SpacingScale', description: 'Vertical margin' },
      { name: 'background', type: 'string', values: ['default', 'raised', 'sunken', 'inverted', 'neutral-subtle', 'neutral-moderate', 'neutral-strong'], description: 'Background color token' },
      { name: 'borderColor', type: 'string', values: ['neutral-subtleA', 'neutral-moderate', 'neutral-strong', 'focus', 'danger'], description: 'Border color token' },
      { name: 'borderRadius', type: 'string', values: ['small', 'medium', 'large', 'xlarge', 'full'], description: 'Border radius token' },
      { name: 'borderWidth', type: 'string', description: 'Border width (e.g., "0 0 1 0" for bottom border)' },
      { name: 'shadow', type: 'string', values: ['small', 'medium', 'large', 'xlarge'], description: 'Box shadow' },
      { name: 'width', type: 'string', description: 'CSS width or responsive prop' },
      { name: 'height', type: 'string', description: 'CSS height or responsive prop' },
      { name: 'minWidth', type: 'string', description: 'CSS min-width' },
      { name: 'maxWidth', type: 'string', description: 'CSS max-width' },
      { name: 'minHeight', type: 'string', description: 'CSS min-height' },
      { name: 'maxHeight', type: 'string', description: 'CSS max-height' },
      { name: 'position', type: '"static" | "relative" | "absolute" | "fixed" | "sticky"', values: ['static', 'relative', 'absolute', 'fixed', 'sticky'] },
      { name: 'overflow', type: '"hidden" | "auto" | "visible" | "clip" | "scroll"', values: ['hidden', 'auto', 'visible', 'clip', 'scroll'] },
      { name: 'asChild', type: 'boolean', description: 'Merge props with child element instead of wrapping' },
      { name: 'as', type: 'string', description: 'HTML element to render as' },
    ],
    snippet: '<BoxNew padding="space-4" background="default">\n  {/* Content */}\n</BoxNew>',
  },
  {
    name: 'Hide',
    category: 'layout',
    import: '@navikt/ds-react',
    description: 'Hide content at specific breakpoints',
    props: [
      { name: 'below', type: '"xs" | "sm" | "md" | "lg" | "xl"', values: ['xs', 'sm', 'md', 'lg', 'xl'], description: 'Hide below breakpoint' },
      { name: 'above', type: '"xs" | "sm" | "md" | "lg" | "xl"', values: ['xs', 'sm', 'md', 'lg', 'xl'], description: 'Hide above breakpoint' },
      { name: 'asChild', type: 'boolean', description: 'Merge with child element' },
    ],
    snippet: '<Hide below="md">\n  {/* Hidden on mobile */}\n</Hide>',
  },
  {
    name: 'Show',
    category: 'layout',
    import: '@navikt/ds-react',
    description: 'Show content at specific breakpoints',
    props: [
      { name: 'below', type: '"xs" | "sm" | "md" | "lg" | "xl"', values: ['xs', 'sm', 'md', 'lg', 'xl'], description: 'Show below breakpoint' },
      { name: 'above', type: '"xs" | "sm" | "md" | "lg" | "xl"', values: ['xs', 'sm', 'md', 'lg', 'xl'], description: 'Show above breakpoint' },
      { name: 'asChild', type: 'boolean', description: 'Merge with child element' },
    ],
    snippet: '<Show below="md">\n  {/* Visible on mobile only */}\n</Show>',
  },
  {
    name: 'Bleed',
    category: 'layout',
    import: '@navikt/ds-react',
    description: 'Break out of container padding',
    props: [
      { name: 'marginInline', type: 'SpacingScale', description: 'Horizontal bleed amount' },
      { name: 'marginBlock', type: 'SpacingScale', description: 'Vertical bleed amount' },
      { name: 'asChild', type: 'boolean', description: 'Merge with child element' },
    ],
    snippet: '<Bleed marginInline="space-4">\n  {/* Content that bleeds out */}\n</Bleed>',
  },
];

// ===== COMPONENT COMPONENTS =====

export const uiComponents: ComponentMetadata[] = [
  {
    name: 'Accordion',
    category: 'component',
    import: '@navikt/ds-react',
    description: 'Expandable content sections',
    props: [
      { name: 'variant', type: '"default" | "neutral"', values: ['default', 'neutral'] },
      { name: 'size', type: '"medium" | "small"', values: ['medium', 'small'], default: 'medium' },
    ],
    snippet: '<Accordion>\n  <Accordion.Item>\n    <Accordion.Header>Header</Accordion.Header>\n    <Accordion.Content>Content</Accordion.Content>\n  </Accordion.Item>\n</Accordion>',
  },
  {
    name: 'ActionMenu',
    category: 'component',
    import: '@navikt/ds-react',
    description: 'Dropdown menu for actions',
    props: [
      { name: 'variant', type: '"default" | "neutral"', values: ['default', 'neutral'] },
      { name: 'size', type: '"medium" | "small" | "xsmall"', values: ['medium', 'small', 'xsmall'], default: 'medium' },
      { name: 'placement', type: 'string', description: 'Popover placement' },
    ],
    snippet: '<ActionMenu>\n  <ActionMenu.Trigger>Actions</ActionMenu.Trigger>\n  <ActionMenu.Content>\n    <ActionMenu.Item>Item 1</ActionMenu.Item>\n  </ActionMenu.Content>\n</ActionMenu>',
  },
  {
    name: 'Alert',
    category: 'component',
    import: '@navikt/ds-react',
    description: 'Display important messages',
    props: [
      { name: 'variant', type: '"info" | "warning" | "error" | "success"', values: ['info', 'warning', 'error', 'success'], required: true },
      { name: 'size', type: '"medium" | "small"', values: ['medium', 'small'], default: 'medium' },
      { name: 'inline', type: 'boolean', description: 'Inline layout' },
      { name: 'closeButton', type: 'boolean', description: 'Show close button' },
    ],
    snippet: '<Alert variant="info">Alert message</Alert>',
  },
  {
    name: 'Button',
    category: 'component',
    import: '@navikt/ds-react',
    description: 'Clickable button for actions',
    props: [
      { name: 'variant', type: 'string', values: ['primary', 'primary-neutral', 'secondary', 'secondary-neutral', 'tertiary', 'tertiary-neutral', 'danger'], default: 'primary' },
      { name: 'size', type: '"medium" | "small" | "xsmall"', values: ['medium', 'small', 'xsmall'], default: 'medium' },
      { name: 'loading', type: 'boolean', description: 'Show loading state' },
      { name: 'disabled', type: 'boolean', description: 'Disable button' },
      { name: 'icon', type: 'ReactNode', description: 'Button icon' },
      { name: 'iconPosition', type: '"left" | "right"', values: ['left', 'right'], default: 'left' },
    ],
    snippet: '<Button>Click me</Button>',
  },
  {
    name: 'Chat',
    category: 'component',
    import: '@navikt/ds-react',
    description: 'Chat message bubbles',
    props: [
      { name: 'variant', type: '"left" | "right"', values: ['left', 'right'] },
      { name: 'avatar', type: 'string', description: 'Avatar image URL' },
      { name: 'name', type: 'string', description: 'Sender name' },
      { name: 'timestamp', type: 'string', description: 'Message timestamp' },
    ],
    snippet: '<Chat variant="left" name="User">\n  <Chat.Bubble>Message text</Chat.Bubble>\n</Chat>',
  },
  {
    name: 'Checkbox',
    category: 'component',
    import: '@navikt/ds-react',
    description: 'Checkbox input',
    props: [
      { name: 'checked', type: 'boolean', description: 'Checked state' },
      { name: 'indeterminate', type: 'boolean', description: 'Indeterminate state' },
      { name: 'size', type: '"medium" | "small"', values: ['medium', 'small'], default: 'medium' },
      { name: 'error', type: 'string', description: 'Error message' },
      { name: 'description', type: 'string', description: 'Helper text' },
    ],
    snippet: '<Checkbox>Checkbox label</Checkbox>',
  },
  {
    name: 'Chips',
    category: 'component',
    import: '@navikt/ds-react',
    description: 'Selectable chips/tags',
    props: [
      { name: 'variant', type: '"action" | "neutral"', values: ['action', 'neutral'], default: 'action' },
      { name: 'size', type: '"medium" | "small"', values: ['medium', 'small'], default: 'medium' },
      { name: 'selected', type: 'boolean', description: 'Selected state' },
    ],
    snippet: '<Chips>\n  <Chips.Toggle>Chip 1</Chips.Toggle>\n  <Chips.Toggle>Chip 2</Chips.Toggle>\n</Chips>',
  },
  {
    name: 'Combobox',
    category: 'component',
    import: '@navikt/ds-react',
    description: 'Searchable select dropdown',
    props: [
      { name: 'label', type: 'string', required: true, description: 'Input label' },
      { name: 'options', type: 'Array', required: true, description: 'Available options' },
      { name: 'size', type: '"medium" | "small"', values: ['medium', 'small'], default: 'medium' },
      { name: 'error', type: 'string', description: 'Error message' },
      { name: 'description', type: 'string', description: 'Helper text' },
    ],
    snippet: '<Combobox label="Select option" options={[]}>\n</Combobox>',
  },
  {
    name: 'CopyButton',
    category: 'component',
    import: '@navikt/ds-react',
    description: 'Button to copy text to clipboard',
    props: [
      { name: 'copyText', type: 'string', required: true, description: 'Text to copy' },
      { name: 'text', type: 'string', description: 'Button text' },
      { name: 'activeText', type: 'string', description: 'Text when copied' },
      { name: 'size', type: '"medium" | "small" | "xsmall"', values: ['medium', 'small', 'xsmall'], default: 'medium' },
      { name: 'variant', type: 'string', values: ['primary', 'secondary', 'tertiary'], default: 'primary' },
    ],
    snippet: '<CopyButton copyText="Text to copy" />',
  },
  {
    name: 'DatePicker',
    category: 'component',
    import: '@navikt/ds-react',
    description: 'Date selection input',
    props: [
      { name: 'label', type: 'string', description: 'Input label' },
      { name: 'fromDate', type: 'Date', description: 'Minimum selectable date' },
      { name: 'toDate', type: 'Date', description: 'Maximum selectable date' },
      { name: 'strategy', type: '"fixed" | "absolute"', values: ['fixed', 'absolute'] },
    ],
    snippet: '<DatePicker>\n  <DatePicker.Input label="Select date" />\n</DatePicker>',
  },
  {
    name: 'Dropdown',
    category: 'component',
    import: '@navikt/ds-react',
    description: 'Dropdown menu',
    props: [
      { name: 'placement', type: 'string', description: 'Menu placement' },
    ],
    snippet: '<Dropdown>\n  <Button as={Dropdown.Toggle}>Open menu</Button>\n  <Dropdown.Menu>\n    <Dropdown.Menu.List>\n      <Dropdown.Menu.List.Item>Item</Dropdown.Menu.List.Item>\n    </Dropdown.Menu.List>\n  </Dropdown.Menu>\n</Dropdown>',
  },
  {
    name: 'ErrorSummary',
    category: 'component',
    import: '@navikt/ds-react',
    description: 'Summary of form errors',
    props: [
      { name: 'heading', type: 'string', required: true, description: 'Error summary heading' },
      { name: 'size', type: '"medium" | "small"', values: ['medium', 'small'], default: 'medium' },
    ],
    snippet: '<ErrorSummary heading="Form has errors">\n  <ErrorSummary.Item href="#field">Error message</ErrorSummary.Item>\n</ErrorSummary>',
  },
  {
    name: 'ExpansionCard',
    category: 'component',
    import: '@navikt/ds-react',
    description: 'Expandable card component',
    props: [
      { name: 'size', type: '"medium" | "small"', values: ['medium', 'small'], default: 'medium' },
      { name: 'variant', type: '"default" | "subtle"', values: ['default', 'subtle'] },
    ],
    snippet: '<ExpansionCard>\n  <ExpansionCard.Header>\n    <ExpansionCard.Title>Title</ExpansionCard.Title>\n  </ExpansionCard.Header>\n  <ExpansionCard.Content>Content</ExpansionCard.Content>\n</ExpansionCard>',
  },
  {
    name: 'FileUpload',
    category: 'component',
    import: '@navikt/ds-react',
    description: 'File upload component',
    props: [
      { name: 'label', type: 'string', required: true, description: 'Upload label' },
      { name: 'accept', type: 'string', description: 'Accepted file types' },
      { name: 'multiple', type: 'boolean', description: 'Allow multiple files' },
      { name: 'error', type: 'string', description: 'Error message' },
    ],
    snippet: '<FileUpload label="Upload file">\n  <FileUpload.Dropzone />\n</FileUpload>',
  },
  {
    name: 'FormProgress',
    category: 'component',
    import: '@navikt/ds-react',
    description: 'Multi-step form progress indicator',
    props: [
      { name: 'activeStep', type: 'number', required: true, description: 'Current active step' },
      { name: 'totalSteps', type: 'number', required: true, description: 'Total number of steps' },
      { name: 'translations', type: 'object', description: 'Text translations' },
    ],
    snippet: '<FormProgress totalSteps={3} activeStep={1}>\n  <FormProgress.Step>Step 1</FormProgress.Step>\n  <FormProgress.Step>Step 2</FormProgress.Step>\n  <FormProgress.Step>Step 3</FormProgress.Step>\n</FormProgress>',
  },
  {
    name: 'FormSummary',
    category: 'component',
    import: '@navikt/ds-react',
    description: 'Form submission summary',
    props: [
      { name: 'heading', type: 'string', description: 'Summary heading' },
    ],
    snippet: '<FormSummary>\n  <FormSummary.Header>\n    <FormSummary.Heading>Summary</FormSummary.Heading>\n  </FormSummary.Header>\n  <FormSummary.Answers>\n    <FormSummary.Answer>\n      <FormSummary.Label>Label</FormSummary.Label>\n      <FormSummary.Value>Value</FormSummary.Value>\n    </FormSummary.Answer>\n  </FormSummary.Answers>\n</FormSummary>',
  },
  {
    name: 'GuidePanel',
    category: 'component',
    import: '@navikt/ds-react',
    description: 'Informational guide panel',
    props: [
      { name: 'poster', type: 'boolean', description: 'Show as poster variant' },
    ],
    snippet: '<GuidePanel>\n  Guide content\n</GuidePanel>',
  },
  {
    name: 'HelpText',
    category: 'component',
    import: '@navikt/ds-react',
    description: 'Contextual help tooltip',
    props: [
      { name: 'title', type: 'string', required: true, description: 'Help text title' },
      { name: 'placement', type: 'string', description: 'Popover placement' },
    ],
    snippet: '<HelpText title="Help title">Help content</HelpText>',
  },
  {
    name: 'InternalHeader',
    category: 'component',
    import: '@navikt/ds-react',
    description: 'Internal application header',
    props: [],
    snippet: '<InternalHeader>\n  <InternalHeader.Title>App Title</InternalHeader.Title>\n</InternalHeader>',
  },
  {
    name: 'Link',
    category: 'component',
    import: '@navikt/ds-react',
    description: 'Styled link component',
    props: [
      { name: 'href', type: 'string', required: true, description: 'Link URL' },
      { name: 'variant', type: '"action" | "neutral"', values: ['action', 'neutral'], default: 'action' },
      { name: 'underline', type: 'boolean', description: 'Show underline', default: 'true' },
    ],
    snippet: '<Link href="#">Link text</Link>',
  },
  {
    name: 'LinkCard',
    category: 'component',
    import: '@navikt/ds-react',
    description: 'Clickable card link',
    props: [
      { name: 'arrow', type: 'boolean', description: 'Show arrow icon', default: 'true' },
      { name: 'arrowPosition', type: 'string', values: ['baseline', 'center'], default: 'baseline', description: 'Adjusts arrow position' },
      { name: 'size', type: 'string', values: ['small', 'medium'], default: 'medium', description: 'Changes padding and typo sizes' },
      { name: 'className', type: 'string', description: 'Additional CSS class names' },
      { name: 'data-color', type: 'string', values: ['neutral', 'accent', 'success', 'warning', 'danger', 'info'], description: 'Color theme for the card' },
    ],
    snippet: '<LinkCard>\n  <LinkCard.Title>\n    <LinkCard.Anchor href="">Datasikkerheit er ivareteken gjennom kryptert overføring.</LinkCard.Anchor>\n  </LinkCard.Title>\n  <LinkCard.Description>\n    I samband med systemvedlikehald kan tenesta vere utilgjengeleg sundag mellom klokka 22 og 02. Planlagde avbrot vert varsla på framsida minst 48 timar før nedetid tek til å gjelde.\n  </LinkCard.Description>\n</LinkCard>',
  },
  {
    name: 'List',
    category: 'component',
    import: '@navikt/ds-react',
    description: 'Styled list component',
    props: [
      { name: 'as', type: '"ul" | "ol"', values: ['ul', 'ol'], default: 'ul' },
      { name: 'size', type: '"medium" | "small"', values: ['medium', 'small'], default: 'medium' },
    ],
    snippet: '<List>\n  <List.Item>Item 1</List.Item>\n  <List.Item>Item 2</List.Item>\n</List>',
  },
  {
    name: 'Loader',
    category: 'component',
    import: '@navikt/ds-react',
    description: 'Loading spinner',
    props: [
      { name: 'size', type: '"3xlarge" | "2xlarge" | "xlarge" | "large" | "medium" | "small" | "xsmall"', values: ['3xlarge', '2xlarge', 'xlarge', 'large', 'medium', 'small', 'xsmall'], default: 'medium' },
      { name: 'title', type: 'string', description: 'Loading message' },
      { name: 'variant', type: '"interaction" | "inverted" | "neutral"', values: ['interaction', 'inverted', 'neutral'], default: 'interaction' },
    ],
    snippet: '<Loader title="Loading..." />',
  },
  {
    name: 'Modal',
    category: 'component',
    import: '@navikt/ds-react',
    description: 'Modal dialog',
    props: [
      { name: 'open', type: 'boolean', required: true, description: 'Modal open state' },
      { name: 'onClose', type: 'function', description: 'Close handler' },
      { name: 'width', type: '"small" | "medium"', values: ['small', 'medium'] },
      { name: 'closeOnBackdropClick', type: 'boolean', description: 'Close on backdrop click' },
    ],
    snippet: '<Modal open={false} onClose={() => {}}>\n  <Modal.Header>\n    <Modal.Title>Modal title</Modal.Title>\n  </Modal.Header>\n  <Modal.Body>Modal content</Modal.Body>\n</Modal>',
  },
  {
    name: 'MonthPicker',
    category: 'component',
    import: '@navikt/ds-react',
    description: 'Month selection input',
    props: [
      { name: 'fromDate', type: 'Date', description: 'Minimum selectable date' },
      { name: 'toDate', type: 'Date', description: 'Maximum selectable date' },
    ],
    snippet: '<MonthPicker>\n  <MonthPicker.Input label="Select month" />\n</MonthPicker>',
  },
  {
    name: 'Pagination',
    category: 'component',
    import: '@navikt/ds-react',
    description: 'Pagination controls',
    props: [
      { name: 'page', type: 'number', required: true, description: 'Current page' },
      { name: 'count', type: 'number', required: true, description: 'Total pages' },
      { name: 'onPageChange', type: 'function', required: true, description: 'Page change handler' },
      { name: 'size', type: '"medium" | "small" | "xsmall"', values: ['medium', 'small', 'xsmall'], default: 'medium' },
    ],
    snippet: '<Pagination page={1} count={10} onPageChange={() => {}} />',
  },
  {
    name: 'Popover',
    category: 'component',
    import: '@navikt/ds-react',
    description: 'Popover overlay',
    props: [
      { name: 'open', type: 'boolean', description: 'Popover open state' },
      { name: 'onClose', type: 'function', description: 'Close handler' },
      { name: 'placement', type: 'string', description: 'Popover placement' },
      { name: 'arrow', type: 'boolean', description: 'Show arrow', default: 'true' },
    ],
    snippet: '<Popover open={false} onClose={() => {}}>\n  <Popover.Trigger>Open</Popover.Trigger>\n  <Popover.Content>Content</Popover.Content>\n</Popover>',
  },
  {
    name: 'Process',
    category: 'component',
    import: '@navikt/ds-react',
    description: 'Process steps indicator',
    props: [
      { name: 'activeStep', type: 'number', description: 'Current active step' },
    ],
    snippet: '<Process>\n  <Process.Step>Step 1</Process.Step>\n  <Process.Step>Step 2</Process.Step>\n</Process>',
  },
  {
    name: 'ProgressBar',
    category: 'component',
    import: '@navikt/ds-react',
    description: 'Progress indicator bar',
    props: [
      { name: 'value', type: 'number', required: true, description: 'Progress value (0-100)' },
      { name: 'variant', type: '"default" | "success" | "warning" | "info"', values: ['default', 'success', 'warning', 'info'], default: 'default' },
      { name: 'size', type: '"medium" | "small"', values: ['medium', 'small'], default: 'medium' },
    ],
    snippet: '<ProgressBar value={50}>50%</ProgressBar>',
  },
  {
    name: 'Radio',
    category: 'component',
    import: '@navikt/ds-react',
    description: 'Radio button input',
    props: [
      { name: 'value', type: 'string', required: true, description: 'Radio value' },
      { name: 'size', type: '"medium" | "small"', values: ['medium', 'small'], default: 'medium' },
      { name: 'description', type: 'string', description: 'Helper text' },
    ],
    snippet: '<Radio.Group legend="Choose option">\n  <Radio value="1">Option 1</Radio>\n  <Radio value="2">Option 2</Radio>\n</Radio.Group>',
  },
  {
    name: 'ReadMore',
    category: 'component',
    import: '@navikt/ds-react',
    description: 'Expandable read more section',
    props: [
      { name: 'header', type: 'string', required: true, description: 'Expandable header text' },
      { name: 'size', type: '"medium" | "small"', values: ['medium', 'small'], default: 'medium' },
    ],
    snippet: '<ReadMore header="Read more">\n  Hidden content\n</ReadMore>',
  },
  {
    name: 'Search',
    category: 'component',
    import: '@navikt/ds-react',
    description: 'Search input field',
    props: [
      { name: 'label', type: 'string', required: true, description: 'Search label' },
      { name: 'variant', type: '"primary" | "secondary" | "simple"', values: ['primary', 'secondary', 'simple'], default: 'primary' },
      { name: 'size', type: '"medium" | "small"', values: ['medium', 'small'], default: 'medium' },
      { name: 'clearButton', type: 'boolean', description: 'Show clear button', default: 'true' },
    ],
    snippet: '<Search label="Search" />',
  },
  {
    name: 'Select',
    category: 'component',
    import: '@navikt/ds-react',
    description: 'Select dropdown',
    props: [
      { name: 'label', type: 'string', required: true, description: 'Select label' },
      { name: 'size', type: '"medium" | "small"', values: ['medium', 'small'], default: 'medium' },
      { name: 'error', type: 'string', description: 'Error message' },
      { name: 'description', type: 'string', description: 'Helper text' },
    ],
    snippet: '<Select label="Select option">\n  <option value="">Choose</option>\n  <option value="1">Option 1</option>\n</Select>',
  },
  {
    name: 'Skeleton',
    category: 'component',
    import: '@navikt/ds-react',
    description: 'Loading skeleton placeholder',
    props: [
      { name: 'variant', type: '"text" | "circle" | "rectangle" | "rounded"', values: ['text', 'circle', 'rectangle', 'rounded'], default: 'text' },
      { name: 'width', type: 'string | number', description: 'Skeleton width' },
      { name: 'height', type: 'string | number', description: 'Skeleton height' },
    ],
    snippet: '<Skeleton variant="text" width="100%" />',
  },
  {
    name: 'Stepper',
    category: 'component',
    import: '@navikt/ds-react',
    description: 'Step-by-step wizard',
    props: [
      { name: 'activeStep', type: 'number', required: true, description: 'Current active step' },
      { name: 'onStepChange', type: 'function', description: 'Step change handler' },
      { name: 'orientation', type: '"horizontal" | "vertical"', values: ['horizontal', 'vertical'], default: 'horizontal' },
    ],
    snippet: '<Stepper activeStep={0}>\n  <Stepper.Step>Step 1</Stepper.Step>\n  <Stepper.Step>Step 2</Stepper.Step>\n</Stepper>',
  },
  {
    name: 'Switch',
    category: 'component',
    import: '@navikt/ds-react',
    description: 'Toggle switch',
    props: [
      { name: 'checked', type: 'boolean', description: 'Switch state' },
      { name: 'size', type: '"medium" | "small"', values: ['medium', 'small'], default: 'medium' },
      { name: 'description', type: 'string', description: 'Helper text' },
    ],
    snippet: '<Switch>Toggle label</Switch>',
  },
  {
    name: 'Table',
    category: 'component',
    import: '@navikt/ds-react',
    description: 'Data table',
    props: [
      { name: 'size', type: '"medium" | "small"', values: ['medium', 'small'], default: 'medium' },
      { name: 'zebraStripes', type: 'boolean', description: 'Alternating row colors' },
      { name: 'sort', type: 'object', description: 'Sort configuration' },
    ],
    snippet: '<Table>\n  <Table.Header>\n    <Table.Row>\n      <Table.HeaderCell>Header</Table.HeaderCell>\n    </Table.Row>\n  </Table.Header>\n  <Table.Body>\n    <Table.Row>\n      <Table.DataCell>Data</Table.DataCell>\n    </Table.Row>\n  </Table.Body>\n</Table>',
  },
  {
    name: 'Tabs',
    category: 'component',
    import: '@navikt/ds-react',
    description: 'Tab navigation',
    props: [
      { name: 'value', type: 'string', required: true, description: 'Active tab value' },
      { name: 'onChange', type: 'function', description: 'Tab change handler' },
      { name: 'size', type: '"medium" | "small"', values: ['medium', 'small'], default: 'medium' },
    ],
    snippet: '<Tabs value="tab1">\n  <Tabs.List>\n    <Tabs.Tab value="tab1" label="Tab 1" />\n    <Tabs.Tab value="tab2" label="Tab 2" />\n  </Tabs.List>\n  <Tabs.Panel value="tab1">Content 1</Tabs.Panel>\n  <Tabs.Panel value="tab2">Content 2</Tabs.Panel>\n</Tabs>',
  },
  {
    name: 'Tag',
    category: 'component',
    import: '@navikt/ds-react',
    description: 'Tag label component',
    props: [
      { name: 'variant', type: 'string', values: ['info', 'success', 'warning', 'error', 'alt1', 'alt2', 'alt3', 'neutral'], default: 'info' },
      { name: 'size', type: '"medium" | "small" | "xsmall"', values: ['medium', 'small', 'xsmall'], default: 'medium' },
    ],
    snippet: '<Tag variant="info">Tag label</Tag>',
  },
  {
    name: 'Textarea',
    category: 'component',
    import: '@navikt/ds-react',
    description: 'Multi-line text input',
    props: [
      { name: 'label', type: 'string', required: true, description: 'Input label' },
      { name: 'value', type: 'string', description: 'Input value' },
      { name: 'size', type: '"medium" | "small"', values: ['medium', 'small'], default: 'medium' },
      { name: 'error', type: 'string', description: 'Error message' },
      { name: 'description', type: 'string', description: 'Helper text' },
      { name: 'maxLength', type: 'number', description: 'Maximum character length' },
    ],
    snippet: '<Textarea label="Enter text" />',
  },
  {
    name: 'TextField',
    category: 'component',
    import: '@navikt/ds-react',
    description: 'Single-line text input',
    props: [
      { name: 'label', type: 'string', required: true, description: 'Input label' },
      { name: 'type', type: 'string', description: 'Input type (text, email, password, etc.)' },
      { name: 'value', type: 'string', description: 'Input value' },
      { name: 'size', type: '"medium" | "small"', values: ['medium', 'small'], default: 'medium' },
      { name: 'error', type: 'string', description: 'Error message' },
      { name: 'description', type: 'string', description: 'Helper text' },
    ],
    snippet: '<TextField label="Enter text" />',
  },
  {
    name: 'Timeline',
    category: 'component',
    import: '@navikt/ds-react',
    description: 'Timeline component',
    props: [],
    snippet: '<Timeline>\n  <Timeline.Row>\n    <Timeline.Period>Period</Timeline.Period>\n    <Timeline.Pin />\n    <Timeline.Content>Content</Timeline.Content>\n  </Timeline.Row>\n</Timeline>',
  },
  {
    name: 'ToggleGroup',
    category: 'component',
    import: '@navikt/ds-react',
    description: 'Toggle button group',
    props: [
      { name: 'value', type: 'string', description: 'Selected value' },
      { name: 'onChange', type: 'function', description: 'Change handler' },
      { name: 'size', type: '"medium" | "small"', values: ['medium', 'small'], default: 'medium' },
      { name: 'variant', type: '"action" | "neutral"', values: ['action', 'neutral'], default: 'action' },
    ],
    snippet: '<ToggleGroup value="">\n  <ToggleGroup.Item value="1">Option 1</ToggleGroup.Item>\n  <ToggleGroup.Item value="2">Option 2</ToggleGroup.Item>\n</ToggleGroup>',
  },
  {
    name: 'Tooltip',
    category: 'component',
    import: '@navikt/ds-react',
    description: 'Tooltip overlay',
    props: [
      { name: 'content', type: 'string', required: true, description: 'Tooltip content' },
      { name: 'placement', type: 'string', description: 'Tooltip placement' },
      { name: 'delay', type: 'number', description: 'Show delay in ms', default: '150' },
    ],
    snippet: '<Tooltip content="Tooltip text">\n  <span>Hover me</span>\n</Tooltip>',
  },
  // Typography components
  {
    name: 'Heading',
    category: 'component',
    import: '@navikt/ds-react',
    description: 'Heading text',
    props: [
      { name: 'level', type: '"1" | "2" | "3" | "4" | "5"', values: ['1', '2', '3', '4', '5'], required: true },
      { name: 'size', type: 'string', values: ['xlarge', 'large', 'medium', 'small', 'xsmall'] },
      { name: 'spacing', type: 'boolean', description: 'Add bottom margin' },
    ],
    snippet: '<Heading level="1" size="large">Heading text</Heading>',
  },
  {
    name: 'BodyLong',
    category: 'component',
    import: '@navikt/ds-react',
    description: 'Long body text with optimized line height',
    props: [
      { name: 'size', type: '"large" | "medium" | "small"', values: ['large', 'medium', 'small'], default: 'medium' },
      { name: 'spacing', type: 'boolean', description: 'Add bottom margin' },
      { name: 'weight', type: '"regular" | "semibold"', values: ['regular', 'semibold'] },
    ],
    snippet: '<BodyLong>Body text</BodyLong>',
  },
  {
    name: 'BodyShort',
    category: 'component',
    import: '@navikt/ds-react',
    description: 'Short body text with compact line height',
    props: [
      { name: 'size', type: '"large" | "medium" | "small"', values: ['large', 'medium', 'small'], default: 'medium' },
      { name: 'spacing', type: 'boolean', description: 'Add bottom margin' },
      { name: 'weight', type: '"regular" | "semibold"', values: ['regular', 'semibold'] },
    ],
    snippet: '<BodyShort>Short text</BodyShort>',
  },
  {
    name: 'Label',
    category: 'component',
    import: '@navikt/ds-react',
    description: 'Label text',
    props: [
      { name: 'size', type: '"large" | "medium" | "small"', values: ['large', 'medium', 'small'], default: 'medium' },
      { name: 'spacing', type: 'boolean', description: 'Add bottom margin' },
      { name: 'as', type: 'string', description: 'HTML element to render' },
    ],
    snippet: '<Label>Label text</Label>',
  },
  {
    name: 'Detail',
    category: 'component',
    import: '@navikt/ds-react',
    description: 'Small detail text',
    props: [
      { name: 'size', type: '"large" | "medium" | "small"', values: ['large', 'medium', 'small'], default: 'medium' },
      { name: 'spacing', type: 'boolean', description: 'Add bottom margin' },
      { name: 'uppercase', type: 'boolean', description: 'Transform to uppercase' },
    ],
    snippet: '<Detail>Detail text</Detail>',
  },
  {
    name: 'ErrorMessage',
    category: 'component',
    import: '@navikt/ds-react',
    description: 'Error message text',
    props: [
      { name: 'size', type: '"medium" | "small"', values: ['medium', 'small'], default: 'medium' },
      { name: 'spacing', type: 'boolean', description: 'Add bottom margin' },
    ],
    snippet: '<ErrorMessage>Error message</ErrorMessage>',
  },
];

// Combined export
export const allComponents: ComponentMetadata[] = [
  ...layoutComponents,
  ...uiComponents,
];

// Helper functions
export const getComponentsByCategory = (category: 'layout' | 'component'): ComponentMetadata[] => {
  return allComponents.filter(c => c.category === category);
};

export const searchComponents = (query: string): ComponentMetadata[] => {
  const lowerQuery = query.toLowerCase();
  return allComponents.filter(c =>
    c.name.toLowerCase().includes(lowerQuery) ||
    c.description?.toLowerCase().includes(lowerQuery)
  );
};
