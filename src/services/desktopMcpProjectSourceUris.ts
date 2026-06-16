import type { ArcadePageId, ProjectSourceTarget } from '@/types/project'
import { isArcadePageId } from '@/services/projectSource'

export type DesktopMcpProjectSourceKind = 'jsx' | 'hooks'

export const DESKTOP_MCP_PROJECT_MANIFEST_URI = 'arcade://project/manifest' as const
export const DESKTOP_MCP_PROJECT_PREVIEW_CONTEXT_URI = 'arcade://project/preview-context' as const
export const DESKTOP_MCP_PROJECT_DIAGNOSTICS_URI = 'arcade://project/diagnostics' as const
export const DESKTOP_MCP_PROJECT_SOURCE_GLOBAL_JSX_URI = 'arcade://project/source/global/jsx' as const
export const DESKTOP_MCP_PROJECT_SOURCE_GLOBAL_HOOKS_URI = 'arcade://project/source/global/hooks' as const
const PROJECT_SOURCE_PAGE_URI_PATTERN = /^arcade:\/\/project\/source\/pages\/(page\d+)\/(jsx|hooks)$/

export interface ParsedDesktopMcpProjectSourceUri {
  uri: string
  sourceKind: DesktopMcpProjectSourceKind
  target: ProjectSourceTarget
}

export const createDesktopMcpProjectPageSourceUri = (
  pageId: ArcadePageId,
  sourceKind: DesktopMcpProjectSourceKind
): string => `arcade://project/source/pages/${pageId}/${sourceKind}`

export const parseDesktopMcpProjectSourceUri = (
  uri: string
): ParsedDesktopMcpProjectSourceUri | null => {
  if (uri === DESKTOP_MCP_PROJECT_SOURCE_GLOBAL_JSX_URI) {
    return {
      uri,
      sourceKind: 'jsx',
      target: { type: 'global-config' },
    }
  }

  if (uri === DESKTOP_MCP_PROJECT_SOURCE_GLOBAL_HOOKS_URI) {
    return {
      uri,
      sourceKind: 'hooks',
      target: { type: 'global-config' },
    }
  }

  const match = uri.match(PROJECT_SOURCE_PAGE_URI_PATTERN)
  if (!match || !isArcadePageId(match[1])) {
    return null
  }

  return {
    uri,
    sourceKind: match[2] as DesktopMcpProjectSourceKind,
    target: {
      type: 'page',
      pageId: match[1],
    },
  }
}

export const isDesktopMcpProjectSourceUri = (uri: string): boolean =>
  parseDesktopMcpProjectSourceUri(uri) !== null
