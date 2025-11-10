/**
 * Aksel Darkside Component Metadata
 * 
 * Accurate prop definitions for autocomplete, sourced from official Aksel documentation.
 * Last updated: 2025-11-09
 * 
 * Sources:
 * - Button: https://aksel.nav.no/komponenter/core/button
 * - TextField: https://aksel.nav.no/komponenter/core/textfield
 * - Select: https://aksel.nav.no/komponenter/core/select
 * - Checkbox: https://aksel.nav.no/komponenter/core/checkbox
 */

export interface PropDefinition {
  name: string
  type: string
  values?: string[] // Valid enum values if applicable
  description?: string
  required?: boolean
}

export interface ComponentMetadata {
  name: string
  props: PropDefinition[]
  description: string
}

export const AKSEL_COMPONENTS: Record<string, ComponentMetadata> = {
  Button: {
    name: 'Button',
    description: 'Action button with variants and sizes',
    props: [
      {
        name: 'variant',
        type: 'string',
        values: [
          'primary',
          'primary-neutral',
          'secondary',
          'secondary-neutral',
          'tertiary',
          'tertiary-neutral',
          'danger',
        ],
        description: 'Button style variant',
      },
      {
        name: 'size',
        type: 'string',
        values: ['medium', 'small', 'xsmall'],
        description: 'Button size (height and font-size)',
      },
      {
        name: 'loading',
        type: 'boolean',
        values: ['true', 'false'],
        description: 'Shows loader and disables button',
      },
      {
        name: 'disabled',
        type: 'boolean',
        values: ['true', 'false'],
        description: 'Disables button interaction',
      },
      {
        name: 'icon',
        type: 'ReactNode',
        description: 'Icon element to display',
      },
      {
        name: 'iconPosition',
        type: 'string',
        values: ['left', 'right'],
        description: 'Position of icon',
      },
      {
        name: 'type',
        type: 'string',
        values: ['button', 'submit', 'reset'],
        description: 'HTML button type',
      },
    ],
  },

  TextField: {
    name: 'TextField',
    description: 'Text input field with label',
    props: [
      {
        name: 'label',
        type: 'ReactNode',
        required: true,
        description: 'Input label',
      },
      {
        name: 'size',
        type: 'string',
        values: ['medium', 'small'],
        description: 'Input size',
      },
      {
        name: 'type',
        type: 'string',
        values: ['text', 'email', 'password', 'tel', 'url', 'time', 'number'],
        description: 'HTML input type',
      },
      {
        name: 'error',
        type: 'ReactNode',
        description: 'Error message to display',
      },
      {
        name: 'disabled',
        type: 'boolean',
        values: ['true', 'false'],
        description: 'Disables input',
      },
      {
        name: 'readOnly',
        type: 'boolean',
        values: ['true', 'false'],
        description: 'Makes input read-only',
      },
      {
        name: 'hideLabel',
        type: 'boolean',
        values: ['true', 'false'],
        description: 'Hides label visually (still accessible)',
      },
      {
        name: 'description',
        type: 'ReactNode',
        description: 'Additional description text',
      },
      {
        name: 'htmlSize',
        type: 'number',
        description: 'HTML size attribute',
      },
      {
        name: 'placeholder',
        type: 'string',
        description: 'Placeholder text (not recommended)',
      },
    ],
  },

  Select: {
    name: 'Select',
    description: 'Dropdown select menu',
    props: [
      {
        name: 'label',
        type: 'ReactNode',
        required: true,
        description: 'Select label',
      },
      {
        name: 'size',
        type: 'string',
        values: ['medium', 'small'],
        description: 'Select size',
      },
      {
        name: 'error',
        type: 'ReactNode',
        description: 'Error message to display',
      },
      {
        name: 'disabled',
        type: 'boolean',
        values: ['true', 'false'],
        description: 'Disables select',
      },
      {
        name: 'readOnly',
        type: 'boolean',
        values: ['true', 'false'],
        description: 'Makes select read-only',
      },
      {
        name: 'hideLabel',
        type: 'boolean',
        values: ['true', 'false'],
        description: 'Hides label visually (still accessible)',
      },
      {
        name: 'description',
        type: 'ReactNode',
        description: 'Additional description text',
      },
      {
        name: 'htmlSize',
        type: 'number',
        description: 'HTML size attribute',
      },
    ],
  },

  Checkbox: {
    name: 'Checkbox',
    description: 'Checkbox input with label',
    props: [
      {
        name: 'size',
        type: 'string',
        values: ['medium', 'small'],
        description: 'Checkbox size',
      },
      {
        name: 'error',
        type: 'boolean',
        values: ['true', 'false'],
        description: 'Shows error indication',
      },
      {
        name: 'disabled',
        type: 'boolean',
        values: ['true', 'false'],
        description: 'Disables checkbox',
      },
      {
        name: 'readOnly',
        type: 'boolean',
        values: ['true', 'false'],
        description: 'Makes checkbox read-only',
      },
      {
        name: 'hideLabel',
        type: 'boolean',
        values: ['true', 'false'],
        description: 'Hides label visually (still accessible)',
      },
      {
        name: 'indeterminate',
        type: 'boolean',
        values: ['true', 'false'],
        description: 'Indeterminate state',
      },
      {
        name: 'description',
        type: 'string',
        description: 'Additional description text',
      },
    ],
  },

  Radio: {
    name: 'Radio',
    description: 'Radio button input',
    props: [
      {
        name: 'name',
        type: 'string',
        description: 'Radio group name',
      },
      {
        name: 'size',
        type: 'string',
        values: ['medium', 'small'],
        description: 'Radio size',
      },
      {
        name: 'disabled',
        type: 'boolean',
        values: ['true', 'false'],
        description: 'Disables radio',
      },
      {
        name: 'readOnly',
        type: 'boolean',
        values: ['true', 'false'],
        description: 'Makes radio read-only',
      },
      {
        name: 'hideLabel',
        type: 'boolean',
        values: ['true', 'false'],
        description: 'Hides label visually (still accessible)',
      },
      {
        name: 'description',
        type: 'string',
        description: 'Additional description text',
      },
    ],
  },

  Box: {
    name: 'Box',
    description: 'Layout container with spacing control',
    props: [
      {
        name: 'padding',
        type: 'string',
        values: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '10', '12', '16', '20', '24', '32'],
        description: 'Padding using design tokens',
      },
      {
        name: 'paddingBlock',
        type: 'string',
        values: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '10', '12', '16', '20', '24', '32'],
        description: 'Vertical padding',
      },
      {
        name: 'paddingInline',
        type: 'string',
        values: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '10', '12', '16', '20', '24', '32'],
        description: 'Horizontal padding',
      },
      {
        name: 'background',
        type: 'string',
        values: ['surface-default', 'surface-subtle', 'surface-neutral-subtle'],
        description: 'Background color',
      },
      {
        name: 'borderRadius',
        type: 'string',
        values: ['small', 'medium', 'large', 'xlarge', 'full'],
        description: 'Border radius',
      },
      {
        name: 'borderWidth',
        type: 'string',
        values: ['1', '2'],
        description: 'Border width',
      },
      {
        name: 'borderColor',
        type: 'string',
        values: ['border-default', 'border-subtle', 'border-strong'],
        description: 'Border color',
      },
      {
        name: 'shadow',
        type: 'string',
        values: ['xsmall', 'small', 'medium', 'large', 'xlarge'],
        description: 'Box shadow',
      },
    ],
  },

  Stack: {
    name: 'Stack',
    description: 'Vertical layout with gap spacing',
    props: [
      {
        name: 'gap',
        type: 'string',
        values: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '10', '12', '16', '20', '24', '32'],
        description: 'Gap between items',
      },
      {
        name: 'align',
        type: 'string',
        values: ['start', 'center', 'end', 'stretch'],
        description: 'Align items',
      },
      {
        name: 'justify',
        type: 'string',
        values: ['start', 'center', 'end', 'space-between', 'space-around', 'space-evenly'],
        description: 'Justify content',
      },
      {
        name: 'direction',
        type: 'string',
        values: ['column', 'column-reverse'],
        description: 'Stack direction',
      },
      {
        name: 'wrap',
        type: 'boolean',
        values: ['true', 'false'],
        description: 'Enable wrapping',
      },
    ],
  },

  Grid: {
    name: 'Grid',
    description: 'Responsive grid layout',
    props: [
      {
        name: 'columns',
        type: 'string | object',
        description: 'Number of columns or responsive object',
      },
      {
        name: 'gap',
        type: 'string',
        values: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '10', '12', '16', '20', '24', '32'],
        description: 'Gap between items',
      },
    ],
  },

  // Layout Components
  Page: {
    name: 'Page',
    description: 'Main page container with responsive layout',
    props: [
      {
        name: 'background',
        type: 'string',
        description: 'Background color token',
      },
      {
        name: 'contentWrapper',
        type: 'boolean',
        values: ['true', 'false'],
        description: 'Wrap content with max-width',
      },
      {
        name: 'footer',
        type: 'ReactNode',
        description: 'Footer content',
      },
      {
        name: 'footerPosition',
        type: 'string',
        values: ['fixed', 'relative'],
        description: 'Footer positioning',
      },
    ],
  },

  'Page.Block': {
    name: 'Page.Block',
    description: 'Page content block with predefined max-width',
    props: [
      {
        name: 'width',
        type: 'string',
        values: ['text', 'md', 'lg', 'xl', '2xl'],
        description: 'Predefined max-width (text: 576px, md: 768px, lg: 1024px, xl: 1280px, 2xl: 1440px)',
      },
      {
        name: 'gutters',
        type: 'boolean',
        values: ['true', 'false'],
        description: 'Adds standardised responsive padding-inline',
      },
      {
        name: 'className',
        type: 'string',
        description: 'Additional CSS class names',
      },
      {
        name: 'as',
        type: 'string',
        description: 'OverridableComponent-api - element type to render as',
      },
    ],
  },

  HGrid: {
    name: 'HGrid',
    description: 'Horizontal grid layout with responsive columns',
    props: [
      {
        name: 'columns',
        type: 'number | string | ResponsiveProp<string>',
        description: 'Grid column definition',
      },
      {
        name: 'gap',
        type: 'string',
        values: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '10', '12', '16', '20', '24', '32'],
        description: 'Gap between grid items',
      },
      {
        name: 'align',
        type: 'string',
        values: ['start', 'center', 'end', 'stretch'],
        description: 'Vertical alignment',
      },
    ],
  },

  HStack: {
    name: 'HStack',
    description: 'Horizontal stack with flexbox',
    props: [
      {
        name: 'gap',
        type: 'string',
        values: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '10', '12', '16', '20', '24', '32'],
        description: 'Space between items',
      },
      {
        name: 'align',
        type: 'string',
        values: ['start', 'center', 'end', 'baseline', 'stretch'],
        description: 'Vertical alignment',
      },
      {
        name: 'justify',
        type: 'string',
        values: ['start', 'center', 'end', 'space-around', 'space-between', 'space-evenly'],
        description: 'Horizontal alignment',
      },
      {
        name: 'wrap',
        type: 'boolean',
        values: ['true', 'false'],
        description: 'Enable flex-wrap',
      },
    ],
  },

  VStack: {
    name: 'VStack',
    description: 'Vertical stack with flexbox',
    props: [
      {
        name: 'gap',
        type: 'string',
        values: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '10', '12', '16', '20', '24', '32'],
        description: 'Space between items',
      },
      {
        name: 'align',
        type: 'string',
        values: ['start', 'center', 'end', 'stretch'],
        description: 'Horizontal alignment',
      },
      {
        name: 'justify',
        type: 'string',
        values: ['start', 'center', 'end', 'space-around', 'space-between', 'space-evenly'],
        description: 'Vertical alignment',
      },
    ],
  },

  Hide: {
    name: 'Hide',
    description: 'Hide content at specific breakpoints',
    props: [
      {
        name: 'below',
        type: 'string',
        values: ['xs', 'sm', 'md', 'lg', 'xl'],
        description: 'Hide below breakpoint',
      },
      {
        name: 'above',
        type: 'string',
        values: ['xs', 'sm', 'md', 'lg', 'xl'],
        description: 'Hide above breakpoint',
      },
      {
        name: 'asChild',
        type: 'boolean',
        values: ['true', 'false'],
        description: 'Merge with child element',
      },
    ],
  },

  Show: {
    name: 'Show',
    description: 'Show content at specific breakpoints',
    props: [
      {
        name: 'below',
        type: 'string',
        values: ['xs', 'sm', 'md', 'lg', 'xl'],
        description: 'Show below breakpoint',
      },
      {
        name: 'above',
        type: 'string',
        values: ['xs', 'sm', 'md', 'lg', 'xl'],
        description: 'Show above breakpoint',
      },
      {
        name: 'asChild',
        type: 'boolean',
        values: ['true', 'false'],
        description: 'Merge with child element',
      },
    ],
  },

  Bleed: {
    name: 'Bleed',
    description: 'Break out of container padding',
    props: [
      {
        name: 'marginInline',
        type: 'string',
        values: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '10', '12', '16', '20', '24', '32'],
        description: 'Horizontal bleed amount',
      },
      {
        name: 'marginBlock',
        type: 'string',
        values: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '10', '12', '16', '20', '24', '32'],
        description: 'Vertical bleed amount',
      },
      {
        name: 'asChild',
        type: 'boolean',
        values: ['true', 'false'],
        description: 'Merge with child element',
      },
    ],
  },

  // UI Components
  Accordion: {
    name: 'Accordion',
    description: 'Expandable content sections',
    props: [
      {
        name: 'variant',
        type: 'string',
        values: ['default', 'neutral'],
        description: 'Accordion style variant',
      },
      {
        name: 'size',
        type: 'string',
        values: ['medium', 'small'],
        description: 'Accordion size',
      },
    ],
  },

  ActionMenu: {
    name: 'ActionMenu',
    description: 'Dropdown menu for actions',
    props: [
      {
        name: 'variant',
        type: 'string',
        values: ['default', 'neutral'],
        description: 'Menu style variant',
      },
      {
        name: 'size',
        type: 'string',
        values: ['medium', 'small', 'xsmall'],
        description: 'Menu size',
      },
      {
        name: 'placement',
        type: 'string',
        description: 'Popover placement',
      },
    ],
  },

  Alert: {
    name: 'Alert',
    description: 'Display important messages',
    props: [
      {
        name: 'variant',
        type: 'string',
        values: ['info', 'warning', 'error', 'success'],
        required: true,
        description: 'Alert type',
      },
      {
        name: 'size',
        type: 'string',
        values: ['medium', 'small'],
        description: 'Alert size',
      },
      {
        name: 'inline',
        type: 'boolean',
        values: ['true', 'false'],
        description: 'Inline layout',
      },
      {
        name: 'closeButton',
        type: 'boolean',
        values: ['true', 'false'],
        description: 'Show close button',
      },
    ],
  },

  Chat: {
    name: 'Chat',
    description: 'Chat message bubbles',
    props: [
      {
        name: 'variant',
        type: 'string',
        values: ['left', 'right'],
        description: 'Message alignment',
      },
      {
        name: 'avatar',
        type: 'string',
        description: 'Avatar image URL',
      },
      {
        name: 'name',
        type: 'string',
        description: 'Sender name',
      },
      {
        name: 'timestamp',
        type: 'string',
        description: 'Message timestamp',
      },
    ],
  },

  Chips: {
    name: 'Chips',
    description: 'Selectable chips/tags',
    props: [
      {
        name: 'variant',
        type: 'string',
        values: ['action', 'neutral'],
        description: 'Chips style',
      },
      {
        name: 'size',
        type: 'string',
        values: ['medium', 'small'],
        description: 'Chips size',
      },
      {
        name: 'selected',
        type: 'boolean',
        values: ['true', 'false'],
        description: 'Selected state',
      },
    ],
  },

  Combobox: {
    name: 'Combobox',
    description: 'Searchable select dropdown',
    props: [
      {
        name: 'label',
        type: 'string',
        required: true,
        description: 'Input label',
      },
      {
        name: 'options',
        type: 'Array',
        required: true,
        description: 'Available options',
      },
      {
        name: 'size',
        type: 'string',
        values: ['medium', 'small'],
        description: 'Input size',
      },
      {
        name: 'error',
        type: 'string',
        description: 'Error message',
      },
      {
        name: 'description',
        type: 'string',
        description: 'Helper text',
      },
    ],
  },

  CopyButton: {
    name: 'CopyButton',
    description: 'Button to copy text to clipboard',
    props: [
      {
        name: 'copyText',
        type: 'string',
        required: true,
        description: 'Text to copy',
      },
      {
        name: 'text',
        type: 'string',
        description: 'Button text',
      },
      {
        name: 'activeText',
        type: 'string',
        description: 'Text when copied',
      },
      {
        name: 'size',
        type: 'string',
        values: ['medium', 'small', 'xsmall'],
        description: 'Button size',
      },
      {
        name: 'variant',
        type: 'string',
        values: ['primary', 'secondary', 'tertiary'],
        description: 'Button variant',
      },
    ],
  },

  DatePicker: {
    name: 'DatePicker',
    description: 'Date selection input',
    props: [
      {
        name: 'label',
        type: 'string',
        description: 'Input label',
      },
      {
        name: 'fromDate',
        type: 'Date',
        description: 'Minimum selectable date',
      },
      {
        name: 'toDate',
        type: 'Date',
        description: 'Maximum selectable date',
      },
      {
        name: 'strategy',
        type: 'string',
        values: ['fixed', 'absolute'],
        description: 'Positioning strategy',
      },
    ],
  },

  Dropdown: {
    name: 'Dropdown',
    description: 'Dropdown menu',
    props: [
      {
        name: 'placement',
        type: 'string',
        description: 'Menu placement',
      },
    ],
  },

  ErrorSummary: {
    name: 'ErrorSummary',
    description: 'Summary of form errors',
    props: [
      {
        name: 'heading',
        type: 'string',
        required: true,
        description: 'Error summary heading',
      },
      {
        name: 'size',
        type: 'string',
        values: ['medium', 'small'],
        description: 'Summary size',
      },
    ],
  },

  ExpansionCard: {
    name: 'ExpansionCard',
    description: 'Expandable card component',
    props: [
      {
        name: 'size',
        type: 'string',
        values: ['medium', 'small'],
        description: 'Card size',
      },
      {
        name: 'variant',
        type: 'string',
        values: ['default', 'subtle'],
        description: 'Card style',
      },
    ],
  },

  FileUpload: {
    name: 'FileUpload',
    description: 'File upload component',
    props: [
      {
        name: 'label',
        type: 'string',
        required: true,
        description: 'Upload label',
      },
      {
        name: 'accept',
        type: 'string',
        description: 'Accepted file types',
      },
      {
        name: 'multiple',
        type: 'boolean',
        values: ['true', 'false'],
        description: 'Allow multiple files',
      },
      {
        name: 'error',
        type: 'string',
        description: 'Error message',
      },
    ],
  },

  FormProgress: {
    name: 'FormProgress',
    description: 'Multi-step form progress indicator',
    props: [
      {
        name: 'activeStep',
        type: 'number',
        required: true,
        description: 'Current active step',
      },
      {
        name: 'totalSteps',
        type: 'number',
        required: true,
        description: 'Total number of steps',
      },
      {
        name: 'translations',
        type: 'object',
        description: 'Text translations',
      },
    ],
  },

  FormSummary: {
    name: 'FormSummary',
    description: 'Form submission summary',
    props: [
      {
        name: 'heading',
        type: 'string',
        description: 'Summary heading',
      },
    ],
  },

  GuidePanel: {
    name: 'GuidePanel',
    description: 'Informational guide panel',
    props: [
      {
        name: 'poster',
        type: 'boolean',
        values: ['true', 'false'],
        description: 'Show as poster variant',
      },
    ],
  },

  HelpText: {
    name: 'HelpText',
    description: 'Contextual help tooltip',
    props: [
      {
        name: 'title',
        type: 'string',
        required: true,
        description: 'Help text title',
      },
      {
        name: 'placement',
        type: 'string',
        description: 'Popover placement',
      },
    ],
  },

  InternalHeader: {
    name: 'InternalHeader',
    description: 'Internal application header',
    props: [],
  },

  Link: {
    name: 'Link',
    description: 'Styled link component',
    props: [
      {
        name: 'href',
        type: 'string',
        required: true,
        description: 'Link URL',
      },
      {
        name: 'variant',
        type: 'string',
        values: ['action', 'neutral'],
        description: 'Link style',
      },
      {
        name: 'underline',
        type: 'boolean',
        values: ['true', 'false'],
        description: 'Show underline',
      },
    ],
  },

  LinkCard: {
    name: 'LinkCard',
    description: 'Clickable card link',
    props: [
      {
        name: 'href',
        type: 'string',
        required: true,
        description: 'Link URL',
      },
    ],
  },

  List: {
    name: 'List',
    description: 'Styled list component',
    props: [
      {
        name: 'as',
        type: 'string',
        values: ['ul', 'ol'],
        description: 'List element type',
      },
      {
        name: 'size',
        type: 'string',
        values: ['medium', 'small'],
        description: 'List size',
      },
    ],
  },

  Loader: {
    name: 'Loader',
    description: 'Loading spinner',
    props: [
      {
        name: 'size',
        type: 'string',
        values: ['3xlarge', '2xlarge', 'xlarge', 'large', 'medium', 'small', 'xsmall'],
        description: 'Loader size',
      },
      {
        name: 'title',
        type: 'string',
        description: 'Loading message',
      },
      {
        name: 'variant',
        type: 'string',
        values: ['interaction', 'inverted', 'neutral'],
        description: 'Loader style',
      },
    ],
  },

  Modal: {
    name: 'Modal',
    description: 'Modal dialog',
    props: [
      {
        name: 'open',
        type: 'boolean',
        required: true,
        values: ['true', 'false'],
        description: 'Modal open state',
      },
      {
        name: 'onClose',
        type: 'function',
        description: 'Close handler',
      },
      {
        name: 'width',
        type: 'string',
        values: ['small', 'medium'],
        description: 'Modal width',
      },
      {
        name: 'closeOnBackdropClick',
        type: 'boolean',
        values: ['true', 'false'],
        description: 'Close on backdrop click',
      },
    ],
  },

  MonthPicker: {
    name: 'MonthPicker',
    description: 'Month selection input',
    props: [
      {
        name: 'fromDate',
        type: 'Date',
        description: 'Minimum selectable date',
      },
      {
        name: 'toDate',
        type: 'Date',
        description: 'Maximum selectable date',
      },
    ],
  },

  Pagination: {
    name: 'Pagination',
    description: 'Pagination controls',
    props: [
      {
        name: 'page',
        type: 'number',
        required: true,
        description: 'Current page',
      },
      {
        name: 'count',
        type: 'number',
        required: true,
        description: 'Total pages',
      },
      {
        name: 'onPageChange',
        type: 'function',
        required: true,
        description: 'Page change handler',
      },
      {
        name: 'size',
        type: 'string',
        values: ['medium', 'small', 'xsmall'],
        description: 'Pagination size',
      },
    ],
  },

  Popover: {
    name: 'Popover',
    description: 'Popover overlay',
    props: [
      {
        name: 'open',
        type: 'boolean',
        values: ['true', 'false'],
        description: 'Popover open state',
      },
      {
        name: 'onClose',
        type: 'function',
        description: 'Close handler',
      },
      {
        name: 'placement',
        type: 'string',
        description: 'Popover placement',
      },
      {
        name: 'arrow',
        type: 'boolean',
        values: ['true', 'false'],
        description: 'Show arrow',
      },
    ],
  },

  Process: {
    name: 'Process',
    description: 'Process steps indicator',
    props: [
      {
        name: 'activeStep',
        type: 'number',
        description: 'Current active step',
      },
    ],
  },

  ProgressBar: {
    name: 'ProgressBar',
    description: 'Progress indicator bar',
    props: [
      {
        name: 'value',
        type: 'number',
        required: true,
        description: 'Progress value (0-100)',
      },
      {
        name: 'variant',
        type: 'string',
        values: ['default', 'success', 'warning', 'info'],
        description: 'Progress bar style',
      },
      {
        name: 'size',
        type: 'string',
        values: ['medium', 'small'],
        description: 'Progress bar size',
      },
    ],
  },

  ReadMore: {
    name: 'ReadMore',
    description: 'Expandable read more section',
    props: [
      {
        name: 'header',
        type: 'string',
        required: true,
        description: 'Expandable header text',
      },
      {
        name: 'size',
        type: 'string',
        values: ['medium', 'small'],
        description: 'Text size',
      },
    ],
  },

  Search: {
    name: 'Search',
    description: 'Search input field',
    props: [
      {
        name: 'label',
        type: 'string',
        required: true,
        description: 'Search label',
      },
      {
        name: 'variant',
        type: 'string',
        values: ['primary', 'secondary', 'simple'],
        description: 'Search style',
      },
      {
        name: 'size',
        type: 'string',
        values: ['medium', 'small'],
        description: 'Search size',
      },
      {
        name: 'clearButton',
        type: 'boolean',
        values: ['true', 'false'],
        description: 'Show clear button',
      },
    ],
  },

  Skeleton: {
    name: 'Skeleton',
    description: 'Loading skeleton placeholder',
    props: [
      {
        name: 'variant',
        type: 'string',
        values: ['text', 'circle', 'rectangle', 'rounded'],
        description: 'Skeleton shape',
      },
      {
        name: 'width',
        type: 'string | number',
        description: 'Skeleton width',
      },
      {
        name: 'height',
        type: 'string | number',
        description: 'Skeleton height',
      },
    ],
  },

  Stepper: {
    name: 'Stepper',
    description: 'Step-by-step wizard',
    props: [
      {
        name: 'activeStep',
        type: 'number',
        required: true,
        description: 'Current active step',
      },
      {
        name: 'onStepChange',
        type: 'function',
        description: 'Step change handler',
      },
      {
        name: 'orientation',
        type: 'string',
        values: ['horizontal', 'vertical'],
        description: 'Stepper layout',
      },
    ],
  },

  Switch: {
    name: 'Switch',
    description: 'Toggle switch',
    props: [
      {
        name: 'checked',
        type: 'boolean',
        values: ['true', 'false'],
        description: 'Switch state',
      },
      {
        name: 'size',
        type: 'string',
        values: ['medium', 'small'],
        description: 'Switch size',
      },
      {
        name: 'description',
        type: 'string',
        description: 'Helper text',
      },
    ],
  },

  Table: {
    name: 'Table',
    description: 'Data table',
    props: [
      {
        name: 'size',
        type: 'string',
        values: ['medium', 'small'],
        description: 'Table size',
      },
      {
        name: 'zebraStripes',
        type: 'boolean',
        values: ['true', 'false'],
        description: 'Alternating row colors',
      },
      {
        name: 'sort',
        type: 'object',
        description: 'Sort configuration',
      },
    ],
  },

  Tabs: {
    name: 'Tabs',
    description: 'Tab navigation',
    props: [
      {
        name: 'value',
        type: 'string',
        required: true,
        description: 'Active tab value',
      },
      {
        name: 'onChange',
        type: 'function',
        description: 'Tab change handler',
      },
      {
        name: 'size',
        type: 'string',
        values: ['medium', 'small'],
        description: 'Tab size',
      },
    ],
  },

  Tag: {
    name: 'Tag',
    description: 'Tag label component',
    props: [
      {
        name: 'variant',
        type: 'string',
        values: ['info', 'success', 'warning', 'error', 'alt1', 'alt2', 'alt3', 'neutral'],
        description: 'Tag color',
      },
      {
        name: 'size',
        type: 'string',
        values: ['medium', 'small', 'xsmall'],
        description: 'Tag size',
      },
    ],
  },

  Textarea: {
    name: 'Textarea',
    description: 'Multi-line text input',
    props: [
      {
        name: 'label',
        type: 'string',
        required: true,
        description: 'Input label',
      },
      {
        name: 'value',
        type: 'string',
        description: 'Input value',
      },
      {
        name: 'size',
        type: 'string',
        values: ['medium', 'small'],
        description: 'Input size',
      },
      {
        name: 'error',
        type: 'string',
        description: 'Error message',
      },
      {
        name: 'description',
        type: 'string',
        description: 'Helper text',
      },
      {
        name: 'maxLength',
        type: 'number',
        description: 'Maximum character length',
      },
    ],
  },

  Timeline: {
    name: 'Timeline',
    description: 'Timeline component',
    props: [],
  },

  ToggleGroup: {
    name: 'ToggleGroup',
    description: 'Toggle button group',
    props: [
      {
        name: 'value',
        type: 'string',
        description: 'Selected value',
      },
      {
        name: 'onChange',
        type: 'function',
        description: 'Change handler',
      },
      {
        name: 'size',
        type: 'string',
        values: ['medium', 'small'],
        description: 'Button size',
      },
      {
        name: 'variant',
        type: 'string',
        values: ['action', 'neutral'],
        description: 'Button style',
      },
    ],
  },

  Tooltip: {
    name: 'Tooltip',
    description: 'Tooltip overlay',
    props: [
      {
        name: 'content',
        type: 'string',
        required: true,
        description: 'Tooltip content',
      },
      {
        name: 'placement',
        type: 'string',
        description: 'Tooltip placement',
      },
      {
        name: 'delay',
        type: 'number',
        description: 'Show delay in ms',
      },
    ],
  },

  // Typography Components
  Heading: {
    name: 'Heading',
    description: 'Heading text',
    props: [
      {
        name: 'level',
        type: 'string',
        values: ['1', '2', '3', '4', '5'],
        required: true,
        description: 'Heading level',
      },
      {
        name: 'size',
        type: 'string',
        values: ['xlarge', 'large', 'medium', 'small', 'xsmall'],
        description: 'Heading size',
      },
      {
        name: 'spacing',
        type: 'boolean',
        values: ['true', 'false'],
        description: 'Add bottom margin',
      },
    ],
  },

  BodyLong: {
    name: 'BodyLong',
    description: 'Long body text with optimized line height',
    props: [
      {
        name: 'size',
        type: 'string',
        values: ['large', 'medium', 'small'],
        description: 'Text size',
      },
      {
        name: 'spacing',
        type: 'boolean',
        values: ['true', 'false'],
        description: 'Add bottom margin',
      },
      {
        name: 'weight',
        type: 'string',
        values: ['regular', 'semibold'],
        description: 'Font weight',
      },
    ],
  },

  BodyShort: {
    name: 'BodyShort',
    description: 'Short body text with compact line height',
    props: [
      {
        name: 'size',
        type: 'string',
        values: ['large', 'medium', 'small'],
        description: 'Text size',
      },
      {
        name: 'spacing',
        type: 'boolean',
        values: ['true', 'false'],
        description: 'Add bottom margin',
      },
      {
        name: 'weight',
        type: 'string',
        values: ['regular', 'semibold'],
        description: 'Font weight',
      },
    ],
  },

  Label: {
    name: 'Label',
    description: 'Label text',
    props: [
      {
        name: 'size',
        type: 'string',
        values: ['large', 'medium', 'small'],
        description: 'Label size',
      },
      {
        name: 'spacing',
        type: 'boolean',
        values: ['true', 'false'],
        description: 'Add bottom margin',
      },
      {
        name: 'as',
        type: 'string',
        description: 'HTML element to render',
      },
    ],
  },

  Detail: {
    name: 'Detail',
    description: 'Small detail text',
    props: [
      {
        name: 'size',
        type: 'string',
        values: ['large', 'medium', 'small'],
        description: 'Text size',
      },
      {
        name: 'spacing',
        type: 'boolean',
        values: ['true', 'false'],
        description: 'Add bottom margin',
      },
      {
        name: 'uppercase',
        type: 'boolean',
        values: ['true', 'false'],
        description: 'Transform to uppercase',
      },
    ],
  },

  ErrorMessage: {
    name: 'ErrorMessage',
    description: 'Error message text',
    props: [
      {
        name: 'size',
        type: 'string',
        values: ['medium', 'small'],
        description: 'Error message size',
      },
      {
        name: 'spacing',
        type: 'boolean',
        values: ['true', 'false'],
        description: 'Add bottom margin',
      },
    ],
  },
}

/**
 * Get all prop names for a component
 */
export function getComponentProps(componentName: string): string[] {
  const metadata = AKSEL_COMPONENTS[componentName]
  return metadata ? metadata.props.map((p) => p.name) : []
}

/**
 * Get valid values for a specific prop
 */
export function getPropValues(componentName: string, propName: string): string[] {
  const metadata = AKSEL_COMPONENTS[componentName]
  if (!metadata) return []

  const prop = metadata.props.find((p) => p.name === propName)
  return prop?.values || []
}

/**
 * Get prop definition
 */
export function getPropDefinition(
  componentName: string,
  propName: string
): PropDefinition | undefined {
  const metadata = AKSEL_COMPONENTS[componentName]
  if (!metadata) return undefined

  return metadata.props.find((p) => p.name === propName)
}
