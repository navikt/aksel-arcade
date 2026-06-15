import { compressToEncodedURIComponent } from 'lz-string'
import type {
  CompressionStrategyId,
  Project,
  ProjectSnapshot,
  SharePayloadEnvelope,
  ShareUrlOpeningIntent,
} from '@/types/project'
import { fromBase64Url, toBase64Url } from '@/utils/base64'
import {
  createLegacyWebShareUrlPayload,
  createWebShareUrlPayload,
  serializeLegacyWebShareUrlPayload,
  serializeWebShareUrlPayload,
} from '@/utils/sharePayload'

export const SHARE_URL_PARAM = 'share'
export const SHARE_URL_WARNING_THRESHOLD = 3600
export const SHARE_URL_CHAR_LIMIT = 4000
export const LEGACY_SHARE_FORMAT_VERSION = 2
export const LEGACY_MINIMAL_SHARE_FORMAT_VERSION = 3
export const LEGACY_MINIMAL_SHARE_FULLSCREEN_INTENT_FORMAT_VERSION = 4
export const SHARE_FORMAT_VERSION = 5
export const SHARE_FULLSCREEN_INTENT_FORMAT_VERSION = 6
export const SHARE_METADATA_VERSION = 1
export const SHARE_URL_ESTIMATE_MULTIPLIER = 1.4
export const DEFAULT_COMPRESSION_STRATEGY_ID: CompressionStrategyId = 'lz-string-uri'

const SHARE_TOKEN_PLACEHOLDER = '__SHARE_TOKEN__'

interface EncodeOptions {
  formatVersion?: number
  serialized?: string
  checksum?: string
  checksumSource?: string
  strategyId?: CompressionStrategyId
  warningThresholdHit?: boolean
  warningThreshold?: number
  charLimit?: number
  metadataVersion?: number
  compressed?: string
  openingIntent?: ShareUrlOpeningIntent
  previewTheme?: ProjectSnapshot['preview']['theme']
}

interface ShareTokenMetadataPayloadWire {
  v: number
  s: CompressionStrategyId
  w?: 0 | 1
  t?: number
  c?: number
}

export interface ShareTokenMetadata {
  metadataVersion: number
  strategyId: CompressionStrategyId
  warningThresholdHit?: boolean
  warningThreshold?: number
  charLimit?: number
}

const DEFAULT_TOKEN_METADATA: ShareTokenMetadata = {
  metadataVersion: SHARE_METADATA_VERSION,
  strategyId: DEFAULT_COMPRESSION_STRATEGY_ID,
  warningThresholdHit: false,
  warningThreshold: SHARE_URL_WARNING_THRESHOLD,
  charLimit: SHARE_URL_CHAR_LIMIT,
}

const CHECKSUM_PLACEHOLDER = createChecksumPlaceholder()
const METADATA_PLACEHOLDER = encodeShareTokenMetadata(DEFAULT_TOKEN_METADATA, {
  includeShareUiMetadata: false,
})
export const SHARE_TOKEN_FIXED_OVERHEAD = `${SHARE_FORMAT_VERSION}.${METADATA_PLACEHOLDER}.`.length + CHECKSUM_PLACEHOLDER.length

export const serializeSnapshot = (snapshot: ProjectSnapshot): string => {
  return JSON.stringify(snapshot)
}

export const serializeSharePayload = (
  source: ProjectSnapshot | Project,
  options?: {
    openingIntent?: ShareUrlOpeningIntent
    previewTheme?: ProjectSnapshot['preview']['theme']
  }
): string =>
  isProjectSnapshot(source)
    ? serializeLegacyWebShareUrlPayload(createLegacyWebShareUrlPayload(source, options))
    : serializeWebShareUrlPayload(
        createWebShareUrlPayload(source, {
          theme: options?.previewTheme ?? 'dark',
          openingIntent: options?.openingIntent,
        })
      )

export const computeChecksum = async (payload: string): Promise<string> => {
  const encoder = new TextEncoder()
  const data = encoder.encode(payload)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return toBase64Url(new Uint8Array(digest))
}

export const encodeSharePayload = async (
  source: ProjectSnapshot | Project,
  options?: EncodeOptions
): Promise<SharePayloadEnvelope> => {
  const formatVersion = options?.formatVersion
    ?? (
      isProjectSnapshot(source)
        ? (
            options?.openingIntent?.previewFullscreen
              ? LEGACY_MINIMAL_SHARE_FULLSCREEN_INTENT_FORMAT_VERSION
              : LEGACY_MINIMAL_SHARE_FORMAT_VERSION
          )
        : (
            options?.openingIntent?.previewFullscreen
              ? SHARE_FULLSCREEN_INTENT_FORMAT_VERSION
              : SHARE_FORMAT_VERSION
          )
    )
  const json = options?.serialized ?? (
    formatVersion === LEGACY_SHARE_FORMAT_VERSION
      ? serializeSnapshot(assertProjectSnapshot(source))
      : serializeSharePayload(source, {
          openingIntent: options?.openingIntent,
          previewTheme: options?.previewTheme,
        })
  )
  const checksumPayload = options?.checksumSource ?? json
  const checksum = options?.checksum ?? (await computeChecksum(checksumPayload))
  const compressed = options?.compressed ?? compressToEncodedURIComponent(json)

  return {
    formatVersion,
    metadataVersion: options?.metadataVersion ?? SHARE_METADATA_VERSION,
    checksum,
    compressed,
    approxBytes: compressed.length,
    strategyId: options?.strategyId ?? DEFAULT_COMPRESSION_STRATEGY_ID,
    warningThresholdHit: options?.warningThresholdHit ?? false,
    warningThreshold: options?.warningThreshold ?? SHARE_URL_WARNING_THRESHOLD,
    charLimit: options?.charLimit ?? SHARE_URL_CHAR_LIMIT,
  }
}

export const createShareToken = (envelope: SharePayloadEnvelope): string => {
  const includeShareUiMetadata = envelope.formatVersion === LEGACY_SHARE_FORMAT_VERSION
  const metadataSegment = encodeShareTokenMetadata(
    {
      metadataVersion: envelope.metadataVersion,
      strategyId: envelope.strategyId,
      warningThresholdHit: envelope.warningThresholdHit,
      warningThreshold: envelope.warningThreshold,
      charLimit: envelope.charLimit,
    },
    { includeShareUiMetadata },
  )

  return `${envelope.formatVersion}.${metadataSegment}.${envelope.checksum}.${envelope.compressed}`
}

export const buildShareUrl = (token: string, baseUrl?: string): string => {
  const fallback = typeof window !== 'undefined' ? window.location.href : 'http://localhost:5173/'
  const url = new URL(baseUrl ?? fallback)
  url.searchParams.set(SHARE_URL_PARAM, token)
  return url.toString()
}

export const estimateShareUrlLength = (serializedLength: number, baseUrl?: string): number => {
  const estimatedPayload = Math.ceil(Math.max(0, serializedLength) * SHARE_URL_ESTIMATE_MULTIPLIER)
  return estimateShareUrlLengthFromPayload(estimatedPayload, baseUrl)
}

export const estimateShareUrlLengthFromPayload = (payloadLength: number, baseUrl?: string): number => {
  const sampleUrl = buildShareUrl(SHARE_TOKEN_PLACEHOLDER, baseUrl)
  const encodedPlaceholder = encodeURIComponent(SHARE_TOKEN_PLACEHOLDER)
  const placeholderIndex = sampleUrl.indexOf(encodedPlaceholder)
  const baseLength = placeholderIndex === -1 ? sampleUrl.length : sampleUrl.length - encodedPlaceholder.length
  const normalizedPayload = Math.max(0, payloadLength)
  return baseLength + SHARE_TOKEN_FIXED_OVERHEAD + normalizedPayload
}

export const decodeShareTokenMetadata = (segment: string): ShareTokenMetadata => {
  if (!segment) {
    throw new Error('Missing share token metadata segment')
  }

  try {
    const bytes = fromBase64Url(segment)
    const decoded = new TextDecoder().decode(bytes)
    const payload = JSON.parse(decoded) as Partial<ShareTokenMetadataPayloadWire>

    if (
      typeof payload?.v !== 'number' ||
      typeof payload?.s !== 'string' ||
      (payload.w !== undefined && payload.w !== 0 && payload.w !== 1) ||
      (payload.t !== undefined && typeof payload.t !== 'number') ||
      (payload.c !== undefined && typeof payload.c !== 'number')
    ) {
      throw new Error('Invalid share token metadata payload')
    }

    return {
      metadataVersion: payload.v,
      strategyId: payload.s as CompressionStrategyId,
      warningThresholdHit: payload.w === undefined ? undefined : payload.w === 1,
      warningThreshold: payload.t,
      charLimit: payload.c,
    }
  } catch {
    throw new Error('Failed to decode share token metadata')
  }
}

function encodeShareTokenMetadata(
  metadata: ShareTokenMetadata,
  options?: { includeShareUiMetadata?: boolean }
): string {
  const payload: ShareTokenMetadataPayloadWire = {
    v: metadata.metadataVersion,
    s: metadata.strategyId,
  }

  if (options?.includeShareUiMetadata) {
    payload.w = metadata.warningThresholdHit ? 1 : 0
    payload.t = metadata.warningThreshold ?? SHARE_URL_WARNING_THRESHOLD
    payload.c = metadata.charLimit ?? SHARE_URL_CHAR_LIMIT
  }

  const bytes = new TextEncoder().encode(JSON.stringify(payload))
  return toBase64Url(bytes)
}

function createChecksumPlaceholder(): string {
  return toBase64Url(new Uint8Array(32))
}

const isProjectSnapshot = (value: ProjectSnapshot | Project): value is ProjectSnapshot =>
  'files' in value

const assertProjectSnapshot = (value: ProjectSnapshot | Project): ProjectSnapshot => {
  if (!isProjectSnapshot(value)) {
    throw new Error('Legacy Web share URL generation requires a project snapshot')
  }

  return value
}
