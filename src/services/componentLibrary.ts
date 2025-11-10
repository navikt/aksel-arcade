import type { ComponentSnippet } from '@/types/snippets'

export const AKSEL_SNIPPETS: ComponentSnippet[] = [
  // Layout Components
  {
    id: 'page',
    name: 'Page',
    category: 'layout',
    keywords: ['page', 'container', 'layout', 'wrapper', 'main'],
    template: '<Page>\n  ${1:Page content}\n</Page>',
    description: 'Main page container with responsive layout',
    import: "import { Page } from '@navikt/ds-react';",
  },
  {
    id: 'page-block',
    name: 'Page.Block',
    category: 'layout',
    keywords: ['page', 'block', 'content', 'width', 'gutters'],
    template: '<Page.Block width="lg">\n  ${1:Content}\n</Page.Block>',
    description: 'Page content block with max-width',
    import: "import { Page } from '@navikt/ds-react';",
  },
  {
    id: 'hgrid',
    name: 'HGrid',
    category: 'layout',
    keywords: ['hgrid', 'grid', 'horizontal', 'columns', 'layout'],
    template: '<HGrid columns={2} gap="4">\n  ${1:Column 1}\n  ${2:Column 2}\n</HGrid>',
    description: 'Horizontal grid layout',
    import: "import { HGrid } from '@navikt/ds-react';",
  },
  {
    id: 'hstack',
    name: 'HStack',
    category: 'layout',
    keywords: ['hstack', 'horizontal', 'stack', 'row', 'flex', 'layout'],
    template: '<HStack gap="4" align="center">\n  ${1:Item 1}\n  ${2:Item 2}\n</HStack>',
    description: 'Horizontal stack with flexbox',
    import: "import { HStack } from '@navikt/ds-react';",
  },
  {
    id: 'vstack',
    name: 'VStack',
    category: 'layout',
    keywords: ['vstack', 'vertical', 'stack', 'column', 'flex', 'layout'],
    template: '<VStack gap="4">\n  ${1:Item 1}\n  ${2:Item 2}\n</VStack>',
    description: 'Vertical stack with flexbox',
    import: "import { VStack } from '@navikt/ds-react';",
  },
  {
    id: 'box',
    name: 'Box',
    category: 'layout',
    keywords: ['box', 'container', 'layout', 'padding', 'wrapper'],
    template: '<Box padding="4">\n  ${1:Content}\n</Box>',
    description: 'Layout container with spacing control',
    import: "import { Box } from '@navikt/ds-react';",
  },
  {
    id: 'stack',
    name: 'Stack',
    category: 'layout',
    keywords: ['stack', 'vertical', 'column', 'layout', 'gap', 'spacing'],
    template: '<Stack gap="4">\n  ${1:First item}\n  ${2:Second item}\n</Stack>',
    description: 'Vertical layout stack with gap spacing',
    import: "import { Stack } from '@navikt/ds-react';",
  },
  {
    id: 'grid',
    name: 'Grid',
    category: 'layout',
    keywords: ['grid', 'layout', 'columns', 'responsive'],
    template:
      '<Grid columns={{ xs: 1, sm: 2, md: 3 }} gap="4">\n  ${1:Grid item 1}\n  ${2:Grid item 2}\n  ${3:Grid item 3}\n</Grid>',
    description: 'Responsive grid layout',
    import: "import { Grid } from '@navikt/ds-react';",
  },
  {
    id: 'hide',
    name: 'Hide',
    category: 'layout',
    keywords: ['hide', 'responsive', 'breakpoint', 'visibility'],
    template: '<Hide below="md">\n  ${1:Hidden on mobile}\n</Hide>',
    description: 'Hide content at specific breakpoints',
    import: "import { Hide } from '@navikt/ds-react';",
  },
  {
    id: 'show',
    name: 'Show',
    category: 'layout',
    keywords: ['show', 'responsive', 'breakpoint', 'visibility'],
    template: '<Show below="md">\n  ${1:Visible on mobile only}\n</Show>',
    description: 'Show content at specific breakpoints',
    import: "import { Show } from '@navikt/ds-react';",
  },
  {
    id: 'bleed',
    name: 'Bleed',
    category: 'layout',
    keywords: ['bleed', 'break', 'margin', 'escape', 'full-width'],
    template: '<Bleed marginInline="4">\n  ${1:Content that bleeds out}\n</Bleed>',
    description: 'Break out of container padding',
    import: "import { Bleed } from '@navikt/ds-react';",
  },

  // Form Components
  {
    id: 'button',
    name: 'Button',
    category: 'component',
    keywords: ['button', 'click', 'action', 'submit', 'primary', 'cta'],
    template: '<Button variant="primary">${1:Button text}</Button>',
    description: 'Action button with variants',
    import: "import { Button } from '@navikt/ds-react';",
  },
  {
    id: 'textfield',
    name: 'TextField',
    category: 'component',
    keywords: ['input', 'text', 'form', 'field', 'textbox'],
    template: '<TextField label="${1:Label}" />',
    description: 'Text input field with label',
    import: "import { TextField } from '@navikt/ds-react';",
  },
  {
    id: 'textarea',
    name: 'Textarea',
    category: 'component',
    keywords: ['textarea', 'text', 'multiline', 'form', 'input'],
    template: '<Textarea label="${1:Label}" />',
    description: 'Multi-line text input',
    import: "import { Textarea } from '@navikt/ds-react';",
  },
  {
    id: 'select',
    name: 'Select',
    category: 'component',
    keywords: ['select', 'dropdown', 'options', 'form', 'menu'],
    template:
      '<Select label="${1:Label}">\n  <option value="">${2:Option 1}</option>\n  <option value="">${3:Option 2}</option>\n</Select>',
    description: 'Dropdown select menu',
    import: "import { Select } from '@navikt/ds-react';",
  },
  {
    id: 'checkbox',
    name: 'Checkbox',
    category: 'component',
    keywords: ['checkbox', 'check', 'toggle', 'form', 'boolean'],
    template: '<Checkbox>${1:Label}</Checkbox>',
    description: 'Checkbox input with label',
    import: "import { Checkbox } from '@navikt/ds-react';",
  },
  {
    id: 'radio',
    name: 'Radio',
    category: 'component',
    keywords: ['radio', 'option', 'choice', 'form', 'group'],
    template: '<Radio.Group legend="${1:Legend}">\n  <Radio value="1">${2:Option 1}</Radio>\n  <Radio value="2">${3:Option 2}</Radio>\n</Radio.Group>',
    description: 'Radio button input',
    import: "import { Radio } from '@navikt/ds-react';",
  },
  {
    id: 'switch',
    name: 'Switch',
    category: 'component',
    keywords: ['switch', 'toggle', 'boolean', 'form'],
    template: '<Switch>${1:Toggle label}</Switch>',
    description: 'Toggle switch',
    import: "import { Switch } from '@navikt/ds-react';",
  },
  {
    id: 'search',
    name: 'Search',
    category: 'component',
    keywords: ['search', 'find', 'query', 'filter', 'input'],
    template: '<Search label="${1:Search}" />',
    description: 'Search input field',
    import: "import { Search } from '@navikt/ds-react';",
  },
  {
    id: 'combobox',
    name: 'Combobox',
    category: 'component',
    keywords: ['combobox', 'autocomplete', 'select', 'search', 'dropdown'],
    template: '<Combobox label="${1:Label}" options={[]} />',
    description: 'Searchable select dropdown',
    import: "import { Combobox } from '@navikt/ds-react';",
  },
  {
    id: 'datepicker',
    name: 'DatePicker',
    category: 'component',
    keywords: ['date', 'picker', 'calendar', 'form', 'input'],
    template: '<DatePicker>\n  <DatePicker.Input label="${1:Select date}" />\n</DatePicker>',
    description: 'Date selection input',
    import: "import { DatePicker } from '@navikt/ds-react';",
  },
  {
    id: 'monthpicker',
    name: 'MonthPicker',
    category: 'component',
    keywords: ['month', 'picker', 'calendar', 'form', 'date'],
    template: '<MonthPicker>\n  <MonthPicker.Input label="${1:Select month}" />\n</MonthPicker>',
    description: 'Month selection input',
    import: "import { MonthPicker } from '@navikt/ds-react';",
  },
  {
    id: 'fileupload',
    name: 'FileUpload',
    category: 'component',
    keywords: ['file', 'upload', 'attach', 'form', 'input'],
    template: '<FileUpload label="${1:Upload file}">\n  <FileUpload.Dropzone />\n</FileUpload>',
    description: 'File upload component',
    import: "import { FileUpload } from '@navikt/ds-react';",
  },
  {
    id: 'chips',
    name: 'Chips',
    category: 'component',
    keywords: ['chips', 'tags', 'filter', 'toggle', 'select'],
    template: '<Chips>\n  <Chips.Toggle>${1:Chip 1}</Chips.Toggle>\n  <Chips.Toggle>${2:Chip 2}</Chips.Toggle>\n</Chips>',
    description: 'Selectable chips/tags',
    import: "import { Chips } from '@navikt/ds-react';",
  },
  {
    id: 'togglegroup',
    name: 'ToggleGroup',
    category: 'component',
    keywords: ['toggle', 'group', 'button', 'select', 'choice'],
    template: '<ToggleGroup>\n  <ToggleGroup.Item value="1">${1:Option 1}</ToggleGroup.Item>\n  <ToggleGroup.Item value="2">${2:Option 2}</ToggleGroup.Item>\n</ToggleGroup>',
    description: 'Toggle button group',
    import: "import { ToggleGroup } from '@navikt/ds-react';",
  },

  // Feedback Components
  {
    id: 'alert',
    name: 'Alert',
    category: 'component',
    keywords: ['alert', 'message', 'notification', 'banner', 'info'],
    template: '<Alert variant="info">${1:Alert message}</Alert>',
    description: 'Display important messages',
    import: "import { Alert } from '@navikt/ds-react';",
  },
  {
    id: 'loader',
    name: 'Loader',
    category: 'component',
    keywords: ['loader', 'loading', 'spinner', 'progress', 'wait'],
    template: '<Loader title="${1:Loading...}" />',
    description: 'Loading spinner',
    import: "import { Loader } from '@navikt/ds-react';",
  },
  {
    id: 'skeleton',
    name: 'Skeleton',
    category: 'component',
    keywords: ['skeleton', 'loading', 'placeholder', 'shimmer'],
    template: '<Skeleton variant="text" width="100%" />',
    description: 'Loading skeleton placeholder',
    import: "import { Skeleton } from '@navikt/ds-react';",
  },
  {
    id: 'progressbar',
    name: 'ProgressBar',
    category: 'component',
    keywords: ['progress', 'bar', 'loading', 'percentage'],
    template: '<ProgressBar value={50}>${1:50%}</ProgressBar>',
    description: 'Progress indicator bar',
    import: "import { ProgressBar } from '@navikt/ds-react';",
  },
  {
    id: 'errorsummary',
    name: 'ErrorSummary',
    category: 'component',
    keywords: ['error', 'summary', 'form', 'validation'],
    template: '<ErrorSummary heading="${1:Form has errors}">\n  <ErrorSummary.Item href="#field">${2:Error message}</ErrorSummary.Item>\n</ErrorSummary>',
    description: 'Summary of form errors',
    import: "import { ErrorSummary } from '@navikt/ds-react';",
  },
  {
    id: 'tag',
    name: 'Tag',
    category: 'component',
    keywords: ['tag', 'label', 'badge', 'status', 'chip'],
    template: '<Tag variant="info">${1:Tag label}</Tag>',
    description: 'Tag label component',
    import: "import { Tag } from '@navikt/ds-react';",
  },

  // Navigation Components
  {
    id: 'link',
    name: 'Link',
    category: 'component',
    keywords: ['link', 'anchor', 'navigate', 'url', 'href'],
    template: '<Link href="${1:#}">${2:Link text}</Link>',
    description: 'Styled link component',
    import: "import { Link } from '@navikt/ds-react';",
  },
  {
    id: 'tabs',
    name: 'Tabs',
    category: 'component',
    keywords: ['tabs', 'navigation', 'panel', 'switch'],
    template: '<Tabs value="tab1">\n  <Tabs.List>\n    <Tabs.Tab value="tab1" label="${1:Tab 1}" />\n    <Tabs.Tab value="tab2" label="${2:Tab 2}" />\n  </Tabs.List>\n  <Tabs.Panel value="tab1">${3:Content 1}</Tabs.Panel>\n  <Tabs.Panel value="tab2">${4:Content 2}</Tabs.Panel>\n</Tabs>',
    description: 'Tab navigation',
    import: "import { Tabs } from '@navikt/ds-react';",
  },
  {
    id: 'pagination',
    name: 'Pagination',
    category: 'component',
    keywords: ['pagination', 'page', 'navigation', 'list'],
    template: '<Pagination page={1} count={10} onPageChange={() => {}} />',
    description: 'Pagination controls',
    import: "import { Pagination } from '@navikt/ds-react';",
  },
  {
    id: 'stepper',
    name: 'Stepper',
    category: 'component',
    keywords: ['stepper', 'steps', 'wizard', 'progress', 'flow'],
    template: '<Stepper activeStep={0}>\n  <Stepper.Step>${1:Step 1}</Stepper.Step>\n  <Stepper.Step>${2:Step 2}</Stepper.Step>\n</Stepper>',
    description: 'Step-by-step wizard',
    import: "import { Stepper } from '@navikt/ds-react';",
  },
  {
    id: 'formprogress',
    name: 'FormProgress',
    category: 'component',
    keywords: ['form', 'progress', 'steps', 'wizard'],
    template: '<FormProgress totalSteps={3} activeStep={1}>\n  <FormProgress.Step>${1:Step 1}</FormProgress.Step>\n  <FormProgress.Step>${2:Step 2}</FormProgress.Step>\n  <FormProgress.Step>${3:Step 3}</FormProgress.Step>\n</FormProgress>',
    description: 'Multi-step form progress',
    import: "import { FormProgress } from '@navikt/ds-react';",
  },

  // Overlay Components
  {
    id: 'modal',
    name: 'Modal',
    category: 'component',
    keywords: ['modal', 'dialog', 'popup', 'overlay'],
    template: '<Modal open={false} onClose={() => {}}>\n  <Modal.Header>\n    <Modal.Title>${1:Modal title}</Modal.Title>\n  </Modal.Header>\n  <Modal.Body>${2:Modal content}</Modal.Body>\n</Modal>',
    description: 'Modal dialog',
    import: "import { Modal } from '@navikt/ds-react';",
  },
  {
    id: 'popover',
    name: 'Popover',
    category: 'component',
    keywords: ['popover', 'tooltip', 'overlay', 'popup'],
    template: '<Popover open={false} onClose={() => {}}>\n  <Popover.Trigger>${1:Open}</Popover.Trigger>\n  <Popover.Content>${2:Content}</Popover.Content>\n</Popover>',
    description: 'Popover overlay',
    import: "import { Popover } from '@navikt/ds-react';",
  },
  {
    id: 'tooltip',
    name: 'Tooltip',
    category: 'component',
    keywords: ['tooltip', 'hint', 'help', 'hover'],
    template: '<Tooltip content="${1:Tooltip text}">\n  <span>${2:Hover me}</span>\n</Tooltip>',
    description: 'Tooltip overlay',
    import: "import { Tooltip } from '@navikt/ds-react';",
  },
  {
    id: 'helptext',
    name: 'HelpText',
    category: 'component',
    keywords: ['help', 'tooltip', 'info', 'assistance'],
    template: '<HelpText title="${1:Help title}">${2:Help content}</HelpText>',
    description: 'Contextual help tooltip',
    import: "import { HelpText } from '@navikt/ds-react';",
  },
  {
    id: 'dropdown',
    name: 'Dropdown',
    category: 'component',
    keywords: ['dropdown', 'menu', 'list', 'options'],
    template: '<Dropdown>\n  <Button as={Dropdown.Toggle}>${1:Open menu}</Button>\n  <Dropdown.Menu>\n    <Dropdown.Menu.List>\n      <Dropdown.Menu.List.Item>${2:Item}</Dropdown.Menu.List.Item>\n    </Dropdown.Menu.List>\n  </Dropdown.Menu>\n</Dropdown>',
    description: 'Dropdown menu',
    import: "import { Dropdown } from '@navikt/ds-react';",
  },
  {
    id: 'actionmenu',
    name: 'ActionMenu',
    category: 'component',
    keywords: ['action', 'menu', 'dropdown', 'options'],
    template: '<ActionMenu>\n  <ActionMenu.Trigger>${1:Actions}</ActionMenu.Trigger>\n  <ActionMenu.Content>\n    <ActionMenu.Item>${2:Item 1}</ActionMenu.Item>\n  </ActionMenu.Content>\n</ActionMenu>',
    description: 'Dropdown menu for actions',
    import: "import { ActionMenu } from '@navikt/ds-react';",
  },

  // Content Components
  {
    id: 'accordion',
    name: 'Accordion',
    category: 'component',
    keywords: ['accordion', 'collapse', 'expand', 'toggle', 'panel'],
    template: '<Accordion>\n  <Accordion.Item>\n    <Accordion.Header>${1:Header}</Accordion.Header>\n    <Accordion.Content>${2:Content}</Accordion.Content>\n  </Accordion.Item>\n</Accordion>',
    description: 'Expandable content sections',
    import: "import { Accordion } from '@navikt/ds-react';",
  },
  {
    id: 'expansioncard',
    name: 'ExpansionCard',
    category: 'component',
    keywords: ['expansion', 'card', 'collapse', 'expand'],
    template: '<ExpansionCard>\n  <ExpansionCard.Header>\n    <ExpansionCard.Title>${1:Title}</ExpansionCard.Title>\n  </ExpansionCard.Header>\n  <ExpansionCard.Content>${2:Content}</ExpansionCard.Content>\n</ExpansionCard>',
    description: 'Expandable card component',
    import: "import { ExpansionCard } from '@navikt/ds-react';",
  },
  {
    id: 'readmore',
    name: 'ReadMore',
    category: 'component',
    keywords: ['read', 'more', 'expand', 'collapse', 'text'],
    template: '<ReadMore header="${1:Read more}">\n  ${2:Hidden content}\n</ReadMore>',
    description: 'Expandable read more section',
    import: "import { ReadMore } from '@navikt/ds-react';",
  },
  {
    id: 'guidepanel',
    name: 'GuidePanel',
    category: 'component',
    keywords: ['guide', 'panel', 'info', 'help', 'content'],
    template: '<GuidePanel>\n  ${1:Guide content}\n</GuidePanel>',
    description: 'Informational guide panel',
    import: "import { GuidePanel } from '@navikt/ds-react';",
  },
  {
    id: 'chat',
    name: 'Chat',
    category: 'component',
    keywords: ['chat', 'message', 'bubble', 'conversation'],
    template: '<Chat variant="left" name="${1:User}">\n  <Chat.Bubble>${2:Message text}</Chat.Bubble>\n</Chat>',
    description: 'Chat message bubbles',
    import: "import { Chat } from '@navikt/ds-react';",
  },
  {
    id: 'table',
    name: 'Table',
    category: 'component',
    keywords: ['table', 'data', 'grid', 'list', 'rows'],
    template: '<Table>\n  <Table.Header>\n    <Table.Row>\n      <Table.HeaderCell>${1:Header}</Table.HeaderCell>\n    </Table.Row>\n  </Table.Header>\n  <Table.Body>\n    <Table.Row>\n      <Table.DataCell>${2:Data}</Table.DataCell>\n    </Table.Row>\n  </Table.Body>\n</Table>',
    description: 'Data table',
    import: "import { Table } from '@navikt/ds-react';",
  },
  {
    id: 'list',
    name: 'List',
    category: 'component',
    keywords: ['list', 'items', 'ul', 'ol', 'bullet'],
    template: '<List>\n  <List.Item>${1:Item 1}</List.Item>\n  <List.Item>${2:Item 2}</List.Item>\n</List>',
    description: 'Styled list component',
    import: "import { List } from '@navikt/ds-react';",
  },
  {
    id: 'linkcard',
    name: 'LinkCard',
    category: 'component',
    keywords: ['link', 'card', 'navigate', 'clickable'],
    template: '<LinkCard href="${1:#}">\n  <LinkCard.Title>${2:Card title}</LinkCard.Title>\n  <LinkCard.Description>${3:Card description}</LinkCard.Description>\n</LinkCard>',
    description: 'Clickable card link',
    import: "import { LinkCard } from '@navikt/ds-react';",
  },
  {
    id: 'formsummary',
    name: 'FormSummary',
    category: 'component',
    keywords: ['form', 'summary', 'review', 'submission'],
    template: '<FormSummary>\n  <FormSummary.Header>\n    <FormSummary.Heading>${1:Summary}</FormSummary.Heading>\n  </FormSummary.Header>\n  <FormSummary.Answers>\n    <FormSummary.Answer>\n      <FormSummary.Label>${2:Label}</FormSummary.Label>\n      <FormSummary.Value>${3:Value}</FormSummary.Value>\n    </FormSummary.Answer>\n  </FormSummary.Answers>\n</FormSummary>',
    description: 'Form submission summary',
    import: "import { FormSummary } from '@navikt/ds-react';",
  },

  // Typography Components
  {
    id: 'heading',
    name: 'Heading',
    category: 'component',
    keywords: ['heading', 'title', 'h1', 'h2', 'h3', 'text'],
    template: '<Heading level="1" size="large">${1:Heading text}</Heading>',
    description: 'Heading text',
    import: "import { Heading } from '@navikt/ds-react';",
  },
  {
    id: 'bodylong',
    name: 'BodyLong',
    category: 'component',
    keywords: ['body', 'text', 'paragraph', 'long'],
    template: '<BodyLong>${1:Body text}</BodyLong>',
    description: 'Long body text',
    import: "import { BodyLong } from '@navikt/ds-react';",
  },
  {
    id: 'bodyshort',
    name: 'BodyShort',
    category: 'component',
    keywords: ['body', 'text', 'paragraph', 'short'],
    template: '<BodyShort>${1:Short text}</BodyShort>',
    description: 'Short body text',
    import: "import { BodyShort } from '@navikt/ds-react';",
  },
  {
    id: 'label',
    name: 'Label',
    category: 'component',
    keywords: ['label', 'text', 'caption'],
    template: '<Label>${1:Label text}</Label>',
    description: 'Label text',
    import: "import { Label } from '@navikt/ds-react';",
  },
  {
    id: 'detail',
    name: 'Detail',
    category: 'component',
    keywords: ['detail', 'small', 'text', 'caption'],
    template: '<Detail>${1:Detail text}</Detail>',
    description: 'Small detail text',
    import: "import { Detail } from '@navikt/ds-react';",
  },
  {
    id: 'errormessage',
    name: 'ErrorMessage',
    category: 'component',
    keywords: ['error', 'message', 'text', 'validation'],
    template: '<ErrorMessage>${1:Error message}</ErrorMessage>',
    description: 'Error message text',
    import: "import { ErrorMessage } from '@navikt/ds-react';",
  },

  // Other Components
  {
    id: 'copybutton',
    name: 'CopyButton',
    category: 'component',
    keywords: ['copy', 'clipboard', 'button', 'text'],
    template: '<CopyButton copyText="${1:Text to copy}" />',
    description: 'Copy to clipboard button',
    import: "import { CopyButton } from '@navikt/ds-react';",
  },
  {
    id: 'internalheader',
    name: 'InternalHeader',
    category: 'component',
    keywords: ['header', 'navigation', 'internal', 'app'],
    template: '<InternalHeader>\n  <InternalHeader.Title>${1:App Title}</InternalHeader.Title>\n</InternalHeader>',
    description: 'Internal application header',
    import: "import { InternalHeader } from '@navikt/ds-react';",
  },
]

interface SearchOptions {
  category?: 'layout' | 'component'
  limit?: number
}

export const searchSnippets = (
  query: string,
  snippets: ComponentSnippet[] = AKSEL_SNIPPETS,
  options: SearchOptions = {}
): ComponentSnippet[] => {
  const lowerQuery = query.toLowerCase().trim()

  // Empty query returns all snippets (optionally filtered by category)
  if (!lowerQuery) {
    let results = snippets
    if (options.category) {
      results = results.filter((s) => s.category === options.category)
    }
    return results
  }

  // Filter by category first
  let filtered = snippets
  if (options.category) {
    filtered = filtered.filter((s) => s.category === options.category)
  }

  // Score each snippet
  const scored = filtered.map((snippet) => {
    let score = 0

    // Exact name match (highest priority)
    if (snippet.name.toLowerCase() === lowerQuery) {
      score += 100
    }
    // Name starts with query
    else if (snippet.name.toLowerCase().startsWith(lowerQuery)) {
      score += 50
    }
    // Name contains query
    else if (snippet.name.toLowerCase().includes(lowerQuery)) {
      score += 25
    }

    // Keyword exact match
    if (snippet.keywords.includes(lowerQuery)) {
      score += 40
    }
    // Keyword starts with query
    else if (snippet.keywords.some((kw) => kw.startsWith(lowerQuery))) {
      score += 20
    }
    // Keyword contains query
    else if (snippet.keywords.some((kw) => kw.includes(lowerQuery))) {
      score += 10
    }

    return { snippet, score }
  })

  // Filter out zero-score results
  const matches = scored.filter((s) => s.score > 0)

  // Sort by score (descending), then alphabetically
  matches.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score
    return a.snippet.name.localeCompare(b.snippet.name)
  })

  // Apply limit
  let results = matches.map((m) => m.snippet)
  if (options.limit) {
    results = results.slice(0, options.limit)
  }

  return results
}
