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
  entryName?: string
  discovery?: AkselAutocompleteDiscovery
  insertion?: ComponentInsertion
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
const floatingPlacementValues = [
  'top',
  'bottom',
  'right',
  'left',
  'top-start',
  'top-end',
  'bottom-start',
  'bottom-end',
  'right-start',
  'right-end',
  'left-start',
  'left-end',
]
const floatingStrategyValues = ['absolute', 'fixed']
const tooltipPlacementValues = ['top', 'right', 'bottom', 'left']

const AKSEL_CONTEXTUAL_AUTOCOMPLETE_RULES: AkselContextualAutocompleteRule[] = [
  {
    parent: 'Accordion',
    children: [
      {
        name: 'Accordion.Item',
        insertion: {
          jsx:
            '<Accordion.Item>\n' +
            '  <Accordion.Header>When will I get an answer?</Accordion.Header>\n' +
            '  <Accordion.Content>\n' +
            '    We usually reply within five working days after we receive all documents.\n' +
            '  </Accordion.Content>\n' +
            '</Accordion.Item>',
        },
      },
    ],
    exclusive: true,
  },
  {
    parent: 'Accordion.Item',
    children: [
      {
        name: 'Accordion.Header',
        insertion: {
          jsx: '<Accordion.Header>When will I get an answer?</Accordion.Header>',
        },
      },
      {
        name: 'Accordion.Content',
        insertion: {
          jsx:
            '<Accordion.Content>\n' +
            '  We usually reply within five working days after we receive all documents.\n' +
            '</Accordion.Content>',
        },
      },
    ],
    exclusive: true,
  },
  {
    parent: 'ExpansionCard',
    children: [
      {
        name: 'ExpansionCard.Header',
        insertion: {
          jsx:
            '<ExpansionCard.Header>\n' +
            '  <ExpansionCard.Title>Payment for June</ExpansionCard.Title>\n' +
            '  <ExpansionCard.Description>\n' +
            '    You are registered as the recipient of sickness benefits from Nav.\n' +
            '  </ExpansionCard.Description>\n' +
            '</ExpansionCard.Header>',
        },
      },
      {
        name: 'ExpansionCard.Content',
        insertion: {
          jsx:
            '<ExpansionCard.Content>\n' +
            '  The payment will be sent to your employer on 14 June.\n' +
            '</ExpansionCard.Content>',
        },
      },
    ],
    exclusive: true,
  },
  {
    parent: 'ExpansionCard.Header',
    children: [
      {
        name: 'ExpansionCard.Title',
        insertion: {
          jsx: '<ExpansionCard.Title>Payment for June</ExpansionCard.Title>',
        },
      },
      {
        name: 'ExpansionCard.Description',
        insertion: {
          jsx:
            '<ExpansionCard.Description>\n' +
            '  You are registered as the recipient of sickness benefits from Nav.\n' +
            '</ExpansionCard.Description>',
        },
      },
    ],
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
      {
        name: 'Dropdown.Menu.Divider',
        entryName: 'Dropdown.Divider',
        insertion: {
          jsx: '<Dropdown.Menu.Divider />',
        },
      },
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
    parent: 'Process',
    children: [
      {
        name: 'Process.Event',
        insertion: {
          jsx:
            '<Process.Event\n' +
            '  status="active"\n' +
            '  title="Case officer is reviewing the application"\n' +
            '  timestamp="12 June 2026"\n' +
            '>\n' +
            '  You will get a message if we need more information.\n' +
            '</Process.Event>',
        },
      },
    ],
    exclusive: true,
  },
  {
    parent: 'Tabs',
    children: [
      {
        name: 'Tabs.List',
        insertion: {
          jsx:
            '<Tabs.List>\n' +
            '  <Tabs.Tab value="__AX_TAB_VALUE__" label="__AX_TAB_LABEL__" />\n' +
            '</Tabs.List>',
        },
      },
      {
        name: 'Tabs.Panel',
        insertion: {
          jsx:
            '<Tabs.Panel value="__AX_TAB_VALUE__">\n' + '  __AX_TAB_CONTENT__\n' + '</Tabs.Panel>',
        },
      },
    ],
    exclusive: true,
  },
  {
    parent: 'Tabs.List',
    children: [
      {
        name: 'Tabs.Tab',
        insertion: {
          jsx: '<Tabs.Tab value="__AX_TAB_VALUE__" label="__AX_TAB_LABEL__" />',
        },
      },
    ],
    exclusive: true,
  },
  {
    parent: 'Stepper',
    children: [
      {
        name: 'Stepper.Step',
        insertion: {
          jsx: '<Stepper.Step href="#">Choose support</Stepper.Step>',
        },
      },
    ],
    exclusive: true,
  },
  {
    parent: 'Timeline',
    children: [
      {
        name: 'Timeline.Pin',
        insertion: {
          jsx:
            '<Timeline.Pin date={new Date("2025-05-12")}>\n' +
            '  Follow-up meeting with the employer\n' +
            '</Timeline.Pin>',
        },
      },
      {
        name: 'Timeline.Row',
        insertion: {
          jsx:
            '<Timeline.Row label="Sick leave">\n' +
            '  <Timeline.Period\n' +
            '    start={new Date("2025-05-01")}\n' +
            '    end={new Date("2025-05-14")}\n' +
            '    status="warning"\n' +
            '    statusLabel="Sick leave"\n' +
            '  >\n' +
            '    50% sick leave\n' +
            '  </Timeline.Period>\n' +
            '</Timeline.Row>',
        },
      },
    ],
    exclusive: true,
  },
  {
    parent: 'Timeline.Row',
    children: [
      {
        name: 'Timeline.Period',
        insertion: {
          jsx:
            '<Timeline.Period\n' +
            '  start={new Date("2025-05-01")}\n' +
            '  end={new Date("2025-05-14")}\n' +
            '  status="warning"\n' +
            '  statusLabel="Sick leave"\n' +
            '>\n' +
            '  50% sick leave\n' +
            '</Timeline.Period>',
        },
      },
    ],
    exclusive: true,
  },
  {
    parent: 'RadioGroup',
    children: [
      {
        name: 'Radio',
        discovery: 'top-level',
        insertion: {
          jsx: '<Radio value="option1">Option 1</Radio>',
        },
      },
    ],
    exclusive: true,
  },
  {
    parent: 'CheckboxGroup',
    children: [
      {
        name: 'Checkbox',
        discovery: 'top-level',
        insertion: {
          jsx: '<Checkbox value="option1">Option 1</Checkbox>',
        },
      },
    ],
    exclusive: true,
  },
]
const contextualAutocompleteRulesByParent = new Map(
  AKSEL_CONTEXTUAL_AUTOCOMPLETE_RULES.map((rule) => [rule.parent, rule])
)
const contextualAutocompleteEntryNamesByComponent = new Map(
  AKSEL_CONTEXTUAL_AUTOCOMPLETE_RULES.flatMap((rule) =>
    rule.children
      .filter((child) => child.entryName && child.entryName !== child.name)
      .map((child) => [child.name, child.entryName!])
  )
)
const contextualOnlyAutocompleteNames = new Set(
  AKSEL_CONTEXTUAL_AUTOCOMPLETE_RULES.flatMap((rule) =>
    rule.children.filter((child) => child.discovery !== 'top-level').map((child) => child.name)
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
    id: 'actionmenu',
    name: 'ActionMenu',
    group: 'component',
    status: 'current',
    package: '@navikt/ds-react',
    importName: 'ActionMenu',
    importGuidance: "import { ActionMenu, Button } from '@navikt/ds-react';",
    docs: `${COMPONENT_DOCS_BASE}/actionmenu`,
    description: 'Action menu with trigger button and grouped actions.',
    keywords: ['action menu', 'menu', 'actions', 'overflow', 'dropdown'],
    props: [
      {
        name: 'open',
        type: 'boolean',
        values: ['true', 'false'],
        valueKind: 'enum',
        description: 'Controlled open state.',
      },
      {
        name: 'onOpenChange',
        type: '(open: boolean) => void',
        description: 'Callback when the menu opens or closes.',
      },
    ],
    snippet: {
      code:
        '<ActionMenu>\n' +
        '  <ActionMenu.Trigger>\n' +
        '    <Button type="button" variant="secondary">Actions</Button>\n' +
        '  </ActionMenu.Trigger>\n' +
        '  <ActionMenu.Content>\n' +
        '    <ActionMenu.Group label="Case actions">\n' +
        '      <ActionMenu.Item onSelect={() => {}}>Open details</ActionMenu.Item>\n' +
        '      <ActionMenu.Item onSelect={() => {}}>Send reminder</ActionMenu.Item>\n' +
        '    </ActionMenu.Group>\n' +
        '  </ActionMenu.Content>\n' +
        '</ActionMenu>',
      description: 'Trigger button with grouped action items.',
    },
  },
  {
    id: 'dropdown',
    name: 'Dropdown',
    group: 'component',
    status: 'current',
    package: '@navikt/ds-react',
    importName: 'Dropdown',
    importGuidance: "import { Button, Dropdown } from '@navikt/ds-react';",
    docs: `${COMPONENT_DOCS_BASE}/dropdown`,
    description: 'Dropdown menu with grouped and simple item lists.',
    keywords: ['dropdown', 'menu', 'grouped list', 'shortcuts', 'actions'],
    props: [
      {
        name: 'onSelect',
        type: '(element: React.MouseEvent) => void',
        description: 'Handler called when an item is selected.',
      },
      {
        name: 'closeOnSelect',
        type: 'boolean',
        values: ['true', 'false'],
        valueKind: 'enum',
        default: 'true',
        description: 'Close the menu after an item is selected.',
      },
      {
        name: 'defaultOpen',
        type: 'boolean',
        values: ['true', 'false'],
        valueKind: 'enum',
        default: 'false',
        description: 'Start with the menu open.',
      },
      {
        name: 'open',
        type: 'boolean',
        values: ['true', 'false'],
        valueKind: 'enum',
        description: 'Controlled open state.',
      },
      {
        name: 'onOpenChange',
        type: '(open: boolean) => void',
        description: 'Callback when the menu opens or closes.',
      },
    ],
    snippet: {
      code:
        '<Dropdown>\n' +
        '  <Button as={Dropdown.Toggle} type="button" variant="secondary">\n' +
        '    Open shortcuts\n' +
        '  </Button>\n' +
        '  <Dropdown.Menu>\n' +
        '    <Dropdown.Menu.GroupedList>\n' +
        '      <Dropdown.Menu.GroupedList.Heading>\n' +
        '        Shortcuts\n' +
        '      </Dropdown.Menu.GroupedList.Heading>\n' +
        '      <Dropdown.Menu.GroupedList.Item onClick={() => {}}>\n' +
        '        Activity plan\n' +
        '      </Dropdown.Menu.GroupedList.Item>\n' +
        '      <Dropdown.Menu.GroupedList.Item onClick={() => {}}>\n' +
        '        Case overview\n' +
        '      </Dropdown.Menu.GroupedList.Item>\n' +
        '    </Dropdown.Menu.GroupedList>\n' +
        '    <Dropdown.Menu.Divider />\n' +
        '    <Dropdown.Menu.List>\n' +
        '      <Dropdown.Menu.List.Item onClick={() => {}}>\n' +
        '        Contact the user\n' +
        '      </Dropdown.Menu.List.Item>\n' +
        '      <Dropdown.Menu.List.Item onClick={() => {}}>\n' +
        '        Open payment details\n' +
        '      </Dropdown.Menu.List.Item>\n' +
        '    </Dropdown.Menu.List>\n' +
        '  </Dropdown.Menu>\n' +
        '</Dropdown>',
      description: 'Dropdown with grouped shortcuts and actions.',
    },
  },
  {
    id: 'helptext',
    name: 'HelpText',
    group: 'component',
    status: 'current',
    package: '@navikt/ds-react',
    importName: 'HelpText',
    importGuidance: "import { BodyShort, HStack, HelpText } from '@navikt/ds-react';",
    docs: `${COMPONENT_DOCS_BASE}/helptext`,
    description: 'Inline help trigger with explanatory text.',
    keywords: ['help text', 'helptext', 'help', 'info', 'question'],
    props: [
      {
        name: 'title',
        type: 'string',
        default: 'Mer informasjon',
        description: 'Tooltip title for the help button.',
      },
      {
        name: 'placement',
        type: '"top" | "bottom" | "right" | "left" | "top-start" | "top-end" | "bottom-start" | "bottom-end" | "right-start" | "right-end" | "left-start" | "left-end"',
        values: floatingPlacementValues,
        valueKind: 'enum',
        default: 'top',
        description: 'Preferred popover placement.',
      },
      {
        name: 'strategy',
        type: '"absolute" | "fixed"',
        values: floatingStrategyValues,
        valueKind: 'enum',
        default: 'absolute',
        description: 'Floating-position strategy.',
      },
    ],
    snippet: {
      code:
        '<HStack gap="space-4" align="center">\n' +
        '  <BodyShort>Estimated payout</BodyShort>\n' +
        '  <HelpText title="How is this calculated?">\n' +
        '    The estimate is based on the latest approved information in your case.\n' +
        '  </HelpText>\n' +
        '</HStack>',
      description: 'Label with inline help explanation.',
    },
  },
  {
    id: 'popover',
    name: 'Popover',
    group: 'component',
    status: 'current',
    package: '@navikt/ds-react',
    importName: 'Popover',
    importGuidance: "import { Button, Popover } from '@navikt/ds-react';",
    docs: `${COMPONENT_DOCS_BASE}/popover`,
    description: 'Controlled popover with trigger, anchor, and close behavior.',
    keywords: ['popover', 'overlay', 'floating panel', 'anchor', 'details'],
    props: [
      {
        name: 'anchorEl',
        type: 'Element | null',
        required: true,
        description: 'Element the popover anchors to.',
      },
      {
        name: 'open',
        type: 'boolean',
        values: ['true', 'false'],
        valueKind: 'enum',
        required: true,
        description: 'Controlled open state.',
      },
      {
        name: 'onClose',
        type: '() => void',
        required: true,
        description: 'Callback used to close the popover.',
      },
      {
        name: 'placement',
        type: '"top" | "bottom" | "right" | "left" | "top-start" | "top-end" | "bottom-start" | "bottom-end" | "right-start" | "right-end" | "left-start" | "left-end"',
        values: floatingPlacementValues,
        valueKind: 'enum',
        default: 'top',
        description: 'Preferred popover placement.',
      },
      {
        name: 'strategy',
        type: '"absolute" | "fixed"',
        values: floatingStrategyValues,
        valueKind: 'enum',
        default: 'absolute',
        description: 'Floating-position strategy.',
      },
    ],
    snippet: {
      code:
        '<Button\n' +
        '  ref={setAnchorEl{{popoverSuffix}}}\n' +
        '  onClick={() => setOpenState{{popoverSuffix}}(!openState{{popoverSuffix}})}\n' +
        '  aria-expanded={openState{{popoverSuffix}}}\n' +
        '  aria-controls={openState{{popoverSuffix}} ? popoverId{{popoverSuffix}} : undefined}\n' +
        '>\n' +
        '  Åpne popover\n' +
        '</Button>\n' +
        '\n' +
        '<Popover\n' +
        '  open={openState{{popoverSuffix}}}\n' +
        '  onClose={() => setOpenState{{popoverSuffix}}(false)}\n' +
        '  anchorEl={anchorEl{{popoverSuffix}}}\n' +
        '  id={popoverId{{popoverSuffix}}}\n' +
        '>\n' +
        '  <Popover.Content>Innhold her!</Popover.Content>\n' +
        '</Popover>',
      hooksCode:
        'const [anchorEl{{popoverSuffix}}, setAnchorEl{{popoverSuffix}}] = useState<HTMLButtonElement | null>(null)\n' +
        'const [openState{{popoverSuffix}}, setOpenState{{popoverSuffix}}] = useState(false)\n' +
        'const popoverId{{popoverSuffix}} = useId()',
      description: 'Trigger button with inline popover content.',
    },
  },
  {
    id: 'tooltip',
    name: 'Tooltip',
    group: 'component',
    status: 'current',
    package: '@navikt/ds-react',
    importName: 'Tooltip',
    importGuidance: "import { Button, Tooltip } from '@navikt/ds-react';",
    docs: `${COMPONENT_DOCS_BASE}/tooltip`,
    description: 'Tooltip around a visible trigger button.',
    keywords: ['tooltip', 'hover', 'hint', 'shortcut', 'help'],
    props: [
      {
        name: 'content',
        type: 'string',
        required: true,
        description: 'Tooltip text content.',
      },
      {
        name: 'describesChild',
        type: 'boolean',
        values: ['true', 'false'],
        valueKind: 'enum',
        default: 'false',
        description: 'Expose the tooltip as additional information instead of the only label.',
      },
      {
        name: 'placement',
        type: '"top" | "right" | "bottom" | "left"',
        values: tooltipPlacementValues,
        valueKind: 'enum',
        default: 'top',
        description: 'Tooltip placement.',
      },
      {
        name: 'delay',
        type: 'number',
        default: '150',
        description: 'Delay before the tooltip opens.',
      },
    ],
    snippet: {
      code:
        '<Tooltip content="Opens a printer-friendly summary" describesChild>\n' +
        '  <Button type="button" size="small" variant="secondary">Print summary</Button>\n' +
        '</Tooltip>',
      description: 'Tooltip with a focusable button trigger.',
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
    id: 'inlinemessage',
    name: 'InlineMessage',
    group: 'component',
    status: 'current',
    package: '@navikt/ds-react',
    importName: 'InlineMessage',
    importGuidance: "import { InlineMessage } from '@navikt/ds-react';",
    docs: `${COMPONENT_DOCS_BASE}/inlinemessage`,
    description: 'Inline status message for short feedback.',
    keywords: ['inline message', 'message', 'status', 'feedback', 'success', 'warning'],
    props: [
      {
        name: 'status',
        type: '"info" | "success" | "warning" | "error"',
        values: ['info', 'success', 'warning', 'error'],
        valueKind: 'enum',
        required: true,
        description: 'Inline feedback status.',
      },
      {
        name: 'size',
        type: '"medium" | "small"',
        values: ['medium', 'small'],
        valueKind: 'enum',
        default: 'medium',
        description: 'Inline message size.',
      },
    ],
    snippet: {
      code: '<InlineMessage status="success">Draft saved at 14:35</InlineMessage>',
      description: 'Inline success message.',
    },
  },
  {
    id: 'globalalert',
    name: 'GlobalAlert',
    group: 'component',
    status: 'current',
    package: '@navikt/ds-react',
    importName: 'GlobalAlert',
    importGuidance: "import { GlobalAlert } from '@navikt/ds-react';",
    docs: `${COMPONENT_DOCS_BASE}/globalalert`,
    description: 'Page-wide alert banner for important updates.',
    keywords: ['global alert', 'alert', 'banner', 'feedback', 'announcement', 'system'],
    props: [
      {
        name: 'status',
        type: '"announcement" | "success" | "warning" | "error"',
        values: ['announcement', 'success', 'warning', 'error'],
        valueKind: 'enum',
        required: true,
        description: 'Alert status.',
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
        name: 'centered',
        type: 'boolean',
        values: ['true', 'false'],
        valueKind: 'enum',
        description: 'Center the title and content.',
      },
    ],
    snippet: {
      code:
        '<GlobalAlert status="announcement">\n' +
        '  <GlobalAlert.Header>\n' +
        '    <GlobalAlert.Title>Scheduled maintenance on Sunday night</GlobalAlert.Title>\n' +
        '  </GlobalAlert.Header>\n' +
        '  <GlobalAlert.Content>\n' +
        '    The application will be unavailable from 23:00 to 01:00 while we deploy updates.\n' +
        '  </GlobalAlert.Content>\n' +
        '</GlobalAlert>',
      description: 'Visible global announcement banner.',
    },
  },
  {
    id: 'localalert',
    name: 'LocalAlert',
    group: 'component',
    status: 'current',
    package: '@navikt/ds-react',
    importName: 'LocalAlert',
    importGuidance: "import { LocalAlert } from '@navikt/ds-react';",
    docs: `${COMPONENT_DOCS_BASE}/localalert`,
    description: 'Section-level alert for nearby feedback.',
    keywords: ['local alert', 'alert', 'feedback', 'warning', 'message', 'section'],
    props: [
      {
        name: 'status',
        type: '"announcement" | "success" | "warning" | "error"',
        values: ['announcement', 'success', 'warning', 'error'],
        valueKind: 'enum',
        required: true,
        description: 'Alert status.',
      },
      {
        name: 'size',
        type: '"medium" | "small"',
        values: ['medium', 'small'],
        valueKind: 'enum',
        default: 'medium',
        description: 'Alert size.',
      },
    ],
    snippet: {
      code:
        '<LocalAlert status="warning">\n' +
        '  <LocalAlert.Header>\n' +
        '    <LocalAlert.Title>Missing supporting documents</LocalAlert.Title>\n' +
        '  </LocalAlert.Header>\n' +
        '  <LocalAlert.Content>\n' +
        '    Upload the latest payslip before you send the application.\n' +
        '  </LocalAlert.Content>\n' +
        '</LocalAlert>',
      description: 'Visible local warning message.',
    },
  },
  {
    id: 'dialog',
    name: 'Dialog',
    group: 'component',
    status: 'current',
    package: '@navikt/ds-react',
    importName: 'Dialog',
    importGuidance: "import { BodyShort, Button, Dialog } from '@navikt/ds-react';",
    docs: `${COMPONENT_DOCS_BASE}/dialog`,
    description: 'Controlled dialog with trigger and close actions.',
    keywords: ['dialog', 'modal replacement', 'overlay', 'popup', 'confirmation'],
    props: [
      {
        name: 'open',
        type: 'boolean',
        values: ['true', 'false'],
        valueKind: 'enum',
        description: 'Controlled open state.',
      },
      {
        name: 'onOpenChange',
        type: '(open: boolean) => void',
        description: 'Callback when the open state changes.',
      },
      {
        name: 'size',
        type: '"medium" | "small"',
        values: ['medium', 'small'],
        valueKind: 'enum',
        default: 'medium',
        description: 'Dialog size.',
      },
    ],
    snippet: {
      code: '<ReviewDialog{{dialogSuffix}} />',
      hooksCode:
        'export const ReviewDialog{{dialogSuffix}} = () => {\n' +
        '  const [dialogOpen{{dialogSuffix}}, setDialogOpen{{dialogSuffix}}] = useState(false)\n' +
        '\n' +
        '  return (\n' +
        '    <>\n' +
        '      <Button\n' +
        '        type="button"\n' +
        '        variant="secondary"\n' +
        '        onClick={() => setDialogOpen{{dialogSuffix}}(true)}\n' +
        '        aria-haspopup="dialog"\n' +
        '        aria-controls={dialogOpen{{dialogSuffix}} ? "review-dialog-popup{{dialogSuffix}}" : undefined}\n' +
        '      >\n' +
        '        Review summary\n' +
        '      </Button>\n' +
        '      <Dialog open={dialogOpen{{dialogSuffix}}} onOpenChange={setDialogOpen{{dialogSuffix}}}>\n' +
        '        <Dialog.Popup id="review-dialog-popup{{dialogSuffix}}">\n' +
        '          <Dialog.Header>\n' +
        '            <Dialog.Title>Ready to send?</Dialog.Title>\n' +
        '            <Dialog.Description>\n' +
        '              Review the summary before you submit the application.\n' +
        '            </Dialog.Description>\n' +
        '          </Dialog.Header>\n' +
        '          <Dialog.Body>\n' +
        '            <BodyShort spacing>The draft is saved and ready for a final check.</BodyShort>\n' +
        '            <BodyShort>Confirm when the required attachments are in place.</BodyShort>\n' +
        '          </Dialog.Body>\n' +
        '          <Dialog.Footer>\n' +
        '            <Dialog.CloseTrigger>\n' +
        '              <Button type="button" variant="secondary">Go back</Button>\n' +
        '            </Dialog.CloseTrigger>\n' +
        '            <Button type="button" onClick={() => setDialogOpen{{dialogSuffix}}(false)}>\n' +
        '              Confirm\n' +
        '            </Button>\n' +
        '          </Dialog.Footer>\n' +
        '        </Dialog.Popup>\n' +
        '      </Dialog>\n' +
        '    </>\n' +
        '  )\n' +
        '}',
      description: 'Dialog example with trigger, open state, and close actions.',
    },
  },
  {
    id: 'fieldset',
    name: 'Fieldset',
    group: 'component',
    status: 'current',
    package: '@navikt/ds-react',
    importName: 'Fieldset',
    importGuidance:
      "import { BodyShort, Fieldset, HStack, Select, TextField } from '@navikt/ds-react';",
    docs: `${COMPONENT_DOCS_BASE}/fieldset`,
    description: 'Semantic group for related form fields.',
    keywords: ['fieldset', 'group', 'form', 'legend', 'address', 'semantics'],
    props: [
      {
        name: 'legend',
        type: 'ReactNode',
        required: true,
        description: 'Fieldset legend.',
      },
      {
        name: 'description',
        type: 'ReactNode',
        description: 'Additional guidance for the grouped fields.',
      },
      {
        name: 'hideLegend',
        type: 'boolean',
        values: ['true', 'false'],
        valueKind: 'enum',
        description: 'Show the legend for screen readers only.',
      },
      {
        name: 'error',
        type: 'ReactNode',
        description: 'Error message for the field group.',
      },
    ],
    snippet: {
      code:
        '<Fieldset legend="Employer phone number">\n' +
        '  <HStack gap="space-16">\n' +
        '    <Select label={<BodyShort as="span">Country code</BodyShort>} defaultValue="">\n' +
        '      <option value="" disabled>Select</option>\n' +
        '      <option value="+45">+45</option>\n' +
        '      <option value="+46">+46</option>\n' +
        '      <option value="+47">+47</option>\n' +
        '    </Select>\n' +
        '    <TextField label={<BodyShort as="span">Number</BodyShort>} htmlSize={8} name="employerPhone" />\n' +
        '  </HStack>\n' +
        '</Fieldset>',
      description: 'Grouped phone fields with a shared legend.',
    },
  },
  {
    id: 'checkboxgroup',
    name: 'CheckboxGroup',
    group: 'component',
    status: 'current',
    package: '@navikt/ds-react',
    importName: 'CheckboxGroup',
    importGuidance: "import { Checkbox, CheckboxGroup } from '@navikt/ds-react';",
    docs: `${COMPONENT_DOCS_BASE}/checkbox`,
    description: 'Checkbox group with legend and multiple choices.',
    keywords: ['checkbox group', 'checkboxes', 'multi-select', 'choices', 'form'],
    props: [
      {
        name: 'legend',
        type: 'ReactNode',
        required: true,
        description: 'Fieldset legend.',
      },
      {
        name: 'description',
        type: 'ReactNode',
        description: 'Additional guidance for the choices.',
      },
      {
        name: 'defaultValue',
        type: 'any[]',
        description: 'Default checked values.',
      },
      {
        name: 'error',
        type: 'ReactNode',
        description: 'Error message for the group.',
      },
    ],
    snippet: {
      code:
        '<CheckboxGroup\n' +
        '  legend="How should we notify you?"\n' +
        '  description="Select all channels that should receive updates."\n' +
        '  defaultValue={["email"]}\n' +
        '>\n' +
        '  <Checkbox value="email">Email</Checkbox>\n' +
        '  <Checkbox value="sms">SMS</Checkbox>\n' +
        '  <Checkbox value="push">Push notification</Checkbox>\n' +
        '</CheckboxGroup>',
      description: 'Checkbox group with multiple visible options.',
    },
  },
  {
    id: 'errormessage',
    name: 'ErrorMessage',
    group: 'component',
    status: 'current',
    package: '@navikt/ds-react',
    importName: 'ErrorMessage',
    importGuidance: "import { ErrorMessage } from '@navikt/ds-react';",
    docs: `${COMPONENT_DOCS_BASE}/typography`,
    description: 'Inline validation message with optional icon.',
    keywords: ['error message', 'validation', 'error', 'form', 'feedback'],
    props: [
      {
        name: 'size',
        type: '"medium" | "small"',
        values: ['medium', 'small'],
        valueKind: 'enum',
        default: 'medium',
        description: 'Error message size.',
      },
      {
        name: 'showIcon',
        type: 'boolean',
        values: ['true', 'false'],
        valueKind: 'enum',
        description: 'Render the warning icon.',
      },
      {
        name: 'spacing',
        type: 'boolean',
        values: ['true', 'false'],
        valueKind: 'enum',
        description: 'Add bottom spacing.',
      },
    ],
    snippet: {
      code: '<ErrorMessage showIcon>Enter a valid email address.</ErrorMessage>',
      description: 'Visible inline validation message.',
    },
  },
  {
    id: 'errorsummary',
    name: 'ErrorSummary',
    group: 'component',
    status: 'current',
    package: '@navikt/ds-react',
    importName: 'ErrorSummary',
    importGuidance: "import { ErrorSummary } from '@navikt/ds-react';",
    docs: `${COMPONENT_DOCS_BASE}/errorsummary`,
    description: 'Summary of validation errors with field links.',
    keywords: ['error summary', 'validation', 'errors', 'form', 'summary'],
    props: [
      {
        name: 'heading',
        type: 'ReactNode',
        description: 'Heading above the error links.',
      },
      {
        name: 'headingTag',
        type: 'ElementType',
        description: 'Semantic heading tag for the summary title.',
      },
      {
        name: 'size',
        type: '"medium" | "small"',
        values: ['medium', 'small'],
        valueKind: 'enum',
        default: 'medium',
        description: 'Summary size.',
      },
    ],
    snippet: {
      code:
        '<ErrorSummary heading="You must fix these errors before continuing:">\n' +
        '  <ErrorSummary.Item href="#application-age">Enter an age before submitting.</ErrorSummary.Item>\n' +
        '  <ErrorSummary.Item href="#application-email">Enter a valid email address.</ErrorSummary.Item>\n' +
        '</ErrorSummary>',
      description: 'Error summary with linked validation messages.',
    },
  },
  {
    id: 'fileupload',
    name: 'FileUpload',
    group: 'component',
    status: 'current',
    package: '@navikt/ds-react',
    importName: 'FileUpload',
    importGuidance: "import { FileUpload, VStack } from '@navikt/ds-react';",
    docs: `${COMPONENT_DOCS_BASE}/fileupload`,
    description: 'File upload dropzone with a listed example attachment.',
    keywords: ['file upload', 'upload', 'dropzone', 'attachment', 'documents'],
    props: [
      {
        name: 'accept',
        type: 'string',
        description: 'Accepted file extensions.',
      },
      {
        name: 'fileLimit',
        type: '{ max: number; current: number }',
        description: 'Maximum number of files and current count.',
      },
      {
        name: 'maxSizeInBytes',
        type: 'number',
        description: 'Maximum allowed file size.',
      },
    ],
    snippet: {
      code:
        '<FileUpload>\n' +
        '  <VStack gap="space-24">\n' +
        '    <FileUpload.Dropzone\n' +
        '      label="Upload supporting documents"\n' +
        '      description="You can upload PDF or Word files. Maximum 3 files."\n' +
        '      accept=".pdf,.doc,.docx"\n' +
        '      fileLimit={{ max: 3, current: 1 }}\n' +
        '      onSelect={() => {}}\n' +
        '    />\n' +
        '    <VStack as="ul" gap="space-8">\n' +
        '      <FileUpload.Item\n' +
        '        as="li"\n' +
        '        file={{ name: "income-statement.pdf", size: 280000 }}\n' +
        '        button={{ action: "delete", onClick: () => {} }}\n' +
        '      />\n' +
        '    </VStack>\n' +
        '  </VStack>\n' +
        '</FileUpload>',
      description: 'Upload dropzone with an example attachment item.',
    },
  },
  {
    id: 'accordion',
    name: 'Accordion',
    group: 'component',
    status: 'current',
    package: '@navikt/ds-react',
    importName: 'Accordion',
    importGuidance: "import { Accordion } from '@navikt/ds-react';",
    docs: `${COMPONENT_DOCS_BASE}/accordion`,
    description: 'Accordion with related questions and one answer expanded.',
    keywords: ['accordion', 'faq', 'expand', 'collapse', 'disclosure'],
    props: [
      {
        name: 'size',
        type: '"large" | "medium" | "small"',
        values: ['large', 'medium', 'small'],
        valueKind: 'enum',
        default: 'medium',
        description: 'Accordion size.',
      },
      {
        name: 'indent',
        type: 'boolean',
        values: ['true', 'false'],
        valueKind: 'enum',
        description: 'Indent the content area.',
      },
      {
        name: 'data-color',
        type: 'string',
        values: dataColorValues,
        valueKind: 'data-color',
        description: 'Override the inherited color context.',
      },
    ],
    snippet: {
      code:
        '<Accordion>\n' +
        '  <Accordion.Item defaultOpen>\n' +
        '    <Accordion.Header>How do I change my meeting time?</Accordion.Header>\n' +
        '    <Accordion.Content>\n' +
        '      You can change the meeting time from the activity plan up to 24 hours before the appointment.\n' +
        '    </Accordion.Content>\n' +
        '  </Accordion.Item>\n' +
        '  <Accordion.Item>\n' +
        '    <Accordion.Header>When will I get an answer?</Accordion.Header>\n' +
        '    <Accordion.Content>\n' +
        '      We usually reply within five working days after we receive all documents.\n' +
        '    </Accordion.Content>\n' +
        '  </Accordion.Item>\n' +
        '</Accordion>',
      description: 'Frequently asked questions with one answer expanded.',
    },
  },
  {
    id: 'expansioncard',
    name: 'ExpansionCard',
    group: 'component',
    status: 'current',
    package: '@navikt/ds-react',
    importName: 'ExpansionCard',
    importGuidance: "import { ExpansionCard } from '@navikt/ds-react';",
    docs: `${COMPONENT_DOCS_BASE}/expansioncard`,
    description: 'Expansion card with visible summary and expanded details.',
    keywords: ['expansion card', 'expand', 'collapse', 'summary', 'details'],
    props: [
      {
        name: 'defaultOpen',
        type: 'boolean',
        values: ['true', 'false'],
        valueKind: 'enum',
        description: 'Start with the card expanded.',
      },
      {
        name: 'open',
        type: 'boolean',
        values: ['true', 'false'],
        valueKind: 'enum',
        description: 'Controlled open state.',
      },
      {
        name: 'onToggle',
        type: '(open: boolean) => void',
        description: 'Callback when the card opens or closes.',
      },
      {
        name: 'size',
        type: '"medium" | "small"',
        values: ['medium', 'small'],
        valueKind: 'enum',
        default: 'medium',
        description: 'Expansion card size.',
      },
      {
        name: 'data-color',
        type: 'string',
        values: dataColorValues,
        valueKind: 'data-color',
        description: 'Override the inherited color context.',
      },
    ],
    snippet: {
      code:
        '<ExpansionCard aria-label="Payment summary" defaultOpen>\n' +
        '  <ExpansionCard.Header>\n' +
        '    <ExpansionCard.Title>Payment for June</ExpansionCard.Title>\n' +
        '    <ExpansionCard.Description>\n' +
        '      You are registered as the recipient of sickness benefits from Nav.\n' +
        '    </ExpansionCard.Description>\n' +
        '  </ExpansionCard.Header>\n' +
        '  <ExpansionCard.Content>\n' +
        '    The payment will be sent to your employer on 14 June. You can review the calculation details from this summary.\n' +
        '  </ExpansionCard.Content>\n' +
        '</ExpansionCard>',
      description: 'Expansion card with a visible summary and open content.',
    },
  },
  {
    id: 'process',
    name: 'Process',
    group: 'component',
    status: 'current',
    package: '@navikt/ds-react',
    importName: 'Process',
    importGuidance: "import { Process } from '@navikt/ds-react';",
    docs: `${COMPONENT_DOCS_BASE}/process`,
    description: 'Process event list with completed and active statuses.',
    keywords: ['process', 'events', 'case flow', 'status', 'timeline', 'workflow'],
    props: [
      {
        name: 'hideStatusText',
        type: 'boolean',
        values: ['true', 'false'],
        valueKind: 'enum',
        description: 'Hide the status text on the active event.',
      },
      {
        name: 'isTruncated',
        type: '"start" | "end" | "both"',
        values: ['start', 'end', 'both'],
        valueKind: 'enum',
        description: 'Show that more events exist before or after the current list.',
      },
    ],
    snippet: {
      code:
        '<Process>\n' +
        '  <Process.Event status="completed" title="Application received" timestamp="10 June 2026">\n' +
        '    We have received your application and attachments.\n' +
        '  </Process.Event>\n' +
        '  <Process.Event\n' +
        '    status="active"\n' +
        '    title="Case officer is reviewing the application"\n' +
        '    timestamp="12 June 2026"\n' +
        '  >\n' +
        '    You will get a message if we need more information.\n' +
        '  </Process.Event>\n' +
        '  <Process.Event title="Decision is ready" timestamp="Expected this week">\n' +
        '    We notify you as soon as the decision is available.\n' +
        '  </Process.Event>\n' +
        '</Process>',
      description: 'Process with completed, active, and upcoming events.',
    },
  },
  {
    id: 'readmore',
    name: 'ReadMore',
    group: 'component',
    status: 'current',
    package: '@navikt/ds-react',
    importName: 'ReadMore',
    importGuidance: "import { ReadMore } from '@navikt/ds-react';",
    docs: `${COMPONENT_DOCS_BASE}/read-more`,
    description: 'Expandable explanation text with a visible header.',
    keywords: ['read more', 'expand', 'disclosure', 'details', 'help'],
    props: [
      {
        name: 'header',
        type: 'ReactNode',
        required: true,
        description: 'Visible button label for the disclosure.',
      },
      {
        name: 'defaultOpen',
        type: 'boolean',
        values: ['true', 'false'],
        valueKind: 'enum',
        description: 'Start with the content expanded.',
      },
      {
        name: 'open',
        type: 'boolean',
        values: ['true', 'false'],
        valueKind: 'enum',
        description: 'Controlled open state.',
      },
      {
        name: 'size',
        type: '"large" | "medium" | "small"',
        values: ['large', 'medium', 'small'],
        valueKind: 'enum',
        default: 'medium',
        description: 'ReadMore content size.',
      },
      {
        name: 'variant',
        type: '"moderate" | "ghost"',
        values: ['moderate', 'ghost'],
        valueKind: 'enum',
        default: 'ghost',
        description: 'Visual emphasis for the disclosure.',
      },
    ],
    snippet: {
      code:
        '<ReadMore header="Why we ask about income" variant="moderate">\n' +
        '  We use your income to calculate the correct benefit and show which documents you must send in.\n' +
        '</ReadMore>',
      description: 'ReadMore with visible helper text when expanded.',
    },
  },
  {
    id: 'stepper',
    name: 'Stepper',
    group: 'component',
    status: 'current',
    package: '@navikt/ds-react',
    importName: 'Stepper',
    importGuidance: "import { Stepper } from '@navikt/ds-react';",
    docs: `${COMPONENT_DOCS_BASE}/stepper`,
    description: 'Stepper with a valid current step and visible navigation labels.',
    keywords: ['stepper', 'wizard', 'steps', 'progress', 'navigation'],
    props: [
      {
        name: 'activeStep',
        type: 'number',
        required: true,
        description: 'Current active step. Stepper starts at 1.',
      },
      {
        name: 'orientation',
        type: '"horizontal" | "vertical"',
        values: ['horizontal', 'vertical'],
        valueKind: 'enum',
        default: 'vertical',
        description: 'Layout direction for the stepper.',
      },
      {
        name: 'onStepChange',
        type: '(step: number) => void',
        description: 'Callback when the user changes step.',
      },
    ],
    snippet: {
      code:
        '<Stepper aria-label="Application steps" activeStep={2}>\n' +
        '  <Stepper.Step href="#">Choose support</Stepper.Step>\n' +
        '  <Stepper.Step href="#">Upload documents</Stepper.Step>\n' +
        '  <Stepper.Step href="#">Send application</Stepper.Step>\n' +
        '</Stepper>',
      description: 'Visible stepper with a current step highlighted.',
    },
  },
  {
    id: 'tabs',
    name: 'Tabs',
    group: 'component',
    status: 'current',
    package: '@navikt/ds-react',
    importName: 'Tabs',
    importGuidance: "import { Tabs } from '@navikt/ds-react';",
    docs: `${COMPONENT_DOCS_BASE}/tabs`,
    description: 'Controlled tabs with Hooks-tab state and three panels.',
    keywords: ['tabs', 'tab navigation', 'panel', 'messages', 'switch'],
    props: [
      {
        name: 'size',
        type: '"medium" | "small"',
        values: ['medium', 'small'],
        valueKind: 'enum',
        default: 'medium',
        description: 'Tab list size.',
      },
      {
        name: 'onChange',
        type: '(value: string) => void',
        description: 'Callback when a tab is selected.',
      },
      {
        name: 'value',
        type: 'string',
        description: 'Controlled selected tab value.',
      },
      {
        name: 'defaultValue',
        type: 'string',
        description: 'Initial tab value for uncontrolled state.',
      },
      {
        name: 'selectionFollowsFocus',
        type: 'boolean',
        values: ['true', 'false'],
        valueKind: 'enum',
        description: 'Automatically select tabs when focus moves.',
      },
      {
        name: 'fill',
        type: 'boolean',
        values: ['true', 'false'],
        valueKind: 'enum',
        description: 'Stretch tabs to fill the available width.',
      },
    ],
    snippet: {
      code:
        '<Tabs {...useTabsState{{tabsSuffix}}()}>\n' +
        '  <Tabs.List>\n' +
        '    <Tabs.Tab value="overview" label="Overview" />\n' +
        '    <Tabs.Tab value="timeline" label="Timeline" />\n' +
        '    <Tabs.Tab value="documents" label="Documents" />\n' +
        '  </Tabs.List>\n' +
        '  <Tabs.Panel value="overview">Overview of the application.</Tabs.Panel>\n' +
        '  <Tabs.Panel value="timeline">Timeline of the case.</Tabs.Panel>\n' +
        '  <Tabs.Panel value="documents">Attachments and letters.</Tabs.Panel>\n' +
        '</Tabs>',
      hooksCode:
        'export const useTabsState{{tabsSuffix}} = (initialValue = "overview") => {\n' +
        '  const [selectedTab, setSelectedTab] = useState(initialValue)\n' +
        '\n' +
        '  return {\n' +
        '    value: selectedTab,\n' +
        '    onChange: setSelectedTab,\n' +
        '  }\n' +
        '}',
      description: 'Tabs with Hooks-tab state so panel changes are visible on click.',
    },
  },
  {
    id: 'timeline',
    name: 'Timeline',
    group: 'component',
    status: 'current',
    package: '@navikt/ds-react',
    importName: 'Timeline',
    importGuidance: "import { Box, Timeline } from '@navikt/ds-react';",
    docs: `${COMPONENT_DOCS_BASE}/timeline`,
    description: 'Timeline with rows, dated periods, and a visible pin.',
    keywords: ['timeline', 'period', 'chronology', 'milestone', 'schedule', 'internal'],
    props: [
      {
        name: 'startDate',
        type: 'Date',
        description: 'Start date for the visible range.',
      },
      {
        name: 'endDate',
        type: 'Date',
        description: 'End date for the visible range.',
      },
      {
        name: 'direction',
        type: '"left" | "right"',
        values: ['left', 'right'],
        valueKind: 'enum',
        default: 'left',
        description: 'Sort direction for the periods.',
      },
    ],
    snippet: {
      code:
        '<Box marginInline="auto" maxWidth="800px">\n' +
        '  <Timeline>\n' +
        '    <Timeline.Pin date={new Date("2025-05-12")}>\n' +
        '      Follow-up meeting with the employer\n' +
        '    </Timeline.Pin>\n' +
        '    <Timeline.Row label="Sick leave">\n' +
        '      <Timeline.Period\n' +
        '        start={new Date("2025-05-01")}\n' +
        '        end={new Date("2025-05-14")}\n' +
        '        status="warning"\n' +
        '        statusLabel="Sick leave"\n' +
        '      >\n' +
        '        50% sick leave\n' +
        '      </Timeline.Period>\n' +
        '      <Timeline.Period\n' +
        '        start={new Date("2025-05-15")}\n' +
        '        end={new Date("2025-05-31")}\n' +
        '        status="success"\n' +
        '        statusLabel="Return plan"\n' +
        '      >\n' +
        '        Gradual return to work\n' +
        '      </Timeline.Period>\n' +
        '    </Timeline.Row>\n' +
        '    <Timeline.Row label="Payments">\n' +
        '      <Timeline.Period\n' +
        '        start={new Date("2025-05-05")}\n' +
        '        end={new Date("2025-05-20")}\n' +
        '        status="info"\n' +
        '        statusLabel="Benefit payment"\n' +
        '      >\n' +
        '        First benefit payment\n' +
        '      </Timeline.Period>\n' +
        '    </Timeline.Row>\n' +
        '  </Timeline>\n' +
        '</Box>',
      description: 'Timeline with rows, periods, and a dated pin.',
    },
  },
  {
    id: 'formsummary',
    name: 'FormSummary',
    group: 'component',
    status: 'current',
    package: '@navikt/ds-react',
    importName: 'FormSummary',
    importGuidance: "import { FormSummary } from '@navikt/ds-react';",
    docs: `${COMPONENT_DOCS_BASE}/formsummary`,
    description: 'Structured summary of completed form answers.',
    keywords: ['form summary', 'summary', 'answers', 'review', 'application'],
    props: [],
    snippet: {
      code:
        '<FormSummary>\n' +
        '  <FormSummary.Header>\n' +
        '    <FormSummary.Heading level="2">Application summary</FormSummary.Heading>\n' +
        '  </FormSummary.Header>\n' +
        '  <FormSummary.Answers>\n' +
        '    <FormSummary.Answer>\n' +
        '      <FormSummary.Label>Name</FormSummary.Label>\n' +
        '      <FormSummary.Value>Ola Nordmann</FormSummary.Value>\n' +
        '    </FormSummary.Answer>\n' +
        '    <FormSummary.Answer>\n' +
        '      <FormSummary.Label>Preferred contact</FormSummary.Label>\n' +
        '      <FormSummary.Value>Email</FormSummary.Value>\n' +
        '      <FormSummary.Value>SMS</FormSummary.Value>\n' +
        '    </FormSummary.Answer>\n' +
        '  </FormSummary.Answers>\n' +
        '  <FormSummary.Footer>\n' +
        '    <FormSummary.EditLink href="#edit-contact-details" />\n' +
        '  </FormSummary.Footer>\n' +
        '</FormSummary>',
      description: 'Structured summary with answers and edit link.',
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

export function resolveContextualAutocompleteEntryName(componentName: string): string {
  return contextualAutocompleteEntryNamesByComponent.get(componentName) ?? componentName
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
