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

/**
 * Aksel Darkside spacing scale tokens
 * Based on: https://aksel.nav.no/grunnleggende/styling/design-tokens
 */
const SPACING_TOKENS = [
  'space-0',   // 0rem
  'space-1',   // 0.0625rem
  'space-2',   // 0.125rem
  'space-4',   // 0.25rem
  'space-6',   // 0.375rem
  'space-8',   // 0.5rem
  'space-12',  // 0.75rem
  'space-16',  // 1rem
  'space-20',  // 1.25rem
  'space-24',  // 1.5rem
  'space-28',  // 1.75rem
  'space-32',  // 2rem
  'space-36',  // 2.25rem
  'space-40',  // 2.5rem
  'space-44',  // 2.75rem
  'space-48',  // 3rem
  'space-56',  // 3.5rem
  'space-64',  // 4rem
  'space-72',  // 4.5rem
  'space-80',  // 5rem
  'space-96',  // 6rem
  'space-128', // 8rem
]

const SPACING_TOKENS_WITH_AUTO = [...SPACING_TOKENS, 'auto']

/**
 * Aksel Darkside background color tokens
 * Based on: https://aksel.nav.no/grunnleggende/styling/design-tokens
 * 
 * **CRITICAL**: Token fragments only (no "bg-" prefix)
 * Aksel props accept token fragments and add the --ax-bg- prefix automatically.
 * Using full token names would cause double-prefixing: `var(--ax-bg---ax-bg-default)` ❌
 */
const BACKGROUND_TOKENS = [
  // Root
  'default',
  'input',
  'raised',
  'sunken',
  'overlay',
  // Neutral
  'neutral-soft',
  'neutral-softA',
  'neutral-moderate',
  'neutral-moderateA',
  'neutral-moderate-hover',
  'neutral-moderate-hoverA',
  'neutral-moderate-pressed',
  'neutral-moderate-pressedA',
  'neutral-strong',
  'neutral-strong-hover',
  'neutral-strong-pressed',
  // Accent
  'accent-soft',
  'accent-softA',
  'accent-moderate',
  'accent-moderateA',
  'accent-moderate-hover',
  'accent-moderate-hoverA',
  'accent-moderate-pressed',
  'accent-moderate-pressedA',
  'accent-strong',
  'accent-strong-hover',
  'accent-strong-pressed',
  // Success
  'success-soft',
  'success-softA',
  'success-moderate',
  'success-moderateA',
  'success-moderate-hover',
  'success-moderate-hoverA',
  'success-moderate-pressed',
  'success-moderate-pressedA',
  'success-strong',
  'success-strong-hover',
  'success-strong-pressed',
  // Warning
  'warning-soft',
  'warning-softA',
  'warning-moderate',
  'warning-moderateA',
  'warning-moderate-hover',
  'warning-moderate-hoverA',
  'warning-moderate-pressed',
  'warning-moderate-pressedA',
  'warning-strong',
  'warning-strong-hover',
  'warning-strong-pressed',
  // Danger
  'danger-soft',
  'danger-softA',
  'danger-moderate',
  'danger-moderateA',
  'danger-moderate-hover',
  'danger-moderate-hoverA',
  'danger-moderate-pressed',
  'danger-moderate-pressedA',
  'danger-strong',
  'danger-strong-hover',
  'danger-strong-pressed',
  // Info
  'info-soft',
  'info-softA',
  'info-moderate',
  'info-moderateA',
  'info-moderate-hover',
  'info-moderate-hoverA',
  'info-moderate-pressed',
  'info-moderate-pressedA',
  'info-strong',
  'info-strong-hover',
  'info-strong-pressed',
  // Brand magenta
  'brand-magenta-soft',
  'brand-magenta-softA',
  'brand-magenta-moderate',
  'brand-magenta-moderateA',
  'brand-magenta-moderate-hover',
  'brand-magenta-moderate-hoverA',
  'brand-magenta-moderate-pressed',
  'brand-magenta-moderate-pressedA',
  'brand-magenta-strong',
  'brand-magenta-strong-hover',
  'brand-magenta-strong-pressed',
  // Brand beige
  'brand-beige-soft',
  'brand-beige-softA',
  'brand-beige-moderate',
  'brand-beige-moderateA',
  'brand-beige-moderate-hover',
  'brand-beige-moderate-hoverA',
  'brand-beige-moderate-pressed',
  'brand-beige-moderate-pressedA',
  'brand-beige-strong',
  'brand-beige-strong-hover',
  'brand-beige-strong-pressed',
  // Brand blue
  'brand-blue-soft',
  'brand-blue-softA',
  'brand-blue-moderate',
  'brand-blue-moderateA',
  'brand-blue-moderate-hover',
  'brand-blue-moderate-hoverA',
  'brand-blue-moderate-pressed',
  'brand-blue-moderate-pressedA',
  'brand-blue-strong',
  'brand-blue-strong-hover',
  'brand-blue-strong-pressed',
  // Meta lime
  'meta-lime-soft',
  'meta-lime-softA',
  'meta-lime-moderate',
  'meta-lime-moderateA',
  'meta-lime-moderate-hover',
  'meta-lime-moderate-hoverA',
  'meta-lime-moderate-pressed',
  'meta-lime-moderate-pressedA',
  'meta-lime-strong',
  'meta-lime-strong-hover',
  'meta-lime-strong-pressed',
  // Meta purple
  'meta-purple-soft',
  'meta-purple-softA',
  'meta-purple-moderate',
  'meta-purple-moderateA',
  'meta-purple-moderate-hover',
  'meta-purple-moderate-hoverA',
  'meta-purple-moderate-pressed',
  'meta-purple-moderate-pressedA',
  'meta-purple-strong',
  'meta-purple-strong-hover',
  'meta-purple-strong-pressed',
]

/**
 * Aksel Darkside text color intensity values for textColor prop
 * Based on: https://aksel.nav.no/grunnleggende/styling/design-tokens
 */
const TEXT_COLOR_INTENSITY = ['default', 'subtle', 'decoration', 'contrast']

/**
 * Aksel Darkside color types for data-color attribute
 * Used in combination with textColor to define the final text color
 */
const DATA_COLOR_VALUES = [
  'neutral',
  'accent',
  'success',
  'warning',
  'danger',
  'info',
  'brand-magenta',
  'brand-beige',
  'brand-blue',
  'meta-lime',
  'meta-purple',
]

/**
 * Aksel Darkside border color tokens (token fragment only, NO prefix)
 * Based on: https://aksel.nav.no/grunnleggende/darkside/design-tokens
 * CRITICAL: Box.darkside automatically adds `--ax-border-` prefix to these values.
 * Example: Use `"neutral-subtle"` NOT `"border-neutral-subtle"` 
 * The component will transform it to `var(--ax-border-neutral-subtle)`.
 * Using "border-" prefix causes double-prefixing bug: `var(--ax-border-border-neutral-subtle)` ❌
 */
export const BORDER_COLOR_TOKENS: string[] = [
  // Root
  'focus',
  // Neutral
  'neutral',
  'neutral-subtle',
  'neutral-subtleA',
  'neutral-strong',
  // Accent
  'accent',
  'accent-subtle',
  'accent-subtleA',
  'accent-strong',
  // Success
  'success',
  'success-subtle',
  'success-subtleA',
  'success-strong',
  // Warning
  'warning',
  'warning-subtle',
  'warning-subtleA',
  'warning-strong',
  // Danger
  'danger',
  'danger-subtle',
  'danger-subtleA',
  'danger-strong',
  // Info
  'info',
  'info-subtle',
  'info-subtleA',
  'info-strong',
  // Brand magenta
  'brand-magenta',
  'brand-magenta-subtle',
  'brand-magenta-subtleA',
  'brand-magenta-strong',
  // Brand beige
  'brand-beige',
  'brand-beige-subtle',
  'brand-beige-subtleA',
  'brand-beige-strong',
  // Brand blue
  'brand-blue',
  'brand-blue-subtle',
  'brand-blue-subtleA',
  'brand-blue-strong',
  // Meta lime
  'meta-lime',
  'meta-lime-subtle',
  'meta-lime-subtleA',
  'meta-lime-strong',
  // Meta purple
  'meta-purple',
  'meta-purple-subtle',
  'meta-purple-subtleA',
  'meta-purple-strong',
]

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

  BoxNew: {
    name: 'BoxNew',
    description: 'Layout container with spacing control and Darkside support (borderColor, background, shadow)',
    props: [
      {
        name: 'padding',
        type: 'string',
        values: SPACING_TOKENS,
        description: 'Padding around children',
      },
      {
        name: 'paddingInline',
        type: 'string',
        values: SPACING_TOKENS,
        description: 'Horizontal padding around children',
      },
      {
        name: 'paddingBlock',
        type: 'string',
        values: SPACING_TOKENS,
        description: 'Vertical padding around children',
      },
      {
        name: 'margin',
        type: 'string',
        values: SPACING_TOKENS,
        description: 'Margin around element',
      },
      {
        name: 'marginInline',
        type: 'string',
        values: SPACING_TOKENS_WITH_AUTO,
        description: 'Horizontal margin around element',
      },
      {
        name: 'marginBlock',
        type: 'string',
        values: SPACING_TOKENS_WITH_AUTO,
        description: 'Vertical margin around element',
      },
      {
        name: 'background',
        type: 'string',
        values: BACKGROUND_TOKENS,
        description: 'CSS background-color property (accepts background/surface color token)',
      },
      {
        name: 'borderColor',
        type: 'string',
        values: BORDER_COLOR_TOKENS,
        description: 'Border color token (use token fragment like "neutral-subtle", NOT "border-neutral-subtle")',
      },
      {
        name: 'borderRadius',
        type: 'string',
        values: ['2', '4', '8', '12', 'full'],
        description: 'Border radius value (component adds radius- prefix automatically to create --ax-radius-X token)',
      },
      {
        name: 'borderWidth',
        type: 'string',
        values: ['0', '1', '2', '3', '4', '5'],
        description: 'CSS border-width property (no border if not set)',
      },
      {
        name: 'shadow',
        type: 'string',
        values: ['dialog'],
        description: 'Shadow on box (accepts shadow token)',
      },
      {
        name: 'width',
        type: 'string',
        description: 'CSS width',
      },
      {
        name: 'minWidth',
        type: 'string',
        description: 'CSS min-width',
      },
      {
        name: 'maxWidth',
        type: 'string',
        description: 'CSS max-width',
      },
      {
        name: 'height',
        type: 'string',
        description: 'CSS height',
      },
      {
        name: 'minHeight',
        type: 'string',
        description: 'CSS min-height',
      },
      {
        name: 'maxHeight',
        type: 'string',
        description: 'CSS max-height',
      },
      {
        name: 'position',
        type: 'string',
        values: ['static', 'relative', 'absolute', 'fixed', 'sticky'],
        description: 'CSS position',
      },
      {
        name: 'inset',
        type: 'string',
        values: SPACING_TOKENS,
        description: 'CSS inset',
      },
      {
        name: 'top',
        type: 'string',
        values: SPACING_TOKENS,
        description: 'CSS top',
      },
      {
        name: 'right',
        type: 'string',
        values: SPACING_TOKENS,
        description: 'CSS right',
      },
      {
        name: 'bottom',
        type: 'string',
        values: SPACING_TOKENS,
        description: 'CSS bottom',
      },
      {
        name: 'left',
        type: 'string',
        values: SPACING_TOKENS,
        description: 'CSS left',
      },
      {
        name: 'overflow',
        type: 'string',
        values: ['auto', 'visible', 'hidden', 'clip', 'scroll'],
        description: 'CSS overflow',
      },
      {
        name: 'overflowX',
        type: 'string',
        values: ['auto', 'visible', 'hidden', 'clip', 'scroll'],
        description: 'CSS overflow-x',
      },
      {
        name: 'overflowY',
        type: 'string',
        values: ['auto', 'visible', 'hidden', 'clip', 'scroll'],
        description: 'CSS overflow-y',
      },
      {
        name: 'flexBasis',
        type: 'string',
        description: 'CSS flex-basis',
      },
      {
        name: 'flexShrink',
        type: 'string',
        values: ['0', '1'],
        description: 'CSS flex-shrink',
      },
      {
        name: 'flexGrow',
        type: 'string',
        values: ['0', '1'],
        description: 'CSS flex-grow',
      },
      {
        name: 'gridColumn',
        type: 'string',
        description: 'CSS grid-column',
      },
      {
        name: 'asChild',
        type: 'boolean',
        values: ['true', 'false'],
        description: 'Merge with child element',
      },
      {
        name: 'as',
        type: 'string',
        description: 'HTML element to render as',
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
        values: SPACING_TOKENS,
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
        values: SPACING_TOKENS,
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
        values: SPACING_TOKENS,
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
        values: SPACING_TOKENS,
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
      {
        name: 'padding',
        type: 'string',
        values: SPACING_TOKENS,
        description: 'Padding around children',
      },
      {
        name: 'paddingInline',
        type: 'string',
        values: SPACING_TOKENS,
        description: 'Horizontal padding',
      },
      {
        name: 'paddingBlock',
        type: 'string',
        values: SPACING_TOKENS,
        description: 'Vertical padding',
      },
      {
        name: 'margin',
        type: 'string',
        values: SPACING_TOKENS_WITH_AUTO,
        description: 'Margin around element',
      },
      {
        name: 'marginInline',
        type: 'string',
        values: SPACING_TOKENS_WITH_AUTO,
        description: 'Horizontal margin',
      },
      {
        name: 'marginBlock',
        type: 'string',
        values: SPACING_TOKENS_WITH_AUTO,
        description: 'Vertical margin',
      },
      {
        name: 'width',
        type: 'string',
        description: 'CSS width (e.g., "100%", "300px", "50vw")',
      },
      {
        name: 'minWidth',
        type: 'string',
        description: 'CSS min-width',
      },
      {
        name: 'maxWidth',
        type: 'string',
        description: 'CSS max-width',
      },
      {
        name: 'height',
        type: 'string',
        description: 'CSS height',
      },
      {
        name: 'minHeight',
        type: 'string',
        description: 'CSS min-height',
      },
      {
        name: 'maxHeight',
        type: 'string',
        description: 'CSS max-height',
      },
      {
        name: 'position',
        type: 'string',
        values: ['static', 'relative', 'absolute', 'fixed', 'sticky'],
        description: 'CSS position',
      },
      {
        name: 'inset',
        type: 'string',
        values: SPACING_TOKENS,
        description: 'CSS inset property',
      },
      {
        name: 'top',
        type: 'string',
        values: SPACING_TOKENS,
        description: 'CSS top',
      },
      {
        name: 'right',
        type: 'string',
        values: SPACING_TOKENS,
        description: 'CSS right',
      },
      {
        name: 'bottom',
        type: 'string',
        values: SPACING_TOKENS,
        description: 'CSS bottom',
      },
      {
        name: 'left',
        type: 'string',
        values: SPACING_TOKENS,
        description: 'CSS left',
      },
      {
        name: 'overflow',
        type: 'string',
        values: ['hidden', 'auto', 'visible', 'clip', 'scroll'],
        description: 'CSS overflow',
      },
      {
        name: 'overflowX',
        type: 'string',
        values: ['hidden', 'auto', 'visible', 'clip', 'scroll'],
        description: 'CSS overflow-x',
      },
      {
        name: 'overflowY',
        type: 'string',
        values: ['hidden', 'auto', 'visible', 'clip', 'scroll'],
        description: 'CSS overflow-y',
      },
      {
        name: 'flexBasis',
        type: 'string',
        description: 'CSS flex-basis',
      },
      {
        name: 'flexShrink',
        type: 'string',
        values: ['0', '1'],
        description: 'CSS flex-shrink',
      },
      {
        name: 'flexGrow',
        type: 'string',
        values: ['0', '1'],
        description: 'CSS flex-grow',
      },
      {
        name: 'gridColumn',
        type: 'string',
        description: 'CSS grid-column',
      },
      {
        name: 'asChild',
        type: 'boolean',
        values: ['true', 'false'],
        description: 'Merge with child element',
      },
      {
        name: 'as',
        type: 'string',
        description: 'HTML element to render as',
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
        values: SPACING_TOKENS,
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
      {
        name: 'padding',
        type: 'string',
        values: SPACING_TOKENS,
        description: 'Padding around children',
      },
      {
        name: 'paddingInline',
        type: 'string',
        values: SPACING_TOKENS,
        description: 'Horizontal padding',
      },
      {
        name: 'paddingBlock',
        type: 'string',
        values: SPACING_TOKENS,
        description: 'Vertical padding',
      },
      {
        name: 'margin',
        type: 'string',
        values: SPACING_TOKENS_WITH_AUTO,
        description: 'Margin around element',
      },
      {
        name: 'marginInline',
        type: 'string',
        values: SPACING_TOKENS_WITH_AUTO,
        description: 'Horizontal margin',
      },
      {
        name: 'marginBlock',
        type: 'string',
        values: SPACING_TOKENS_WITH_AUTO,
        description: 'Vertical margin',
      },
      {
        name: 'width',
        type: 'string',
        description: 'CSS width (e.g., "100%", "300px", "50vw")',
      },
      {
        name: 'minWidth',
        type: 'string',
        description: 'CSS min-width',
      },
      {
        name: 'maxWidth',
        type: 'string',
        description: 'CSS max-width',
      },
      {
        name: 'height',
        type: 'string',
        description: 'CSS height',
      },
      {
        name: 'minHeight',
        type: 'string',
        description: 'CSS min-height',
      },
      {
        name: 'maxHeight',
        type: 'string',
        description: 'CSS max-height',
      },
      {
        name: 'position',
        type: 'string',
        values: ['static', 'relative', 'absolute', 'fixed', 'sticky'],
        description: 'CSS position',
      },
      {
        name: 'inset',
        type: 'string',
        values: SPACING_TOKENS,
        description: 'CSS inset property',
      },
      {
        name: 'top',
        type: 'string',
        values: SPACING_TOKENS,
        description: 'CSS top',
      },
      {
        name: 'right',
        type: 'string',
        values: SPACING_TOKENS,
        description: 'CSS right',
      },
      {
        name: 'bottom',
        type: 'string',
        values: SPACING_TOKENS,
        description: 'CSS bottom',
      },
      {
        name: 'left',
        type: 'string',
        values: SPACING_TOKENS,
        description: 'CSS left',
      },
      {
        name: 'overflow',
        type: 'string',
        values: ['hidden', 'auto', 'visible', 'clip', 'scroll'],
        description: 'CSS overflow',
      },
      {
        name: 'overflowX',
        type: 'string',
        values: ['hidden', 'auto', 'visible', 'clip', 'scroll'],
        description: 'CSS overflow-x',
      },
      {
        name: 'overflowY',
        type: 'string',
        values: ['hidden', 'auto', 'visible', 'clip', 'scroll'],
        description: 'CSS overflow-y',
      },
      {
        name: 'flexBasis',
        type: 'string',
        description: 'CSS flex-basis',
      },
      {
        name: 'flexShrink',
        type: 'string',
        values: ['0', '1'],
        description: 'CSS flex-shrink',
      },
      {
        name: 'flexGrow',
        type: 'string',
        values: ['0', '1'],
        description: 'CSS flex-grow',
      },
      {
        name: 'gridColumn',
        type: 'string',
        description: 'CSS grid-column',
      },
      {
        name: 'asChild',
        type: 'boolean',
        values: ['true', 'false'],
        description: 'Merge with child element',
      },
      {
        name: 'as',
        type: 'string',
        description: 'HTML element to render as',
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
        values: SPACING_TOKENS,
        description: 'Horizontal bleed amount',
      },
      {
        name: 'marginBlock',
        type: 'string',
        values: SPACING_TOKENS,
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
      {
        name: 'textColor',
        type: 'string',
        values: TEXT_COLOR_INTENSITY,
        description: 'Text color intensity (use with data-color prop to define full color)',
      },
      {
        name: 'data-color',
        type: 'string',
        values: DATA_COLOR_VALUES,
        description: 'Color type (use with textColor prop to define full color)',
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
      {
        name: 'textColor',
        type: 'string',
        values: TEXT_COLOR_INTENSITY,
        description: 'Text color intensity (use with data-color prop to define full color)',
      },
      {
        name: 'data-color',
        type: 'string',
        values: DATA_COLOR_VALUES,
        description: 'Color type (use with textColor prop to define full color)',
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
      {
        name: 'textColor',
        type: 'string',
        values: TEXT_COLOR_INTENSITY,
        description: 'Text color intensity (use with data-color prop to define full color)',
      },
      {
        name: 'data-color',
        type: 'string',
        values: DATA_COLOR_VALUES,
        description: 'Color type (use with textColor prop to define full color)',
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
      {
        name: 'textColor',
        type: 'string',
        values: TEXT_COLOR_INTENSITY,
        description: 'Text color intensity (use with data-color prop to define full color)',
      },
      {
        name: 'data-color',
        type: 'string',
        values: DATA_COLOR_VALUES,
        description: 'Color type (use with textColor prop to define full color)',
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
      {
        name: 'textColor',
        type: 'string',
        values: TEXT_COLOR_INTENSITY,
        description: 'Text color intensity (use with data-color prop to define full color)',
      },
      {
        name: 'data-color',
        type: 'string',
        values: DATA_COLOR_VALUES,
        description: 'Color type (use with textColor prop to define full color)',
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
      {
        name: 'textColor',
        type: 'string',
        values: TEXT_COLOR_INTENSITY,
        description: 'Text color intensity (use with data-color prop to define full color)',
      },
      {
        name: 'data-color',
        type: 'string',
        values: DATA_COLOR_VALUES,
        description: 'Color type (use with textColor prop to define full color)',
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
