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
  serializeSharePayload,
  SHARE_URL_CHAR_LIMIT,
  SHARE_URL_WARNING_THRESHOLD,
} from '@/utils/shareEncoding'
import {
  recordShareClipboardTelemetry,
  recordShareGenerationTelemetry,
  type ShareGenerationOutcome,
} from '@/services/telemetry'
import {
  isSharePayloadCompressionStrategy,
  listCompressionStrategies,
  type CompressionStrategy,
} from '@/services/compressionStrategies'

const SLOW_GENERATION_THRESHOLD_MS = 9000

type PendingGeneration = {
  startedAt: number
}

export type ShareLinkStatus = 'idle' | 'generating' | 'warning' | 'ready' | 'oversize' | 'error'
export type ClipboardStatus = 'idle' | 'copying' | 'copied' | 'error'

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
  slowGenerationThresholdMs?: number
  generationDelayMs?: number
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
  const { project, editorState } = useProject()
  const { theme } = useSettings()
  const { adjustPayloadEstimate, recordResult } = useShareLinkExperiments()

  const charLimit = options?.charLimit ?? SHARE_URL_CHAR_LIMIT
  const slowGenerationThresholdMs = options?.slowGenerationThresholdMs && options.slowGenerationThresholdMs > 0
    ? options.slowGenerationThresholdMs
    : SLOW_GENERATION_THRESHOLD_MS
  const generationDelayMs = options?.generationDelayMs ?? 0

  useEffect(() => {
    stateRef.current = state
  }, [state])

  const derivedSnapshotBuilder = useCallback(() => {
    return createShareSnapshot(project, {
      activeFileId: editorState.activeTab === 'Hooks' ? SNAPSHOT_FILE_IDS.hooks : SNAPSHOT_FILE_IDS.jsx,
      preview: {
        viewport: project.viewportSize,
        theme,
      },
    })
  }, [editorState.activeTab, project, theme])

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

        return {
          ...prev,
          elapsedMs: elapsed,
          showSlowGenerationNotice: prev.showSlowGenerationNotice || elapsed >= slowGenerationThresholdMs,
        }
      })
    }, 250)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [slowGenerationThresholdMs, state.status])

  const resetShareState = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setState(IDLE_STATE)
  }, [])

  const snapshotBuilder = options?.snapshotBuilder ?? derivedSnapshotBuilder

  const generateShareLink = useCallback(async (forceRegeneration = false) => {
    if (pendingGenerationRef.current) {
      const { startedAt } = pendingGenerationRef.current
      const elapsed = Date.now() - startedAt
      const currentStatus = stateRef.current.status === 'warning' ? 'warning' : 'generating'

      setState(prev => ({
        ...prev,
        status: currentStatus,
        startedAt,
        elapsedMs: elapsed,
        showSlowGenerationNotice: prev.showSlowGenerationNotice || elapsed >= slowGenerationThresholdMs,
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
          message: 'Connect to the internet to generate a Web share URL.',
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
      approxChars: undefined,
      estimatedChars: undefined,
      strategyId: undefined,
    }))

    try {
      const snapshot = await Promise.resolve(snapshotBuilder())
      if (generationDelayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, generationDelayMs))
      }
      const serialized = serializeSharePayload(snapshot)
      const contentSignature = await computeChecksum(serialized)

      if (
        !forceRegeneration &&
        lastResultRef.current &&
        lastResultRef.current.contentSignature === contentSignature
      ) {
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
        throw new Error('No compression strategies available for Web share URLs')
      }

      const smallestEstimate = rankedStrategies[0]
      const viableCandidates = rankedStrategies.filter(est => est.estimatedChars <= charLimit)
      const candidateQueue = viableCandidates.length ? viableCandidates : [smallestEstimate]
      const updateEstimateState = (estimate: StrategyEstimate) => {
        const thresholdHit = estimate.estimatedChars >= SHARE_URL_WARNING_THRESHOLD
        const warningActive = thresholdHit
        setState(prev => ({
          ...prev,
          status: warningActive ? 'warning' : 'generating',
          estimatedChars: estimate.estimatedChars,
          warningThresholdHit: warningActive,
          strategyId: estimate.strategy.id,
          approxChars: undefined,
        }))
      }

      if (candidateQueue.length) {
        updateEstimateState(candidateQueue[0])
      }

      let lastFailure: Error | null = null
      let maxOversizeChars: number | null = null

      for (const estimate of candidateQueue) {
        if (estimate !== candidateQueue[0]) {
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

          const shouldWarn = finalized.warningThresholdHit

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
            : new Error('Failed to encode Web share URL')
        }
      }

      if (maxOversizeChars) {
        emitGenerationTelemetry({
          outcome: 'oversize',
          approxChars: maxOversizeChars,
          estimatedChars: candidateQueue[0]?.estimatedChars ?? smallestEstimate.estimatedChars,
          warningThresholdHit: maxOversizeChars >= SHARE_URL_WARNING_THRESHOLD,
        })
        setState({
          status: 'oversize',
          link: undefined,
          token: undefined,
          approxChars: maxOversizeChars,
          estimatedChars: candidateQueue[0]?.estimatedChars ?? smallestEstimate.estimatedChars,
          error: {
            code: 'oversize',
            message: `Web share URL exceeds ${charLimit} characters`,
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

      throw new Error('Web share URL generation failed unexpectedly')
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
          message: error instanceof Error ? error.message : 'Failed to generate Web share URL',
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
  }, [
    adjustPayloadEstimate,
    charLimit,
    generationDelayMs,
    options?.baseUrl,
    recordResult,
    slowGenerationThresholdMs,
    snapshotBuilder,
  ])

  const reuseExistingLink = useCallback(() => {
    const lastResult = lastResultRef.current
    if (!lastResult) {
      return undefined
    }
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
    console.warn('Web share URL storage unavailable:', error)
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
  const strategies = listCompressionStrategies().filter(isSharePayloadCompressionStrategy)
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
  return estimates
}

const encodeWithStrategy = async ({ snapshot, serialized, strategy }: EncodeWithStrategyInput) => {
  const result = await strategy.encode({ serialized })
  const checksumSource = result.checksumSource ?? result.serialized ?? serialized
  return encodeSharePayload(snapshot, {
    serialized: result.serialized,
    checksumSource,
    compressed: result.payload,
    strategyId: strategy.id,
  })
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

const nowMs = (): number => {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now()
  }
  return Date.now()
}
