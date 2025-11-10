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
