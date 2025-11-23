import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  recordShareGenerationTelemetry,
  registerTelemetryHook,
  resetTelemetryLog,
} from '@/services/telemetry'

const clearWindowTelemetryHook = () => {
  if (typeof window !== 'undefined') {
    delete window.__AKSEL_TELEMETRY_HOOK__
  }
}

describe('telemetry service hooks', () => {
  beforeEach(() => {
    resetTelemetryLog()
    clearWindowTelemetryHook()
  })

  afterEach(() => {
    clearWindowTelemetryHook()
    resetTelemetryLog()
  })

  it('invokes registered telemetry hooks', () => {
    const hook = vi.fn()
    const unregister = registerTelemetryHook(hook)

    recordShareGenerationTelemetry({
      durationMs: 1500,
      approxChars: 1024,
      outcome: 'success',
    })

    expect(hook).toHaveBeenCalledTimes(1)
    expect(hook).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'share_generation', durationMs: 1500 })
    )

    unregister()
  })

  it('invokes window telemetry hook when available', () => {
    const hook = vi.fn()
    window.__AKSEL_TELEMETRY_HOOK__ = hook

    recordShareGenerationTelemetry({
      durationMs: 500,
      outcome: 'success',
    })

    expect(hook).toHaveBeenCalledTimes(1)
    expect(hook).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'share_generation', durationMs: 500 })
    )
  })
})
