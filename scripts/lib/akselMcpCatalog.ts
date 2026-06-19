import {
  AKSEL_CATALOG_VERSION,
  listCatalogEntries,
  type AkselCatalogEntry,
  type AkselCatalogProp,
} from '@/data/akselCatalog'
import {
  filterNewAuthoringEntries,
  getNewAuthoringPolicy,
  listHiddenNewAuthoringRoots,
  type HiddenNewAuthoringMigrationMatch,
  type HiddenNewAuthoringMigrationRule,
  type HiddenNewAuthoringPropMapping,
} from '@/data/akselAuthoringPolicy'

/**
 * Builds the version-matched Aksel snippet data that the Desktop Arcade MCP
 * server serves through `arcade://aksel/catalog` and
 * `arcade://aksel/components/{name}`.
 *
 * The single source of truth is `src/data/akselCatalog.ts` (the same catalog the
 * editor's insertions use), so the MCP snippets can never drift from what
 * actually runs in Arcade's runtime. This module only reshapes that catalog into
 * a compact, import-free, agent-facing form and resolves the editor's insertion
 * placeholders to their clean first-insertion output.
 */

const AKSEL_COMPONENT_RESOURCE_URI_PREFIX = 'arcade://aksel/components/'

const SNIPPET_TABSTOP_PATTERN = /\$\{(\d+):([^}]+)\}/g
const COLLISION_TOKEN_PATTERN = /\{\{[\w]+\}\}/g
const MCP_COMPONENT_ALIASES = Object.freeze({
  RadioGroup: 'Radio',
})

export interface McpAkselComponentProp {
  name: string
  type: string
  values?: string[]
  required?: boolean
  default?: string
  description: string
}

export interface McpAkselComponentSnippet {
  jsx: string
  hooks?: string
}

export interface McpAkselComponentDetail {
  name: string
  group: AkselCatalogEntry['group']
  status: AkselCatalogEntry['status']
  description: string
  docs: string
  keywords: string[]
  props: McpAkselComponentProp[]
  snippet: McpAkselComponentSnippet
}

export interface McpAkselComponentIndexEntry {
  name: string
  group: AkselCatalogEntry['group']
  status: AkselCatalogEntry['status']
  purpose: string
  resourceUri: string
}

export interface McpAkselHiddenRootReplacement {
  reason: 'deprecated' | 'replaced'
  replacements: string[]
  migrationRules?: McpAkselHiddenRootMigrationRule[]
}

export type McpAkselHiddenRootMigrationMatch = HiddenNewAuthoringMigrationMatch

export type McpAkselHiddenRootPropMapping = HiddenNewAuthoringPropMapping

export interface McpAkselHiddenRootMigrationRule extends Omit<HiddenNewAuthoringMigrationRule, 'match' | 'propMappings'> {
  match?: McpAkselHiddenRootMigrationMatch
  propMappings?: McpAkselHiddenRootPropMapping[]
}

export interface McpAkselCatalog {
  akselVersion: string
  components: McpAkselComponentIndexEntry[]
  componentsByName: Record<string, McpAkselComponentDetail>
  componentAliases: Record<string, string>
  hiddenRootReplacements: Record<string, McpAkselHiddenRootReplacement>
}

export const akselComponentResourceUri = (name: string): string =>
  `${AKSEL_COMPONENT_RESOURCE_URI_PREFIX}${encodeURIComponent(name)}`

/**
 * Resolves an editor insertion template to the clean code an agent should read:
 * `${1:label}` tabstops collapse to their label, and `{{token}}` collision
 * suffixes resolve to the empty first-insertion form (matching
 * `componentInsertion.ts` for a fresh, collision-free insert).
 */
export const resolveSnippetCode = (code: string): string =>
  code
    .replace(SNIPPET_TABSTOP_PATTERN, (_match, _index, label: string) => label)
    .replace(COLLISION_TOKEN_PATTERN, '')

const toComponentProp = (prop: AkselCatalogProp): McpAkselComponentProp => ({
  name: prop.name,
  type: prop.type,
  ...(prop.values ? { values: prop.values } : {}),
  ...(prop.required ? { required: true } : {}),
  ...(prop.default !== undefined ? { default: prop.default } : {}),
  description: prop.description,
})

const toComponentDetail = (entry: AkselCatalogEntry): McpAkselComponentDetail => {
  const hooks = entry.snippet.hooksCode ? resolveSnippetCode(entry.snippet.hooksCode) : undefined

  return {
    name: entry.name,
    group: entry.group,
    status: entry.status,
    description: entry.description,
    docs: entry.docs,
    keywords: entry.keywords,
    props: entry.props.map(toComponentProp),
    snippet: {
      jsx: resolveSnippetCode(entry.snippet.code),
      ...(hooks ? { hooks } : {}),
    },
  }
}

/**
 * The component set offered to authoring agents: layout primitives and core
 * components that are current or experimental, with replaced/deprecated roots
 * (e.g. Modal, Alert, Dropdown) filtered out so agents are steered to the
 * recommended Aksel choices. Icons are intentionally excluded from this set —
 * there are thousands, so they are discovered separately.
 */
export const listMcpAuthoringEntries = (): AkselCatalogEntry[] =>
  filterNewAuthoringEntries(
    listCatalogEntries({
      groups: ['layout', 'component'],
      statuses: ['current', 'experimental'],
    })
  )

const buildComponentAliases = (
  entries: readonly AkselCatalogEntry[]
): Record<string, string> => {
  const availableNames = new Set(entries.map((entry) => entry.name))

  return Object.entries(MCP_COMPONENT_ALIASES).reduce<Record<string, string>>((map, [alias, target]) => {
    if (availableNames.has(target)) {
      map[alias] = target
    }
    return map
  }, {})
}

const buildHiddenRootReplacements = (): Record<string, McpAkselHiddenRootReplacement> =>
  listHiddenNewAuthoringRoots().reduce<Record<string, McpAkselHiddenRootReplacement>>((map, rootName) => {
    const policy = getNewAuthoringPolicy(rootName)
    if (policy) {
      map[rootName] = {
        reason: policy.reason,
        replacements: [...policy.replacements],
        ...(policy.migrationRules
          ? {
              migrationRules: policy.migrationRules.map((rule): McpAkselHiddenRootMigrationRule => ({
                when: rule.when,
                target: rule.target,
                ...(rule.match
                  ? {
                      match: {
                        ...(rule.match.fullWidth ? { fullWidth: true } : {}),
                        ...(rule.match.closeButton ? { closeButton: true } : {}),
                        ...(rule.match.inline ? { inline: true } : {}),
                        ...(rule.match.variants ? { variants: [...rule.match.variants] } : {}),
                      },
                    }
                  : {}),
                ...(rule.propMappings
                  ? {
                      propMappings: rule.propMappings.map((mapping): McpAkselHiddenRootPropMapping => ({
                        sourceProp: mapping.sourceProp,
                        targetProp: mapping.targetProp,
                        valueMap: { ...mapping.valueMap },
                      })),
                    }
                  : {}),
                ...(rule.preservesCloseButton ? { preservesCloseButton: true } : {}),
                ...(rule.note ? { note: rule.note } : {}),
              })),
            }
          : {}),
      }
    }
    return map
  }, {})

export const buildMcpAkselCatalog = (): McpAkselCatalog => {
  const entries = listMcpAuthoringEntries()

  const components = entries.map<McpAkselComponentIndexEntry>((entry) => ({
    name: entry.name,
    group: entry.group,
    status: entry.status,
    purpose: entry.description,
    resourceUri: akselComponentResourceUri(entry.name),
  }))

  const componentsByName = entries.reduce<Record<string, McpAkselComponentDetail>>((map, entry) => {
    map[entry.name] = toComponentDetail(entry)
    return map
  }, {})

  return {
    akselVersion: AKSEL_CATALOG_VERSION,
    components,
    componentsByName,
    componentAliases: buildComponentAliases(entries),
    hiddenRootReplacements: buildHiddenRootReplacements(),
  }
}

const GENERATED_FILE_HEADER = [
  '// Generated by scripts/generate-mcp-aksel-catalog.(ts|mjs). Do not edit by hand.',
  '// Source of truth: src/data/akselCatalog.ts. Refresh with `npm run aksel:refresh-mcp-catalog`.',
  '//',
  '// This artifact lets the CommonJS Desktop Arcade MCP server (desktop/mcpServer.cjs)',
  '// serve version-matched, import-free Aksel snippets without importing the TypeScript catalog.',
].join('\n')

export const renderMcpAkselCatalogModule = (catalog: McpAkselCatalog = buildMcpAkselCatalog()): string =>
  `${GENERATED_FILE_HEADER}\n\nmodule.exports = ${JSON.stringify(catalog, null, 2)}\n`
