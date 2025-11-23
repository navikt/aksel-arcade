import type { CompressionStrategyId } from '@/types/project'

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

export type TelemetryEvent = ShareGenerationTelemetryEvent | ShareClipboardTelemetryEvent

const telemetryBuffer: TelemetryEvent[] = []
const telemetryHooks = new Set<TelemetryHook>()

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

const safelyInvokeTelemetryHook = (hook: TelemetryHook, event: TelemetryEvent): void => {
  try {
    hook(event)
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('[telemetry] hook threw', error)
    }
  }
}
