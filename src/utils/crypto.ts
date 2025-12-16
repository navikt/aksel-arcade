/**
 * Generates RFC4122 v4 UUID using Web Crypto; never falls back to Math.random.
 */
export const generateSecureUUID = (): string => {
  const cryptoObj = globalThis.crypto

  if (cryptoObj?.randomUUID) {
    return cryptoObj.randomUUID()
  }

  if (cryptoObj?.getRandomValues) {
    const bytes = new Uint8Array(16)
    cryptoObj.getRandomValues(bytes)

    // Set version (4) and variant (RFC4122)
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80

    const byteToHex = (b: number) => b.toString(16).padStart(2, '0')
    const hex = Array.from(bytes, byteToHex).join('')

    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  }

  throw new Error('Secure random generator unavailable (Web Crypto missing)')
}
