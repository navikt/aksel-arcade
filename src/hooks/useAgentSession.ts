import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DEFAULT_AGENT_PERMISSIONS,
  createAgentBridgeCommandRouter,
  createAgentPairingHandoffCommand,
  type AgentBridgeController,
  type AgentBridgeCommandResult,
  type AgentBridgeErrorCode,
  type AgentBridgeReadContext,
  type AgentChangeField,
  type AgentPermissions,
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
import type { Project, ViewportSize } from '@/types/project'
import type { PreviewState } from '@/types/preview'
import { VIEWPORTS } from '@/types/viewports'
import { validateProjectSize } from '@/services/storage'
import { collectPreviewDiagnostics, type PreviewDiagnostics } from '@/services/previewDiagnostics'
import type { PreviewEvidenceCaptureResult } from '@/services/previewEvidence'
import { subscribeToAgentSessionProjectReplacement } from '@/services/agentSessionLifecycle'

type AgentProjectUpdates = Partial<Pick<Project, 'name' | 'jsxCode' | 'hooksCode' | 'viewportSize'>>

interface UseAgentSessionOptions {
  project: Project
  previewState: PreviewState
  theme: ThemeMode
  onProjectChange: (updates: AgentProjectUpdates) => void
  onThemeChange: (theme: ThemeMode) => void
  getPreviewEvidence: () => Promise<PreviewEvidenceCaptureResult>
}

export const useAgentSession = ({
  project,
  previewState,
  theme,
  onProjectChange,
  onThemeChange,
  getPreviewEvidence,
}: UseAgentSessionOptions) => {
  const [session, setSession] = useState<DesktopAgentSessionSnapshot | null>(null)
  const [permissions, setPermissions] = useState<AgentPermissions>({ ...DEFAULT_AGENT_PERMISSIONS })
  const coordinatorRef = useRef<DesktopAgentSessionCoordinator | null>(null)
  const activeSessionIdRef = useRef<string | null>(null)
  const permissionsRef = useRef<AgentPermissions>(permissions)
  const projectRef = useRef(project)
  const readContextRef = useRef<AgentBridgeReadContext>({
    project: {
      name: project.name,
      jsxCode: project.jsxCode,
      hooksCode: project.hooksCode,
    },
    preview: {
      theme,
      viewportSize: project.viewportSize,
    },
    diagnostics: collectPreviewDiagnostics(previewState),
  })

  if (!coordinatorRef.current) {
    coordinatorRef.current = createDesktopAgentSessionCoordinator({
      transportAdapter: createDesktopPreloadAgentTransportAdapter(),
    })
  }

  const readContext = useMemo<AgentBridgeReadContext>(
    () => ({
      project: {
        name: project.name,
        jsxCode: project.jsxCode,
        hooksCode: project.hooksCode,
      },
      preview: {
        theme,
        viewportSize: project.viewportSize,
      },
      diagnostics: collectPreviewDiagnostics(previewState),
    }),
    [project.hooksCode, project.jsxCode, project.name, project.viewportSize, previewState, theme]
  )

  permissionsRef.current = permissions
  projectRef.current = project
  readContextRef.current = readContext

  const syncCurrentContext = useCallback(
    (
      nextProject: Project,
      nextTheme: ThemeMode,
      nextDiagnostics: PreviewDiagnostics = readContextRef.current.diagnostics
    ) => {
      projectRef.current = nextProject
      readContextRef.current = {
        project: {
          name: nextProject.name,
          jsxCode: nextProject.jsxCode,
          hooksCode: nextProject.hooksCode,
        },
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

      const nextProject = {
        ...projectRef.current,
        ...parsedRequest.projectUpdates,
      }
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
      if (Object.keys(parsedRequest.projectUpdates).length > 0) {
        onProjectChange(parsedRequest.projectUpdates)
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
      getPreviewEvidence,
    }),
    [applyAgentChange, getPreviewEvidence, session?.id]
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

interface ParsedAgentChangeRequest {
  ok: true
  changedFields: AgentChangeField[]
  projectUpdates: AgentProjectUpdates
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

const AGENT_CHANGE_REQUEST_KEYS = [
  'summary',
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
      }: ${unsupportedFields.join(', ')}. applyAgentChange accepts only summary, jsxCode, hooksCode, viewportSize, theme, and name.`,
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
    theme,
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
