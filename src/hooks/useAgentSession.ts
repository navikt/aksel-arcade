import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DEFAULT_AGENT_PERMISSIONS,
  createAgentProjectReadState,
  createAgentBridgeCommandRouter,
  createAgentPairingHandoffCommand,
  type AgentBridgeController,
  type AgentBridgeCommandResult,
  type AgentCreatePageResult,
  type AgentBridgeErrorCode,
  type AgentBridgeReadContext,
  type AgentChangeField,
  type AgentPageLifecycleResult,
  type AgentPermissions,
  type AgentProjectReadState,
  type AgentSourceTarget,
  type AgentSourceField,
  type AgentChangeResult,
} from '@/services/agentBridge'
import {
  createDesktopAgentSessionCoordinator,
  type DesktopAgentSessionCoordinator,
  type DesktopAgentSessionEndReason,
  type DesktopAgentSessionSnapshot,
} from '@/services/desktopAgentSessionCoordinator'
import {
  createDesktopPreloadAgentTransportAdapter,
  registerDesktopPreloadAgentTransportRequestHandler,
} from '@/services/desktopAgentTransportAdapter'
import { routeDesktopAgentTransportRequest } from '@/services/desktopAgentTransportProtocol'
import type { ThemeMode } from '@/contexts/SettingsContext'
import type { ArcadePageId, Project, ProjectSourceTarget, ViewportSize } from '@/types/project'
import type { PreviewState } from '@/types/preview'
import { VIEWPORTS } from '@/types/viewports'
import {
  createPage as createProjectPage,
  deletePage as deleteProjectPage,
  isArcadePageId,
  renamePage as renameProjectPage,
  setActivePage as setProjectActivePage,
  setStartPage as setProjectStartPage,
  updateSourceForTarget,
} from '@/services/projectSource'
import { validateProjectSize } from '@/services/storage'
import { collectPreviewDiagnostics, type PreviewDiagnostics } from '@/services/previewDiagnostics'
import type { PreviewEvidenceCaptureResult } from '@/services/previewEvidence'
import { subscribeToAgentSessionProjectReplacement } from '@/services/agentSessionLifecycle'

type AgentProjectUpdates = Partial<Pick<Project, 'name' | 'viewportSize' | 'activePageId'>> & {
  jsxCode?: string
  hooksCode?: string
  sourceTarget?: ProjectSourceTarget
}

interface UseAgentSessionOptions {
  project: Project
  previewState: PreviewState
  theme: ThemeMode
  multiPageEnabled: boolean
  onProjectChange: (updates: AgentProjectUpdates) => void
  onCreatePage: () => void
  onRenamePage: (pageId: ArcadePageId, name: string) => void
  onDeletePage: (pageId: ArcadePageId) => void
  onSetStartPage: (pageId: ArcadePageId) => void
  onThemeChange: (theme: ThemeMode) => void
  getPreviewEvidence: () => Promise<PreviewEvidenceCaptureResult>
}

export const useAgentSession = ({
  project,
  previewState,
  theme,
  multiPageEnabled,
  onProjectChange,
  onCreatePage,
  onRenamePage,
  onDeletePage,
  onSetStartPage,
  onThemeChange,
  getPreviewEvidence,
}: UseAgentSessionOptions) => {
  const [session, setSession] = useState<DesktopAgentSessionSnapshot | null>(null)
  const [permissions, setPermissions] = useState<AgentPermissions>({ ...DEFAULT_AGENT_PERMISSIONS })
  const coordinatorRef = useRef<DesktopAgentSessionCoordinator | null>(null)
  const activeSessionIdRef = useRef<string | null>(null)
  const permissionsRef = useRef<AgentPermissions>(permissions)
  const projectRef = useRef(project)
  const multiPageEnabledRef = useRef(multiPageEnabled)
  const readContextRef = useRef<AgentBridgeReadContext>(
    createBridgeReadContext(project, previewState, theme, multiPageEnabled)
  )

  if (!coordinatorRef.current) {
    coordinatorRef.current = createDesktopAgentSessionCoordinator({
      transportAdapter: createDesktopPreloadAgentTransportAdapter(),
    })
  }

  const readContext = useMemo<AgentBridgeReadContext>(
    () => createBridgeReadContext(project, previewState, theme, multiPageEnabled),
    [multiPageEnabled, previewState, project, theme]
  )

  permissionsRef.current = permissions
  projectRef.current = project
  multiPageEnabledRef.current = multiPageEnabled
  readContextRef.current = readContext

  const syncCurrentContext = useCallback(
    (
      nextProject: Project,
      nextTheme: ThemeMode,
      nextDiagnostics: PreviewDiagnostics = readContextRef.current.diagnostics
    ) => {
      projectRef.current = nextProject
      readContextRef.current = {
        project: createAgentProjectReadState(nextProject, multiPageEnabledRef.current),
        preview: {
          theme: nextTheme,
          viewportSize: nextProject.viewportSize,
        },
        diagnostics: nextDiagnostics,
      }
    },
    []
  )

  const cleanupAgentSession = useCallback((reason: DesktopAgentSessionEndReason) => {
    coordinatorRef.current?.stopSession(reason)
    activeSessionIdRef.current = null
  }, [])

  const createPage = useCallback(
    (request?: unknown): AgentBridgeCommandResult<AgentCreatePageResult> => {
      const parsedRequest = parseCreatePageRequest(request)
      if (!parsedRequest.ok) {
        return createPageFailure(parsedRequest.code, parsedRequest.message)
      }

      if (!permissionsRef.current.sourceChanges) {
        return createPageFailure(
          'permission-denied',
          'createPage requires the source changes permission.'
        )
      }

      const nextProject = createProjectPage(projectRef.current)
      const sizeStatus = validateProjectSize(nextProject)
      if (!sizeStatus.valid) {
        return createPageFailure(
          'payload-too-large',
          sizeStatus.message ?? 'Agent change exceeds the project size limit.'
        )
      }

      syncCurrentContext(
        nextProject,
        readContextRef.current.preview.theme,
        createPendingSourceDiagnostics(readContextRef.current.diagnostics)
      )
      onCreatePage()

      return {
        ok: true,
        command: 'createPage',
        data: {
          pageId: nextProject.activePageId,
        },
      }
    },
    [onCreatePage, syncCurrentContext]
  )

  const renamePage = useCallback(
    (request: unknown): AgentBridgeCommandResult<AgentPageLifecycleResult> => {
      const parsedRequest = parseRenamePageRequest(request)
      if (!parsedRequest.ok) {
        return createPageLifecycleFailure('renamePage', parsedRequest.code, parsedRequest.message)
      }

      if (!permissionsRef.current.sourceChanges) {
        return createPageLifecycleFailure(
          'renamePage',
          'permission-denied',
          'renamePage requires the source changes permission.'
        )
      }

      const resolvedPage = resolveSessionPageId('renamePage', parsedRequest.pageId, readContextRef.current.project)
      if (!resolvedPage.ok) {
        return createPageLifecycleFailure('renamePage', resolvedPage.code, resolvedPage.message)
      }

      const nextProject = renameProjectPage(projectRef.current, resolvedPage.pageId, parsedRequest.name)
      const sizeStatus = validateProjectSize(nextProject)
      if (!sizeStatus.valid) {
        return createPageLifecycleFailure(
          'renamePage',
          'payload-too-large',
          sizeStatus.message ?? 'Agent change exceeds the project size limit.'
        )
      }

      syncCurrentContext(
        nextProject,
        readContextRef.current.preview.theme,
        createPendingSourceDiagnostics(readContextRef.current.diagnostics)
      )
      onRenamePage(resolvedPage.pageId, parsedRequest.name)

      return {
        ok: true,
        command: 'renamePage',
        data: {
          pageId: resolvedPage.pageId,
        },
      }
    },
    [onRenamePage, syncCurrentContext]
  )

  const deletePage = useCallback(
    (request: unknown): AgentBridgeCommandResult<AgentPageLifecycleResult> => {
      const parsedRequest = parsePageIdRequest('deletePage', request)
      if (!parsedRequest.ok) {
        return createPageLifecycleFailure('deletePage', parsedRequest.code, parsedRequest.message)
      }

      if (!permissionsRef.current.sourceChanges) {
        return createPageLifecycleFailure(
          'deletePage',
          'permission-denied',
          'deletePage requires the source changes permission.'
        )
      }

      const resolvedPage = resolveSessionPageId('deletePage', parsedRequest.pageId, readContextRef.current.project)
      if (!resolvedPage.ok) {
        return createPageLifecycleFailure('deletePage', resolvedPage.code, resolvedPage.message)
      }

      const nextProject = deleteProjectPage(projectRef.current, resolvedPage.pageId)
      syncCurrentContext(
        nextProject,
        readContextRef.current.preview.theme,
        createPendingSourceDiagnostics(readContextRef.current.diagnostics)
      )
      onDeletePage(resolvedPage.pageId)

      return {
        ok: true,
        command: 'deletePage',
        data: {
          pageId: resolvedPage.pageId,
        },
      }
    },
    [onDeletePage, syncCurrentContext]
  )

  const setStartPage = useCallback(
    (request: unknown): AgentBridgeCommandResult<AgentPageLifecycleResult> => {
      const parsedRequest = parsePageIdRequest('setStartPage', request)
      if (!parsedRequest.ok) {
        return createPageLifecycleFailure('setStartPage', parsedRequest.code, parsedRequest.message)
      }

      if (!permissionsRef.current.sourceChanges) {
        return createPageLifecycleFailure(
          'setStartPage',
          'permission-denied',
          'setStartPage requires the source changes permission.'
        )
      }

      const resolvedPage = resolveSessionPageId(
        'setStartPage',
        parsedRequest.pageId,
        readContextRef.current.project
      )
      if (!resolvedPage.ok) {
        return createPageLifecycleFailure('setStartPage', resolvedPage.code, resolvedPage.message)
      }

      const nextProject = setProjectStartPage(projectRef.current, resolvedPage.pageId)
      const sizeStatus = validateProjectSize(nextProject)
      if (!sizeStatus.valid) {
        return createPageLifecycleFailure(
          'setStartPage',
          'payload-too-large',
          sizeStatus.message ?? 'Agent change exceeds the project size limit.'
        )
      }

      syncCurrentContext(
        nextProject,
        readContextRef.current.preview.theme,
        createPendingSourceDiagnostics(readContextRef.current.diagnostics)
      )
      onSetStartPage(resolvedPage.pageId)

      return {
        ok: true,
        command: 'setStartPage',
        data: {
          pageId: resolvedPage.pageId,
        },
      }
    },
    [onSetStartPage, syncCurrentContext]
  )

  const selectActivePage = useCallback(
    (request: unknown): AgentBridgeCommandResult<AgentPageLifecycleResult> => {
      const parsedRequest = parsePageIdRequest('selectActivePage', request)
      if (!parsedRequest.ok) {
        return createPageLifecycleFailure(
          'selectActivePage',
          parsedRequest.code,
          parsedRequest.message
        )
      }

      if (!permissionsRef.current.sourceChanges) {
        return createPageLifecycleFailure(
          'selectActivePage',
          'permission-denied',
          'selectActivePage requires the source changes permission.'
        )
      }

      const resolvedPage = resolveSessionPageId(
        'selectActivePage',
        parsedRequest.pageId,
        readContextRef.current.project
      )
      if (!resolvedPage.ok) {
        return createPageLifecycleFailure(
          'selectActivePage',
          resolvedPage.code,
          resolvedPage.message
        )
      }

      const nextProject = setProjectActivePage(projectRef.current, resolvedPage.pageId)
      syncCurrentContext(nextProject, readContextRef.current.preview.theme)
      onProjectChange({ activePageId: resolvedPage.pageId })

      return {
        ok: true,
        command: 'selectActivePage',
        data: {
          pageId: resolvedPage.pageId,
        },
      }
    },
    [onProjectChange, syncCurrentContext]
  )

  const applyAgentChange = useCallback(
    (request: unknown): AgentBridgeCommandResult<AgentChangeResult> => {
      const parsedRequest = parseAgentChangeRequest(request)
      if (!parsedRequest.ok) {
        return createAgentChangeFailure(parsedRequest.code, parsedRequest.message)
      }

      const deniedPermissions = getDeniedAgentChangePermissions(
        parsedRequest.changedFields,
        permissionsRef.current
      )
      if (deniedPermissions.length > 0) {
        return createAgentChangeFailure(
          'permission-denied',
          `Agent change requires disabled permission${
            deniedPermissions.length === 1 ? '' : 's'
          }: ${deniedPermissions.join(', ')}.`
        )
      }

      const resolvedTarget = resolveAgentSourceTargetForSession(
        parsedRequest.sourceTarget,
        parsedRequest.changedFields,
        readContextRef.current.project
      )
      if (!resolvedTarget.ok) {
        return createAgentChangeFailure(resolvedTarget.code, resolvedTarget.message)
      }

      const nextProject = applyAgentProjectUpdates(projectRef.current, {
        ...parsedRequest.projectUpdates,
        ...(resolvedTarget.target ? { sourceTarget: resolvedTarget.target } : {}),
      })
      const nextTheme = parsedRequest.theme ?? readContextRef.current.preview.theme
      const sizeStatus = validateProjectSize(nextProject)
      if (!sizeStatus.valid) {
        return createAgentChangeFailure(
          'payload-too-large',
          sizeStatus.message ?? 'Agent change exceeds the project size limit.'
        )
      }

      const nextDiagnostics = parsedRequest.changedFields.some(isAgentSourceField)
        ? createPendingSourceDiagnostics(readContextRef.current.diagnostics)
        : readContextRef.current.diagnostics

      syncCurrentContext(nextProject, nextTheme, nextDiagnostics)
      if (
        Object.keys(parsedRequest.projectUpdates).length > 0 ||
        resolvedTarget.target !== undefined
      ) {
        onProjectChange({
          ...parsedRequest.projectUpdates,
          ...(resolvedTarget.target ? { sourceTarget: resolvedTarget.target } : {}),
        })
      }
      if (parsedRequest.theme !== undefined) {
        onThemeChange(parsedRequest.theme)
      }

      return {
        ok: true,
        command: 'applyAgentChange',
        data: {
          changedFields: [...parsedRequest.changedFields],
        },
      }
    },
    [onProjectChange, onThemeChange, syncCurrentContext]
  )

  const createBridgeController = useCallback(
    (): AgentBridgeController => ({
      getReadContext: () => readContextRef.current,
      getPermissions: () => permissionsRef.current,
      isSessionActive: () => activeSessionIdRef.current === session?.id,
      recordActivity: () => undefined,
      applyAgentChange: applyAgentChange,
      createPage,
      renamePage,
      deletePage,
      setStartPage,
      selectActivePage,
      getPreviewEvidence,
    }),
    [
      applyAgentChange,
      createPage,
      deletePage,
      getPreviewEvidence,
      renamePage,
      selectActivePage,
      session?.id,
      setStartPage,
    ]
  )

  useEffect(() => {
    const cleanupForReload = () => {
      cleanupAgentSession('reload')
      setPermissions({ ...DEFAULT_AGENT_PERMISSIONS })
      setSession(null)
    }

    window.addEventListener('pagehide', cleanupForReload)
    window.addEventListener('beforeunload', cleanupForReload)

    return () => {
      window.removeEventListener('pagehide', cleanupForReload)
      window.removeEventListener('beforeunload', cleanupForReload)
      cleanupAgentSession('renderer-unmount')
    }
  }, [cleanupAgentSession])

  useEffect(() => {
    return subscribeToAgentSessionProjectReplacement(() => {
      cleanupAgentSession('project-replaced')
      setPermissions({ ...DEFAULT_AGENT_PERMISSIONS })
      setSession(null)
    })
  }, [cleanupAgentSession])

  useEffect(() => {
    if (!session) {
      return
    }

    return registerDesktopPreloadAgentTransportRequestHandler((request) =>
      routeDesktopAgentTransportRequest(request, {
        session,
        router: createAgentBridgeCommandRouter(session, createBridgeController()),
      })
    )
  }, [createBridgeController, session])

  const startAgentSession = useCallback(async () => {
    const coordinator = coordinatorRef.current
    if (!coordinator) {
      throw new Error('Desktop Agent session coordinator was not initialized.')
    }

    const nextSession = await coordinator.startSession()
    activeSessionIdRef.current = nextSession.id
    setPermissions(nextSession.permissions)
    setSession(nextSession)
  }, [activeSessionIdRef])

  const stopAgentSession = useCallback(() => {
    cleanupAgentSession('stop')
    setPermissions({ ...DEFAULT_AGENT_PERMISSIONS })
    setSession(null)
  }, [cleanupAgentSession])

  const statusText = session ? 'Status: active' : 'Status: inactive'

  const agentPairingHandoffCommand = useMemo(
    () =>
      session?.transportEndpoint ? createAgentPairingHandoffCommand(session.transportEndpoint) : null,
    [session?.transportEndpoint]
  )

  return {
    agentPairingHandoffCommand,
    isActive: Boolean(session),
    statusText,
    startAgentSession,
    stopAgentSession,
  }
}

const createBridgeReadContext = (
  project: Project,
  previewState: PreviewState,
  theme: ThemeMode,
  multiPageEnabled: boolean,
  diagnostics: PreviewDiagnostics = collectPreviewDiagnostics(previewState)
): AgentBridgeReadContext => ({
  project: createAgentProjectReadState(project, multiPageEnabled),
  preview: {
    theme,
    viewportSize: project.viewportSize,
  },
  diagnostics,
})

const applyAgentProjectUpdates = (project: Project, updates: AgentProjectUpdates): Project => {
  let nextProject = project

  if (updates.name !== undefined) {
    nextProject = {
      ...nextProject,
      name: updates.name,
    }
  }

  if (updates.viewportSize !== undefined) {
    nextProject = {
      ...nextProject,
      viewportSize: updates.viewportSize,
    }
  }

  if (updates.jsxCode !== undefined || updates.hooksCode !== undefined) {
    nextProject = updateSourceForTarget(nextProject, updates.sourceTarget ?? { type: 'page', pageId: nextProject.activePageId }, {
      jsx: updates.jsxCode,
      hooks: updates.hooksCode,
    })
  }

  return nextProject
}

interface ParsedAgentChangeRequest {
  ok: true
  changedFields: AgentChangeField[]
  projectUpdates: AgentProjectUpdates
  sourceTarget?: AgentSourceTarget
  theme?: ThemeMode
}

interface InvalidAgentChangeRequest {
  ok: false
  code: AgentBridgeErrorCode
  message: string
}

type AgentChangeParseResult = ParsedAgentChangeRequest | InvalidAgentChangeRequest

const createAgentChangeFailure = (
  code: AgentBridgeErrorCode,
  message: string
): AgentBridgeCommandResult<AgentChangeResult> => ({
  ok: false,
  command: 'applyAgentChange',
  error: {
    code,
    message,
  },
})

const createPageFailure = (
  code: AgentBridgeErrorCode,
  message: string
): AgentBridgeCommandResult<AgentCreatePageResult> => ({
  ok: false,
  command: 'createPage',
  error: {
    code,
    message,
  },
})

const createPageLifecycleFailure = (
  command: 'renamePage' | 'deletePage' | 'setStartPage' | 'selectActivePage',
  code: AgentBridgeErrorCode,
  message: string
): AgentBridgeCommandResult<AgentPageLifecycleResult> => ({
  ok: false,
  command,
  error: {
    code,
    message,
  },
})

const AGENT_CHANGE_REQUEST_KEYS = [
  'summary',
  'target',
  'jsxCode',
  'hooksCode',
  'viewportSize',
  'theme',
  'name',
] as const
const AGENT_CHANGE_REQUEST_KEY_SET = new Set<string>(AGENT_CHANGE_REQUEST_KEYS)
const VALID_VIEWPORT_SIZES = VIEWPORTS.map(({ id }) => id)

const parseAgentChangeRequest = (request: unknown): AgentChangeParseResult => {
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    return {
      ok: false,
      code: 'invalid-request',
      message: 'Agent changes must be provided as an object.',
    }
  }

  const candidate = request as Record<string, unknown>
  const unsupportedFields = Object.keys(candidate).filter(
    (field) => !AGENT_CHANGE_REQUEST_KEY_SET.has(field)
  )
  if (unsupportedFields.length > 0) {
    return {
      ok: false,
      code: 'unsupported-field',
      message: `Unsupported Agent change field${
        unsupportedFields.length === 1 ? '' : 's'
      }: ${unsupportedFields.join(', ')}. applyAgentChange accepts only summary, target, jsxCode, hooksCode, viewportSize, theme, and name.`,
    }
  }

  const summary = candidate.summary
  if (typeof summary !== 'string' || summary.trim().length === 0) {
    return {
      ok: false,
      code: 'invalid-request',
      message: 'A non-empty human-readable summary is required.',
    }
  }

  const projectUpdates: AgentProjectUpdates = {}
  const changedFields: AgentChangeField[] = []
  const sourceFieldPresent = 'jsxCode' in candidate || 'hooksCode' in candidate
  let sourceTarget: AgentSourceTarget | undefined

  if ('target' in candidate) {
    const parsedTarget = parseAgentSourceTarget(candidate.target)
    if (!parsedTarget.ok) {
      return parsedTarget
    }

    sourceTarget = parsedTarget.target
  }

  for (const field of ['jsxCode', 'hooksCode'] as const) {
    if (!(field in candidate)) {
      continue
    }

    const value = candidate[field]
    if (typeof value !== 'string') {
      return {
        ok: false,
        code: 'invalid-request',
        message: `${field} must be a full-field string replacement.`,
      }
    }
    if (value.trim().length === 0) {
      return {
        ok: false,
        code: 'invalid-request',
        message: `${field} must be a non-empty full-field string replacement.`,
      }
    }

    projectUpdates[field] = value
    changedFields.push(field)
  }

  if (sourceFieldPresent && !sourceTarget) {
    return {
      ok: false,
      code: 'invalid-request',
      message: 'applyAgentChange requires target when jsxCode and/or hooksCode are provided.',
    }
  }
  if (!sourceFieldPresent && sourceTarget) {
    return {
      ok: false,
      code: 'invalid-request',
      message: 'target is only valid when jsxCode and/or hooksCode are provided.',
    }
  }

  if ('viewportSize' in candidate) {
    const value = candidate.viewportSize
    if (!isViewportSize(value)) {
      return {
        ok: false,
        code: 'invalid-request',
        message: `viewportSize must be one of ${VALID_VIEWPORT_SIZES.join(', ')}.`,
      }
    }

    projectUpdates.viewportSize = value
    changedFields.push('viewportSize')
  }

  let theme: ThemeMode | undefined
  if ('theme' in candidate) {
    const value = candidate.theme
    if (!isThemeMode(value)) {
      return {
        ok: false,
        code: 'invalid-request',
        message: 'theme must be either "light" or "dark".',
      }
    }

    theme = value
    changedFields.push('theme')
  }

  if ('name' in candidate) {
    const value = candidate.name
    if (typeof value !== 'string') {
      return {
        ok: false,
        code: 'invalid-request',
        message: 'name must be a full-field string replacement.',
      }
    }
    if (value.trim().length === 0 || value.length > 100) {
      return {
        ok: false,
        code: 'invalid-request',
        message: 'name must be 1-100 characters with non-whitespace content.',
      }
    }

    projectUpdates.name = value
    changedFields.push('name')
  }

  if (changedFields.length === 0) {
    return {
      ok: false,
      code: 'invalid-request',
      message: 'Provide jsxCode, hooksCode, viewportSize, theme, and/or name to replace.',
    }
  }

  return {
    ok: true,
    changedFields,
    projectUpdates,
    sourceTarget,
    theme,
  }
}

const parseCreatePageRequest = (
  request: unknown
): { ok: true } | InvalidAgentChangeRequest => {
  if (request === undefined) {
    return { ok: true }
  }

  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    return {
      ok: false,
      code: 'invalid-request',
      message: 'createPage accepts no params or an empty object.',
    }
  }

  if (Object.keys(request as Record<string, unknown>).length > 0) {
    return {
      ok: false,
      code: 'unsupported-field',
      message: 'createPage accepts no request fields.',
    }
  }

  return { ok: true }
}

const parsePageIdRequest = (
  command: 'deletePage' | 'setStartPage' | 'selectActivePage',
  request: unknown
): { ok: true; pageId: ArcadePageId } | InvalidAgentChangeRequest => {
  const candidate = parseObjectRequest(command, request)
  if (!candidate.ok) {
    return candidate
  }

  const unsupportedFields = Object.keys(candidate.value).filter((field) => field !== 'pageId')
  if (unsupportedFields.length > 0) {
    return {
      ok: false,
      code: 'unsupported-field',
      message: `${command} accepts only pageId.`,
    }
  }

  const pageId = candidate.value.pageId
  if (!isArcadePageId(pageId)) {
    return {
      ok: false,
      code: 'invalid-request',
      message: `${command} requires a valid pageId.`,
    }
  }

  return {
    ok: true,
    pageId,
  }
}

const parseRenamePageRequest = (
  request: unknown
): { ok: true; pageId: ArcadePageId; name: string } | InvalidAgentChangeRequest => {
  const candidate = parseObjectRequest('renamePage', request)
  if (!candidate.ok) {
    return candidate
  }

  const unsupportedFields = Object.keys(candidate.value).filter(
    (field) => field !== 'pageId' && field !== 'name'
  )
  if (unsupportedFields.length > 0) {
    return {
      ok: false,
      code: 'unsupported-field',
      message: 'renamePage accepts only pageId and name.',
    }
  }

  const pageId = candidate.value.pageId
  if (!isArcadePageId(pageId)) {
    return {
      ok: false,
      code: 'invalid-request',
      message: 'renamePage requires a valid pageId.',
    }
  }

  const name = candidate.value.name
  if (typeof name !== 'string' || name.trim().length === 0) {
    return {
      ok: false,
      code: 'invalid-request',
      message: 'renamePage requires a non-empty name.',
    }
  }

  return {
    ok: true,
    pageId,
    name,
  }
}

const parseAgentSourceTarget = (
  target: unknown
): { ok: true; target: AgentSourceTarget } | InvalidAgentChangeRequest => {
  if (!target || typeof target !== 'object' || Array.isArray(target)) {
    return {
      ok: false,
      code: 'invalid-request',
      message:
        'target must be { type: "page", pageId } or { type: "global-config" } when replacing source.',
    }
  }

  const candidate = target as Record<string, unknown>
  const type = candidate.type
  if (type === 'global-config') {
    const unsupportedFields = Object.keys(candidate).filter((field) => field !== 'type')
    if (unsupportedFields.length > 0) {
      return {
        ok: false,
        code: 'unsupported-field',
        message: 'global-config targets accept only type.',
      }
    }

    return {
      ok: true,
      target: { type: 'global-config' },
    }
  }

  if (type === 'page') {
    const unsupportedFields = Object.keys(candidate).filter(
      (field) => field !== 'type' && field !== 'pageId'
    )
    if (unsupportedFields.length > 0) {
      return {
        ok: false,
        code: 'unsupported-field',
        message: 'page targets accept only type and pageId.',
      }
    }

    if (!isArcadePageId(candidate.pageId)) {
      return {
        ok: false,
        code: 'invalid-request',
        message: 'page targets require a valid pageId.',
      }
    }

    return {
      ok: true,
      target: {
        type: 'page',
        pageId: candidate.pageId,
      },
    }
  }

  return {
    ok: false,
    code: 'invalid-request',
    message:
      'target must be { type: "page", pageId } or { type: "global-config" } when replacing source.',
  }
}

const parseObjectRequest = (
  command:
    | 'renamePage'
    | 'deletePage'
    | 'setStartPage'
    | 'selectActivePage',
  request: unknown
): { ok: true; value: Record<string, unknown> } | InvalidAgentChangeRequest => {
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    return {
      ok: false,
      code: 'invalid-request',
      message: `${command} requires an object request.`,
    }
  }

  return {
    ok: true,
    value: request as Record<string, unknown>,
  }
}

const resolveAgentSourceTargetForSession = (
  sourceTarget: AgentSourceTarget | undefined,
  changedFields: AgentChangeField[],
  project: AgentProjectReadState
):
  | { ok: true; target?: AgentSourceTarget }
  | { ok: false; code: AgentBridgeErrorCode; message: string } => {
  if (!changedFields.some(isAgentSourceField)) {
    return { ok: true }
  }

  if (!sourceTarget) {
    return {
      ok: false,
      code: 'invalid-request',
      message: 'applyAgentChange requires target when jsxCode and/or hooksCode are provided.',
    }
  }

  if (sourceTarget.type === 'global-config') {
    if (project.pageMode === 'single-page') {
      return {
        ok: false,
        code: 'invalid-request',
        message:
          'Global config edits require experimental multi-page authoring. Ask the human to enable it.',
      }
    }

    return {
      ok: true,
      target: sourceTarget,
    }
  }

  if (project.pages.some((page) => page.id === sourceTarget.pageId)) {
    return {
      ok: true,
      target: sourceTarget,
    }
  }

  if (project.pageMode === 'single-page') {
    return {
      ok: false,
      code: 'invalid-request',
      message: `Only ${project.activePageId} is currently exposed through the single-page Agent bridge. Ask the human to enable experimental multi-page authoring before targeting other pages.`,
    }
  }

  return {
    ok: false,
    code: 'invalid-request',
    message: `Unknown Arcade page "${sourceTarget.pageId}". Available page ids: ${project.pages
      .map((page) => page.id)
      .join(', ')}.`,
  }
}

const resolveSessionPageId = (
  command: 'renamePage' | 'deletePage' | 'setStartPage' | 'selectActivePage',
  pageId: ArcadePageId,
  project: AgentProjectReadState
):
  | { ok: true; pageId: ArcadePageId }
  | { ok: false; code: AgentBridgeErrorCode; message: string } => {
  if (project.pages.some((page) => page.id === pageId)) {
    return {
      ok: true,
      pageId,
    }
  }

  return {
    ok: false,
    code: 'invalid-request',
    message: `Unknown Arcade page "${pageId}" for ${command}. Available page ids: ${project.pages
      .map((page) => page.id)
      .join(', ')}.`,
  }
}

const isViewportSize = (value: unknown): value is ViewportSize =>
  typeof value === 'string' && VALID_VIEWPORT_SIZES.some((viewport) => viewport === value)

const isThemeMode = (value: unknown): value is ThemeMode => value === 'light' || value === 'dark'

const isAgentSourceField = (field: AgentChangeField): field is AgentSourceField =>
  field === 'jsxCode' || field === 'hooksCode'

const createPendingSourceDiagnostics = (diagnostics: PreviewDiagnostics): PreviewDiagnostics => ({
  status: 'transpiling',
  compileError: null,
  runtimeError: null,
  sandboxConsoleMessages: diagnostics.sandboxConsoleMessages.map((message) => ({
    ...message,
    args: [...message.args],
  })),
})

const getDeniedAgentChangePermissions = (
  changedFields: AgentChangeField[],
  permissions: AgentPermissions
): string[] => {
  const deniedPermissions: string[] = []

  if (
    changedFields.some((field) => field === 'jsxCode' || field === 'hooksCode') &&
    !permissions.sourceChanges
  ) {
    deniedPermissions.push('source changes')
  }
  if (
    changedFields.some((field) => field === 'viewportSize' || field === 'theme') &&
    !permissions.previewSettings
  ) {
    deniedPermissions.push('preview setting changes')
  }
  if (changedFields.includes('name') && !permissions.projectMetadata) {
    deniedPermissions.push('project metadata changes')
  }

  return deniedPermissions
}
