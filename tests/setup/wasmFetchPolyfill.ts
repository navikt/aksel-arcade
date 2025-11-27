import fs from 'node:fs/promises'
import { brotliCompressSync, brotliDecompressSync, constants as zlibConstants } from 'node:zlib'
import { vi } from 'vitest'

const ensureNodeFileFetchSupport = (): void => {
  if (typeof fetch !== 'function') {
    return
  }
  if (typeof process === 'undefined' || !process.versions?.node) {
    return
  }

  const existing = globalThis.fetch as typeof fetch & { __filePatched?: boolean }
  if (existing.__filePatched) {
    return
  }

  const patched: typeof fetch & { __filePatched?: boolean } = (async (resource: RequestInfo | URL, init?: RequestInit) => {
    const targetUrl = resolveToUrl(resource)
    if (targetUrl?.protocol === 'file:') {
      const data = await fs.readFile(targetUrl)
      const headers = new Headers(init?.headers ?? {})
      if (!headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/wasm')
      }
      return new Response(data, { status: 200, statusText: 'OK', headers })
    }

    return existing(resource as RequestInfo, init)
  }) as typeof fetch & { __filePatched?: boolean }

  patched.__filePatched = true
  globalThis.fetch = patched
}

const resolveToUrl = (resource: RequestInfo | URL): URL | null => {
  if (resource instanceof URL) {
    return resource
  }
  if (typeof resource === 'string') {
    return safeParseUrl(resource)
  }
  if (typeof Request !== 'undefined' && resource instanceof Request) {
    return safeParseUrl(resource.url)
  }
  return null
}

const safeParseUrl = (value: string): URL | null => {
  try {
    return new URL(value)
  } catch {
    return null
  }
}

ensureNodeFileFetchSupport()

vi.mock('brotli-wasm', () => {
  const module = {
    compress: (input: Uint8Array, options?: { quality?: number }) => {
      const quality = options?.quality ?? 11
      const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input)
      const compressed = brotliCompressSync(buffer, {
        params: {
          [zlibConstants.BROTLI_PARAM_QUALITY]: quality,
        },
      })
      return new Uint8Array(compressed.buffer, compressed.byteOffset, compressed.byteLength)
    },
    decompress: (input: Uint8Array) => {
      const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input)
      const decompressed = brotliDecompressSync(buffer)
      return new Uint8Array(decompressed.buffer, decompressed.byteOffset, decompressed.byteLength)
    },
  }

  return {
    default: Promise.resolve(module),
  }
})
