import type { CompressionStrategyId } from '@/types/project'
import type { ShareDecodeErrorCode } from '@/utils/shareDecoding'

export type ShareGenerationOutcome = 'success' | 'oversize' | 'error'
export type ShareClipboardOutcome = 'success' | 'fallback' | 'error'
export type ShareGenerationBucket = '<1s' | '1-3s' | '3-9s' | '>=9s'
export type TelemetryHook = (event: TelemetryEvent) => void

interface ShareGenerationTelemetryEvent {
  type: 'share_generation'
  durationMs: number
  bucket: ShareGenerationBucket
  approxChars?: number
  estimatedChars?: number
  warningThresholdHit?: boolean
  strategyId?: CompressionStrategyId
  encodeMs?: number
  withinTarget: boolean
  outcome: ShareGenerationOutcome
  reused?: boolean
  timestamp: number
}

interface ShareClipboardTelemetryEvent {
  type: 'share_clipboard'
  outcome: ShareClipboardOutcome
  timestamp: number
}

interface ShareDecodeTelemetryEvent {
  type: 'share_decode'
  strategyId?: CompressionStrategyId
  repairApplied?: boolean
  checksumValid: boolean
  errorCode?: ShareDecodeErrorCode
  timestamp: number
}

export type TelemetryEvent =
  | ShareGenerationTelemetryEvent
  | ShareClipboardTelemetryEvent
  | ShareDecodeTelemetryEvent

const telemetryBuffer: TelemetryEvent[] = []
const telemetryHooks = new Set<TelemetryHook>()
const TELEMETRY_QUEUE_KEY = 'telemetryQueue'
const TELEMETRY_QUEUE_LIMIT = 100

export const registerTelemetryHook = (hook: TelemetryHook): (() => void) => {
  telemetryHooks.add(hook)
  return () => telemetryHooks.delete(hook)
}

export const recordShareGenerationTelemetry = (payload: {
  durationMs: number
  approxChars?: number
  estimatedChars?: number
  warningThresholdHit?: boolean
  strategyId?: CompressionStrategyId
  encodeMs?: number
  outcome: ShareGenerationOutcome
  reused?: boolean
}): void => {
  const duration = Math.max(0, Math.round(payload.durationMs))
  const event: ShareGenerationTelemetryEvent = {
    type: 'share_generation',
    durationMs: duration,
    bucket: getShareGenerationBucket(duration),
    approxChars: payload.approxChars,
    estimatedChars: payload.estimatedChars,
    warningThresholdHit: payload.warningThresholdHit,
    strategyId: payload.strategyId,
    encodeMs: payload.encodeMs,
    withinTarget: duration <= 3000,
    outcome: payload.outcome,
    reused: payload.reused,
    timestamp: Date.now(),
  }

  pushTelemetryEvent(event)
}

export const recordShareClipboardTelemetry = (payload: {
  outcome: ShareClipboardOutcome
}): void => {
  pushTelemetryEvent({
    type: 'share_clipboard',
    outcome: payload.outcome,
    timestamp: Date.now(),
  })
}

export const recordShareDecodeTelemetry = (payload: {
  strategyId?: CompressionStrategyId
  repairApplied?: boolean
  checksumValid: boolean
  errorCode?: ShareDecodeErrorCode
}): void => {
  pushTelemetryEvent({
    type: 'share_decode',
    strategyId: payload.strategyId,
    repairApplied: payload.repairApplied,
    checksumValid: payload.checksumValid,
    errorCode: payload.errorCode,
    timestamp: Date.now(),
  })
}

export const getShareGenerationBucket = (durationMs: number): ShareGenerationBucket => {
  if (durationMs < 1000) {
    return '<1s'
  }
  if (durationMs < 3000) {
    return '1-3s'
  }
  if (durationMs < 9000) {
    return '3-9s'
  }
  return '>=9s'
}

export const getTelemetryLogSnapshot = (): TelemetryEvent[] => {
  return [...telemetryBuffer]
}

export const resetTelemetryLog = (): void => {
  telemetryBuffer.length = 0
  if (typeof window !== 'undefined') {
    window.__AKSEL_TELEMETRY_LOG__ = []
  }
}

const pushTelemetryEvent = (event: TelemetryEvent): void => {
  telemetryBuffer.push(event)

  if (typeof window !== 'undefined') {
    if (!Array.isArray(window.__AKSEL_TELEMETRY_LOG__)) {
      window.__AKSEL_TELEMETRY_LOG__ = []
    }

    window.__AKSEL_TELEMETRY_LOG__.push(event)
    appendToLocalStorageQueue(event)
  }

  dispatchTelemetryHooks(event)

  if (import.meta.env.DEV) {
    console.debug('[telemetry]', event)
  }
}

const dispatchTelemetryHooks = (event: TelemetryEvent): void => {
  const invoked = new Set<TelemetryHook>()

  telemetryHooks.forEach(hook => {
    invoked.add(hook)
    safelyInvokeTelemetryHook(hook, event)
  })

  if (typeof window !== 'undefined') {
    const windowHook = window.__AKSEL_TELEMETRY_HOOK__
    if (typeof windowHook === 'function' && !invoked.has(windowHook)) {
      safelyInvokeTelemetryHook(windowHook, event)
    }
  }
}

const appendToLocalStorageQueue = (event: TelemetryEvent): void => {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return
  }

  try {
    const raw = window.localStorage.getItem(TELEMETRY_QUEUE_KEY)
    const queue: TelemetryEvent[] = raw ? JSON.parse(raw) : []
    queue.push(event)
    const trimmed = queue.slice(-TELEMETRY_QUEUE_LIMIT)
    window.localStorage.setItem(TELEMETRY_QUEUE_KEY, JSON.stringify(trimmed))
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('[telemetry] failed to persist telemetry queue', error)
    }
  }
}

const safelyInvokeTelemetryHook = (hook: TelemetryHook, event: TelemetryEvent): void => {
  try {
    hook(event)
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('[telemetry] hook threw', error)
    }
  }
}
