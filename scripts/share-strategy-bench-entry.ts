import fs from 'node:fs/promises'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import type { ProjectSnapshot } from '../src/types/project'
import { listCompressionStrategies } from '../src/services/compressionStrategies'
import {
  buildShareUrl,
  createShareToken,
  encodeSharePayload,
  estimateShareUrlLengthFromPayload,
  computeChecksum,
  SHARE_URL_CHAR_LIMIT,
  SHARE_URL_WARNING_THRESHOLD,
} from '../src/utils/shareEncoding'

const BENCH_BASE_URL = 'https://aksel.nav.no/arcade'
const OUTPUT_FILE = 'test-results/share-strategies.json'
const FIXTURE_FILES = [
  { id: 'hooks-demo', file: 'hooks-demo.json', label: 'Hooks demo snapshot' },
  { id: 'summary-page', file: 'summary-page.json', label: 'Summary page snapshot' },
]

type StrategyStats = {
  strategyId: string
  estimatedChars: number
  actualChars: number | null
  encodeMs: number
  warningThresholdHit: boolean
  withinLimit: boolean
  error?: string
}

type FixtureStats = {
  fixtureId: string
  label: string
  bytes: number
  strategies: StrategyStats[]
}

type BenchPayload = {
  generatedAt: string
  baseUrl: string
  fixtures: FixtureStats[]
}

const formatNumber = (value: number): string => value.toLocaleString('en-US')

export const runShareStrategyBench = async (): Promise<void> => {
  const projectRoot = process.env.AKSEL_ARCADE_ROOT ?? process.cwd()
  const fixturesDir = path.join(projectRoot, 'tests', 'fixtures', 'share')
  const outputPath = path.join(projectRoot, OUTPUT_FILE)

  await fs.mkdir(path.dirname(outputPath), { recursive: true })

  const strategies = listCompressionStrategies()
  const fixtures: FixtureStats[] = []

  for (const entry of FIXTURE_FILES) {
    const snapshot = await loadSnapshot(path.join(fixturesDir, entry.file))
    const serialized = JSON.stringify(snapshot)
    const checksum = await computeChecksum(serialized)
    const fixtureResult: FixtureStats = {
      fixtureId: entry.id,
      label: entry.label,
      bytes: serialized.length,
      strategies: [],
    }

    for (const strategy of strategies) {
      const estimatedPayload = Math.ceil(Math.max(0, strategy.estimateSize(serialized.length)))
      const estimatedChars = estimateShareUrlLengthFromPayload(estimatedPayload, BENCH_BASE_URL)
      const stat: StrategyStats = {
        strategyId: strategy.id,
        estimatedChars,
        actualChars: null,
        encodeMs: 0,
        warningThresholdHit: estimatedChars >= SHARE_URL_WARNING_THRESHOLD,
        withinLimit: estimatedChars <= SHARE_URL_CHAR_LIMIT,
      }

      const encodeStarted = performance.now()
      try {
        const encoded = await strategy.encode({ snapshot, serialized })
        const envelope = await encodeSharePayload(snapshot, {
          serialized: encoded.serialized,
          checksum,
          compressed: encoded.payload,
          strategyId: strategy.id,
        })
        const token = createShareToken(envelope)
        const shareUrl = buildShareUrl(token, BENCH_BASE_URL)

        stat.encodeMs = Math.max(0, Math.round(performance.now() - encodeStarted))
        stat.actualChars = shareUrl.length
        stat.warningThresholdHit = shareUrl.length >= SHARE_URL_WARNING_THRESHOLD
        stat.withinLimit = shareUrl.length <= SHARE_URL_CHAR_LIMIT
      } catch (error) {
        stat.encodeMs = Math.max(0, Math.round(performance.now() - encodeStarted))
        stat.error = error instanceof Error ? error.message : 'Unknown error'
        stat.warningThresholdHit = false
        stat.withinLimit = false
      }

      fixtureResult.strategies.push(stat)
    }

    fixtureResult.strategies.sort((a, b) => {
      if (a.actualChars === null && b.actualChars === null) {
        return 0
      }
      if (a.actualChars === null) {
        return 1
      }
      if (b.actualChars === null) {
        return -1
      }
      return a.actualChars - b.actualChars
    })

    fixtures.push(fixtureResult)
  }

  const payload: BenchPayload = {
    generatedAt: new Date().toISOString(),
    baseUrl: BENCH_BASE_URL,
    fixtures,
  }

  await fs.writeFile(outputPath, JSON.stringify(payload, null, 2), 'utf-8')
  logSummary(payload, outputPath)
}

const loadSnapshot = async (filePath: string): Promise<ProjectSnapshot> => {
  const raw = await fs.readFile(filePath, 'utf-8')
  return JSON.parse(raw) as ProjectSnapshot
}

const logSummary = (payload: BenchPayload, outputPath: string): void => {
  console.log(`\n📊 Share strategy bench complete → ${outputPath}`)
  payload.fixtures.forEach(fixture => {
    const winner = fixture.strategies.find(stat => stat.actualChars !== null)
    if (!winner) {
      console.log(` - ${fixture.label}: no successful strategies`)
      return
    }

    console.log(
      ` - ${fixture.label}: ${winner.strategyId} (${formatNumber(winner.actualChars!)} chars, ${winner.encodeMs}ms)`
    )
  })
  console.log('')
}

export default runShareStrategyBench
