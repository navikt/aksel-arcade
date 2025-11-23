import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { listCompressionStrategies } from '@/services/compressionStrategies'
import {
  estimateShareUrlLengthFromPayload,
  SHARE_URL_CHAR_LIMIT,
  SHARE_URL_WARNING_THRESHOLD,
} from '@/utils/shareEncoding'
import type { ProjectSnapshot } from '@/types/project'

const BASE_URL = 'https://aksel.nav.no/arcade'
const FIXTURE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../fixtures/share')

const loadSnapshot = (fileName: string): ProjectSnapshot => {
  const raw = fs.readFileSync(path.join(FIXTURE_DIR, fileName), 'utf-8')
  return JSON.parse(raw) as ProjectSnapshot
}

const hooksSnapshot = loadSnapshot('hooks-demo.json')
const summarySnapshot = loadSnapshot('summary-page.json')

const calculateEstimates = (snapshot: ProjectSnapshot) => {
  const serializedLength = JSON.stringify(snapshot).length
  return listCompressionStrategies().map(strategy => {
    const estimatedPayload = Math.ceil(Math.max(0, strategy.estimateSize(serializedLength)))
    return {
      id: strategy.id,
      estimatedChars: estimateShareUrlLengthFromPayload(estimatedPayload, BASE_URL),
    }
  })
}

describe('compressionStrategies heuristics', () => {
  it('keeps the hooks demo under the warning threshold', () => {
    const estimates = calculateEstimates(hooksSnapshot)
    const best = estimates.reduce((prev, curr) => (curr.estimatedChars < prev.estimatedChars ? curr : prev))
    expect(best.estimatedChars).toBeLessThan(SHARE_URL_WARNING_THRESHOLD)
  })

  it('requires alternative strategies to keep the summary template within the hard limit', () => {
    const estimates = calculateEstimates(summarySnapshot)
    const baseline = estimates.find(entry => entry.id === 'lz-string-uri')
    expect(baseline?.estimatedChars ?? 0).toBeGreaterThan(SHARE_URL_CHAR_LIMIT)

    const winner = estimates.reduce((prev, curr) => (curr.estimatedChars < prev.estimatedChars ? curr : prev))
    expect(winner.estimatedChars).toBeLessThanOrEqual(SHARE_URL_CHAR_LIMIT)
  })

  it('identifies at least one strategy in the warning window for summary payloads', () => {
    const estimates = calculateEstimates(summarySnapshot)
    const hasWarningCandidate = estimates.some(entry => (
      entry.estimatedChars >= SHARE_URL_WARNING_THRESHOLD && entry.estimatedChars <= SHARE_URL_CHAR_LIMIT
    ))
    expect(hasWarningCandidate).toBe(true)
  })
})
