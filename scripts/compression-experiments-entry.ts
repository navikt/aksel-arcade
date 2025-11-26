import fs from 'node:fs/promises'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import type { ProjectSnapshot } from '../src/types/project'
import { serializePackedSnapshot, unpackSnapshot } from '../src/utils/snapshotPacking'
import { buildShareUrl, computeChecksum, createShareToken, encodeSharePayload } from '../src/utils/shareEncoding'
import { toBase64Url, fromBase64Url } from '../src/utils/base64'
import { getCompressionStrategy } from '../src/services/compressionStrategies'
declare module 'lzma' {
  type LzmaResult = Uint8Array | number[] | string
  type LzmaCallback = (result: LzmaResult) => void

  export function compress(
    data: string | Uint8Array,
    mode: number,
    onFinish: LzmaCallback,
    onProgress?: (percent: number) => void
  ): void
}

const BASE_URL = 'https://aksel.nav.no/arcade'
const OUTPUT_FILE = 'test-results/compression-experiments.json'
const FIXTURE = { id: 'hooks-demo', file: 'hooks-demo.json', label: 'Hooks demo snapshot' }

const BASE91_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!#$%&()*+,./:;<=>?@[]^_`{|}~\"'"

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

interface ExperimentContext {
  snapshot: ProjectSnapshot
  serialized: string
  packed: string
  checksumPacked: string
}

interface ExperimentDefinition {
  id: string
  label: string
  notes: string
  run: (ctx: ExperimentContext) => Promise<ExperimentRunResult>
}

interface ExperimentRunResult {
  payload: string
  checksumSource: string
  decode?: () => Promise<ProjectSnapshot>
}

interface ExperimentRecord {
  id: string
  label: string
  notes: string
  shareUrlChars: number | null
  payloadChars: number | null
  encodeMs: number
  decodeMs: number | null
  decodedMatches?: boolean
  error?: string
}

interface ExperimentReportPayload {
  generatedAt: string
  baseUrl: string
  brotliWasmBytes: number | null
  fixture: {
    id: string
    label: string
    bytes: number
  }
  experiments: ExperimentRecord[]
}

const experiments: ExperimentDefinition[] = [
  {
    id: 'baseline-packed-deflate-b91',
    label: 'Baseline — Snapshot pack + Deflate (lvl9) + Base91',
    notes: 'Current production strategy (reference point)',
    run: async (ctx) => {
      const strategy = getCompressionStrategy('packed-deflate-b91')
      if (!strategy) {
        throw new Error('Missing baseline strategy implementation')
      }
      const result = await strategy.encode({ snapshot: ctx.snapshot, serialized: ctx.serialized })
      return {
        payload: result.payload,
        checksumSource: result.checksumSource ?? ctx.packed,
        decode: () => strategy.decode(result.payload),
      }
    },
  },
  {
    id: 'exp-packed-brotli-q7-b91',
    label: 'Experiment — Snapshot pack + Brotli (q7) + Base91',
    notes: 'Trade extra CPU for denser Brotli output before Base91 encoding',
    run: async (ctx) => {
      const module = await loadBrotliModule()
      const compressed = module.compress(textEncoder.encode(ctx.packed), { quality: 7 })
      const payload = encodeBase91(compressed)
      return {
        payload,
        checksumSource: ctx.packed,
        decode: async () => {
          const bytes = decodeBase91(payload)
          const packed = textDecoder.decode(module.decompress(bytes))
          return unpackSnapshot(packed)
        },
      }
    },
  },
  {
    id: 'exp-packed-brotli-q9-b91',
    label: 'Experiment — Snapshot pack + Brotli (q9) + Base91',
    notes: 'Higher-quality Brotli to see diminishing returns vs q7',
    run: async (ctx) => {
      const module = await loadBrotliModule()
      const compressed = module.compress(textEncoder.encode(ctx.packed), { quality: 9 })
      const payload = encodeBase91(compressed)
      return {
        payload,
        checksumSource: ctx.packed,
        decode: async () => {
          const bytes = decodeBase91(payload)
          const packed = textDecoder.decode(module.decompress(bytes))
          return unpackSnapshot(packed)
        },
      }
    },
  },
  {
    id: 'exp-packed-lzma-mode4-b91',
    label: 'Experiment — Snapshot pack + LZMA (mode 4) + Base91',
    notes: 'Heavier LZMA mode on packed snapshot with Base91 transport',
    run: async (ctx) => {
      const compressed = await runLzmaCompress(ctx.packed, 4)
      const payload = encodeBase91(compressed)
      return { payload, checksumSource: ctx.packed }
    },
  },
  {
    id: 'exp-packed-brotli-q11-b91',
    label: 'Experiment — Snapshot pack + Brotli (q11) + Base91',
    notes: 'Max-quality Brotli pass over packed snapshot, expect best ratio but highest CPU',
    run: async (ctx) => {
      const module = await loadBrotliModule()
      const compressed = module.compress(textEncoder.encode(ctx.packed), { quality: 11 })
      const payload = encodeBase91(compressed)
      return {
        payload,
        checksumSource: ctx.packed,
        decode: async () => {
          const bytes = decodeBase91(payload)
          const packed = textDecoder.decode(module.decompress(bytes))
          return unpackSnapshot(packed)
        },
      }
    },
  },
  {
    id: 'exp-packed-brotli-q9-b64url',
    label: 'Experiment — Snapshot pack + Brotli (q9) + Base64url',
    notes: 'Control to verify Base91 alphabet advantage vs Base64url transport',
    run: async (ctx) => {
      const module = await loadBrotliModule()
      const compressed = module.compress(textEncoder.encode(ctx.packed), { quality: 9 })
      const payload = toBase64Url(compressed)
      return {
        payload,
        checksumSource: ctx.packed,
        decode: async () => {
          const bytes = fromBase64Url(payload)
          const packed = textDecoder.decode(module.decompress(bytes))
          return unpackSnapshot(packed)
        },
      }
    },
  },
  {
    id: 'exp-packed-brotli-q11-b64url',
    label: 'Experiment — Snapshot pack + Brotli (q11) + Base64url',
    notes: 'Same as q11 Base91 variant but without Base91 to isolate codec gains',
    run: async (ctx) => {
      const module = await loadBrotliModule()
      const compressed = module.compress(textEncoder.encode(ctx.packed), { quality: 11 })
      const payload = toBase64Url(compressed)
      return {
        payload,
        checksumSource: ctx.packed,
        decode: async () => {
          const bytes = fromBase64Url(payload)
          const packed = textDecoder.decode(module.decompress(bytes))
          return unpackSnapshot(packed)
        },
      }
    },
  },
]

export const runCompressionExperiments = async (): Promise<void> => {
  const projectRoot = process.env.AKSEL_ARCADE_ROOT ?? process.cwd()
  const fixturesDir = path.join(projectRoot, 'tests', 'fixtures', 'share')
  const outputPath = path.join(projectRoot, OUTPUT_FILE)
  await fs.mkdir(path.dirname(outputPath), { recursive: true })

  ensureFileFetchSupport()

  const snapshot = await loadSnapshot(path.join(fixturesDir, FIXTURE.file))
  const serialized = JSON.stringify(snapshot)
  const packed = serializePackedSnapshot(snapshot)
  const checksumPacked = await computeChecksum(packed)
  const brotliWasmBytes = await measureBrotliWasmSize(projectRoot)

  const ctx: ExperimentContext = { snapshot, serialized, packed, checksumPacked }
  const records: ExperimentRecord[] = []

  for (const experiment of experiments) {
    const started = performance.now()
    const record: ExperimentRecord = {
      id: experiment.id,
      label: experiment.label,
      notes: experiment.notes,
      shareUrlChars: null,
      payloadChars: null,
      encodeMs: 0,
      decodeMs: null,
    }

    try {
      const result = await experiment.run(ctx)
      const checksum = result.checksumSource === ctx.packed ? ctx.checksumPacked : await computeChecksum(result.checksumSource)
      const envelope = await encodeSharePayload(snapshot, {
        serialized,
        compressed: result.payload,
        checksum,
        checksumSource: result.checksumSource,
        strategyId: experiment.id as never,
      })
      const token = createShareToken(envelope)
      const shareUrl = buildShareUrl(token, BASE_URL)

      record.shareUrlChars = shareUrl.length
      record.payloadChars = result.payload.length
      record.encodeMs = Math.max(0, Math.round(performance.now() - started))

      if (result.decode) {
        const decodeStarted = performance.now()
        const decoded = await result.decode()
        record.decodeMs = Math.max(0, Math.round(performance.now() - decodeStarted))
        record.decodedMatches = serializePackedSnapshot(decoded) === ctx.packed
      }
    } catch (error) {
      record.encodeMs = Math.max(0, Math.round(performance.now() - started))
      record.error = error instanceof Error ? error.message : 'Unknown error'
    }

    records.push(record)
  }

  const payload: ExperimentReportPayload = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    brotliWasmBytes,
    fixture: {
      id: FIXTURE.id,
      label: FIXTURE.label,
      bytes: serialized.length,
    },
    experiments: records,
  }

  await fs.writeFile(outputPath, JSON.stringify(payload, null, 2), 'utf-8')
  logSummary(payload, outputPath)
}

const loadSnapshot = async (filePath: string): Promise<ProjectSnapshot> => {
  const raw = await fs.readFile(filePath, 'utf-8')
  return JSON.parse(raw) as ProjectSnapshot
}

const ensureFileFetchSupport = (): void => {
  if (typeof fetch !== 'function') {
    return
  }

  const existing = globalThis.fetch as typeof fetch & { __filePatched?: boolean }
  if (existing.__filePatched) {
    return
  }

  const patchedFetch: typeof fetch & { __filePatched?: boolean } = (async (resource: RequestInfo | URL, init?: RequestInit) => {
    const targetUrl = resource instanceof URL ? resource : typeof resource === 'string' ? safeParseUrl(resource) : null
    if (targetUrl && targetUrl.protocol === 'file:') {
      const data = await fs.readFile(targetUrl)
      return new Response(data, { status: 200, statusText: 'OK' })
    }
    return existing(resource as RequestInfo, init)
  }) as typeof fetch & { __filePatched?: boolean }

  patchedFetch.__filePatched = true
  globalThis.fetch = patchedFetch
}

const safeParseUrl = (value: string): URL | null => {
  try {
    return new URL(value)
  } catch {
    return null
  }
}

const encodeBase91 = (bytes: Uint8Array): string => {
  let b = 0
  let n = 0
  let output = ''

  for (let i = 0; i < bytes.length; i += 1) {
    b |= bytes[i] << n
    n += 8
    if (n > 13) {
      let value = b & 8191
      if (value > 88) {
        b >>= 13
        n -= 13
      } else {
        value = b & 16383
        b >>= 14
        n -= 14
      }
      output += BASE91_ALPHABET[value % 91]
      output += BASE91_ALPHABET[Math.floor(value / 91)]
    }
  }

  if (n) {
    output += BASE91_ALPHABET[b % 91]
    if (n > 7 || b > 90) {
      output += BASE91_ALPHABET[Math.floor(b / 91)]
    }
  }

  return output
}

const decodeBase91 = (input: string): Uint8Array => {
  let value = -1
  let b = 0
  let n = 0
  const output: number[] = []

  for (let i = 0; i < input.length; i += 1) {
    const charIndex = BASE91_ALPHABET.indexOf(input[i])
    if (charIndex === -1) {
      throw new Error('Invalid Base91 input')
    }
    if (value < 0) {
      value = charIndex
    } else {
      value += charIndex * 91
      b |= value << n
      n += (value & 8191) > 88 ? 13 : 14
      do {
        output.push(b & 255)
        b >>= 8
        n -= 8
      } while (n > 7)
      value = -1
    }
  }

  if (value !== -1) {
    output.push((b | (value << n)) & 255)
  }

  return Uint8Array.from(output)
}

type LzmaModule = {
  compress: (data: string | Uint8Array, mode: number, onFinish: (result: unknown) => void) => void
}

let lzmaPromise: Promise<LzmaModule> | null = null
const loadLzma = async (): Promise<LzmaModule> => {
  if (!lzmaPromise) {
    lzmaPromise = import('lzma').then((module) => (module as unknown as { default?: LzmaModule }).default ?? (module as unknown as LzmaModule))
  }
  return lzmaPromise
}

const runLzmaCompress = async (payload: string, mode: number): Promise<Uint8Array> => {
  const { compress } = await loadLzma()
  return new Promise((resolve, reject) => {
    try {
      compress(payload, mode, (result) => {
        if (result instanceof Uint8Array) {
          resolve(result)
          return
        }
        if (Array.isArray(result)) {
          resolve(Uint8Array.from(result))
          return
        }
        if (typeof result === 'string') {
          resolve(textEncoder.encode(result))
          return
        }
        reject(new Error('Unexpected LZMA compression result'))
      })
    } catch (error) {
      reject(error instanceof Error ? error : new Error('LZMA compression failed'))
    }
  })
}

type BrotliModule = {
  compress: (input: Uint8Array, options?: { quality?: number }) => Uint8Array
  decompress: (input: Uint8Array) => Uint8Array
}

let brotliModulePromise: Promise<BrotliModule> | null = null
const loadBrotliModule = async (): Promise<BrotliModule> => {
  if (!brotliModulePromise) {
    brotliModulePromise = (async () => {
      const mod = await import('brotli-wasm')
      const candidate: unknown = (mod as { default?: unknown }).default ?? mod
      return (await candidate) as BrotliModule
    })()
  }
  return brotliModulePromise
}

const measureBrotliWasmSize = async (projectRoot: string): Promise<number | null> => {
  const candidates = [
    path.join(projectRoot, 'node_modules', 'brotli-wasm', 'pkg.bundler', 'brotli_wasm_bg.wasm'),
    path.join(projectRoot, 'node_modules', 'brotli-wasm', 'pkg.web', 'brotli_wasm_bg.wasm'),
    path.join(projectRoot, 'node_modules', 'brotli-wasm', 'pkg.node', 'brotli_wasm_bg.wasm'),
  ]

  for (const candidate of candidates) {
    try {
      const stat = await fs.stat(candidate)
      if (stat.isFile()) {
        return stat.size
      }
    } catch {
      // Ignore missing files; keep scanning.
    }
  }

  return null
}

const logSummary = (payload: ExperimentReportPayload, outputPath: string): void => {
  console.log(`\n🧪 Compression experiments complete → ${outputPath}`)
  if (payload.brotliWasmBytes !== null) {
    console.log(` - brotli_wasm_bg.wasm size: ${(payload.brotliWasmBytes / 1024).toFixed(1)} KiB`)
  }
  payload.experiments.forEach((record) => {
    if (record.error) {
      console.log(` - ${record.label}: failed (${record.error})`)
      return
    }
    if (record.shareUrlChars === null) {
      console.log(` - ${record.label}: missing data`)
      return
    }
    const decodeSegment = record.decodeMs !== null ? ` / ${record.decodeMs}ms decode` : ''
    console.log(
      ` - ${record.label}: ${record.shareUrlChars.toLocaleString('en-US')} chars (${record.encodeMs}ms encode${decodeSegment})`
    )
  })
  console.log('')
}

export default runCompressionExperiments
