const ensureBase64Padding = (input: string): string => {
  const remainder = input.length % 4
  if (remainder === 0) {
    return input
  }
  return input.padEnd(input.length + (4 - remainder), '=')
}

export const toBase64Url = (bytes: Uint8Array): string => {
  let binary = ''
  bytes.forEach(byte => {
    binary += String.fromCharCode(byte)
  })

  const base64 = typeof btoa === 'function'
    ? btoa(binary)
    : typeof Buffer !== 'undefined'
    ? Buffer.from(bytes).toString('base64')
    : ''

  if (!base64) {
    throw new Error('Base64 encoding is not supported in this environment')
  }

  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export const fromBase64Url = (value: string): Uint8Array => {
  const normalized = ensureBase64Padding(value.replace(/-/g, '+').replace(/_/g, '/'))

  if (typeof atob === 'function') {
    const binary = atob(normalized)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes
  }

  if (typeof Buffer !== 'undefined') {
    return Buffer.from(normalized, 'base64')
  }

  throw new Error('Base64 decoding is not supported in this environment')
}
