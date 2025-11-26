import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react'
import type { CompressionStrategyId, ProjectSnapshot, SharePayloadEnvelope } from '@/types/project'
import { useProject } from '@/hooks/useProject'
import { useShareLinkExperiments } from '@/hooks/useShareLinkExperiments'
import { useSettings } from '@/contexts/SettingsContext'
import { createShareSnapshot, SNAPSHOT_FILE_IDS } from '@/services/storage'
import {
  buildShareUrl,
  computeChecksum,
  createShareToken,
  encodeSharePayload,
  estimateShareUrlLengthFromPayload,
  serializeSnapshot,
  SHARE_URL_CHAR_LIMIT,
  SHARE_URL_WARNING_THRESHOLD,
} from '@/utils/shareEncoding'
import {
  recordShareClipboardTelemetry,
  recordShareGenerationTelemetry,
  type ShareGenerationOutcome,
} from '@/services/telemetry'
import { listCompressionStrategies, type CompressionStrategy } from '@/services/compressionStrategies'

const SLOW_GENERATION_THRESHOLD_MS = 9000

type PendingGeneration = {
  startedAt: number
}

export type ShareLinkStatus = 'idle' | 'generating' | 'warning' | 'ready' | 'oversize' | 'error'
export type ClipboardStatus = 'idle' | 'copying' | 'copied' | 'error'

type ShareDebugHandle = {
  forceStrategyId?: CompressionStrategyId
  currentStrategyId?: CompressionStrategyId
  lastToken?: string
  lastLink?: string
  lastEnvelope?: SharePayloadEnvelope
  warningThresholdHit?: boolean
  forceWarningThresholdHit?: boolean
  repairApplied?: boolean
}

export type ShareLinkErrorCode =
  | 'unavailable'
  | 'generation-failed'
  | 'oversize'
  | 'offline'
  | 'storage-unavailable'

export interface ShareLinkError {
  code: ShareLinkErrorCode
  message: string
}

export interface ShareLinkState {
  status: ShareLinkStatus
  link?: string
  token?: string
  approxChars?: number
  estimatedChars?: number
  warningThresholdHit: boolean
  strategyId?: CompressionStrategyId
  startedAt?: number
  elapsedMs?: number
  showSlowGenerationNotice: boolean
  error?: ShareLinkError
  clipboardStatus: ClipboardStatus
  clipboardError?: string
  copiedAt?: number
}

export interface UseShareLinkOptions {
  snapshotBuilder?: () => Promise<ProjectSnapshot> | ProjectSnapshot
  charLimit?: number
  baseUrl?: string
}

const IDLE_STATE: ShareLinkState = {
  status: 'idle',
  clipboardStatus: 'idle',
  showSlowGenerationNotice: false,
  warningThresholdHit: false,
  estimatedChars: undefined,
  strategyId: undefined,
}

const isProgressStatus = (status: ShareLinkStatus): boolean => {
  return status === 'generating' || status === 'warning'
}

export const useShareLink = (options?: UseShareLinkOptions) => {
  const [state, setState] = useState<ShareLinkState>(IDLE_STATE)
  const stateRef = useRef(state)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pendingGenerationRef = useRef<PendingGeneration | null>(null)
  const lastResultRef = useRef<{
    contentSignature: string
    checksum: string
    link: string
    token: string
    approxChars?: number
    estimatedChars?: number
    warningThresholdHit: boolean
    strategyId: CompressionStrategyId
  } | null>(null)
  const storageHealthRef = useRef<'unknown' | 'ok' | 'failed'>('unknown')
  const { project, editorState, previewState } = useProject()
  const { theme } = useSettings()
  const { adjustPayloadEstimate, recordResult } = useShareLinkExperiments()

  const charLimit = options?.charLimit ?? SHARE_URL_CHAR_LIMIT

  useEffect(() => {
    stateRef.current = state
  }, [state])

  const derivedSnapshotBuilder = useCallback(() => {
    return createShareSnapshot(project, {
      activeFileId: editorState.activeTab === 'Hooks' ? SNAPSHOT_FILE_IDS.hooks : SNAPSHOT_FILE_IDS.jsx,
      preview: {
        viewport: previewState.currentViewport,
        theme,
      },
    })
  }, [editorState.activeTab, previewState.currentViewport, project, theme])

  useEffect(() => {
    if (!isProgressStatus(state.status)) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }

    intervalRef.current = setInterval(() => {
      setState(prev => {
        if (!prev.startedAt) {
          return prev
        }

        const elapsed = Date.now() - prev.startedAt
        const threshold = getSlowGenerationThreshold()

        return {
          ...prev,
          elapsedMs: elapsed,
          showSlowGenerationNotice: prev.showSlowGenerationNotice || elapsed >= threshold,
        }
      })
    }, 250)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [state.status])

  const resetShareState = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setState(IDLE_STATE)
  }, [])

  const snapshotBuilder = options?.snapshotBuilder ?? derivedSnapshotBuilder

  const generateShareLink = useCallback(async () => {
    if (pendingGenerationRef.current) {
      const { startedAt } = pendingGenerationRef.current
      const elapsed = Date.now() - startedAt
      const currentStatus = stateRef.current.status === 'warning' ? 'warning' : 'generating'

      setState(prev => ({
        ...prev,
        status: currentStatus,
        startedAt,
        elapsedMs: elapsed,
        showSlowGenerationNotice: prev.showSlowGenerationNotice || elapsed >= getSlowGenerationThreshold(),
        error: undefined,
        clipboardStatus: 'idle',
        clipboardError: undefined,
      }))
      return
    }

    if (isProgressStatus(stateRef.current.status)) {
      return
    }

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setState({
        status: 'error',
        error: {
          code: 'offline',
          message: 'Connect to the internet to generate a share link.',
        },
        clipboardStatus: 'idle',
        showSlowGenerationNotice: false,
        warningThresholdHit: false,
        strategyId: undefined,
        estimatedChars: undefined,
        approxChars: undefined,
      })
      return
    }

    if (!isStorageAvailable(storageHealthRef)) {
      setState({
        status: 'error',
        error: {
          code: 'storage-unavailable',
          message: 'Shared links require local storage access, which is currently blocked.',
        },
        clipboardStatus: 'idle',
        showSlowGenerationNotice: false,
        warningThresholdHit: false,
        strategyId: undefined,
        estimatedChars: undefined,
        approxChars: undefined,
      })
      return
    }

    const startedAt = Date.now()
    pendingGenerationRef.current = { startedAt }

    const emitGenerationTelemetry = (payload: {
      outcome: ShareGenerationOutcome
      approxChars?: number
      estimatedChars?: number
      warningThresholdHit?: boolean
      strategyId?: CompressionStrategyId
      encodeMs?: number
      reused?: boolean
    }) => {
      recordShareGenerationTelemetry({
        durationMs: Date.now() - startedAt,
        approxChars: payload.approxChars,
        estimatedChars: payload.estimatedChars,
        warningThresholdHit: payload.warningThresholdHit,
        strategyId: payload.strategyId,
        encodeMs: payload.encodeMs,
        outcome: payload.outcome,
        reused: payload.reused,
      })
    }

    setState(prev => ({
      ...prev,
      status: 'generating',
      error: undefined,
      startedAt,
      elapsedMs: 0,
      showSlowGenerationNotice: false,
      clipboardStatus: 'idle',
      clipboardError: undefined,
      warningThresholdHit: false,
      approxChars: prev.approxChars,
      estimatedChars: undefined,
      strategyId: undefined,
    }))

    try {
      const snapshot = await Promise.resolve(snapshotBuilder())
      await applyShareDebugDelay()
      const serialized = serializeSnapshot(snapshot)
      const contentSignature = await computeChecksum(serialized)

      if (lastResultRef.current && lastResultRef.current.contentSignature === contentSignature) {
        emitGenerationTelemetry({
          outcome: 'success',
          approxChars: lastResultRef.current?.approxChars,
          estimatedChars: lastResultRef.current?.estimatedChars,
          warningThresholdHit: lastResultRef.current?.warningThresholdHit,
          strategyId: lastResultRef.current?.strategyId,
          reused: true,
        })
        setState(prev => ({
          ...prev,
          status: 'ready',
          link: lastResultRef.current?.link,
          token: lastResultRef.current?.token,
          approxChars: lastResultRef.current?.approxChars ?? prev.approxChars,
          estimatedChars: lastResultRef.current?.estimatedChars ?? prev.estimatedChars,
          elapsedMs: prev.startedAt ? Date.now() - prev.startedAt : prev.elapsedMs,
          showSlowGenerationNotice: false,
          warningThresholdHit: lastResultRef.current?.warningThresholdHit ?? false,
          strategyId: lastResultRef.current?.strategyId,
        }))
        return
      }

      const rankedStrategies = rankCompressionStrategies(
        serialized.length,
        options?.baseUrl,
        adjustPayloadEstimate,
      )
      if (!rankedStrategies.length) {
        throw new Error('No compression strategies available for share links')
      }

      const smallestEstimate = rankedStrategies[0]
      if (smallestEstimate.estimatedChars > charLimit) {
        emitGenerationTelemetry({
          outcome: 'oversize',
          approxChars: smallestEstimate.estimatedChars,
          estimatedChars: smallestEstimate.estimatedChars,
          warningThresholdHit: smallestEstimate.estimatedChars >= SHARE_URL_WARNING_THRESHOLD,
        })
        setState({
          status: 'oversize',
          link: undefined,
          token: undefined,
          approxChars: undefined,
          estimatedChars: smallestEstimate.estimatedChars,
          error: {
            code: 'oversize',
            message: `Share link exceeds ${charLimit} characters`,
          },
          clipboardStatus: 'idle',
          showSlowGenerationNotice: false,
          warningThresholdHit: smallestEstimate.estimatedChars >= SHARE_URL_WARNING_THRESHOLD,
          strategyId: undefined,
        })
        return
      }

      const viableCandidates = rankedStrategies.filter(est => est.estimatedChars <= charLimit)
      const updateEstimateState = (estimate: StrategyEstimate) => {
        const thresholdHit = estimate.estimatedChars >= SHARE_URL_WARNING_THRESHOLD
        const warningActive = thresholdHit || isDebugWarningForced()
        setState(prev => ({
          ...prev,
          status: warningActive ? 'warning' : 'generating',
          estimatedChars: estimate.estimatedChars,
          warningThresholdHit: warningActive,
          strategyId: estimate.strategy.id,
          approxChars: prev.approxChars,
        }))
        setShareDebugCurrentStrategy(estimate.strategy.id)
      }

      updateEstimateState(viableCandidates[0])

      let lastFailure: Error | null = null
      let maxOversizeChars: number | null = null

      for (const estimate of viableCandidates) {
        if (estimate !== viableCandidates[0]) {
          updateEstimateState(estimate)
        }

        try {
          const encodeStartedAt = nowMs()
          const envelope = await encodeWithStrategy({
            snapshot,
            serialized,
            strategy: estimate.strategy,
          })
          const finalized = finalizeShareToken(envelope, options?.baseUrl)
          const encodeMs = Math.max(0, Math.round(nowMs() - encodeStartedAt))

          recordResult({
            strategyId: estimate.strategy.id,
            estimatedChars: estimate.estimatedChars,
            actualChars: finalized.linkChars,
            encodeMs,
          })

          if (finalized.linkChars > charLimit) {
            maxOversizeChars = Math.max(maxOversizeChars ?? 0, finalized.linkChars)
            continue
          }

          const shouldWarn =
            isDebugWarningForced() ||
            finalized.warningThresholdHit ||
            estimate.estimatedChars >= SHARE_URL_WARNING_THRESHOLD

          lastResultRef.current = {
            contentSignature,
            checksum: envelope.checksum,
            link: finalized.link,
            token: finalized.token,
            approxChars: finalized.linkChars,
            estimatedChars: estimate.estimatedChars,
            warningThresholdHit: shouldWarn,
            strategyId: estimate.strategy.id,
          }

          recordShareDebugResult({
            envelope: finalized.envelope,
            link: finalized.link,
            token: finalized.token,
            strategyId: estimate.strategy.id,
            warningThresholdHit: shouldWarn,
          })

          emitGenerationTelemetry({
            outcome: 'success',
            approxChars: finalized.linkChars,
            estimatedChars: estimate.estimatedChars,
            warningThresholdHit: shouldWarn,
            strategyId: estimate.strategy.id,
            encodeMs,
          })

          setState(prev => ({
            ...prev,
            status: 'ready',
            link: finalized.link,
            token: finalized.token,
            approxChars: finalized.linkChars,
            estimatedChars: estimate.estimatedChars,
            elapsedMs: prev.startedAt ? Date.now() - prev.startedAt : prev.elapsedMs,
            showSlowGenerationNotice: false,
            warningThresholdHit: shouldWarn,
            strategyId: estimate.strategy.id,
          }))
          return
        } catch (error) {
          lastFailure = error instanceof Error
            ? error
            : new Error('Failed to encode share link')
        }
      }

      if (maxOversizeChars) {
        emitGenerationTelemetry({
          outcome: 'oversize',
          approxChars: maxOversizeChars,
          estimatedChars: smallestEstimate.estimatedChars,
          warningThresholdHit: maxOversizeChars >= SHARE_URL_WARNING_THRESHOLD,
        })
        setState({
          status: 'oversize',
          link: undefined,
          token: undefined,
          approxChars: maxOversizeChars,
          estimatedChars: smallestEstimate.estimatedChars,
          error: {
            code: 'oversize',
            message: `Share link exceeds ${charLimit} characters`,
          },
          clipboardStatus: 'idle',
          showSlowGenerationNotice: false,
          warningThresholdHit: maxOversizeChars >= SHARE_URL_WARNING_THRESHOLD,
          strategyId: undefined,
        })
        return
      }

      if (lastFailure) {
        throw lastFailure
      }

      throw new Error('Share link generation failed unexpectedly')
    } catch (error) {
      emitGenerationTelemetry({
        outcome: 'error',
        approxChars: stateRef.current.approxChars,
        strategyId: stateRef.current.strategyId,
        warningThresholdHit: stateRef.current.warningThresholdHit,
      })
      setState({
        status: 'error',
        error: {
          code: 'generation-failed',
          message: error instanceof Error ? error.message : 'Failed to generate share link',
        },
        clipboardStatus: 'idle',
        showSlowGenerationNotice: false,
        warningThresholdHit: false,
        strategyId: undefined,
        estimatedChars: undefined,
        approxChars: undefined,
      })
    } finally {
      pendingGenerationRef.current = null
    }
  }, [adjustPayloadEstimate, charLimit, options?.baseUrl, recordResult, snapshotBuilder])

  const reuseExistingLink = useCallback(() => {
    const lastResult = lastResultRef.current
    if (!lastResult) {
      return undefined
    }
    setShareDebugCurrentStrategy(lastResult.strategyId)
    setState(prev => ({
      ...prev,
      status: 'ready',
      link: lastResult.link,
      token: lastResult.token,
      approxChars: lastResult.approxChars ?? prev.approxChars,
      estimatedChars: lastResult.approxChars ?? prev.estimatedChars,
      showSlowGenerationNotice: false,
      warningThresholdHit: lastResult.warningThresholdHit,
      strategyId: lastResult.strategyId,
    }))
    return lastResult.link
  }, [])

  const markCopyPending = useCallback(() => {
    setState(prev => ({
      ...prev,
      clipboardStatus: 'copying',
      clipboardError: undefined,
    }))
  }, [])

  const markCopySuccess = useCallback(() => {
    recordShareClipboardTelemetry({ outcome: 'success' })
    setState(prev => ({
      ...prev,
      clipboardStatus: 'copied',
      clipboardError: undefined,
      copiedAt: Date.now(),
    }))
  }, [])

  const markCopyFailure = useCallback((message: string) => {
    recordShareClipboardTelemetry({ outcome: 'fallback' })
    setState(prev => ({
      ...prev,
      clipboardStatus: 'error',
      clipboardError: message,
    }))
  }, [])

  useEffect(() => {
    if (import.meta.env.MODE === 'test') {
      console.info('[share-link]', state.status, state.error?.code ?? '')
    }
  }, [state.error?.code, state.status])

  return {
    state,
    generateShareLink,
    resetShareState,
    reuseExistingLink,
    markCopyPending,
    markCopySuccess,
    markCopyFailure,
  }
}

const isStorageAvailable = (healthRef: MutableRefObject<'unknown' | 'ok' | 'failed'>): boolean => {
  if (healthRef.current === 'failed') {
    return false
  }

  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    healthRef.current = 'failed'
    return false
  }

  try {
    const testKey = '__share-link-check__'
    window.localStorage.setItem(testKey, 'ok')
    window.localStorage.removeItem(testKey)
    healthRef.current = 'ok'
    return true
  } catch (error) {
    console.warn('Share link storage unavailable:', error)
    healthRef.current = 'failed'
    return false
  }
}

type StrategyEstimate = {
  strategy: CompressionStrategy
  estimatedChars: number
  estimatedPayloadChars: number
}

type EstimateAdjuster = (strategyId: CompressionStrategyId, baseEstimate: number) => number

interface EncodeWithStrategyInput {
  snapshot: ProjectSnapshot
  serialized: string
  strategy: CompressionStrategy
}

const rankCompressionStrategies = (
  serializedLength: number,
  baseUrl?: string,
  adjustEstimate?: EstimateAdjuster,
): StrategyEstimate[] => {
  const strategies = listCompressionStrategies()
  const estimates = strategies
    .map(strategy => {
      const basePayload = Math.ceil(Math.max(0, strategy.estimateSize(serializedLength)))
      const adjustedPayload = adjustEstimate ? adjustEstimate(strategy.id, basePayload) : basePayload
      const estimatedChars = estimateShareUrlLengthFromPayload(adjustedPayload, baseUrl)
      return {
        strategy,
        estimatedChars,
        estimatedPayloadChars: adjustedPayload,
      }
    })
    .sort((a, b) => a.estimatedChars - b.estimatedChars)
  return applyShareDebugStrategyOverride(estimates)
}

const encodeWithStrategy = async ({ snapshot, serialized, strategy }: EncodeWithStrategyInput) => {
  const result = await strategy.encode({ snapshot, serialized })
    const checksumSource = result.checksumSource ?? result.serialized ?? serialized
    return encodeSharePayload(snapshot, {
      serialized: result.serialized,
      checksumSource,
      compressed: result.payload,
      strategyId: strategy.id,
    })
}

const applyShareDebugStrategyOverride = (estimates: StrategyEstimate[]): StrategyEstimate[] => {
  const handle = resolveShareDebugHandle()
  if (!handle?.forceStrategyId) {
    return estimates
  }
  const forcedIndex = estimates.findIndex(entry => entry.strategy.id === handle.forceStrategyId)
  if (forcedIndex <= 0) {
    return estimates
  }
  const forced = estimates[forcedIndex]
  return [forced, ...estimates.slice(0, forcedIndex), ...estimates.slice(forcedIndex + 1)]
}

const resolveShareDebugHandle = (): ShareDebugHandle | undefined => {
  if (import.meta.env.PROD || typeof window === 'undefined') {
    return undefined
  }
  if (!window.__akselShareDebug) {
    window.__akselShareDebug = {}
  }
  return window.__akselShareDebug
}

const setShareDebugCurrentStrategy = (strategyId: CompressionStrategyId) => {
  const handle = resolveShareDebugHandle()
  if (handle) {
    handle.currentStrategyId = strategyId
  }
}

const recordShareDebugResult = (payload: {
  envelope: SharePayloadEnvelope
  link: string
  token: string
  strategyId: CompressionStrategyId
  warningThresholdHit: boolean
}) => {
  const handle = resolveShareDebugHandle()
  if (!handle) {
    return
  }
  handle.currentStrategyId = payload.strategyId
  handle.lastLink = payload.link
  handle.lastToken = payload.token
  handle.lastEnvelope = payload.envelope
  handle.warningThresholdHit = payload.warningThresholdHit
}

const isDebugWarningForced = (): boolean => {
  return Boolean(resolveShareDebugHandle()?.forceWarningThresholdHit)
}

const finalizeShareToken = (envelope: SharePayloadEnvelope, baseUrl?: string) => {
  let workingEnvelope = envelope
  let token = createShareToken(workingEnvelope)
  let link = buildShareUrl(token, baseUrl)
  let linkChars = link.length
  let warningThresholdHit = linkChars >= SHARE_URL_WARNING_THRESHOLD

  if (warningThresholdHit !== workingEnvelope.warningThresholdHit) {
    workingEnvelope = {
      ...workingEnvelope,
      warningThresholdHit,
    }
    token = createShareToken(workingEnvelope)
    link = buildShareUrl(token, baseUrl)
    linkChars = link.length
    warningThresholdHit = linkChars >= SHARE_URL_WARNING_THRESHOLD
  }

  return {
    envelope: workingEnvelope,
    token,
    link,
    linkChars,
    warningThresholdHit,
  }
}

const getSlowGenerationThreshold = (): number => {
  const config = getShareDebugConfig()
  if (config?.apologyThresholdMs && config.apologyThresholdMs > 0) {
    return config.apologyThresholdMs
  }
  return SLOW_GENERATION_THRESHOLD_MS
}

const applyShareDebugDelay = async (): Promise<void> => {
  const delayMs = getShareDebugConfig()?.delayMs ?? 0
  if (!delayMs) {
    return
  }

  await new Promise(resolve => setTimeout(resolve, delayMs))
}

const getShareDebugConfig = () => {
  if (import.meta.env.PROD) {
    return undefined
  }

  if (typeof window === 'undefined') {
    return undefined
  }

  return window.__AXEL_SHARE_DEBUG_CONFIG__
}

const nowMs = (): number => {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now()
  }
  return Date.now()
}
