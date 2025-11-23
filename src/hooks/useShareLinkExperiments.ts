import { useCallback, useEffect, useRef } from 'react'
import type { CompressionExperimentResult, CompressionStrategyId } from '@/types/project'

const DEFAULT_MULTIPLIER = 1
const MIN_MULTIPLIER = 0.25
const MAX_MULTIPLIER = 2.5
const SMOOTHING_FACTOR = 0.3
const STORAGE_KEY = 'aksel.share.strategy-multipliers.v1'
const MAX_BUFFERED_RESULTS = 25

export interface ShareLinkExperimentsApi {
  adjustPayloadEstimate: (strategyId: CompressionStrategyId, baseEstimate: number) => number
  recordResult: (result: CompressionExperimentResult) => CompressionExperimentResult
  consumeResults: () => CompressionExperimentResult[]
}

export const useShareLinkExperiments = (): ShareLinkExperimentsApi => {
  const multiplierRef = useRef<Partial<Record<CompressionStrategyId, number>>>({})
  const resultsRef = useRef<CompressionExperimentResult[]>([])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (!stored) {
        return
      }

      const parsed = JSON.parse(stored) as Partial<Record<CompressionStrategyId, unknown>>
      if (!parsed || typeof parsed !== 'object') {
        return
      }

      const restored: Partial<Record<CompressionStrategyId, number>> = {}
      Object.entries(parsed).forEach(([key, value]) => {
        if (typeof value === 'number') {
          restored[key as CompressionStrategyId] = clampMultiplier(value)
        }
      })
      multiplierRef.current = restored
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('[share-link] Failed to restore experiment multipliers', error)
      }
    }
  }, [])

  const persistMultipliers = useCallback(() => {
    if (typeof window === 'undefined') {
      return
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(multiplierRef.current))
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('[share-link] Failed to persist experiment multipliers', error)
      }
    }
  }, [])

  const adjustPayloadEstimate = useCallback((strategyId: CompressionStrategyId, baseEstimate: number) => {
    const multiplier = multiplierRef.current[strategyId] ?? DEFAULT_MULTIPLIER
    const normalized = Math.max(1, Math.round(baseEstimate))
    return Math.max(1, Math.round(normalized * multiplier))
  }, [])

  const recordResult = useCallback((result: CompressionExperimentResult) => {
    resultsRef.current = [...resultsRef.current.slice(-(MAX_BUFFERED_RESULTS - 1)), result]

    if (result.estimatedChars > 0 && result.actualChars > 0) {
      const ratio = result.actualChars / result.estimatedChars
      const current = multiplierRef.current[result.strategyId] ?? DEFAULT_MULTIPLIER
      const blended = current * (1 - SMOOTHING_FACTOR) + ratio * SMOOTHING_FACTOR
      multiplierRef.current[result.strategyId] = clampMultiplier(blended)
      persistMultipliers()
    }

    return result
  }, [persistMultipliers])

  const consumeResults = useCallback(() => {
    const pending = resultsRef.current
    resultsRef.current = []
    return pending
  }, [])

  return {
    adjustPayloadEstimate,
    recordResult,
    consumeResults,
  }
}

const clampMultiplier = (value: number): number => {
  return Math.min(MAX_MULTIPLIER, Math.max(MIN_MULTIPLIER, value))
}
