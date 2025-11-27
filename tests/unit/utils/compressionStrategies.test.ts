import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { listCompressionStrategies } from '@/services/compressionStrategies'
import {
  buildShareUrl,
  createShareToken,
  encodeSharePayload,
  estimateShareUrlLengthFromPayload,
  SHARE_URL_CHAR_LIMIT,
  SHARE_URL_WARNING_THRESHOLD,
} from '@/utils/shareEncoding'
import type { ProjectSnapshot } from '@/types/project'
import { createDefaultProject, FORM_SUMMARY_JSX_CODE, HOOKS_DEMO_HOOKS_CODE, HOOKS_DEMO_JSX_CODE } from '@/utils/projectDefaults'
import { createShareSnapshot, SNAPSHOT_FILE_IDS } from '@/services/storage'

const BASE_URL = 'https://aksel.nav.no/arcade'
const FIXTURE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../fixtures/share')

const loadSnapshot = (fileName: string): ProjectSnapshot => {
  const raw = fs.readFileSync(path.join(FIXTURE_DIR, fileName), 'utf-8')
  return JSON.parse(raw) as ProjectSnapshot
}

const hooksSnapshot = loadSnapshot('hooks-demo.json')
const summarySnapshot = loadSnapshot('summary-page.json')

const createSnapshotFromTemplate = (variant: 'hooks' | 'summary'): ProjectSnapshot => {
  const project = createDefaultProject()
  if (variant === 'hooks') {
    project.jsxCode = HOOKS_DEMO_JSX_CODE
    project.hooksCode = HOOKS_DEMO_HOOKS_CODE
  } else {
    project.jsxCode = FORM_SUMMARY_JSX_CODE
    project.hooksCode = ''
  }

  return createShareSnapshot(project, {
    activeFileId: SNAPSHOT_FILE_IDS.jsx,
    preview: {
      viewport: variant === 'summary' ? 'LG' : 'MD',
      zoom: 1,
      theme: 'dark',
      sandboxFlags: {},
    },
  })
}

const measureActualChars = async (snapshot: ProjectSnapshot, baseUrl: string) => {
  const serialized = JSON.stringify(snapshot)
  const entries = [] as Array<{ id: string; chars: number }>
  for (const strategy of listCompressionStrategies()) {
    const encoded = await strategy.encode({ snapshot, serialized })
    const envelope = await encodeSharePayload(snapshot, {
      serialized,
      checksumSource: encoded.checksumSource,
      compressed: encoded.payload,
      strategyId: strategy.id,
    })
    const token = createShareToken(envelope)
    const url = buildShareUrl(token, baseUrl)
    entries.push({ id: strategy.id, chars: url.length })
  }
  entries.sort((a, b) => a.chars - b.chars)
  return entries
}

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

  it('prefers the base64url packed-brotli q11 strategy for hooks snapshot', () => {
    const estimates = calculateEstimates(hooksSnapshot)
    const winner = estimates.reduce((prev, curr) => (curr.estimatedChars < prev.estimatedChars ? curr : prev))
    expect(winner.id).toBe('packed-brotli-q11-b64url')
  })

  it('requires alternative strategies to keep the summary template within safe limits', () => {
    const estimates = calculateEstimates(summarySnapshot)
    const baseline = estimates.find(entry => entry.id === 'lz-string-uri')
    expect(baseline?.estimatedChars ?? 0).toBeGreaterThanOrEqual(SHARE_URL_WARNING_THRESHOLD)

    const winner = estimates.reduce((prev, curr) => (curr.estimatedChars < prev.estimatedChars ? curr : prev))
    expect(winner.estimatedChars).toBeLessThanOrEqual(SHARE_URL_CHAR_LIMIT)
    expect(winner.estimatedChars).toBeLessThan(baseline?.estimatedChars ?? Number.MAX_SAFE_INTEGER)
  })

  it('identifies at least one strategy in the warning window for summary payloads', () => {
    const estimates = calculateEstimates(summarySnapshot)
    const hasWarningCandidate = estimates.some(entry => (
      entry.estimatedChars >= SHARE_URL_WARNING_THRESHOLD && entry.estimatedChars <= SHARE_URL_CHAR_LIMIT
    ))
    expect(hasWarningCandidate).toBe(true)
  })

  it('keeps the built-in hooks demo below the warning threshold after compression', async () => {
    const snapshot = createSnapshotFromTemplate('hooks')
    const results = await measureActualChars(snapshot, BASE_URL)
    const best = results[0]
    expect(best.chars).toBeLessThan(SHARE_URL_WARNING_THRESHOLD)
  })

  it('keeps the summary template share under the hard limit', async () => {
    const snapshot = createSnapshotFromTemplate('summary')
    const results = await measureActualChars(snapshot, BASE_URL)
    const best = results[0]
    expect(best.chars).toBeLessThanOrEqual(SHARE_URL_CHAR_LIMIT)
  })
})
