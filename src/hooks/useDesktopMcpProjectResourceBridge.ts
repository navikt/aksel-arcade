import { useCallback, useEffect, useRef } from 'react'
import type { ThemeMode, Project } from '@/types/project'
import type { PreviewState } from '@/types/preview'
import { collectPreviewDiagnostics } from '@/services/previewDiagnostics'
import { readDesktopMcpProjectResource } from '@/services/desktopMcpProjectResources'
import { registerDesktopPreloadMcpProjectResourceReadHandler } from '@/services/desktopMcpProjectResourceAdapter'
import type { DesktopMcpProjectResourceReadRequest } from '@/services/desktopMcpProjectResourceProtocol'

interface UseDesktopMcpProjectResourceBridgeOptions {
  project: Project
  previewState: PreviewState
  theme: ThemeMode
}

export const useDesktopMcpProjectResourceBridge = ({
  project,
  previewState,
  theme,
}: UseDesktopMcpProjectResourceBridgeOptions): void => {
  const resourceContextRef = useRef({
    project,
    theme,
    diagnostics: collectPreviewDiagnostics(previewState),
  })

  useEffect(() => {
    resourceContextRef.current = {
      project,
      theme,
      diagnostics: collectPreviewDiagnostics(previewState),
    }
  }, [previewState, project, theme])

  const handleProjectResourceRead = useCallback(
    (request: DesktopMcpProjectResourceReadRequest) =>
      readDesktopMcpProjectResource(request, resourceContextRef.current),
    []
  )

  useEffect(() => {
    return registerDesktopPreloadMcpProjectResourceReadHandler(handleProjectResourceRead)
  }, [handleProjectResourceRead])
}
