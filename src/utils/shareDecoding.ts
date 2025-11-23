import { decompressFromEncodedURIComponent } from 'lz-string'
import type { ProjectSnapshot, ShareUrlMetadata } from '@/types/project'
import {
  computeChecksum,
  SHARE_FORMAT_VERSION,
  SHARE_METADATA_VERSION,
  SHARE_URL_PARAM,
  decodeShareTokenMetadata,
  DEFAULT_COMPRESSION_STRATEGY_ID,
} from '@/utils/shareEncoding'

export type ShareDecodeErrorCode =
  | 'missing-token'
  | 'malformed-token'
  | 'unsupported-version'
  | 'checksum-mismatch'
  | 'decode-failed'

export interface ShareDecodeError {
  code: ShareDecodeErrorCode
  message: string
}

export interface ShareDecodeResult {
  metadata?: ShareUrlMetadata
  snapshot?: ProjectSnapshot
  checksumValid: boolean
  error?: ShareDecodeError
}

export const extractShareTokenFromSearch = (search: string): string | null => {
  if (!search) {
    return null
  }

  const params = new URLSearchParams(search)
  const token = params.get(SHARE_URL_PARAM)
  if (!token || !token.trim()) {
    return null
  }
  return token.trim()
}

export const getShareTokenFromLocation = (): string | null => {
  if (typeof window === 'undefined') {
    return null
  }
  return extractShareTokenFromSearch(window.location.search)
}

export const decodeShareToken = async (token: string): Promise<ShareDecodeResult> => {
  let metadata: ShareUrlMetadata
  try {
    metadata = parseShareToken(token)
  } catch (error) {
    return {
      checksumValid: false,
      error: error instanceof Error && 'code' in error
        ? (error as ShareDecodeError)
        : createDecodeError('malformed-token'),
    }
  }

  try {
    const decompressed = decompressFromEncodedURIComponent(metadata.payload)
    if (!decompressed) {
      return {
        metadata,
        checksumValid: false,
        error: createDecodeError('decode-failed'),
      }
    }

    const computedChecksum = await computeChecksum(decompressed)
    if (computedChecksum !== metadata.checksum) {
      return {
        metadata,
        checksumValid: false,
        error: createDecodeError('checksum-mismatch'),
      }
    }

    const snapshot = JSON.parse(decompressed) as ProjectSnapshot
    return {
      metadata,
      snapshot,
      checksumValid: true,
    }
  } catch (error) {
    if (error instanceof SyntaxError) {
      return {
        metadata,
        checksumValid: false,
        error: createDecodeError('decode-failed'),
      }
    }
    return {
      metadata,
      checksumValid: false,
      error: createDecodeError('decode-failed'),
    }
  }
}

export const stripShareQueryParam = (): void => {
  if (typeof window === 'undefined') {
    return
  }

  try {
    const url = new URL(window.location.href)
    if (!url.searchParams.has(SHARE_URL_PARAM)) {
      return
    }

    url.searchParams.delete(SHARE_URL_PARAM)
    const nextSearch = url.searchParams.toString()
    const nextUrl = `${url.pathname}${nextSearch ? `?${nextSearch}` : ''}${url.hash}`
    window.history.replaceState(window.history.state, document.title, nextUrl)
  } catch (error) {
    console.warn('Failed to strip share query parameter', error)
  }
}

const parseShareToken = (token: string): ShareUrlMetadata => {
  if (!token || typeof token !== 'string') {
    throw createDecodeError('missing-token')
  }

  const firstDot = token.indexOf('.')
  const secondDot = token.indexOf('.', firstDot + 1)

  if (firstDot === -1 || secondDot === -1) {
    throw createDecodeError('malformed-token')
  }

  const version = Number(token.slice(0, firstDot))
  if (!Number.isInteger(version)) {
    throw createDecodeError('malformed-token')
  }

  if (version === 1) {
    const checksum = token.slice(firstDot + 1, secondDot)
    const payload = token.slice(secondDot + 1)

    if (!checksum || !payload) {
      throw createDecodeError('malformed-token')
    }

    return {
      formatVersion: version,
      metadataVersion: 0,
      checksum,
      payload,
      strategyId: DEFAULT_COMPRESSION_STRATEGY_ID,
      warningThresholdHit: false,
    }
  }

  if (version !== SHARE_FORMAT_VERSION) {
    throw createDecodeError('unsupported-version')
  }

  const thirdDot = token.indexOf('.', secondDot + 1)
  if (thirdDot === -1) {
    throw createDecodeError('malformed-token')
  }

  const metadataSegment = token.slice(firstDot + 1, secondDot)
  const checksum = token.slice(secondDot + 1, thirdDot)
  const payload = token.slice(thirdDot + 1)

  if (!metadataSegment || !checksum || !payload) {
    throw createDecodeError('malformed-token')
  }

  let decodedMetadata
  try {
    decodedMetadata = decodeShareTokenMetadata(metadataSegment)
  } catch {
    throw createDecodeError('malformed-token')
  }

  if (decodedMetadata.metadataVersion > SHARE_METADATA_VERSION) {
    throw createDecodeError('unsupported-version')
  }

  return {
    formatVersion: version,
    metadataVersion: decodedMetadata.metadataVersion,
    checksum,
    payload,
    strategyId: decodedMetadata.strategyId,
    warningThresholdHit: decodedMetadata.warningThresholdHit,
    warningThreshold: decodedMetadata.warningThreshold,
    charLimit: decodedMetadata.charLimit,
  }
}

const createDecodeError = (code: ShareDecodeErrorCode): ShareDecodeError => {
  switch (code) {
    case 'missing-token':
      return {
        code,
        message: 'Share link is missing required data. Ask the sender to regenerate the link.',
      }
    case 'malformed-token':
      return {
        code,
        message: 'Share link is incomplete or corrupted. Double-check the copied URL.',
      }
    case 'unsupported-version':
      return {
        code,
        message: 'This share link was created with a newer format that is not supported yet.',
      }
    case 'checksum-mismatch':
      return {
        code,
        message: 'The shared data looks tampered with. Ask the sender to generate a new link.',
      }
    case 'decode-failed':
    default:
      return {
        code: 'decode-failed',
        message: 'We could not decode this share link. Please try again or request a new link.',
      }
  }
}
