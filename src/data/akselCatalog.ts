import type { ComponentInsertion, ComponentSnippet, SnippetCategory } from '@/types/snippets'
import iconMetadata from '@navikt/aksel-icons/metadata'
import { filterNewAuthoringEntries } from '@/data/akselAuthoringPolicy'

export const AKSEL_CATALOG_VERSION = '8.11.0'

export type AkselCatalogGroup = 'layout' | 'component' | 'icon'
export type AkselCatalogStatus = 'current' | 'experimental' | 'legacy'
export type AkselValueKind =
  | 'enum'
  | 'spacing-token'
  | 'background-token'
  | 'border-color-token'
  | 'radius-token'
  | 'shadow-token'
  | 'data-color'

export interface AkselCatalogProp {
  name: string
  type: string
  values?: string[]
  valueKind?: AkselValueKind
  required?: boolean
  default?: string
  description: string
}

export interface AkselCatalogSnippet {
  code: string
  description: string
  hooksCode?: string
}

export interface AkselCatalogEntry {
  id: string
  name: string
  group: AkselCatalogGroup
  status: AkselCatalogStatus
  package: '@navikt/ds-react' | '@navikt/aksel-icons'
  importName: string
  importGuidance: string
  docs: string
  description: string
  keywords: string[]
  props: AkselCatalogProp[]
  snippet: AkselCatalogSnippet
}

export type AkselAutocompleteDiscovery = 'contextual-only' | 'top-level'

export interface AkselContextualAutocompleteChild {
  name: string
  discovery?: AkselAutocompleteDiscovery
}

export interface AkselContextualAutocompleteRule {
  parent: string
  children: AkselContextualAutocompleteChild[]
  exclusive?: boolean
}

export interface AkselTokenMetadata {
  kind: AkselValueKind
  docs: string
  description: string
  values: string[]
}

const AKSEL_DOCS_BASE = 'https://aksel.nav.no'
const COMPONENT_DOCS_BASE = `${AKSEL_DOCS_BASE}/komponenter/core`
const ICON_DOCS = `${AKSEL_DOCS_BASE}/ikoner`
const TOKEN_DOCS = `${AKSEL_DOCS_BASE}/grunnleggende/styling/design-tokens`
const DEFAULT_DISCOVERY_STATUSES: AkselCatalogStatus[] = ['current', 'experimental']

const splitIconName = (iconName: string): string[] =>
  iconName
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .toLowerCase()
    .split(/\s+/)

const iconCatalogEntries: AkselCatalogEntry[] = Object.values(iconMetadata)
  .sort((a, b) => a.name.localeCompare(b.name))
  .map((icon) => {
    const componentName = `${icon.name}Icon`
    const readableName = splitIconName(icon.name).join(' ')
    const keywords = [
      ...splitIconName(icon.name),
      icon.category,
      icon.sub_category,
      icon.variant,
      ...icon.keywords,
      'icon',
    ]
      .filter(Boolean)
      .map((keyword) => keyword.toLowerCase())

    return {
      id: `${icon.name.toLowerCase()}-icon`,
      name: componentName,
      group: 'icon',
      status: 'current',
      package: '@navikt/aksel-icons',
      importName: componentName,
      importGuidance: `import { ${componentName} } from '@navikt/aksel-icons';`,
      docs: ICON_DOCS,
      description: `${readableName} icon.`,
      keywords: Array.from(new Set(keywords)),
      props: [],
      snippet: {
        code: `<${componentName} aria-hidden />`,
        description: `${readableName} icon.`,
      },
    }
  })

export const AKSEL_TOKEN_METADATA: Record<string, AkselTokenMetadata> = {
  spacing: {
    kind: 'spacing-token',
    docs: TOKEN_DOCS,
    description: 'Aksel v8 spacing tokens for layout gap, padding, margin, and inset props.',
    values: [
      'space-0',
      'space-1',
      'space-2',
      'space-4',
      'space-6',
      'space-8',
      'space-12',
      'space-16',
      'space-20',
      'space-24',
      'space-28',
      'space-32',
      'space-36',
      'space-40',
      'space-44',
      'space-48',
      'space-56',
      'space-64',
      'space-72',
      'space-80',
      'space-96',
      'space-128',
    ],
  },
  spacingWithAuto: {
    kind: 'spacing-token',
    docs: TOKEN_DOCS,
    description: 'Aksel v8 spacing tokens plus auto for margin props.',
    values: [
      'space-0',
      'space-1',
      'space-2',
      'space-4',
      'space-6',
      'space-8',
      'space-12',
      'space-16',
      'space-20',
      'space-24',
      'space-28',
      'space-32',
      'space-36',
      'space-40',
      'space-44',
      'space-48',
      'space-56',
      'space-64',
      'space-72',
      'space-80',
      'space-96',
      'space-128',
      'auto',
    ],
  },
  background: {
    kind: 'background-token',
    docs: TOKEN_DOCS,
    description: 'Box background token fragments; Box adds the Aksel CSS variable prefix.',
    values: [
      'default',
      'input',
      'raised',
      'sunken',
      'overlay',
      'neutral-soft',
      'neutral-softA',
      'neutral-moderate',
      'neutral-moderateA',
      'neutral-strong',
      'accent-soft',
      'accent-softA',
      'success-soft',
      'warning-soft',
      'danger-soft',
      'info-soft',
    ],
  },
  borderColor: {
    kind: 'border-color-token',
    docs: TOKEN_DOCS,
    description: 'Box border color token fragments; Box adds the Aksel CSS variable prefix.',
    values: [
      'focus',
      'neutral',
      'neutral-subtle',
      'neutral-subtleA',
      'neutral-strong',
      'accent',
      'accent-subtle',
      'success',
      'success-subtle',
      'warning',
      'warning-subtle',
      'danger',
      'danger-subtle',
      'info',
      'info-subtle',
    ],
  },
  radius: {
    kind: 'radius-token',
    docs: TOKEN_DOCS,
    description: 'Aksel v8 radius token fragments for Box borderRadius.',
    values: ['2', '4', '8', '12', 'full'],
  },
  shadow: {
    kind: 'shadow-token',
    docs: TOKEN_DOCS,
    description: 'Aksel v8 shadow token fragments for Box shadow.',
    values: ['dialog'],
  },
  dataColor: {
    kind: 'data-color',
    docs: TOKEN_DOCS,
    description: 'Aksel v8 dynamic color values for the data-color attribute.',
    values: [
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
    ],
  },
}

const spacingValues = AKSEL_TOKEN_METADATA.spacing.values
const spacingWithAutoValues = AKSEL_TOKEN_METADATA.spacingWithAuto.values
const dataColorValues = AKSEL_TOKEN_METADATA.dataColor.values

const AKSEL_CONTEXTUAL_AUTOCOMPLETE_RULES: AkselContextualAutocompleteRule[] = [
  {
    parent: 'Accordion',
    children: [{ name: 'Accordion.Item' }],
    exclusive: true,
  },
  {
    parent: 'Accordion.Item',
    children: [{ name: 'Accordion.Header' }, { name: 'Accordion.Content' }],
    exclusive: true,
  },
  {
    parent: 'ActionMenu',
    children: [{ name: 'ActionMenu.Trigger' }, { name: 'ActionMenu.Content' }],
    exclusive: true,
  },
  {
    parent: 'ActionMenu.Content',
    children: [
      { name: 'ActionMenu.Item' },
      { name: 'ActionMenu.Group' },
      { name: 'ActionMenu.Label' },
      { name: 'ActionMenu.Divider' },
      { name: 'ActionMenu.CheckboxItem' },
      { name: 'ActionMenu.RadioGroup' },
      { name: 'ActionMenu.Sub' },
    ],
    exclusive: true,
  },
  {
    parent: 'ActionMenu.Group',
    children: [
      { name: 'ActionMenu.Label' },
      { name: 'ActionMenu.Item' },
      { name: 'ActionMenu.Divider' },
      { name: 'ActionMenu.CheckboxItem' },
      { name: 'ActionMenu.RadioGroup' },
      { name: 'ActionMenu.Sub' },
    ],
    exclusive: true,
  },
  {
    parent: 'ActionMenu.RadioGroup',
    children: [{ name: 'ActionMenu.RadioItem' }],
    exclusive: true,
  },
  {
    parent: 'ActionMenu.Sub',
    children: [{ name: 'ActionMenu.SubTrigger' }, { name: 'ActionMenu.SubContent' }],
    exclusive: true,
  },
  {
    parent: 'ActionMenu.SubContent',
    children: [
      { name: 'ActionMenu.Item' },
      { name: 'ActionMenu.Group' },
      { name: 'ActionMenu.Label' },
      { name: 'ActionMenu.Divider' },
      { name: 'ActionMenu.CheckboxItem' },
      { name: 'ActionMenu.RadioGroup' },
      { name: 'ActionMenu.Sub' },
    ],
    exclusive: true,
  },
  {
    parent: 'Dropdown',
    children: [{ name: 'Dropdown.Toggle' }, { name: 'Dropdown.Menu' }],
    exclusive: true,
  },
  {
    parent: 'Dropdown.Menu',
    children: [
      { name: 'Dropdown.Menu.List' },
      { name: 'Dropdown.Menu.GroupedList' },
      { name: 'Dropdown.Divider' },
    ],
    exclusive: true,
  },
  {
    parent: 'Dropdown.Menu.List',
    children: [{ name: 'Dropdown.Menu.List.Item' }],
    exclusive: true,
  },
  {
    parent: 'Dropdown.Menu.GroupedList',
    children: [
      { name: 'Dropdown.Menu.GroupedList.Heading' },
      { name: 'Dropdown.Menu.GroupedList.Item' },
    ],
    exclusive: true,
  },
  {
    parent: 'Tabs',
    children: [{ name: 'Tabs.List' }, { name: 'Tabs.Panel' }],
    exclusive: true,
  },
  {
    parent: 'Tabs.List',
    children: [{ name: 'Tabs.Tab' }],
    exclusive: true,
  },
  {
    parent: 'RadioGroup',
    children: [{ name: 'Radio', discovery: 'top-level' }],
    exclusive: true,
  },
  {
    parent: 'CheckboxGroup',
    children: [{ name: 'Checkbox', discovery: 'top-level' }],
    exclusive: true,
  },
]
const contextualAutocompleteRulesByParent = new Map(
  AKSEL_CONTEXTUAL_AUTOCOMPLETE_RULES.map((rule) => [rule.parent, rule])
)
const contextualOnlyAutocompleteNames = new Set(
  AKSEL_CONTEXTUAL_AUTOCOMPLETE_RULES.flatMap((rule) =>
    rule.children
      .filter((child) => child.discovery !== 'top-level')
      .map((child) => child.name)
  )
)

const layoutShellProps: AkselCatalogProp[] = [
  {
    name: 'padding',
    type: 'SpacingScale',
    values: spacingValues,
    valueKind: 'spacing-token',
    description: 'Padding around children.',
  },
  {
    name: 'paddingInline',
    type: 'SpacingScale',
    values: spacingValues,
    valueKind: 'spacing-token',
    description: 'Horizontal padding.',
  },
  {
    name: 'paddingBlock',
    type: 'SpacingScale',
    values: spacingValues,
    valueKind: 'spacing-token',
    description: 'Vertical padding.',
  },
  {
    name: 'margin',
    type: 'SpacingScale | "auto"',
    values: spacingWithAutoValues,
    valueKind: 'spacing-token',
    description: 'Margin around the element.',
  },
  {
    name: 'marginInline',
    type: 'SpacingScale | "auto"',
    values: spacingWithAutoValues,
    valueKind: 'spacing-token',
    description: 'Horizontal margin.',
  },
  {
    name: 'marginBlock',
    type: 'SpacingScale | "auto"',
    values: spacingWithAutoValues,
    valueKind: 'spacing-token',
    description: 'Vertical margin.',
  },
  {
    name: 'width',
    type: 'string',
    description: 'CSS width.',
  },
  {
    name: 'height',
    type: 'string',
    description: 'CSS height.',
  },
  {
    name: 'as',
    type: 'string',
    description: 'HTML element to render as.',
  },
]

export const AKSEL_CATALOG: AkselCatalogEntry[] = [
  {
    id: 'page',
    name: 'Page',
    group: 'layout',
    status: 'current',
    package: '@navikt/ds-react',
    importName: 'Page',
    importGuidance: "import { Page } from '@navikt/ds-react';",
    docs: `${COMPONENT_DOCS_BASE}/page`,
    description: 'Main page container with responsive layout.',
    keywords: ['page', 'container', 'layout', 'wrapper', 'main'],
    props: [
      {
        name: 'background',
        type: 'string',
        values: AKSEL_TOKEN_METADATA.background.values,
        valueKind: 'background-token',
        description: 'Background color token fragment.',
      },
      {
        name: 'footer',
        type: 'ReactNode',
        description: 'Footer content.',
      },
      {
        name: 'footerPosition',
        type: '"fixed" | "relative"',
        values: ['fixed', 'relative'],
        valueKind: 'enum',
        description: 'Footer positioning.',
      },
      {
        name: 'data-color',
        type: 'string',
        values: dataColorValues,
        valueKind: 'data-color',
        description: 'Dynamic color context for the page.',
      },
    ],
    snippet: {
      code: '<Page>\n  Page content\n</Page>',
      description: 'Page shell for a prototype screen.',
    },
  },
  {
    id: 'page-block',
    name: 'Page.Block',
    group: 'layout',
    status: 'current',
    package: '@navikt/ds-react',
    importName: 'Page',
    importGuidance: "import { Page } from '@navikt/ds-react';",
    docs: `${COMPONENT_DOCS_BASE}/page`,
    description: 'Page content block with a responsive max width.',
    keywords: ['page', 'block', 'content', 'width', 'gutters'],
    props: [
      {
        name: 'width',
        type: '"text" | "md" | "lg" | "xl" | "2xl"',
        values: ['text', 'md', 'lg', 'xl', '2xl'],
        valueKind: 'enum',
        default: 'lg',
        description: 'Predefined max width for the block.',
      },
      {
        name: 'gutters',
        type: 'boolean',
        values: ['true', 'false'],
        valueKind: 'enum',
        description: 'Adds standard responsive inline padding.',
      },
      {
        name: 'as',
        type: 'string',
        description: 'HTML element to render as.',
      },
    ],
    snippet: {
      code: '<Page.Block width="lg">\n  Content\n</Page.Block>',
      description: 'Constrained content block inside a Page.',
    },
  },
  {
    id: 'hstack',
    name: 'HStack',
    group: 'layout',
    status: 'current',
    package: '@navikt/ds-react',
    importName: 'HStack',
    importGuidance: "import { HStack } from '@navikt/ds-react';",
    docs: `${COMPONENT_DOCS_BASE}/hstack`,
    description: 'Horizontal stack with flexbox alignment and v8 spacing.',
    keywords: ['hstack', 'horizontal', 'stack', 'row', 'flex', 'layout'],
    props: [
      {
        name: 'gap',
        type: 'SpacingScale',
        values: spacingValues,
        valueKind: 'spacing-token',
        description: 'Space between items.',
      },
      {
        name: 'align',
        type: '"start" | "center" | "end" | "baseline" | "stretch"',
        values: ['start', 'center', 'end', 'baseline', 'stretch'],
        valueKind: 'enum',
        description: 'Vertical alignment.',
      },
      {
        name: 'justify',
        type: '"start" | "center" | "end" | "space-around" | "space-between" | "space-evenly"',
        values: ['start', 'center', 'end', 'space-around', 'space-between', 'space-evenly'],
        valueKind: 'enum',
        description: 'Horizontal alignment.',
      },
      {
        name: 'wrap',
        type: 'boolean',
        values: ['true', 'false'],
        valueKind: 'enum',
        description: 'Enable flex wrapping.',
      },
      ...layoutShellProps,
    ],
    snippet: {
      code: '<HStack gap="space-16" align="center">\n  <div>Item 1</div>\n  <div>Item 2</div>\n</HStack>',
      description: 'Horizontal layout with current v8 spacing tokens.',
    },
  },
  {
    id: 'vstack',
    name: 'VStack',
    group: 'layout',
    status: 'current',
    package: '@navikt/ds-react',
    importName: 'VStack',
    importGuidance: "import { VStack } from '@navikt/ds-react';",
    docs: `${COMPONENT_DOCS_BASE}/vstack`,
    description: 'Vertical stack with flexbox alignment and v8 spacing.',
    keywords: ['vstack', 'vertical', 'stack', 'column', 'flex', 'layout'],
    props: [
      {
        name: 'gap',
        type: 'SpacingScale',
        values: spacingValues,
        valueKind: 'spacing-token',
        description: 'Space between items.',
      },
      {
        name: 'align',
        type: '"start" | "center" | "end" | "stretch"',
        values: ['start', 'center', 'end', 'stretch'],
        valueKind: 'enum',
        description: 'Horizontal alignment.',
      },
      {
        name: 'justify',
        type: '"start" | "center" | "end" | "space-around" | "space-between" | "space-evenly"',
        values: ['start', 'center', 'end', 'space-around', 'space-between', 'space-evenly'],
        valueKind: 'enum',
        description: 'Vertical alignment.',
      },
      ...layoutShellProps,
    ],
    snippet: {
      code: '<VStack gap="space-16">\n  <div>First item</div>\n  <div>Second item</div>\n</VStack>',
      description: 'Vertical layout with current v8 spacing tokens.',
    },
  },
  {
    id: 'hgrid',
    name: 'HGrid',
    group: 'layout',
    status: 'current',
    package: '@navikt/ds-react',
    importName: 'HGrid',
    importGuidance: "import { HGrid } from '@navikt/ds-react';",
    docs: `${COMPONENT_DOCS_BASE}/hgrid`,
    description: 'Responsive horizontal grid using v8 spacing tokens.',
    keywords: ['hgrid', 'grid', 'horizontal', 'columns', 'layout'],
    props: [
      {
        name: 'columns',
        type: 'number | string | ResponsiveProp<string>',
        description: 'Grid column definition.',
      },
      {
        name: 'gap',
        type: 'SpacingScale',
        values: spacingValues,
        valueKind: 'spacing-token',
        description: 'Gap between grid items.',
      },
      {
        name: 'align',
        type: '"start" | "center" | "end" | "stretch"',
        values: ['start', 'center', 'end', 'stretch'],
        valueKind: 'enum',
        description: 'Vertical alignment.',
      },
    ],
    snippet: {
      code: '<HGrid columns={{ xs: 1, md: 2 }} gap="space-16">\n  <div>Column 1</div>\n  <div>Column 2</div>\n</HGrid>',
      description: 'Responsive two-column grid.',
    },
  },
  {
    id: 'box',
    name: 'Box',
    group: 'layout',
    status: 'current',
    package: '@navikt/ds-react',
    importName: 'Box',
    importGuidance: "import { Box } from '@navikt/ds-react';",
    docs: `${COMPONENT_DOCS_BASE}/box`,
    description: 'Generic container with spacing, color, border, radius, and shadow tokens.',
    keywords: ['box', 'container', 'layout', 'padding', 'border', 'shadow'],
    props: [
      {
        name: 'padding',
        type: 'SpacingScale',
        values: spacingValues,
        valueKind: 'spacing-token',
        description: 'Padding around children.',
      },
      {
        name: 'paddingInline',
        type: 'SpacingScale',
        values: spacingValues,
        valueKind: 'spacing-token',
        description: 'Horizontal padding.',
      },
      {
        name: 'paddingBlock',
        type: 'SpacingScale',
        values: spacingValues,
        valueKind: 'spacing-token',
        description: 'Vertical padding.',
      },
      {
        name: 'background',
        type: 'string',
        values: AKSEL_TOKEN_METADATA.background.values,
        valueKind: 'background-token',
        description: 'Background token fragment.',
      },
      {
        name: 'borderColor',
        type: 'string',
        values: AKSEL_TOKEN_METADATA.borderColor.values,
        valueKind: 'border-color-token',
        description: 'Border color token fragment.',
      },
      {
        name: 'borderRadius',
        type: 'string',
        values: AKSEL_TOKEN_METADATA.radius.values,
        valueKind: 'radius-token',
        description: 'Border radius token fragment.',
      },
      {
        name: 'borderWidth',
        type: '"0" | "1" | "2" | "3" | "4" | "5"',
        values: ['0', '1', '2', '3', '4', '5'],
        valueKind: 'enum',
        description: 'Border width token fragment.',
      },
      {
        name: 'shadow',
        type: 'string',
        values: AKSEL_TOKEN_METADATA.shadow.values,
        valueKind: 'shadow-token',
        description: 'Shadow token fragment.',
      },
      ...layoutShellProps,
    ],
    snippet: {
      code: '<Box padding="space-16" background="neutral-softA" borderRadius="8">\n  Content\n</Box>',
      description: 'Token-based container for grouping content.',
    },
  },
  {
    id: 'button',
    name: 'Button',
    group: 'component',
    status: 'current',
    package: '@navikt/ds-react',
    importName: 'Button',
    importGuidance: "import { Button } from '@navikt/ds-react';",
    docs: `${COMPONENT_DOCS_BASE}/button`,
    description: 'Action button with Aksel v8 variants and sizes.',
    keywords: ['button', 'click', 'action', 'submit', 'primary', 'cta'],
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
        valueKind: 'enum',
        default: 'primary',
        description: 'Button style variant.',
      },
      {
        name: 'size',
        type: '"medium" | "small" | "xsmall"',
        values: ['medium', 'small', 'xsmall'],
        valueKind: 'enum',
        default: 'medium',
        description: 'Button size.',
      },
      {
        name: 'loading',
        type: 'boolean',
        values: ['true', 'false'],
        valueKind: 'enum',
        description: 'Shows loading state and disables the button.',
      },
      {
        name: 'disabled',
        type: 'boolean',
        values: ['true', 'false'],
        valueKind: 'enum',
        description: 'Disables button interaction.',
      },
      {
        name: 'icon',
        type: 'ReactNode',
        description: 'Icon element to display.',
      },
      {
        name: 'iconPosition',
        type: '"left" | "right"',
        values: ['left', 'right'],
        valueKind: 'enum',
        default: 'left',
        description: 'Position of the icon.',
      },
    ],
    snippet: {
      code: '<Button variant="primary">Button text</Button>',
      description: 'Primary action button.',
    },
  },
  {
    id: 'checkbox',
    name: 'Checkbox',
    group: 'component',
    status: 'current',
    package: '@navikt/ds-react',
    importName: 'Checkbox',
    importGuidance: "import { Checkbox } from '@navikt/ds-react';",
    docs: `${COMPONENT_DOCS_BASE}/checkbox`,
    description: 'Checkbox input with a visible label.',
    keywords: ['checkbox', 'check', 'consent', 'boolean', 'form', 'input'],
    props: [
      {
        name: 'value',
        type: 'string',
        description: 'Submitted checkbox value.',
      },
      {
        name: 'indeterminate',
        type: 'boolean',
        values: ['true', 'false'],
        valueKind: 'enum',
        description: 'Show a partially selected state.',
      },
      {
        name: 'description',
        type: 'ReactNode',
        description: 'Additional helper text for the checkbox.',
      },
      {
        name: 'size',
        type: '"medium" | "small"',
        values: ['medium', 'small'],
        valueKind: 'enum',
        default: 'medium',
        description: 'Checkbox size.',
      },
    ],
    snippet: {
      code:
        '<Checkbox description="You can change this later." name="emailUpdates">\n' +
        '  Send me email updates\n' +
        '</Checkbox>',
      description: 'Visible checkbox example.',
    },
  },
  {
    id: 'radio',
    name: 'Radio',
    group: 'component',
    status: 'current',
    package: '@navikt/ds-react',
    importName: 'Radio',
    importGuidance: "import { Radio, RadioGroup } from '@navikt/ds-react';",
    docs: `${COMPONENT_DOCS_BASE}/radio`,
    description: 'Single-choice radio group with a visible legend.',
    keywords: ['radio', 'radiogroup', 'single choice', 'choice', 'form', 'input'],
    props: [
      {
        name: 'value',
        type: 'string',
        required: true,
        description: 'Value submitted when the radio is selected.',
      },
      {
        name: 'description',
        type: 'ReactNode',
        description: 'Additional helper text for the radio option.',
      },
      {
        name: 'size',
        type: '"medium" | "small"',
        values: ['medium', 'small'],
        valueKind: 'enum',
        default: 'medium',
        description: 'Radio size.',
      },
    ],
    snippet: {
      code:
        '<RadioGroup legend="Choose delivery speed" defaultValue="standard" name="deliverySpeed">\n' +
        '  <Radio value="standard">Standard</Radio>\n' +
        '  <Radio value="express">Express</Radio>\n' +
        '</RadioGroup>',
      description: 'Single-choice radio group example.',
    },
  },
  {
    id: 'datepicker',
    name: 'DatePicker',
    group: 'component',
    status: 'current',
    package: '@navikt/ds-react',
    importName: 'DatePicker',
    importGuidance: "import { DatePicker, useDatepicker } from '@navikt/ds-react';",
    docs: `${COMPONENT_DOCS_BASE}/datepicker`,
    description: 'Hook-backed date picker input.',
    keywords: ['date', 'datepicker', 'calendar', 'form', 'input'],
    props: [
      {
        name: 'fromDate',
        type: 'Date',
        description: 'The earliest selectable day.',
      },
      {
        name: 'toDate',
        type: 'Date',
        description: 'The latest selectable day.',
      },
      {
        name: 'dropdownCaption',
        type: 'boolean',
        values: ['true', 'false'],
        valueKind: 'enum',
        description: 'Show month and year dropdowns when fromDate and toDate are set.',
      },
      {
        name: 'disableWeekends',
        type: 'boolean',
        values: ['true', 'false'],
        valueKind: 'enum',
        description: 'Disable Saturday and Sunday.',
      },
      {
        name: 'mode',
        type: '"single" | "multiple" | "range"',
        values: ['single', 'multiple', 'range'],
        valueKind: 'enum',
        description: 'Date selection mode.',
      },
    ],
    snippet: {
      code: '<DatePickerField{{datePickerFieldSuffix}} />',
      hooksCode:
        'export const DatePickerField{{datePickerFieldSuffix}} = () => {\n' +
        '  const { datepickerProps, inputProps } = useDatepicker({\n' +
        '    defaultSelected: new Date("2025-06-15"),\n' +
        '    fromDate: new Date("2025-01-01"),\n' +
        '    toDate: new Date("2025-12-31"),\n' +
        '  })\n' +
        '\n' +
        '  return (\n' +
        '    <DatePicker {...datepickerProps}>\n' +
        '      <DatePicker.Input\n' +
        '        {...inputProps}\n' +
        '        label="Choose meeting date"\n' +
        '        description="Pick a date in 2025."\n' +
        '        name="meetingDate"\n' +
        '      />\n' +
        '    </DatePicker>\n' +
        '  )\n' +
        '}',
      description: 'Date picker input with Hooks-tab state.',
    },
  },
  {
    id: 'monthpicker',
    name: 'MonthPicker',
    group: 'component',
    status: 'current',
    package: '@navikt/ds-react',
    importName: 'MonthPicker',
    importGuidance: "import { MonthPicker, useMonthpicker } from '@navikt/ds-react';",
    docs: `${COMPONENT_DOCS_BASE}/monthpicker`,
    description: 'Hook-backed month picker input.',
    keywords: ['month', 'monthpicker', 'calendar', 'form', 'input'],
    props: [
      {
        name: 'fromDate',
        type: 'Date',
        description: 'The earliest selectable month.',
      },
      {
        name: 'toDate',
        type: 'Date',
        description: 'The latest selectable month.',
      },
      {
        name: 'dropdownCaption',
        type: 'boolean',
        values: ['true', 'false'],
        valueKind: 'enum',
        description: 'Show a year dropdown when fromDate and toDate are set.',
      },
      {
        name: 'selected',
        type: 'Date',
        description: 'Controlled selected month.',
      },
      {
        name: 'defaultSelected',
        type: 'Date',
        description: 'Initial selected month for uncontrolled state.',
      },
    ],
    snippet: {
      code: '<MonthPickerField{{monthPickerFieldSuffix}} />',
      hooksCode:
        'export const MonthPickerField{{monthPickerFieldSuffix}} = () => {\n' +
        '  const { monthpickerProps, inputProps } = useMonthpicker({\n' +
        '    defaultSelected: new Date("2025-09-01"),\n' +
        '    fromDate: new Date("2025-01-01"),\n' +
        '    toDate: new Date("2025-12-31"),\n' +
        '  })\n' +
        '\n' +
        '  return (\n' +
        '    <MonthPicker {...monthpickerProps}>\n' +
        '      <MonthPicker.Input\n' +
        '        {...inputProps}\n' +
        '        label="Choose reporting month"\n' +
        '        description="Select a month in 2025."\n' +
        '        name="reportingMonth"\n' +
        '      />\n' +
        '    </MonthPicker>\n' +
        '  )\n' +
        '}',
      description: 'Month picker input with Hooks-tab state.',
    },
  },
  {
    id: 'search',
    name: 'Search',
    group: 'component',
    status: 'current',
    package: '@navikt/ds-react',
    importName: 'Search',
    importGuidance: "import { Search } from '@navikt/ds-react';",
    docs: `${COMPONENT_DOCS_BASE}/search`,
    description: 'Search field inside an accessible search form.',
    keywords: ['search', 'find', 'query', 'filter', 'input'],
    props: [
      {
        name: 'label',
        type: 'ReactNode',
        required: true,
        description: 'Accessible search label.',
      },
      {
        name: 'variant',
        type: '"primary" | "secondary" | "simple"',
        values: ['primary', 'secondary', 'simple'],
        valueKind: 'enum',
        default: 'primary',
        description: 'Search button style.',
      },
      {
        name: 'clearButton',
        type: 'boolean',
        values: ['true', 'false'],
        valueKind: 'enum',
        description: 'Show the clear button.',
      },
      {
        name: 'htmlSize',
        type: 'number | string',
        description: 'HTML input width in characters.',
      },
    ],
    snippet: {
      code:
        '<form role="search" onSubmit={(event) => event.preventDefault()}>\n' +
        '  <Search label="Search projects" variant="secondary" name="projectSearch" />\n' +
        '</form>',
      description: 'Accessible search form example.',
    },
  },
  {
    id: 'select',
    name: 'Select',
    group: 'component',
    status: 'current',
    package: '@navikt/ds-react',
    importName: 'Select',
    importGuidance: "import { Select } from '@navikt/ds-react';",
    docs: `${COMPONENT_DOCS_BASE}/select`,
    description: 'Labeled select input with visible choices.',
    keywords: ['select', 'dropdown', 'options', 'form', 'menu'],
    props: [
      {
        name: 'label',
        type: 'ReactNode',
        required: true,
        description: 'Select label.',
      },
      {
        name: 'size',
        type: '"medium" | "small"',
        values: ['medium', 'small'],
        valueKind: 'enum',
        default: 'medium',
        description: 'Select size.',
      },
      {
        name: 'description',
        type: 'ReactNode',
        description: 'Additional helper text.',
      },
      {
        name: 'hideLabel',
        type: 'boolean',
        values: ['true', 'false'],
        valueKind: 'enum',
        description: 'Hide the label visually while keeping it accessible.',
      },
    ],
    snippet: {
      code:
        '<Select label="Choose delivery window" defaultValue="" name="deliveryWindow">\n' +
        '  <option value="" disabled>Select an option</option>\n' +
        '  <option value="morning">Morning</option>\n' +
        '  <option value="afternoon">Afternoon</option>\n' +
        '</Select>',
      description: 'Select with placeholder and options.',
    },
  },
  {
    id: 'switch',
    name: 'Switch',
    group: 'component',
    status: 'current',
    package: '@navikt/ds-react',
    importName: 'Switch',
    importGuidance: "import { Switch } from '@navikt/ds-react';",
    docs: `${COMPONENT_DOCS_BASE}/switch`,
    description: 'Toggle switch with a visible label.',
    keywords: ['switch', 'toggle', 'boolean', 'settings', 'form'],
    props: [
      {
        name: 'description',
        type: 'ReactNode',
        description: 'Additional helper text.',
      },
      {
        name: 'size',
        type: '"medium" | "small"',
        values: ['medium', 'small'],
        valueKind: 'enum',
        default: 'medium',
        description: 'Switch size.',
      },
      {
        name: 'position',
        type: '"left" | "right"',
        values: ['left', 'right'],
        valueKind: 'enum',
        description: 'Place the switch on the left or right side of the label.',
      },
      {
        name: 'loading',
        type: 'boolean',
        values: ['true', 'false'],
        valueKind: 'enum',
        description: 'Show a short loading state.',
      },
    ],
    snippet: {
      code:
        '<Switch defaultChecked description="Turn this off if you do not want reminder emails." name="emailReminders">\n' +
        '  Email reminders\n' +
        '</Switch>',
      description: 'Visible switch example.',
    },
  },
  {
    id: 'textarea',
    name: 'Textarea',
    group: 'component',
    status: 'current',
    package: '@navikt/ds-react',
    importName: 'Textarea',
    importGuidance: "import { Textarea } from '@navikt/ds-react';",
    docs: `${COMPONENT_DOCS_BASE}/textarea`,
    description: 'Multi-line text input with label and helper text.',
    keywords: ['textarea', 'multiline', 'text', 'form', 'input'],
    props: [
      {
        name: 'label',
        type: 'ReactNode',
        required: true,
        description: 'Textarea label.',
      },
      {
        name: 'description',
        type: 'ReactNode',
        description: 'Additional helper text.',
      },
      {
        name: 'minRows',
        type: 'number',
        description: 'Minimum number of visible text rows.',
      },
      {
        name: 'resize',
        type: 'boolean | "vertical" | "horizontal"',
        values: ['true', 'false', 'vertical', 'horizontal'],
        valueKind: 'enum',
        description: 'Allow resizing the field.',
      },
      {
        name: 'maxLength',
        type: 'number',
        description: 'Character counter limit.',
      },
    ],
    snippet: {
      code:
        '<Textarea\n' +
        '  label="Additional details"\n' +
        '  description="Include anything the reviewer should know."\n' +
        '  name="additionalDetails"\n' +
        '  minRows={4}\n' +
        '/>',
      description: 'Labeled multi-line text field.',
    },
  },
  {
    id: 'togglegroup',
    name: 'ToggleGroup',
    group: 'component',
    status: 'current',
    package: '@navikt/ds-react',
    importName: 'ToggleGroup',
    importGuidance: "import { ToggleGroup } from '@navikt/ds-react';",
    docs: `${COMPONENT_DOCS_BASE}/toggle-group`,
    description: 'Toggle group with Hooks-tab selection state.',
    keywords: ['toggle', 'group', 'segmented', 'choice', 'filter', 'view'],
    props: [
      {
        name: 'value',
        type: 'string',
        description: 'Controlled selected value.',
      },
      {
        name: 'defaultValue',
        type: 'string',
        description: 'Initial selected value for uncontrolled state.',
      },
      {
        name: 'onChange',
        type: '(value: string) => void',
        required: true,
        description: 'Callback when the selected item changes.',
      },
      {
        name: 'label',
        type: 'ReactNode',
        description: 'Label describing the toggle group.',
      },
      {
        name: 'fill',
        type: 'boolean',
        values: ['true', 'false'],
        valueKind: 'enum',
        description: 'Stretch the items to fill the available width.',
      },
    ],
    snippet: {
      code:
        '<ToggleGroup\n' +
        '  {...useToggleGroupState{{toggleGroupSuffix}}()}\n' +
        '  label="Choose view"\n' +
        '>\n' +
        '  <ToggleGroup.Item value="list">List</ToggleGroup.Item>\n' +
        '  <ToggleGroup.Item value="calendar">Calendar</ToggleGroup.Item>\n' +
        '</ToggleGroup>',
      hooksCode:
        'export const useToggleGroupState{{toggleGroupSuffix}} = (initialValue = "list") => {\n' +
        '  const [selectedView, setSelectedView] = useState(initialValue)\n' +
        '\n' +
        '  return {\n' +
        '    value: selectedView,\n' +
        '    onChange: setSelectedView,\n' +
        '  }\n' +
        '}',
      description: 'Toggle group with Hooks-tab state.',
    },
  },
  {
    id: 'bodyshort',
    name: 'BodyShort',
    group: 'component',
    status: 'current',
    package: '@navikt/ds-react',
    importName: 'BodyShort',
    importGuidance: "import { BodyShort } from '@navikt/ds-react';",
    docs: `${COMPONENT_DOCS_BASE}/typography`,
    description: 'Short body text with compact line height.',
    keywords: ['bodyshort', 'body short', 'text', 'typography', 'paragraph', 'copy'],
    props: [
      {
        name: 'size',
        type: '"large" | "medium" | "small"',
        values: ['large', 'medium', 'small'],
        valueKind: 'enum',
        default: 'medium',
        description: 'Typography size.',
      },
      {
        name: 'weight',
        type: '"regular" | "semibold"',
        values: ['regular', 'semibold'],
        valueKind: 'enum',
        default: 'regular',
        description: 'Typography weight.',
      },
      {
        name: 'spacing',
        type: 'boolean',
        values: ['true', 'false'],
        valueKind: 'enum',
        description: 'Add bottom margin.',
      },
      {
        name: 'data-color',
        type: 'string',
        values: dataColorValues,
        valueKind: 'data-color',
        description: 'Dynamic color context for the text.',
      },
      {
        name: 'truncate',
        type: 'boolean',
        values: ['true', 'false'],
        valueKind: 'enum',
        description: 'Truncate text with ellipsis.',
      },
    ],
    snippet: {
      code: '<BodyShort>Short text</BodyShort>',
      description: 'Short paragraph text.',
    },
  },
  {
    id: 'heading',
    name: 'Heading',
    group: 'component',
    status: 'current',
    package: '@navikt/ds-react',
    importName: 'Heading',
    importGuidance: "import { Heading } from '@navikt/ds-react';",
    docs: `${COMPONENT_DOCS_BASE}/typography`,
    description: 'Heading text.',
    keywords: ['heading', 'title', 'headline', 'typography', 'section'],
    props: [
      {
        name: 'level',
        type: '"1" | "2" | "3" | "4" | "5" | "6"',
        values: ['1', '2', '3', '4', '5', '6'],
        valueKind: 'enum',
        default: '1',
        description: 'Semantic heading level.',
      },
      {
        name: 'size',
        type: '"xlarge" | "large" | "medium" | "small" | "xsmall"',
        values: ['xlarge', 'large', 'medium', 'small', 'xsmall'],
        valueKind: 'enum',
        description: 'Visual heading size.',
      },
      {
        name: 'spacing',
        type: 'boolean',
        values: ['true', 'false'],
        valueKind: 'enum',
        description: 'Add bottom margin.',
      },
      {
        name: 'data-color',
        type: 'string',
        values: dataColorValues,
        valueKind: 'data-color',
        description: 'Dynamic color context for the heading.',
      },
    ],
    snippet: {
      code: '<Heading level="1" size="large">Heading text</Heading>',
      description: 'Visible heading example.',
    },
  },
  {
    id: 'tag',
    name: 'Tag',
    group: 'component',
    status: 'current',
    package: '@navikt/ds-react',
    importName: 'Tag',
    importGuidance: "import { Tag } from '@navikt/ds-react';",
    docs: `${COMPONENT_DOCS_BASE}/tag`,
    description: 'Tag label component.',
    keywords: ['tag', 'status', 'badge', 'label', 'pill'],
    props: [
      {
        name: 'variant',
        type: '"outline" | "moderate" | "strong"',
        values: ['outline', 'moderate', 'strong'],
        valueKind: 'enum',
        default: 'outline',
        description: 'Visual emphasis style.',
      },
      {
        name: 'size',
        type: '"medium" | "small" | "xsmall"',
        values: ['medium', 'small', 'xsmall'],
        valueKind: 'enum',
        default: 'medium',
        description: 'Tag size.',
      },
      {
        name: 'data-color',
        type: 'string',
        values: dataColorValues,
        valueKind: 'data-color',
        description: 'Semantic color choice.',
      },
      {
        name: 'icon',
        type: 'ReactNode',
        description: 'Optional icon element.',
      },
    ],
    snippet: {
      code: '<Tag variant="moderate" data-color="info">In progress</Tag>',
      description: 'Visible status label.',
    },
  },
  {
    id: 'pagination',
    name: 'Pagination',
    group: 'component',
    status: 'current',
    package: '@navikt/ds-react',
    importName: 'Pagination',
    importGuidance: "import { Pagination } from '@navikt/ds-react';",
    docs: `${COMPONENT_DOCS_BASE}/pagination`,
    description: 'Pagination controls with Hooks-tab state.',
    keywords: ['pagination', 'paging', 'pager', 'pages', 'navigation', 'results'],
    props: [
      {
        name: 'page',
        type: 'number',
        required: true,
        description: 'Current page. Pagination indexing starts at 1.',
      },
      {
        name: 'count',
        type: 'number',
        required: true,
        description: 'Total number of pages.',
      },
      {
        name: 'onPageChange',
        type: '(page: number) => void',
        description: 'Callback when the current page changes.',
      },
      {
        name: 'size',
        type: '"medium" | "small" | "xsmall"',
        values: ['medium', 'small', 'xsmall'],
        valueKind: 'enum',
        description: 'Changes padding, height, and font-size.',
      },
      {
        name: 'srHeading',
        type: '{ tag: "h2" | "h3" | "h4" | "h5" | "h6"; text: string }',
        description: 'Accessible heading for the pagination landmark.',
      },
    ],
    snippet: {
      code:
        '<Pagination\n' +
        '  {...usePaginationState{{paginationSuffix}}()}\n' +
        '  count={9}\n' +
        '  boundaryCount={1}\n' +
        '  siblingCount={1}\n' +
        '  srHeading={{ tag: "h2", text: "Result pages" }}\n' +
        '/>',
      hooksCode:
        'export const usePaginationState{{paginationSuffix}} = (initialPage = 1) => {\n' +
        '  const [pageState, setPageState] = useState(initialPage)\n' +
        '\n' +
        '  return {\n' +
        '    page: pageState,\n' +
        '    onPageChange: setPageState,\n' +
        '  }\n' +
        '}',
      description: 'Composable Pagination with Hooks-tab state.',
    },
  },
  {
    id: 'alert',
    name: 'Alert',
    group: 'component',
    status: 'legacy',
    package: '@navikt/ds-react',
    importName: 'Alert',
    importGuidance: "import { Alert } from '@navikt/ds-react';",
    docs: `${COMPONENT_DOCS_BASE}/alert`,
    description: 'Display important feedback messages.',
    keywords: ['alert', 'message', 'notification', 'banner', 'info'],
    props: [
      {
        name: 'variant',
        type: '"info" | "warning" | "error" | "success"',
        values: ['info', 'warning', 'error', 'success'],
        valueKind: 'enum',
        required: true,
        description: 'Message severity.',
      },
      {
        name: 'size',
        type: '"medium" | "small"',
        values: ['medium', 'small'],
        valueKind: 'enum',
        default: 'medium',
        description: 'Alert size.',
      },
      {
        name: 'inline',
        type: 'boolean',
        values: ['true', 'false'],
        valueKind: 'enum',
        description: 'Use inline alert layout.',
      },
    ],
    snippet: {
      code: '<Alert variant="info">Alert message</Alert>',
      description: 'Informational feedback message.',
    },
  },
  {
    id: 'textfield',
    name: 'TextField',
    group: 'component',
    status: 'current',
    package: '@navikt/ds-react',
    importName: 'TextField',
    importGuidance: "import { TextField } from '@navikt/ds-react';",
    docs: `${COMPONENT_DOCS_BASE}/textfield`,
    description: 'Single-line text input with label and validation props.',
    keywords: ['input', 'text', 'form', 'field', 'textbox'],
    props: [
      {
        name: 'label',
        type: 'ReactNode',
        required: true,
        description: 'Input label.',
      },
      {
        name: 'size',
        type: '"medium" | "small"',
        values: ['medium', 'small'],
        valueKind: 'enum',
        default: 'medium',
        description: 'Input size.',
      },
      {
        name: 'type',
        type: 'string',
        values: ['text', 'email', 'password', 'tel', 'url', 'time', 'number'],
        valueKind: 'enum',
        default: 'text',
        description: 'HTML input type.',
      },
      {
        name: 'error',
        type: 'ReactNode',
        description: 'Validation error message.',
      },
      {
        name: 'description',
        type: 'ReactNode',
        description: 'Additional helper text.',
      },
      {
        name: 'hideLabel',
        type: 'boolean',
        values: ['true', 'false'],
        valueKind: 'enum',
        description: 'Hide the label visually while keeping it accessible.',
      },
    ],
    snippet: {
      code: '<TextField label="Label" />',
      description: 'Labeled text input.',
    },
  },
  {
    id: 'formprogress',
    name: 'FormProgress',
    group: 'component',
    status: 'experimental',
    package: '@navikt/ds-react',
    importName: 'FormProgress',
    importGuidance: "import { FormProgress } from '@navikt/ds-react';",
    docs: `${COMPONENT_DOCS_BASE}/formprogress`,
    description: 'Experimental step indicator for multi-step forms.',
    keywords: ['form', 'progress', 'steps', 'wizard', 'experimental'],
    props: [
      {
        name: 'totalSteps',
        type: 'number',
        required: true,
        description: 'Total number of steps in the flow.',
      },
      {
        name: 'activeStep',
        type: 'number',
        required: true,
        description: 'Current zero-based active step.',
      },
    ],
    snippet: {
      code:
        '<FormProgress totalSteps={3} activeStep={1}>\n' +
        '  <FormProgress.Step>Start</FormProgress.Step>\n' +
        '  <FormProgress.Step>Details</FormProgress.Step>\n' +
        '  <FormProgress.Step>Submit</FormProgress.Step>\n' +
        '</FormProgress>',
      description: 'Experimental multi-step form progress indicator.',
    },
  },
  ...iconCatalogEntries,
  {
    id: 'boxnew',
    name: 'BoxNew',
    group: 'layout',
    status: 'legacy',
    package: '@navikt/ds-react',
    importName: 'BoxNew',
    importGuidance: "import { BoxNew } from '@navikt/ds-react';",
    docs: `${COMPONENT_DOCS_BASE}/box`,
    description: 'Legacy container name retained only for compatibility; prefer Box.',
    keywords: ['boxnew', 'box', 'legacy'],
    props: [],
    snippet: {
      code: '<Box padding="space-16">Content</Box>',
      description: 'Use Box for new v8 prototypes.',
    },
  },
  {
    id: 'stack',
    name: 'Stack',
    group: 'layout',
    status: 'legacy',
    package: '@navikt/ds-react',
    importName: 'Stack',
    importGuidance: "import { Stack } from '@navikt/ds-react';",
    docs: `${COMPONENT_DOCS_BASE}/vstack`,
    description: 'Legacy stack pattern; prefer VStack or HStack for new prototypes.',
    keywords: ['stack', 'legacy', 'vstack', 'hstack'],
    props: [],
    snippet: {
      code: '<VStack gap="space-16">Content</VStack>',
      description: 'Use VStack for new v8 prototypes.',
    },
  },
  {
    id: 'grid',
    name: 'Grid',
    group: 'layout',
    status: 'legacy',
    package: '@navikt/ds-react',
    importName: 'Grid',
    importGuidance: "import { HGrid } from '@navikt/ds-react';",
    docs: `${COMPONENT_DOCS_BASE}/hgrid`,
    description: 'Legacy grid pattern; prefer HGrid for current Aksel v8 prototypes.',
    keywords: ['grid', 'legacy', 'hgrid'],
    props: [],
    snippet: {
      code: '<HGrid columns={2} gap="space-16">Content</HGrid>',
      description: 'Use HGrid for new v8 prototypes.',
    },
  },
]

export function listCatalogEntries(
  filters: {
    groups?: AkselCatalogGroup[]
    statuses?: AkselCatalogStatus[]
  } = {}
): AkselCatalogEntry[] {
  return AKSEL_CATALOG.filter((entry) => {
    const matchesGroup = filters.groups ? filters.groups.includes(entry.group) : true
    const matchesStatus = filters.statuses ? filters.statuses.includes(entry.status) : true
    return matchesGroup && matchesStatus
  })
}

export function getCatalogComponent(componentName: string): AkselCatalogEntry | undefined {
  return AKSEL_CATALOG.find((entry) => entry.name === componentName)
}

export function getCatalogPropDefinition(
  componentName: string,
  propName: string
): AkselCatalogProp | undefined {
  return getCatalogComponent(componentName)?.props.find((prop) => prop.name === propName)
}

export function getCatalogPropValues(componentName: string, propName: string): string[] {
  return getCatalogPropDefinition(componentName, propName)?.values ?? []
}

export function getCatalogTokenValues(tokenKey: keyof typeof AKSEL_TOKEN_METADATA): string[] {
  return AKSEL_TOKEN_METADATA[tokenKey].values
}

export function getCatalogSnippets(): ComponentSnippet[] {
  return filterNewAuthoringEntries(
    listCatalogEntries({
      groups: ['layout', 'component'],
      statuses: DEFAULT_DISCOVERY_STATUSES,
    })
  ).map((entry) => {
    const insertion: ComponentInsertion = {
      jsx: entry.snippet.code,
      hooks: entry.snippet.hooksCode,
    }
    return {
      id: entry.id,
      name: entry.name,
      category: entry.group as SnippetCategory,
      keywords: entry.keywords,
      template: entry.snippet.code,
      description: entry.snippet.description,
      import: entry.importGuidance,
      status: entry.status,
      docs: entry.docs,
      insertion,
    }
  })
}

export function getContextualAutocompleteRule(
  parentName: string
): AkselContextualAutocompleteRule | undefined {
  return contextualAutocompleteRulesByParent.get(parentName)
}

export function isContextualOnlyAutocompleteEntry(componentName: string): boolean {
  return contextualOnlyAutocompleteNames.has(componentName)
}

export function getCatalogPaletteComponents(): Array<{
  name: string
  category: AkselCatalogGroup
  status: AkselCatalogStatus
  import: string
  keywords: string[]
  props: AkselCatalogProp[]
  snippet: string
  description: string
  docs: string
  insertion: ComponentInsertion
}> {
  return filterNewAuthoringEntries(
    listCatalogEntries({
      groups: ['layout', 'component', 'icon'],
      statuses: DEFAULT_DISCOVERY_STATUSES,
    })
  ).map((entry) => {
    const insertion: ComponentInsertion = {
      jsx: entry.snippet.code,
      hooks: entry.snippet.hooksCode,
    }
    return {
      name: entry.name,
      category: entry.group,
      status: entry.status,
      import: entry.importGuidance,
      keywords: entry.keywords,
      props: entry.props,
      snippet: entry.snippet.code,
      description: entry.description,
      docs: entry.docs,
      insertion,
    }
  })
}
