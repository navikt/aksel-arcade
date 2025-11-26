/// <reference types="vite/client" />

import type { TelemetryEvent } from './services/telemetry'
import type { CompressionStrategyId, SharePayloadEnvelope } from './types/project'

interface ShareDebugConfig {
	delayMs?: number
	apologyThresholdMs?: number
}

interface ShareDebugHandle {
	forceStrategyId?: CompressionStrategyId
	currentStrategyId?: CompressionStrategyId
	lastToken?: string
	lastLink?: string
	lastEnvelope?: SharePayloadEnvelope
	warningThresholdHit?: boolean
	forceWarningThresholdHit?: boolean
	repairApplied?: boolean
}

declare global {
	interface Window {
		__AXEL_SHARE_DEBUG_CONFIG__?: ShareDebugConfig
		__AKSEL_TELEMETRY_LOG__?: TelemetryEvent[]
		__AKSEL_TELEMETRY_HOOK__?: (event: TelemetryEvent) => void
		__akselShareDebug?: ShareDebugHandle
	}
}

export {}
