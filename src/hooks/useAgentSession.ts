import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DEFAULT_AGENT_PERMISSIONS,
  createAgentInstructions,
  publishAgentBridge,
  removeAgentBridge,
  type AgentBridgeCommandResult,
  type AgentBridgeErrorCode,
  type AgentBridgeReadContext,
  type AgentChangeField,
  type AgentBridgeSession,
  type AgentPermissions,
  type AgentSourceField,
  type AgentSourceChangeResult,
} from '@/services/agentBridge'
import {
  createDesktopAgentSessionCoordinator,
  type DesktopAgentSessionCoordinator,
  type DesktopAgentSessionEndReason,
} from '@/services/desktopAgentSessionCoordinator'
import type { ThemeMode } from '@/contexts/SettingsContext'
import type { Project, ViewportSize } from '@/types/project'
import type { PreviewState } from '@/types/preview'
import { VIEWPORTS } from '@/types/viewports'
import { validateProjectSize } from '@/services/storage'
import { generateSecureUUID } from '@/utils/crypto'
import { collectPreviewDiagnostics, type PreviewDiagnostics } from '@/services/previewDiagnostics'
import type { PreviewEvidenceCaptureResult } from '@/services/previewEvidence'

type AgentProjectUpdates = Partial<Pick<Project, 'name' | 'jsxCode' | 'hooksCode' | 'viewportSize'>>

interface AgentCheckpoint {
  id: string
  createdAt: string
  summary: string
  changedFields: AgentChangeField[]
  previous: Pick<Project, 'name' | 'jsxCode' | 'hooksCode' | 'viewportSize'> & {
    theme: ThemeMode
  }
}

export type AgentSourceCheckpointListItem = Pick<
  AgentCheckpoint,
  'id' | 'createdAt' | 'summary' | 'changedFields'
>

interface UseAgentSessionOptions {
  project: Project
  previewState: PreviewState
  theme: ThemeMode
  onProjectChange: (updates: AgentProjectUpdates) => void
  onThemeChange: (theme: ThemeMode) => void
  getPreviewEvidence: () => PreviewEvidenceCaptureResult
}

const createTimestamp = (): string => new Date().toISOString()
const MAX_AGENT_SOURCE_CHECKPOINTS = 10

export const useAgentSession = ({
  project,
  previewState,
  theme,
  onProjectChange,
  onThemeChange,
  getPreviewEvidence,
}: UseAgentSessionOptions) => {
  const [session, setSession] = useState<AgentBridgeSession | null>(null)
  const [permissions, setPermissions] = useState<AgentPermissions>({ ...DEFAULT_AGENT_PERMISSIONS })
  const [checkpoints, setCheckpoints] = useState<AgentCheckpoint[]>([])
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
    coordinatorRef.current = createDesktopAgentSessionCoordinator()
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
    const sessionId = activeSessionIdRef.current
    coordinatorRef.current?.stopSession(reason)
    activeSessionIdRef.current = null
    removeAgentBridge(sessionId ?? undefined)
  }, [])

  const applyAgentChange = useCallback(
    (request: unknown): AgentBridgeCommandResult<AgentSourceChangeResult> => {
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
          sizeStatus.message ?? 'Agent source change exceeds the project size limit.'
        )
      }

      const currentContext = readContextRef.current
      const checkpoint = {
        id: generateSecureUUID(),
        createdAt: createTimestamp(),
        summary: parsedRequest.summary,
        changedFields: parsedRequest.changedFields,
        previous: {
          name: currentContext.project.name,
          jsxCode: currentContext.project.jsxCode,
          hooksCode: currentContext.project.hooksCode,
          viewportSize: currentContext.preview.viewportSize,
          theme: currentContext.preview.theme,
        },
      }

      const nextDiagnostics = parsedRequest.changedFields.some(isAgentSourceField)
        ? createPendingSourceDiagnostics(readContextRef.current.diagnostics)
        : readContextRef.current.diagnostics

      syncCurrentContext(nextProject, nextTheme, nextDiagnostics)
      setCheckpoints((current) => [checkpoint, ...current].slice(0, MAX_AGENT_SOURCE_CHECKPOINTS))
      if (Object.keys(parsedRequest.projectUpdates).length > 0) {
        onProjectChange(parsedRequest.projectUpdates)
      }
      if (parsedRequest.theme !== undefined) {
        onThemeChange(parsedRequest.theme)
      }

      return {
        ok: true,
        command: 'applySourceChange',
        data: {
          checkpointId: checkpoint.id,
          changedFields: checkpoint.changedFields,
        },
      }
    },
    [onProjectChange, onThemeChange, syncCurrentContext]
  )

  useEffect(() => {
    const cleanupForReload = () => {
      cleanupAgentSession('reload')
      setCheckpoints([])
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
    if (!session) {
      removeAgentBridge()
      return
    }

    activeSessionIdRef.current = session.id
    publishAgentBridge(session, {
      getReadContext: () => readContextRef.current,
      getPermissions: () => permissionsRef.current,
      isSessionActive: () => activeSessionIdRef.current === session.id,
      recordActivity: () => undefined,
      applySourceChange: applyAgentChange,
      getPreviewEvidence,
    })

    return () => {
      removeAgentBridge(session.id)
    }
  }, [
    activeSessionIdRef,
    applyAgentChange,
    getPreviewEvidence,
    permissionsRef,
    readContextRef,
    session,
  ])

  const startAgentSession = useCallback(() => {
    const coordinator = coordinatorRef.current
    if (!coordinator) {
      throw new Error('Desktop Agent session coordinator was not initialized.')
    }

    const wasActive = coordinator.isSessionActive()
    const nextSession = coordinator.startSession()
    activeSessionIdRef.current = nextSession.id
    setPermissions(nextSession.permissions)
    if (!wasActive) {
      setCheckpoints([])
    }
    setSession({
      id: nextSession.id,
      startedAt: nextSession.startedAt,
    })
  }, [activeSessionIdRef])

  const stopAgentSession = useCallback(() => {
    cleanupAgentSession('stop')
    setCheckpoints([])
    setPermissions({ ...DEFAULT_AGENT_PERMISSIONS })
    setSession(null)
  }, [cleanupAgentSession])

  const restoreCheckpoint = useCallback(
    (checkpointId: string) => {
      const checkpoint = checkpoints.find((entry) => entry.id === checkpointId)
      if (!checkpoint) {
        console.error(
          `Agent Checkpoint ${checkpointId} could not be restored because it is no longer available.`
        )
        return
      }

      const updates: AgentProjectUpdates = {}
      let themeToRestore: ThemeMode | null = null

      for (const field of checkpoint.changedFields) {
        switch (field) {
          case 'jsxCode':
            updates.jsxCode = checkpoint.previous.jsxCode
            break
          case 'hooksCode':
            updates.hooksCode = checkpoint.previous.hooksCode
            break
          case 'name':
            updates.name = checkpoint.previous.name
            break
          case 'viewportSize':
            updates.viewportSize = checkpoint.previous.viewportSize
            break
          case 'theme':
            themeToRestore = checkpoint.previous.theme
            break
        }
      }

      if (Object.keys(updates).length > 0) {
        syncCurrentContext(
          {
            ...projectRef.current,
            ...updates,
          },
          themeToRestore ?? readContextRef.current.preview.theme
        )
        onProjectChange(updates)
      } else if (themeToRestore) {
        syncCurrentContext(projectRef.current, themeToRestore)
      }
      if (themeToRestore) {
        onThemeChange(themeToRestore)
      }
    },
    [checkpoints, onProjectChange, onThemeChange, syncCurrentContext]
  )

  const rollbackCheckpoints = useMemo<AgentSourceCheckpointListItem[]>(
    () =>
      checkpoints.map(({ id, createdAt, summary, changedFields }) => ({
        id,
        createdAt,
        summary,
        changedFields,
      })),
    [checkpoints]
  )

  const statusText = session ? 'Status: aktiv' : 'Status: inaktiv'

  const agentInstructions = useMemo(() => createAgentInstructions(permissions), [permissions])

  return {
    agentInstructions,
    checkpoints: rollbackCheckpoints,
    isActive: Boolean(session),
    restoreCheckpoint,
    statusText,
    startAgentSession,
    stopAgentSession,
  }
}

interface ParsedSourceChangeRequest {
  ok: true
  summary: string
  changedFields: AgentChangeField[]
  projectUpdates: AgentProjectUpdates
  theme?: ThemeMode
}

interface InvalidSourceChangeRequest {
  ok: false
  code: AgentBridgeErrorCode
  message: string
}

type SourceChangeParseResult = ParsedSourceChangeRequest | InvalidSourceChangeRequest

const createAgentChangeFailure = (
  code: AgentBridgeErrorCode,
  message: string
): AgentBridgeCommandResult<AgentSourceChangeResult> => ({
  ok: false,
  command: 'applySourceChange',
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

const parseAgentChangeRequest = (request: unknown): SourceChangeParseResult => {
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
      }: ${unsupportedFields.join(', ')}. applySourceChange accepts only summary, jsxCode, hooksCode, viewportSize, theme, and name.`,
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
    summary: summary.trim(),
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
