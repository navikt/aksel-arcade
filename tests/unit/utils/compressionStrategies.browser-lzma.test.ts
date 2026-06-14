import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('lzma/src/lzma_worker-min.js?url', () => ({
  default: '/mock-lzma-worker.js',
}))

const originalLzma = (window as Window & { LZMA?: unknown }).LZMA
type MockLzmaModule = {
  compress: (data: string | Uint8Array, mode: number, onFinish: (result: unknown) => void) => void
  decompress: (data: Uint8Array | number[], onFinish: (result: unknown) => void) => void
}

describe('compressionStrategies browser lzma worker', () => {
  beforeEach(() => {
    vi.resetModules()
    delete (window as Window & { LZMA?: unknown }).LZMA
  })

  afterEach(() => {
    if (originalLzma === undefined) {
      delete (window as Window & { LZMA?: unknown }).LZMA
      return
    }

    ;(window as Window & { LZMA?: unknown }).LZMA = originalLzma
  })

  it('uses the worker asset path for lzma payload round-trips', async () => {
    const lzmaModule: MockLzmaModule = {
      compress(data, _mode, onFinish) {
        onFinish(Array.from(new TextEncoder().encode(data as string)))
      },
      decompress(data, onFinish) {
        onFinish(new TextDecoder().decode(Uint8Array.from(data as number[])))
      },
    }
    ;(window as Window & { LZMA?: MockLzmaModule }).LZMA = lzmaModule

    const appendChildSpy = vi.spyOn(document.head, 'appendChild')

    try {
      const { getCompressionStrategy, decodeSerializedPayload } = await import('@/services/compressionStrategies')
      const strategy = getCompressionStrategy('lzma-worker-b64url')
      if (!strategy) {
        throw new Error('lzma-worker-b64url strategy missing')
      }

      const serialized = JSON.stringify({
        version: '1.0.0',
        files: [{ id: 'file-jsx', name: 'App.tsx', language: 'tsx', content: 'export default function App() { return null }', order: 0 }],
        activeFileId: 'file-jsx',
        preview: { viewport: 'MD', zoom: 1, theme: 'dark', sandboxFlags: {} },
        settings: { autosave: true, linting: true, showLineNumbers: true },
        updatedAt: Date.now(),
      })

      const encoded = await strategy.encode({ serialized })
      const decoded = await decodeSerializedPayload('lzma-worker-b64url', encoded.payload)

      expect(decoded).toBe(serialized)
      expect(appendChildSpy).not.toHaveBeenCalled()
    } finally {
      appendChildSpy.mockRestore()
    }
  })
})
