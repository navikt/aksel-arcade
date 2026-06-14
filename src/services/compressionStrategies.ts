import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'
import { deflateSync, inflateSync, strFromU8, strToU8 } from 'fflate'
import lzmaWorkerUrl from 'lzma/src/lzma_worker-min.js?url'
import type { ProjectSnapshot, CompressionStrategyId, ProjectFileSnapshot } from '@/types/project'
import { toBase64Url, fromBase64Url } from '@/utils/base64'
import { serializePackedSnapshot, unpackSnapshot } from '@/utils/snapshotPacking'

interface CompressionEncodeInput {
  snapshot?: ProjectSnapshot
  serialized?: string
}

export interface CompressionEncodeResult {
  payload: string
  serialized: string
  checksumSource?: string
}

export interface CompressionStrategy {
  id: CompressionStrategyId
  label: string
  estimateSize: (inputBytes: number) => number
  encode: (input: CompressionEncodeInput) => Promise<CompressionEncodeResult>
  decode: (payload: string) => Promise<ProjectSnapshot>
  avgCpuMs: { encode: number; decode: number }
  libraryCostKb: number
  lossy?: boolean
  supportsSerializedPayload: boolean
}

const BASE91_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!#$%&()*+,./:;<=>?@[]^_`{|}~\"'"
const BASE91_LOOKUP: Record<string, number> = {}
for (let i = 0; i < BASE91_ALPHABET.length; i += 1) {
  BASE91_LOOKUP[BASE91_ALPHABET[i]] = i
}

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

const strategyRegistry: Record<CompressionStrategyId, CompressionStrategy> = {
  'lz-string-uri': {
    id: 'lz-string-uri',
    label: 'LZ-String URI encode',
    estimateSize: (bytes) => Math.ceil(bytes * 0.65) + 120,
    encode: async (input) => {
      const serialized = ensureSerialized(input)
      const payload = compressToEncodedURIComponent(serialized)
      return { payload, serialized }
    },
    decode: async (payload) => {
      const json = decompressFromEncodedURIComponent(payload)
      if (!json) {
        throw new Error('Failed to decode LZ-String payload')
      }
      return parseSnapshot(json)
    },
    avgCpuMs: { encode: 5, decode: 3 },
    libraryCostKb: 3,
    supportsSerializedPayload: true,
  },
  'fflate-deflate-b91': {
    id: 'fflate-deflate-b91',
    label: 'Deflate + Base91',
    estimateSize: (bytes) => Math.ceil(bytes * 0.82) + 120,
    encode: async (input) => {
      const serialized = ensureSerialized(input)
      const compressed = deflateSync(strToU8(serialized, true), { level: 6 })
      const payload = encodeBase91(compressed)
      return { payload, serialized }
    },
    decode: async (payload) => {
      const compressed = decodeBase91(payload)
      const json = strFromU8(inflateSync(compressed), true)
      return parseSnapshot(json)
    },
    avgCpuMs: { encode: 7, decode: 5 },
    libraryCostKb: 6,
    supportsSerializedPayload: true,
  },
  'lzma-worker-b64url': {
    id: 'lzma-worker-b64url',
    label: 'LZMA (mode 3) + Base64url',
    estimateSize: (bytes) => Math.ceil(bytes * 0.48) + 120,
    encode: async (input) => {
      const serialized = ensureSerialized(input)
      const compressed = await runLzmaCompress(serialized)
      const payload = toBase64Url(compressed)
      return { payload, serialized }
    },
    decode: async (payload) => {
      const bytes = fromBase64Url(payload)
      const json = await runLzmaDecompress(bytes)
      return parseSnapshot(json)
    },
    avgCpuMs: { encode: 20, decode: 12 },
    libraryCostKb: 28,
    supportsSerializedPayload: true,
  },
  'brotli-wasm-b64url': {
    id: 'brotli-wasm-b64url',
    label: 'Brotli WASM (q4) + Base64url',
    estimateSize: (bytes) => Math.ceil(bytes * 0.5) + 110,
    encode: async (input) => {
      const serialized = ensureSerialized(input)
      const module = await loadBrotliModule()
      const compressed = module.compress(textEncoder.encode(serialized), { quality: 4 })
      const payload = toBase64Url(compressed)
      return { payload, serialized }
    },
    decode: async (payload) => {
      const module = await loadBrotliModule()
      const bytes = fromBase64Url(payload)
      const json = textDecoder.decode(module.decompress(bytes))
      return parseSnapshot(json)
    },
    avgCpuMs: { encode: 12, decode: 9 },
    libraryCostKb: 30,
    supportsSerializedPayload: true,
  },
  'ast-minify-lz-string': {
    id: 'ast-minify-lz-string',
    label: 'Whitespace-trim + LZ-String',
    estimateSize: (bytes) => {
      const minified = Math.ceil(bytes * 0.88)
      return Math.ceil(minified * 0.62) + 120
    },
    encode: async (input) => {
      const minifiedSnapshot = minifySnapshot(ensureSnapshot(input))
      const serialized = JSON.stringify(minifiedSnapshot)
      const payload = compressToEncodedURIComponent(serialized)
      return { payload, serialized }
    },
    decode: async (payload) => {
      const json = decompressFromEncodedURIComponent(payload)
      if (!json) {
        throw new Error('Failed to decode minified payload')
      }
      return parseSnapshot(json)
    },
    avgCpuMs: { encode: 9, decode: 4 },
    libraryCostKb: 4,
    lossy: true,
    supportsSerializedPayload: false,
  },
  'packed-deflate-b91': {
    id: 'packed-deflate-b91',
    label: 'Snapshot pack + Deflate + Base91',
    estimateSize: (bytes) => Math.ceil(bytes * 0.7) + 120,
    encode: async (input) => {
      const serialized = ensureSerialized(input)
      const packed = serializePackedSnapshot(ensureSnapshot(input))
      const compressed = deflateSync(strToU8(packed, true), { level: 9 })
      const payload = encodeBase91(compressed)
      return { payload, serialized, checksumSource: packed }
    },
    decode: async (payload) => {
      const compressed = decodeBase91(payload)
      const packed = strFromU8(inflateSync(compressed), true)
      return unpackSnapshot(packed)
    },
    avgCpuMs: { encode: 13, decode: 8 },
    libraryCostKb: 9,
    supportsSerializedPayload: false,
  },
  'packed-brotli-q11-b91': {
    id: 'packed-brotli-q11-b91',
    label: 'Snapshot pack + Brotli (q11) + Base91',
    estimateSize: (bytes) => Math.ceil(bytes * 0.5) + 120,
    encode: async (input) => {
      const serialized = ensureSerialized(input)
      const packed = serializePackedSnapshot(ensureSnapshot(input))
      const module = await loadBrotliModule()
      const compressed = module.compress(textEncoder.encode(packed), { quality: 11 })
      const payload = encodeBase91(compressed)
      return { payload, serialized, checksumSource: packed }
    },
    decode: async (payload) => {
      const module = await loadBrotliModule()
      const bytes = decodeBase91(payload)
      const packed = textDecoder.decode(module.decompress(bytes))
      return unpackSnapshot(packed)
    },
    avgCpuMs: { encode: 15, decode: 6 },
    libraryCostKb: 1032,
    supportsSerializedPayload: false,
  },
  'packed-brotli-q11-b64url': {
    id: 'packed-brotli-q11-b64url',
    label: 'Snapshot pack + Brotli (q11) + Base64url',
    estimateSize: (bytes) => Math.ceil(bytes * 0.4) + 85,
    encode: async (input) => {
      const serialized = ensureSerialized(input)
      const packed = serializePackedSnapshot(ensureSnapshot(input))
      const module = await loadBrotliModule()
      const compressed = module.compress(textEncoder.encode(packed), { quality: 11 })
      const payload = toBase64Url(compressed)
      return { payload, serialized, checksumSource: packed }
    },
    decode: async (payload) => {
      const module = await loadBrotliModule()
      const bytes = fromBase64Url(payload)
      const packed = textDecoder.decode(module.decompress(bytes))
      return unpackSnapshot(packed)
    },
    avgCpuMs: { encode: 15, decode: 6 },
    libraryCostKb: 1032,
    supportsSerializedPayload: false,
  },
}

export const listCompressionStrategies = (): CompressionStrategy[] => {
  return Object.values(strategyRegistry)
}

export const getCompressionStrategy = (id: CompressionStrategyId): CompressionStrategy | undefined => {
  return strategyRegistry[id]
}

export const isSharePayloadCompressionStrategy = (strategy: CompressionStrategy): boolean =>
  strategy.supportsSerializedPayload

export const decodeSerializedPayload = async (
  strategyId: CompressionStrategyId,
  payload: string
): Promise<string> => {
  switch (strategyId) {
    case 'lz-string-uri': {
      const json = decompressFromEncodedURIComponent(payload)
      if (!json) {
        throw new Error('Failed to decode LZ-String payload')
      }
      return json
    }
    case 'fflate-deflate-b91': {
      const compressed = decodeBase91(payload)
      return strFromU8(inflateSync(compressed), true)
    }
    case 'lzma-worker-b64url': {
      const bytes = fromBase64Url(payload)
      return runLzmaDecompress(bytes)
    }
    case 'brotli-wasm-b64url': {
      const module = await loadBrotliModule()
      const bytes = fromBase64Url(payload)
      return textDecoder.decode(module.decompress(bytes))
    }
    default:
      throw new Error('unknown-strategy')
  }
}

const ensureSerialized = (input: CompressionEncodeInput): string => {
  if (input.serialized) {
    return input.serialized
  }
  return JSON.stringify(ensureSnapshot(input))
}

const ensureSnapshot = (input: CompressionEncodeInput): ProjectSnapshot => {
  if (!input.snapshot) {
    throw new Error('Project snapshot is required for this compression strategy')
  }
  return input.snapshot
}

const parseSnapshot = (json: string): ProjectSnapshot => {
  return JSON.parse(json) as ProjectSnapshot
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
    const char = BASE91_LOOKUP[input[i]]
    if (char === undefined) {
      throw new Error('Invalid Base91 input')
    }
    if (value < 0) {
      value = char
    } else {
      value += char * 91
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
  compress: (
    data: string | Uint8Array,
    mode: number,
    onFinish: (result: unknown, error?: unknown) => void,
    onProgress?: (percent: number) => void
  ) => void
  decompress: (
    data: Uint8Array | number[],
    onFinish: (result: unknown, error?: unknown) => void,
    onProgress?: (percent: number) => void
  ) => void
  worker?: () => Worker | null
}

let lzmaPromise: Promise<LzmaModule> | null = null
let browserLzmaModulePromise: Promise<LzmaModule> | null = null
const loadLzma = async (): Promise<LzmaModule> => {
  if (!lzmaPromise) {
    lzmaPromise = shouldUseBrowserLzmaLoader()
      ? loadBrowserLzma()
      : loadNodeLzma()
  }
  return lzmaPromise
}

const shouldUseBrowserLzmaLoader = (): boolean => {
  if (getBrowserLzmaModule()) {
    return true
  }

  return typeof window !== 'undefined' && typeof document !== 'undefined' && !isNodeLikeEnvironment()
}

const isNodeLikeEnvironment = (): boolean => {
  return typeof process !== 'undefined' && Boolean(process.versions?.node)
}

const getBrowserLzmaModule = (): LzmaModule | null => {
  if (typeof window === 'undefined') {
    return null
  }

  const candidate = (window as Window & { LZMA?: unknown }).LZMA
  if (
    candidate &&
    typeof candidate === 'object' &&
    typeof (candidate as LzmaModule).compress === 'function' &&
    typeof (candidate as LzmaModule).decompress === 'function'
  ) {
    return candidate as LzmaModule
  }

  return null
}

const loadBrowserLzma = async (): Promise<LzmaModule> => {
  const existingModule = getBrowserLzmaModule()
  if (existingModule) {
    return existingModule
  }

  if (!browserLzmaModulePromise) {
    browserLzmaModulePromise = new Promise((resolve, reject) => {
      const head = document.head ?? document.getElementsByTagName('head')[0]
      if (!head) {
        reject(new Error('Document head is unavailable for LZMA loader'))
        return
      }

      const script = document.createElement('script')
      script.src = lzmaWorkerUrl
      script.async = true
      script.onload = () => {
        const loadedModule = getBrowserLzmaModule()
        if (!loadedModule) {
          browserLzmaModulePromise = null
          reject(new Error('Browser LZMA script did not expose window.LZMA'))
          return
        }
        resolve(loadedModule)
      }
      script.onerror = () => {
        browserLzmaModulePromise = null
        reject(new Error('Failed to load browser LZMA script'))
      }

      head.appendChild(script)
    })
  }

  return browserLzmaModulePromise
}

const loadNodeLzma = async (): Promise<LzmaModule> => {
  const lzmaSpecifier = 'lzma'
  const module = await import(/* @vite-ignore */ lzmaSpecifier)
  return ((module as { default?: unknown }).default ?? module) as LzmaModule
}

const runLzmaCompress = async (serialized: string): Promise<Uint8Array> => {
  const { compress } = await loadLzma()
  return new Promise((resolve, reject) => {
    try {
      compress(serialized, 3, (result, error) => {
        if (error) {
          reject(error instanceof Error ? error : new Error(String(error)))
          return
        }
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

const runLzmaDecompress = async (bytes: Uint8Array): Promise<string> => {
  const { decompress } = await loadLzma()
  return new Promise((resolve, reject) => {
    try {
      decompress(Array.from(bytes), (result, error) => {
        if (error) {
          reject(error instanceof Error ? error : new Error(String(error)))
          return
        }
        if (typeof result === 'string') {
          resolve(result)
          return
        }
        if (Array.isArray(result) || result instanceof Uint8Array) {
          const buffer = result instanceof Uint8Array ? result : Uint8Array.from(result)
          resolve(textDecoder.decode(buffer))
          return
        }
        reject(new Error('Unexpected LZMA decompression result'))
      })
    } catch (error) {
      reject(error instanceof Error ? error : new Error('LZMA decompression failed'))
    }
  })
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

type BrotliModule = {
  compress: (input: Uint8Array, options?: { quality?: number }) => Uint8Array
  decompress: (input: Uint8Array) => Uint8Array
}

const minifySnapshot = (snapshot: ProjectSnapshot): ProjectSnapshot => {
  const files = snapshot.files.map((file) => ({
    ...file,
    content: minifyFileContent(file),
  }))

  return {
    ...snapshot,
    files,
  }
}

const minifyFileContent = (file: ProjectFileSnapshot): string => {
  const trimmed = file.content.split('\n').map((line) => line.trimEnd())
  const result: string[] = []
  for (const line of trimmed) {
    if (line === '' && result[result.length - 1] === '') {
      continue
    }
    result.push(line)
  }
  return result.join('\n')
}
