import type { ArcadePageId } from '@/types/project'

export type DesktopMcpProjectSourceKind = 'jsx' | 'hooks'

export const DESKTOP_MCP_PROJECT_MANIFEST_URI = 'arcade://project/manifest' as const
export const DESKTOP_MCP_PROJECT_PREVIEW_CONTEXT_URI = 'arcade://project/preview-context' as const
export const DESKTOP_MCP_PROJECT_DIAGNOSTICS_URI = 'arcade://project/diagnostics' as const
export const DESKTOP_MCP_PROJECT_SOURCE_GLOBAL_JSX_URI = 'arcade://project/source/global/jsx' as const
export const DESKTOP_MCP_PROJECT_SOURCE_GLOBAL_HOOKS_URI = 'arcade://project/source/global/hooks' as const

export const createDesktopMcpProjectPageSourceUri = (
  pageId: ArcadePageId,
  sourceKind: DesktopMcpProjectSourceKind
): string => `arcade://project/source/pages/${pageId}/${sourceKind}`
