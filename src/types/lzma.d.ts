declare module 'lzma' {
  type LzmaResult = Uint8Array | number[] | string
  type LzmaCallback = (result: LzmaResult) => void

  export function compress(data: string | Uint8Array, mode: number, onFinish: LzmaCallback, onProgress?: (percent: number) => void): void
  export function decompress(data: Uint8Array | number[], onFinish: LzmaCallback, onProgress?: (percent: number) => void): void
}
