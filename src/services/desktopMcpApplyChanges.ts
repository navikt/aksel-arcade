import type { ArcadePageId, Project, ProjectSourceTarget, ThemeMode } from '@/types/project'
import type { PreviewDiagnostics } from '@/services/previewDiagnostics'
import { clonePreviewDiagnostics } from '@/services/previewDiagnostics'
import { parser as javascriptParser } from '@lezer/javascript'
import {
  DESKTOP_MCP_PROJECT_DIAGNOSTICS_URI,
  DESKTOP_MCP_PROJECT_MANIFEST_URI,
  DESKTOP_MCP_PROJECT_PREVIEW_CONTEXT_URI,
  DESKTOP_MCP_PROJECT_SOURCE_GLOBAL_HOOKS_URI,
  DESKTOP_MCP_PROJECT_SOURCE_GLOBAL_JSX_URI,
  createDesktopMcpProjectPageSourceUri,
  createDesktopMcpProjectRevision,
} from '@/services/desktopMcpProjectResources'
import {
  parseDesktopMcpProjectSourceUri,
  type DesktopMcpProjectSourceKind,
} from '@/services/desktopMcpProjectSourceUris'
import {
  createArcadePage,
  createArcadeSourceFile,
  getPageById,
  isArcadePageId,
  nextPageId,
  normalizeProjectSelection,
  renamePage as renameProjectPage,
  setActivePage,
  setStartPage,
  updateSourceForTarget,
} from '@/services/projectSource'
import { resolveAlertMigration } from '@/data/akselAuthoringPolicy'
import { validateProjectSize } from '@/services/storage'
import type {
  DesktopMcpApplyChangesFailure,
  DesktopMcpApplyChangesOperation,
  DesktopMcpApplyChangesOperationResult,
  DesktopMcpApplyChangesRequest,
  DesktopMcpApplyChangesSourceResources,
  DesktopMcpApplyChangesSuccess,
  DesktopMcpApplyChangesTempPageRefMapping,
} from './desktopMcpApplyChangesProtocol'

const MAX_PROJECT_NAME_LENGTH = 100
const PAGE_REF_PLACEHOLDER_PATTERN = /\{\{pageRef:([^}]+)\}\}/g
const TEMP_PAGE_REF_PATTERN = /^[^{}\s]+$/
const STATIC_IMPORT_STATEMENT_PATTERN = /^\s*import\b/m
const DEPRECATED_ALERT_PROP_NAMES = new Set([
  'closeButton',
  'contentMaxWidth',
  'data-color',
  'fullWidth',
  'inline',
  'onClose',
  'variant',
])

interface DesktopMcpApplyChangesContext {
  project: Project
  theme: ThemeMode
  diagnostics: PreviewDiagnostics
}

interface PlannedCreatedPage {
  index: number
  pageId: ArcadePageId
  sourceResources: DesktopMcpApplyChangesSourceResources
  newPageRef?: string
}

interface PlannedCreatedPages {
  byIndex: Map<number, PlannedCreatedPage>
  tempPageRefs: Map<string, PlannedCreatedPage>
}

interface UsedPageRefPlaceholder {
  tempPageRef: string
  pageId: ArcadePageId
}

interface ParsedJsxAttributeToken {
  name: string | null
  raw: string
  valueRaw?: string
}

interface ParsedJsxSyntaxNode {
  from: number
  to: number
  type: {
    name: string
  }
  firstChild: ParsedJsxSyntaxNode | null
  nextSibling: ParsedJsxSyntaxNode | null
}

type SourceOverrideKey = `${string}:${DesktopMcpProjectSourceKind}`

export interface PreparedDesktopMcpApplyChangesSuccess {
  ok: true
  nextProject: Project
  nextTheme: ThemeMode
  nextDiagnostics: PreviewDiagnostics
  previewRefreshRequired: boolean
  result: DesktopMcpApplyChangesSuccess
}

export type PreparedDesktopMcpApplyChangesResult =
  | PreparedDesktopMcpApplyChangesSuccess
  | DesktopMcpApplyChangesFailure

const parseJsxAttributeTokens = (
  content: string,
  tagNode: ParsedJsxSyntaxNode
): ParsedJsxAttributeToken[] => {
  const tokens: ParsedJsxAttributeToken[] = []

  for (let child = tagNode.firstChild; child; child = child.nextSibling) {
    if (child.type.name === 'JSXAttribute') {
      const identifierNode = findFirstChildByType(child, 'JSXIdentifier')
      if (!identifierNode) {
        continue
      }

      const equalsNode = findFirstChildByType(child, 'Equals')
      tokens.push({
        name: content.slice(identifierNode.from, identifierNode.to),
        raw: content.slice(child.from, child.to),
        valueRaw: equalsNode ? content.slice(equalsNode.to, child.to) : undefined,
      })
      continue
    }

    if (child.type.name === 'JSXSpreadAttribute') {
      tokens.push({
        name: null,
        raw: content.slice(child.from, child.to),
      })
    }
  }

  return tokens
}

const parseStaticBooleanJsxValue = (valueRaw?: string): boolean | undefined => {
  if (valueRaw === undefined) {
    return true
  }

  const trimmedValue = valueRaw.trim()
  if (trimmedValue === 'true' || trimmedValue === '{true}') {
    return true
  }
  if (trimmedValue === 'false' || trimmedValue === '{false}') {
    return false
  }
  return undefined
}

const parseStaticStringJsxValue = (valueRaw?: string): string | undefined => {
  if (!valueRaw) {
    return undefined
  }

  const trimmedValue = valueRaw.trim()
  const directMatch = trimmedValue.match(/^(['"])([\s\S]*)\1$/)
  if (directMatch) {
    return directMatch[2]
  }

  const expressionMatch = trimmedValue.match(/^\{\s*(['"])([\s\S]*)\1\s*\}$/)
  if (expressionMatch) {
    return expressionMatch[2]
  }

  return undefined
}

const findJsxAttributeToken = (tokens: readonly ParsedJsxAttributeToken[], name: string) =>
  tokens.find((token) => token.name === name)

const buildJsxAttributeString = (tokens: readonly ParsedJsxAttributeToken[], extraAttributes: string[]): string => {
  const parts = tokens
    .map((token) => token.raw.trim())
    .filter((part) => part.length > 0)
    .concat(extraAttributes)

  return parts.length > 0 ? ` ${parts.join(' ')}` : ''
}

const indentMultilineBlock = (text: string, prefix: string): string =>
  text
    .split('\n')
    .map((line) => `${prefix}${line}`)
    .join('\n')

const createSourceOverrideKey = (
  target: ProjectSourceTarget,
  sourceKind: DesktopMcpProjectSourceKind
): SourceOverrideKey =>
  `${target.type === 'global-config' ? 'global-config' : target.pageId}:${sourceKind}`

const sourceDefinesCustomAlert = (source: string): boolean => {
  if (!source.includes('Alert')) {
    return false
  }

  const tree = JSX_TYPESCRIPT_PARSER.parse(source)
  const hasAlertDefinition = (node: ParsedJsxSyntaxNode): boolean => {
    if (
      node.type.name === 'FunctionDeclaration' ||
      node.type.name === 'ClassDeclaration' ||
      node.type.name === 'VariableDeclaration'
    ) {
      for (let child = node.firstChild; child; child = child.nextSibling) {
        if (child.type.name === 'VariableDefinition' && source.slice(child.from, child.to) === 'Alert') {
          return true
        }
      }
    }

    for (let child = node.firstChild; child; child = child.nextSibling) {
      if (hasAlertDefinition(child)) {
        return true
      }
    }

    return false
  }

  return hasAlertDefinition(tree.topNode as ParsedJsxSyntaxNode)
}

const hasScopedCustomAlertDefinition = ({
  project,
  target,
  finalSourceOverrides,
}: {
  project: Project
  target: ProjectSourceTarget
  finalSourceOverrides: ReadonlyMap<SourceOverrideKey, string>
}): boolean => {
  const getScopedSourceText = (
    scopedTarget: ProjectSourceTarget,
    sourceKind: DesktopMcpProjectSourceKind
  ): string => {
    const override = finalSourceOverrides.get(createSourceOverrideKey(scopedTarget, sourceKind))
    if (override !== undefined) {
      return override
    }

    if (scopedTarget.type === 'global-config') {
      return project.source.globalConfig[sourceKind]
    }

    const page = getPageById(project.source, scopedTarget.pageId)
    return page?.source[sourceKind] ?? ''
  }

  const scopedSources = [
    getScopedSourceText({ type: 'global-config' }, 'jsx'),
    getScopedSourceText({ type: 'global-config' }, 'hooks'),
  ]

  if (target.type === 'page') {
    scopedSources.push(getScopedSourceText(target, 'jsx'))
    scopedSources.push(getScopedSourceText(target, 'hooks'))
  }

  return scopedSources.some((source) => sourceDefinesCustomAlert(source))
}

const collectFinalSourceOverrides = (
  operations: readonly DesktopMcpApplyChangesOperation[],
  plannedCreatedPages: PlannedCreatedPages
): Map<SourceOverrideKey, string> => {
  const overrides = new Map<SourceOverrideKey, string>()

  for (const [index, operation] of operations.entries()) {
    if (operation.type === 'replace_source') {
      const parsedSource = parseDesktopMcpProjectSourceUri(operation.resourceUri)
      if (!parsedSource) {
        continue
      }

      overrides.set(
        createSourceOverrideKey(parsedSource.target, parsedSource.sourceKind),
        operation.content
      )
      continue
    }

    if (operation.type === 'create_page') {
      const plannedPage = plannedCreatedPages.byIndex.get(index)
      if (!plannedPage) {
        continue
      }

      overrides.set(
        createSourceOverrideKey({ type: 'page', pageId: plannedPage.pageId }, 'jsx'),
        operation.jsxCode ?? ''
      )
      overrides.set(
        createSourceOverrideKey({ type: 'page', pageId: plannedPage.pageId }, 'hooks'),
        operation.hooksCode ?? ''
      )
    }
  }

  return overrides
}

const JSX_TYPESCRIPT_PARSER = javascriptParser.configure({ dialect: 'jsx ts' })

const findFirstChildByType = (
  node: ParsedJsxSyntaxNode,
  typeName: string
): ParsedJsxSyntaxNode | null => {
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (child.type.name === typeName) {
      return child
    }
  }

  return null
}

const getJsxTagName = (content: string, tagNode: ParsedJsxSyntaxNode | null): string | undefined => {
  if (!tagNode) {
    return undefined
  }

  const identifierNode = findFirstChildByType(tagNode, 'JSXIdentifier')
  return identifierNode ? content.slice(identifierNode.from, identifierNode.to) : undefined
}

const isSameSyntaxNode = (left: ParsedJsxSyntaxNode, right: ParsedJsxSyntaxNode): boolean =>
  left.from === right.from && left.to === right.to && left.type.name === right.type.name

const buildDismissibleAlertChildren = (
  target: 'LocalAlert' | 'GlobalAlert',
  children: string,
  onCloseRaw?: string
): string => {
  const closeButton = onCloseRaw
    ? `<${target}.CloseButton onClick=${onCloseRaw} />`
    : `<${target}.CloseButton />`
  const trimmedChildren = children.trim()
  const headerBlock = `\n  <${target}.Header>\n    ${closeButton}\n  </${target}.Header>`

  if (trimmedChildren.length === 0) {
    return `${headerBlock}\n`
  }

  return `${headerBlock}\n${indentMultilineBlock(trimmedChildren, '  ')}\n`
}

const rewriteAlertComponentUsages = (content: string, options?: { allowAlertMigration?: boolean }): string => {
  if (options?.allowAlertMigration === false) {
    return content
  }

  const tree = JSX_TYPESCRIPT_PARSER.parse(content)

  const rewriteNode = (node: ParsedJsxSyntaxNode): string => {
    if (node.type.name === 'JSXElement') {
      const selfClosingTag = findFirstChildByType(node, 'JSXSelfClosingTag')
      if (selfClosingTag && getJsxTagName(content, selfClosingTag) === 'Alert') {
        return rewriteAlertElement({
          content,
          node,
          openingNode: selfClosingTag,
        })
      }

      const openingTag = findFirstChildByType(node, 'JSXOpenTag')
      const closingTag = findFirstChildByType(node, 'JSXCloseTag')
      if (openingTag && closingTag && getJsxTagName(content, openingTag) === 'Alert') {
        return rewriteAlertElement({
          content,
          node,
          openingNode: openingTag,
          closingNode: closingTag,
        })
      }
    }

    if (!node.firstChild) {
      return content.slice(node.from, node.to)
    }

    let rewritten = ''
    let cursor = node.from
    for (
      let child: ParsedJsxSyntaxNode | null = node.firstChild;
      child;
      child = child.nextSibling
    ) {
      rewritten += content.slice(cursor, child.from)
      rewritten += rewriteNode(child)
      cursor = child.to
    }
    rewritten += content.slice(cursor, node.to)
    return rewritten
  }

  return rewriteNode(tree.topNode as ParsedJsxSyntaxNode)
}

const rewriteAlertElement = ({
  content,
  node,
  openingNode,
  closingNode,
}: {
  content: string
  node: ParsedJsxSyntaxNode
  openingNode: ParsedJsxSyntaxNode
  closingNode?: ParsedJsxSyntaxNode
}): string => {
  const tokens = parseJsxAttributeTokens(content, openingNode)
  const variantToken = findJsxAttributeToken(tokens, 'variant')
  const inlineToken = findJsxAttributeToken(tokens, 'inline')
  const fullWidthToken = findJsxAttributeToken(tokens, 'fullWidth')
  const closeButtonToken = findJsxAttributeToken(tokens, 'closeButton')
  const onCloseRaw = findJsxAttributeToken(tokens, 'onClose')?.valueRaw
  const hasSpreadAttribute = tokens.some((token) => token.name === null)
  const variant = variantToken ? parseStaticStringJsxValue(variantToken.valueRaw) : undefined
  const inline = inlineToken ? parseStaticBooleanJsxValue(inlineToken.valueRaw) : false
  const fullWidth = fullWidthToken ? parseStaticBooleanJsxValue(fullWidthToken.valueRaw) : false
  const closeButton = closeButtonToken
    ? parseStaticBooleanJsxValue(closeButtonToken.valueRaw)
    : false
  const hasDynamicMigrationProp =
    hasSpreadAttribute ||
    (!!variantToken && variant === undefined) ||
    (!!inlineToken && inline === undefined) ||
    (!!fullWidthToken && fullWidth === undefined) ||
    (!!closeButtonToken && closeButton === undefined)
  const migration = hasDynamicMigrationProp
    ? undefined
    : resolveAlertMigration({
        variant,
        inline,
        fullWidth,
        closeButton,
      })

  const remainingTokens = tokens.filter(
    (token) => token.name === null || !DEPRECATED_ALERT_PROP_NAMES.has(token.name)
  )

  if (openingNode.type.name === 'JSXSelfClosingTag' || !closingNode) {
    if (!migration) {
      return content.slice(node.from, node.to)
    }

    const attributes = buildJsxAttributeString(remainingTokens, [
      `${migration.targetProp}="${migration.targetValue}"`,
    ])
    if (
      migration.preservesCloseButton &&
      closeButton &&
      (migration.target === 'LocalAlert' || migration.target === 'GlobalAlert')
    ) {
      const replacementChildren = buildDismissibleAlertChildren(migration.target, '', onCloseRaw)
      return `<${migration.target}${attributes}>${replacementChildren}</${migration.target}>`
    }

    return `<${migration.target}${attributes} />`
  }

  let rewrittenChildren = ''
  let cursor = openingNode.to
  for (
    let child = openingNode.nextSibling;
    child && !isSameSyntaxNode(child, closingNode);
    child = child.nextSibling
  ) {
    rewrittenChildren += content.slice(cursor, child.from)
    rewrittenChildren += rewriteAlertComponentUsages(content.slice(child.from, child.to))
    cursor = child.to
  }
  rewrittenChildren += content.slice(cursor, closingNode.from)

  if (!migration) {
    return `${content.slice(node.from, openingNode.to)}${rewrittenChildren}${content.slice(closingNode.from, node.to)}`
  }

  const attributes = buildJsxAttributeString(remainingTokens, [
    `${migration.targetProp}="${migration.targetValue}"`,
  ])
  const replacementChildren =
    migration.preservesCloseButton && closeButton && (migration.target === 'LocalAlert' || migration.target === 'GlobalAlert')
      ? buildDismissibleAlertChildren(migration.target, rewrittenChildren, onCloseRaw)
      : rewrittenChildren

  return `<${migration.target}${attributes}>${replacementChildren}</${migration.target}>`
}

export const prepareDesktopMcpApplyChanges = (
  request: DesktopMcpApplyChangesRequest,
  context: DesktopMcpApplyChangesContext,
  timestamp = new Date().toISOString()
): PreparedDesktopMcpApplyChangesResult => {
  const currentProjectRevision = createDesktopMcpProjectRevision({
    project: context.project,
    theme: context.theme,
  })

  if (
    request.expectedProjectRevision !== undefined &&
    request.expectedProjectRevision !== currentProjectRevision
  ) {
    return createApplyChangesFailure(
      'stale-project-revision',
      `apply_changes expected project revision "${request.expectedProjectRevision}" but the active project is now "${currentProjectRevision}". Re-read arcade://project/manifest before retrying.`,
      {
        manifestResourceUri: DESKTOP_MCP_PROJECT_MANIFEST_URI,
        expectedProjectRevision: request.expectedProjectRevision,
        currentProjectRevision,
      }
    )
  }

  const plannedCreatedPages = planCreatedPages(request.operations, context.project.source.nextPageNumber)
  if (!plannedCreatedPages.ok) {
    return plannedCreatedPages.failure
  }
  const finalSourceOverrides = collectFinalSourceOverrides(
    request.operations,
    plannedCreatedPages.value
  )

  const operationResults: DesktopMcpApplyChangesOperationResult[] = []
  const changedResources = new Set<string>([DESKTOP_MCP_PROJECT_MANIFEST_URI])
  const usedPageRefPlaceholders = new Map<ArcadePageId, UsedPageRefPlaceholder>()
  let nextProject = context.project
  let nextTheme = context.theme
  let previewRefreshRequired = false

  for (const [index, operation] of request.operations.entries()) {
    switch (operation.type) {
      case 'replace_source': {
        const resolvedSource = resolveDesktopMcpApplyChangesSource(operation.resourceUri, nextProject)
        if (!resolvedSource.ok) {
          return resolvedSource.failure
        }

        const rewrittenContent = rewritePageRefPlaceholders({
          content: operation.content,
          contextLabel: `apply_changes replace_source operation ${index} content`,
          currentIndex: index,
          project: nextProject,
          plannedCreatedPages: plannedCreatedPages.value,
          usedPageRefPlaceholders,
        })
        if (!rewrittenContent.ok) {
          return rewrittenContent.failure
        }

        const allowAlertMigration = !hasScopedCustomAlertDefinition({
          project: nextProject,
          target: resolvedSource.target,
          finalSourceOverrides,
        })

        nextProject = updateSourceForTarget(nextProject, resolvedSource.target, {
          [resolvedSource.sourceKind]: rewriteAlertComponentUsages(rewrittenContent.content, {
            allowAlertMigration,
          }),
        })
        previewRefreshRequired = true
        changedResources.add(operation.resourceUri)
        operationResults.push({
          index,
          type: 'replace_source',
          resourceUri: operation.resourceUri,
        })
        break
      }
      case 'create_page': {
        const plannedPage = plannedCreatedPages.value.byIndex.get(index)
        if (!plannedPage) {
          return createApplyChangesFailure(
            'invalid-operation',
            `apply_changes create_page operation ${index} could not be planned.`
          )
        }

        const pageName = normalizePageName({
          operationType: 'create_page',
          index,
          name: operation.name,
          fallback: createDefaultPageName(plannedPage.pageId),
        })
        if (!pageName.ok) {
          return pageName.failure
        }

        const rewrittenJsx = rewritePageRefPlaceholders({
          content: operation.jsxCode ?? '',
          contextLabel: `apply_changes create_page operation ${index} jsxCode`,
          currentIndex: index,
          project: nextProject,
          plannedCreatedPages: plannedCreatedPages.value,
          usedPageRefPlaceholders,
        })
        if (!rewrittenJsx.ok) {
          return rewrittenJsx.failure
        }

        const rewrittenHooks = rewritePageRefPlaceholders({
          content: operation.hooksCode ?? '',
          contextLabel: `apply_changes create_page operation ${index} hooksCode`,
          currentIndex: index,
          project: nextProject,
          plannedCreatedPages: plannedCreatedPages.value,
          usedPageRefPlaceholders,
        })
        if (!rewrittenHooks.ok) {
          return rewrittenHooks.failure
        }

        const allowAlertMigration = !hasScopedCustomAlertDefinition({
          project: nextProject,
          target: { type: 'page', pageId: plannedPage.pageId },
          finalSourceOverrides,
        })

        nextProject = {
          ...nextProject,
          source: {
            ...nextProject.source,
            pages: [
              ...nextProject.source.pages,
              createArcadePage(
                plannedPage.pageId,
                pageName.value,
                createArcadeSourceFile(
                  rewriteAlertComponentUsages(rewrittenJsx.content, {
                    allowAlertMigration,
                  }),
                  rewriteAlertComponentUsages(rewrittenHooks.content, {
                    allowAlertMigration,
                  })
                )
              ),
            ],
            nextPageNumber: nextProject.source.nextPageNumber + 1,
          },
        }
        previewRefreshRequired = true
        changedResources.add(plannedPage.sourceResources.jsxResourceUri)
        changedResources.add(plannedPage.sourceResources.hooksResourceUri)
        operationResults.push({
          index,
          type: 'create_page',
          pageId: plannedPage.pageId,
          name: pageName.value,
          ...(plannedPage.newPageRef ? { newPageRef: plannedPage.newPageRef } : {}),
          sourceResources: plannedPage.sourceResources,
        })
        break
      }
      case 'rename_page': {
        const resolvedPage = resolvePageOperationTarget({
          operationType: 'rename_page',
          index,
          pageId: operation.pageId,
          tempPageRef: operation.tempPageRef,
          project: nextProject,
          plannedCreatedPages: plannedCreatedPages.value,
        })
        if (!resolvedPage.ok) {
          return resolvedPage.failure
        }

        const pageName = normalizePageName({
          operationType: 'rename_page',
          index,
          name: operation.name,
        })
        if (!pageName.ok) {
          return pageName.failure
        }

        nextProject = renameProjectPage(nextProject, resolvedPage.pageId, pageName.value)
        operationResults.push({
          index,
          type: 'rename_page',
          pageId: resolvedPage.pageId,
          name: pageName.value,
        })
        break
      }
      case 'delete_page': {
        const resolvedPage = resolvePageOperationTarget({
          operationType: 'delete_page',
          index,
          pageId: operation.pageId,
          tempPageRef: operation.tempPageRef,
          project: nextProject,
          plannedCreatedPages: plannedCreatedPages.value,
        })
        if (!resolvedPage.ok) {
          return resolvedPage.failure
        }

        nextProject = {
          ...nextProject,
          source: {
            ...nextProject.source,
            pages: nextProject.source.pages.filter((page) => page.id !== resolvedPage.pageId),
          },
        }
        previewRefreshRequired = true
        operationResults.push({
          index,
          type: 'delete_page',
          pageId: resolvedPage.pageId,
        })
        break
      }
      case 'set_start_page': {
        const resolvedPage = resolvePageOperationTarget({
          operationType: 'set_start_page',
          index,
          pageId: operation.pageId,
          tempPageRef: operation.tempPageRef,
          project: nextProject,
          plannedCreatedPages: plannedCreatedPages.value,
        })
        if (!resolvedPage.ok) {
          return resolvedPage.failure
        }

        nextProject = setStartPage(nextProject, resolvedPage.pageId)
        previewRefreshRequired = true
        operationResults.push({
          index,
          type: 'set_start_page',
          pageId: resolvedPage.pageId,
        })
        break
      }
      case 'select_active_page': {
        const resolvedPage = resolvePageOperationTarget({
          operationType: 'select_active_page',
          index,
          pageId: operation.pageId,
          tempPageRef: operation.tempPageRef,
          project: nextProject,
          plannedCreatedPages: plannedCreatedPages.value,
        })
        if (!resolvedPage.ok) {
          return resolvedPage.failure
        }

        nextProject = setActivePage(nextProject, resolvedPage.pageId)
        operationResults.push({
          index,
          type: 'select_active_page',
          pageId: resolvedPage.pageId,
        })
        break
      }
      case 'set_preview_context': {
        if (operation.viewportSize !== undefined) {
          nextProject = {
            ...nextProject,
            viewportSize: operation.viewportSize,
          }
        }
        if (operation.theme !== undefined) {
          nextTheme = operation.theme
        }
        changedResources.add(DESKTOP_MCP_PROJECT_PREVIEW_CONTEXT_URI)
        operationResults.push({
          index,
          type: 'set_preview_context',
          ...(operation.viewportSize !== undefined
            ? { viewportSize: operation.viewportSize }
            : {}),
          ...(operation.theme !== undefined ? { theme: operation.theme } : {}),
        })
        break
      }
      case 'rename_project': {
        const normalizedName = operation.name.trim()
        if (normalizedName.length === 0 || normalizedName.length > MAX_PROJECT_NAME_LENGTH) {
          return createApplyChangesFailure(
            'invalid-project-name',
            `apply_changes rename_project operation ${index} must set a project name with 1-${MAX_PROJECT_NAME_LENGTH} non-whitespace characters.`
          )
        }

        nextProject = {
          ...nextProject,
          name: normalizedName,
        }
        operationResults.push({
          index,
          type: 'rename_project',
          name: normalizedName,
        })
        break
      }
    }
  }

  if (nextProject.source.pages.length === 0) {
    return createApplyChangesFailure(
      'invalid-operation',
      'apply_changes would leave the Arcade project without any pages. Keep a remaining page or create a replacement before deleting the last page.'
    )
  }

  for (const placeholder of usedPageRefPlaceholders.values()) {
    if (!getPageById(nextProject.source, placeholder.pageId)) {
      return createApplyChangesFailure(
        'invalid-operation-target',
        `apply_changes resolved {{pageRef:${placeholder.tempPageRef}}} to Arcade page "${placeholder.pageId}", but that page was deleted before the batch finished.`,
        {
          manifestResourceUri: DESKTOP_MCP_PROJECT_MANIFEST_URI,
        }
      )
    }
  }

  if (!getPageById(nextProject.source, nextProject.source.startPageId)) {
    return createApplyChangesFailure(
      'invalid-operation',
      'apply_changes deleted the current Start page without setting a replacement in the same batch. Add set_start_page targeting a remaining page or tempPageRef.'
    )
  }

  if (!getPageById(nextProject.source, nextProject.activePageId)) {
    return createApplyChangesFailure(
      'invalid-operation',
      'apply_changes deleted the current Active page without selecting a replacement in the same batch. Add select_active_page targeting a remaining page or tempPageRef.'
    )
  }

  nextProject = normalizeProjectSelection({
    ...nextProject,
    lastModified: timestamp,
  })

  const assertionFailure = validateApplyChangesAssertions(request.assertions, nextProject)
  if (assertionFailure) {
    return assertionFailure
  }

  const sizeStatus = validateProjectSize(nextProject)
  if (!sizeStatus.valid) {
    return createApplyChangesFailure(
      'payload-too-large',
      sizeStatus.message ?? 'apply_changes would exceed the 5MB Arcade project size limit.'
    )
  }

  const projectRevision = createDesktopMcpProjectRevision({
    project: nextProject,
    theme: nextTheme,
  })
  const changedResourceList = getReadableChangedResources([...changedResources], nextProject)
  const nextRecommendedResources = dedupeResourceUris([
    DESKTOP_MCP_PROJECT_MANIFEST_URI,
    DESKTOP_MCP_PROJECT_DIAGNOSTICS_URI,
    ...changedResourceList,
  ])
  const tempPageRefMappings = createTempPageRefMappings(plannedCreatedPages.value.tempPageRefs, nextProject)

  return {
    ok: true,
    nextProject,
    nextTheme,
    nextDiagnostics: previewRefreshRequired
      ? createPendingSourceDiagnostics(context.diagnostics)
      : clonePreviewDiagnostics(context.diagnostics),
    previewRefreshRequired,
    result: {
      ok: true,
      summary: request.summary.trim(),
      projectRevision,
      changedResources: changedResourceList,
      nextRecommendedResources,
      operationResults,
      postChangeSummary: createPostChangeSummary(nextProject),
      ...(tempPageRefMappings ? { tempPageRefMappings } : {}),
      safeActivity: {
        toolName: 'apply_changes',
        operationTypes: getOrderedUniqueOperationTypes(request.operations),
        timestamp,
      },
    },
  }
}

const planCreatedPages = (
  operations: DesktopMcpApplyChangesOperation[],
  startingNextPageNumber: number
):
  | {
      ok: true
      value: PlannedCreatedPages
    }
  | {
      ok: false
      failure: DesktopMcpApplyChangesFailure
    } => {
  const byIndex = new Map<number, PlannedCreatedPage>()
  const tempPageRefs = new Map<string, PlannedCreatedPage>()
  let nextPageNumber = startingNextPageNumber

  for (const [index, operation] of operations.entries()) {
    if (operation.type !== 'create_page') {
      continue
    }

    const pageId = nextPageId({ nextPageNumber })
    const plannedPage: PlannedCreatedPage = {
      index,
      pageId,
      sourceResources: createPageSourceResources(pageId),
    }

    if (operation.newPageRef !== undefined) {
      const normalizedTempPageRef = normalizeTempPageRefField(operation.newPageRef, {
        operationType: 'create_page',
        index,
        fieldName: 'newPageRef',
      })
      if (!normalizedTempPageRef.ok) {
        return {
          ok: false,
          failure: normalizedTempPageRef.failure,
        }
      }

      const existingPlan = tempPageRefs.get(normalizedTempPageRef.value)
      if (existingPlan) {
        return {
          ok: false,
          failure: createApplyChangesFailure(
            'invalid-operation',
            `apply_changes create_page operation ${index} newPageRef "${normalizedTempPageRef.value}" duplicates create_page operation ${existingPlan.index}.`
          ),
        }
      }

      plannedPage.newPageRef = normalizedTempPageRef.value
      tempPageRefs.set(normalizedTempPageRef.value, plannedPage)
    }

    byIndex.set(index, plannedPage)
    nextPageNumber += 1
  }

  return {
    ok: true,
    value: {
      byIndex,
      tempPageRefs,
    },
  }
}

const resolveDesktopMcpApplyChangesSource = (
  resourceUri: string,
  project: Project
):
  | {
      ok: true
      target: ProjectSourceTarget
      sourceKind: DesktopMcpProjectSourceKind
    }
  | {
      ok: false
      failure: DesktopMcpApplyChangesFailure
    } => {
  const parsedSourceUri = parseDesktopMcpProjectSourceUri(resourceUri)
  if (!parsedSourceUri) {
    return {
      ok: false,
      failure: createApplyChangesFailure(
        'invalid-operation-target',
        `apply_changes replace_source can target only existing Arcade source resources from the manifest. "${resourceUri}" is not supported.`,
        {
          manifestResourceUri: DESKTOP_MCP_PROJECT_MANIFEST_URI,
          resourceUri,
        }
      ),
    }
  }

  if (
    parsedSourceUri.target.type === 'page' &&
    !getPageById(project.source, parsedSourceUri.target.pageId)
  ) {
    return {
      ok: false,
      failure: createApplyChangesFailure(
        'invalid-operation-target',
        `apply_changes replace_source could not find Arcade page "${parsedSourceUri.target.pageId}" for "${resourceUri}". Re-read arcade://project/manifest before retrying.`,
        {
          manifestResourceUri: DESKTOP_MCP_PROJECT_MANIFEST_URI,
          resourceUri,
        }
      ),
    }
  }

  return {
    ok: true,
    target: parsedSourceUri.target,
    sourceKind: parsedSourceUri.sourceKind,
  }
}

const resolvePageOperationTarget = ({
  operationType,
  index,
  pageId,
  tempPageRef,
  project,
  plannedCreatedPages,
}: {
  operationType: 'rename_page' | 'delete_page' | 'set_start_page' | 'select_active_page'
  index: number
  pageId?: ArcadePageId
  tempPageRef?: string
  project: Project
  plannedCreatedPages: PlannedCreatedPages
}):
  | {
      ok: true
      pageId: ArcadePageId
    }
  | {
      ok: false
      failure: DesktopMcpApplyChangesFailure
    } => {
  if ((pageId === undefined && tempPageRef === undefined) || (pageId !== undefined && tempPageRef !== undefined)) {
    return {
      ok: false,
      failure: createApplyChangesFailure(
        'invalid-operation',
        `apply_changes ${operationType} operation ${index} must provide exactly one of pageId or tempPageRef.`
      ),
    }
  }

  if (pageId !== undefined) {
    if (!isArcadePageId(pageId)) {
      return {
        ok: false,
        failure: createApplyChangesFailure(
          'invalid-operation',
          `apply_changes ${operationType} operation ${index} pageId must be a valid Arcade page id.`
        ),
      }
    }

    if (!getPageById(project.source, pageId)) {
      return {
        ok: false,
        failure: createApplyChangesFailure(
          'invalid-operation-target',
          `apply_changes ${operationType} operation ${index} could not find Arcade page "${pageId}". Re-read arcade://project/manifest before retrying.`,
          {
            manifestResourceUri: DESKTOP_MCP_PROJECT_MANIFEST_URI,
          }
        ),
      }
    }

    return {
      ok: true,
      pageId,
    }
  }

  const normalizedTempPageRef = normalizeTempPageRefField(tempPageRef!, {
    operationType,
    index,
    fieldName: 'tempPageRef',
  })
  if (!normalizedTempPageRef.ok) {
    return {
      ok: false,
      failure: normalizedTempPageRef.failure,
    }
  }

  const plannedPage = plannedCreatedPages.tempPageRefs.get(normalizedTempPageRef.value)
  if (!plannedPage) {
    return {
      ok: false,
      failure: createApplyChangesFailure(
        'invalid-operation-target',
        `apply_changes ${operationType} operation ${index} references unknown tempPageRef "${normalizedTempPageRef.value}". Declare create_page.newPageRef "${normalizedTempPageRef.value}" earlier in the same batch.`,
        {
          manifestResourceUri: DESKTOP_MCP_PROJECT_MANIFEST_URI,
        }
      ),
    }
  }

  if (plannedPage.index > index) {
    return {
      ok: false,
      failure: createApplyChangesFailure(
        'invalid-operation-target',
        `apply_changes ${operationType} operation ${index} references tempPageRef "${normalizedTempPageRef.value}" before create_page declares it. Move the create_page earlier in the batch.`,
        {
          manifestResourceUri: DESKTOP_MCP_PROJECT_MANIFEST_URI,
        }
      ),
    }
  }

  if (!getPageById(project.source, plannedPage.pageId)) {
    return {
      ok: false,
      failure: createApplyChangesFailure(
        'invalid-operation-target',
        `apply_changes ${operationType} operation ${index} references tempPageRef "${normalizedTempPageRef.value}", but Arcade page "${plannedPage.pageId}" is no longer available at that step.`,
        {
          manifestResourceUri: DESKTOP_MCP_PROJECT_MANIFEST_URI,
        }
      ),
    }
  }

  return {
    ok: true,
    pageId: plannedPage.pageId,
  }
}

const rewritePageRefPlaceholders = ({
  content,
  contextLabel,
  currentIndex,
  project,
  plannedCreatedPages,
  usedPageRefPlaceholders,
}: {
  content: string
  contextLabel: string
  currentIndex: number
  project: Project
  plannedCreatedPages: PlannedCreatedPages
  usedPageRefPlaceholders: Map<ArcadePageId, UsedPageRefPlaceholder>
}):
  | {
      ok: true
      content: string
    }
  | {
      ok: false
      failure: DesktopMcpApplyChangesFailure
    } => {
  let failure: DesktopMcpApplyChangesFailure | null = null

  const rewrittenContent = content.replace(PAGE_REF_PLACEHOLDER_PATTERN, (fullMatch, rawTempPageRef) => {
    if (failure) {
      return fullMatch
    }

    const normalizedTempPageRef = normalizeTempPageRefValue(rawTempPageRef)
    if (!normalizedTempPageRef.ok) {
      failure = createApplyChangesFailure(
        'invalid-operation',
        `${contextLabel} contains invalid ${fullMatch} placeholder. pageRef names must be non-empty tokens without spaces or braces.`
      )
      return fullMatch
    }

    const plannedPage = plannedCreatedPages.tempPageRefs.get(normalizedTempPageRef.value)
    if (!plannedPage) {
      failure = createApplyChangesFailure(
        'invalid-operation-target',
        `${contextLabel} contains unresolved ${fullMatch} placeholder. Declare create_page.newPageRef "${normalizedTempPageRef.value}" in the same apply_changes batch.`,
        {
          manifestResourceUri: DESKTOP_MCP_PROJECT_MANIFEST_URI,
        }
      )
      return fullMatch
    }

    if (plannedPage.index < currentIndex && !getPageById(project.source, plannedPage.pageId)) {
      failure = createApplyChangesFailure(
        'invalid-operation-target',
        `${contextLabel} contains ${fullMatch} placeholder, but Arcade page "${plannedPage.pageId}" is no longer available at that step.`,
        {
          manifestResourceUri: DESKTOP_MCP_PROJECT_MANIFEST_URI,
        }
      )
      return fullMatch
    }

    usedPageRefPlaceholders.set(plannedPage.pageId, {
      tempPageRef: normalizedTempPageRef.value,
      pageId: plannedPage.pageId,
    })
    return plannedPage.pageId
  })

  if (failure) {
    return {
      ok: false,
      failure,
    }
  }

  return {
    ok: true,
    content: rewrittenContent,
  }
}

const normalizePageName = ({
  operationType,
  index,
  name,
  fallback,
}: {
  operationType: 'create_page' | 'rename_page'
  index: number
  name: string | undefined
  fallback?: string
}):
  | {
      ok: true
      value: string
    }

  | {
      ok: false
      failure: DesktopMcpApplyChangesFailure
    } => {
  if (name === undefined) {
    if (fallback !== undefined) {
      return {
        ok: true,
        value: fallback,
      }
    }

    return {
      ok: false,
      failure: createApplyChangesFailure(
        'invalid-operation',
        `apply_changes ${operationType} operation ${index} name must be a non-empty string.`
      ),
    }
  }

  const normalizedName = name.trim()
  if (normalizedName.length === 0) {
    return {
      ok: false,
      failure: createApplyChangesFailure(
        'invalid-operation',
        `apply_changes ${operationType} operation ${index} name must be a non-empty string${operationType === 'create_page' ? ' when provided' : ''}.`
      ),
    }
  }

  return {
    ok: true,
    value: normalizedName,
  }
}

const validateApplyChangesAssertions = (
  assertions: DesktopMcpApplyChangesRequest['assertions'] | undefined,
  project: Project
): DesktopMcpApplyChangesFailure | null => {
  if (!assertions) {
    return null
  }

  if (assertions.pageCount !== undefined && project.source.pages.length !== assertions.pageCount) {
    return createApplyChangesFailure(
      'assertion-failed',
      `apply_changes assertion failed: expected ${assertions.pageCount} pages, but the project now has ${project.source.pages.length}.`,
      {
        manifestResourceUri: DESKTOP_MCP_PROJECT_MANIFEST_URI,
      }
    )
  }

  const expectedStartPageId = resolveAssertionPageTarget(assertions.startPage, project)
  if (expectedStartPageId && project.source.startPageId !== expectedStartPageId) {
    return createApplyChangesFailure(
      'assertion-failed',
      `apply_changes assertion failed: expected Start page "${expectedStartPageId}", but the Start page is "${project.source.startPageId}".`,
      {
        manifestResourceUri: DESKTOP_MCP_PROJECT_MANIFEST_URI,
      }
    )
  }

  const expectedActivePageId = resolveAssertionPageTarget(assertions.activePage, project)
  if (expectedActivePageId && project.activePageId !== expectedActivePageId) {
    return createApplyChangesFailure(
      'assertion-failed',
      `apply_changes assertion failed: expected Active page "${expectedActivePageId}", but the Active page is "${project.activePageId}".`,
      {
        manifestResourceUri: DESKTOP_MCP_PROJECT_MANIFEST_URI,
      }
    )
  }

  if (assertions.forbidImports) {
    const importSource = findFirstStaticImportSource(project)
    if (importSource) {
      return createApplyChangesFailure(
        'assertion-failed',
        `apply_changes assertion failed: forbidImports found an import statement in ${importSource.label}. Arcade source must be import-free.`,
        {
          manifestResourceUri: DESKTOP_MCP_PROJECT_MANIFEST_URI,
          resourceUri: importSource.resourceUri,
        }
      )
    }
  }

  return null
}

const resolveAssertionPageTarget = (
  target: ArcadePageId | 'first' | undefined,
  project: Project
): ArcadePageId | null => {
  if (!target) {
    return null
  }

  if (target === 'first') {
    return project.source.pages[0]?.id ?? null
  }

  return target
}

const findFirstStaticImportSource = (
  project: Project
): { label: string; resourceUri: string } | null => {
  const sources = [
    {
      label: 'Global config JSX',
      resourceUri: DESKTOP_MCP_PROJECT_SOURCE_GLOBAL_JSX_URI,
      content: project.source.globalConfig.jsx,
    },
    {
      label: 'Global config Hooks',
      resourceUri: DESKTOP_MCP_PROJECT_SOURCE_GLOBAL_HOOKS_URI,
      content: project.source.globalConfig.hooks,
    },
    ...project.source.pages.flatMap((page) => [
      {
        label: `${page.id} JSX`,
        resourceUri: createDesktopMcpProjectPageSourceUri(page.id, 'jsx'),
        content: page.source.jsx,
      },
      {
        label: `${page.id} Hooks`,
        resourceUri: createDesktopMcpProjectPageSourceUri(page.id, 'hooks'),
        content: page.source.hooks,
      },
    ]),
  ]

  return sources.find((source) => STATIC_IMPORT_STATEMENT_PATTERN.test(source.content)) ?? null
}

const createPostChangeSummary = (
  project: Project
): DesktopMcpApplyChangesSuccess['postChangeSummary'] => ({
  pageCount: project.source.pages.length,
  startPageId: project.source.startPageId,
  activePageId: project.activePageId,
  pages: project.source.pages.map((page) => ({
    id: page.id,
    name: page.name,
    sourceResources: createPageSourceResources(page.id),
  })),
  warnings:
    project.source.pages.length > 5
      ? [
          `Project now has ${project.source.pages.length} pages. If the user asked for a smaller replacement, delete extra pages before finishing.`,
        ]
      : [],
})

const normalizeTempPageRefField = (
  tempPageRef: string,
  {
    operationType,
    index,
    fieldName,
  }: {
    operationType:
      | 'create_page'
      | 'rename_page'
      | 'delete_page'
      | 'set_start_page'
      | 'select_active_page'
    index: number
    fieldName: 'newPageRef' | 'tempPageRef'
  }
):
  | {
      ok: true
      value: string
    }
  | {
      ok: false
      failure: DesktopMcpApplyChangesFailure
    } => {
  const normalizedTempPageRef = normalizeTempPageRefValue(tempPageRef)
  if (normalizedTempPageRef.ok) {
    return normalizedTempPageRef
  }

  return {
    ok: false,
    failure: createApplyChangesFailure(
      'invalid-operation',
      `apply_changes ${operationType} operation ${index} ${fieldName} must be a non-empty token without spaces or braces.`
    ),
  }
}

const normalizeTempPageRefValue = (
  tempPageRef: string
):
  | {
      ok: true
      value: string
    }
  | {
      ok: false
    } => {
  const normalizedTempPageRef = tempPageRef.trim()
  if (normalizedTempPageRef.length === 0 || !TEMP_PAGE_REF_PATTERN.test(normalizedTempPageRef)) {
    return { ok: false }
  }

  return {
    ok: true,
    value: normalizedTempPageRef,
  }
}

const createPageSourceResources = (
  pageId: ArcadePageId
): DesktopMcpApplyChangesSourceResources => ({
  jsxResourceUri: createDesktopMcpProjectPageSourceUri(pageId, 'jsx'),
  hooksResourceUri: createDesktopMcpProjectPageSourceUri(pageId, 'hooks'),
})

const createDefaultPageName = (pageId: ArcadePageId): string => {
  const match = pageId.match(/^page(\d+)$/)
  if (!match) {
    return 'Page'
  }

  return `Page ${Number.parseInt(match[1], 10)}`
}

const getReadableChangedResources = (resourceUris: string[], project: Project): string[] =>
  resourceUris.filter((resourceUri) => isReadableChangedResource(resourceUri, project))

const isReadableChangedResource = (resourceUri: string, project: Project): boolean => {
  if (
    resourceUri === DESKTOP_MCP_PROJECT_MANIFEST_URI ||
    resourceUri === DESKTOP_MCP_PROJECT_PREVIEW_CONTEXT_URI
  ) {
    return true
  }

  const parsedSourceUri = parseDesktopMcpProjectSourceUri(resourceUri)
  if (!parsedSourceUri) {
    return false
  }

  return (
    parsedSourceUri.target.type === 'global-config' ||
    getPageById(project.source, parsedSourceUri.target.pageId) !== undefined
  )
}

const createTempPageRefMappings = (
  tempPageRefs: Map<string, PlannedCreatedPage>,
  project: Project
): Record<string, DesktopMcpApplyChangesTempPageRefMapping> | undefined => {
  const entries = [...tempPageRefs.entries()].flatMap(([tempPageRef, plannedPage]) =>
    getPageById(project.source, plannedPage.pageId)
      ? [
          [
            tempPageRef,
            {
              pageId: plannedPage.pageId,
              sourceResources: plannedPage.sourceResources,
            },
          ] as const,
        ]
      : []
  )

  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}

const createPendingSourceDiagnostics = (diagnostics: PreviewDiagnostics): PreviewDiagnostics => ({
  status: 'transpiling',
  compileError: null,
  runtimeError: null,
  sandboxConsoleMessages: diagnostics.sandboxConsoleMessages.map((message) => ({
    ...message,
    args: [...message.args],
  })),
})

const getOrderedUniqueOperationTypes = (
  operations: DesktopMcpApplyChangesOperation[]
): Array<DesktopMcpApplyChangesOperation['type']> => {
  const seen = new Set<DesktopMcpApplyChangesOperation['type']>()
  const operationTypes: Array<DesktopMcpApplyChangesOperation['type']> = []

  for (const operation of operations) {
    if (seen.has(operation.type)) {
      continue
    }
    seen.add(operation.type)
    operationTypes.push(operation.type)
  }

  return operationTypes
}

const dedupeResourceUris = (resourceUris: string[]): string[] => {
  const seen = new Set<string>()
  const deduped: string[] = []

  for (const resourceUri of resourceUris) {
    if (seen.has(resourceUri)) {
      continue
    }
    seen.add(resourceUri)
    deduped.push(resourceUri)
  }

  return deduped
}

const createApplyChangesFailure = (
  code: DesktopMcpApplyChangesFailure['code'],
  message: string,
  extras: Omit<DesktopMcpApplyChangesFailure, 'ok' | 'code' | 'message'> = {}
): DesktopMcpApplyChangesFailure => ({
  ok: false,
  code,
  message,
  ...extras,
})
