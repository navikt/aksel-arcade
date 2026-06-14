import type {
  CompressionStrategyId,
  ProjectSnapshot,
  ShareUrlMetadata,
  ShareUrlOpeningIntent,
} from '@/types/project'
import {
  computeChecksum,
  LEGACY_SHARE_FORMAT_VERSION,
  SHARE_FULLSCREEN_INTENT_FORMAT_VERSION,
  SHARE_FORMAT_VERSION,
  SHARE_METADATA_VERSION,
  SHARE_URL_PARAM,
  decodeShareTokenMetadata,
  DEFAULT_COMPRESSION_STRATEGY_ID,
} from '@/utils/shareEncoding'
import { decodeSerializedPayload, getCompressionStrategy } from '@/services/compressionStrategies'
import {
  serializePackedSnapshot,
  consumePackedSnapshotRepairState,
  resetPackedSnapshotRepairState,
} from '@/utils/snapshotPacking'
import { recordShareDecodeTelemetry } from '@/services/telemetry'
import {
  extractShareUrlOpeningIntent,
  normalizeLegacyV2FullSnapshotToWebShareSnapshot,
  parseWebShareUrlPayload,
  webShareUrlPayloadToSnapshot,
} from '@/utils/sharePayload'

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
  openingIntent?: ShareUrlOpeningIntent
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

  let repairApplied = false

  try {
    const decoded = await decodeSharePayloadWithStrategy(metadata)
    repairApplied = decoded.repairApplied
    const { snapshot, checksumPayload, openingIntent } = decoded
    const computedChecksum = await computeChecksum(checksumPayload)

    if (computedChecksum !== metadata.checksum) {
      recordShareDecodeTelemetry({
        strategyId: metadata.strategyId,
        repairApplied,
        checksumValid: false,
        errorCode: 'checksum-mismatch',
      })
      return {
        metadata,
        checksumValid: false,
        error: createDecodeError('checksum-mismatch'),
      }
    }

    recordShareDecodeTelemetry({
      strategyId: metadata.strategyId,
      repairApplied,
      checksumValid: true,
    })

    return {
      metadata,
      snapshot,
      openingIntent,
      checksumValid: true,
    }
  } catch (error) {
    recordShareDecodeTelemetry({
      strategyId: metadata.strategyId,
      repairApplied,
      checksumValid: false,
      errorCode: 'decode-failed',
    })
    if (error instanceof Error && error.message === 'unknown-strategy') {
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

const decodeSnapshotWithStrategy = async (
  metadata: ShareUrlMetadata,
): Promise<{ snapshot: ProjectSnapshot; repairApplied: boolean }> => {
  const strategy = getCompressionStrategy(metadata.strategyId)
  if (!strategy) {
    throw new Error('unknown-strategy')
  }

  resetPackedSnapshotRepairState()
  const snapshot = await strategy.decode(metadata.payload)
  const repairApplied = consumePackedSnapshotRepairState()
  return { snapshot, repairApplied }
}

const decodeSharePayloadWithStrategy = async (
  metadata: ShareUrlMetadata,
): Promise<{
  snapshot: ProjectSnapshot
  checksumPayload: string
  repairApplied: boolean
  openingIntent?: ShareUrlOpeningIntent
}> => {
  if (isMinimalWebShareFormatVersion(metadata.formatVersion)) {
    const serialized = await decodeSerializedPayload(metadata.strategyId, metadata.payload)
    const payload = parseWebShareUrlPayload(serialized)
    return {
      snapshot: webShareUrlPayloadToSnapshot(payload),
      checksumPayload: serialized,
      repairApplied: false,
      openingIntent: extractShareUrlOpeningIntent(payload),
    }
  }

  const { snapshot: decodedSnapshot, repairApplied } = await decodeSnapshotWithStrategy(metadata)
  const snapshot =
    metadata.formatVersion === LEGACY_SHARE_FORMAT_VERSION
      // Temporary v2 rollout bridge: discard full-snapshot-only fields before apply.
      // Revisit removal after one release cycle per ADR 0007.
      ? normalizeLegacyV2FullSnapshotToWebShareSnapshot(decodedSnapshot)
      : decodedSnapshot

  return {
    snapshot,
    checksumPayload: getChecksumPayloadForStrategy(decodedSnapshot, metadata.strategyId),
    repairApplied,
    openingIntent: undefined,
  }
}

const getChecksumPayloadForStrategy = (
  snapshot: ProjectSnapshot,
  strategyId?: CompressionStrategyId,
): string => {
  if (usesPackedSnapshotChecksum(strategyId)) {
    return serializePackedSnapshot(snapshot)
  }
  return JSON.stringify(snapshot)
}

const usesPackedSnapshotChecksum = (strategyId?: CompressionStrategyId): boolean => {
  return typeof strategyId === 'string' && strategyId.startsWith('packed-')
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

  if (!isSupportedShareFormatVersion(version)) {
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
    warningThresholdHit: decodedMetadata.warningThresholdHit ?? false,
    warningThreshold: decodedMetadata.warningThreshold,
    charLimit: decodedMetadata.charLimit,
  }
}

const createDecodeError = (code: ShareDecodeErrorCode): ShareDecodeError => {
  switch (code) {
    case 'missing-token':
      return {
        code,
        message: 'Web share URL is missing required data. Ask the sender to regenerate the URL.',
      }
    case 'malformed-token':
      return {
        code,
        message: 'Web share URL is incomplete or corrupted. Double-check the copied URL.',
      }
    case 'unsupported-version':
      return {
        code,
        message: 'This Web share URL was created with a newer format that is not supported yet.',
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
        message: 'We could not decode this Web share URL. Please try again or request a new URL.',
      }
  }
}

const isSupportedShareFormatVersion = (version: number): boolean =>
  version === LEGACY_SHARE_FORMAT_VERSION
  || version === SHARE_FORMAT_VERSION
  || version === SHARE_FULLSCREEN_INTENT_FORMAT_VERSION

const isMinimalWebShareFormatVersion = (version: number): boolean =>
  version === SHARE_FORMAT_VERSION || version === SHARE_FULLSCREEN_INTENT_FORMAT_VERSION
