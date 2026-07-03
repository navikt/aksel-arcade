export const AKSEL_COMPONENT_RESOURCE_URI_PREFIX = 'arcade://aksel/components/' as const

export interface DesktopMcpAkselComponentProp {
  name: string
  type: string
  values?: string[]
  required?: boolean
  default?: string
  description: string
}

export interface DesktopMcpAkselComponentSnippet {
  jsx: string
  hooks?: string
}

export interface DesktopMcpAkselComponentDetail {
  name: string
  group: string
  status: string
  description: string
  docs: string
  keywords: string[]
  props: DesktopMcpAkselComponentProp[]
  snippet: DesktopMcpAkselComponentSnippet
}

export interface DesktopMcpAkselComponentIndexEntry {
  name: string
  group: string
  status: string
  purpose: string
  resourceUri: string
}

export interface DesktopMcpAkselHiddenRootMigrationMatch {
  fullWidth?: boolean
  closeButton?: boolean
  inline?: boolean
  variants?: string[]
}

export interface DesktopMcpAkselHiddenRootPropMapping {
  sourceProp: string
  targetProp: string
  valueMap: Record<string, string>
}

export interface DesktopMcpAkselHiddenRootMigrationRule {
  when: string
  target: string
  match?: DesktopMcpAkselHiddenRootMigrationMatch
  preservesCloseButton?: boolean
  note?: string
  propMappings?: DesktopMcpAkselHiddenRootPropMapping[]
}

export interface DesktopMcpAkselHiddenRootReplacement {
  reason: 'deprecated' | 'replaced'
  replacements: string[]
  migrationRules?: DesktopMcpAkselHiddenRootMigrationRule[]
}

export interface DesktopMcpAkselCatalogData {
  akselVersion: string
  components: DesktopMcpAkselComponentIndexEntry[]
  componentsByName: Record<string, DesktopMcpAkselComponentDetail>
  componentAliases: Record<string, string>
  hiddenRootReplacements: Record<string, DesktopMcpAkselHiddenRootReplacement>
}

export const akselComponentResourceUri = (name: string): string =>
  `${AKSEL_COMPONENT_RESOURCE_URI_PREFIX}${encodeURIComponent(name)}`
