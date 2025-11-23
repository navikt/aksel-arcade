/// <reference types="vite/client" />

import type { TelemetryEvent } from './services/telemetry'

interface ShareDebugConfig {
	delayMs?: number
	apologyThresholdMs?: number
}

declare global {
	interface Window {
		__AXEL_SHARE_DEBUG_CONFIG__?: ShareDebugConfig
		__AKSEL_TELEMETRY_LOG__?: TelemetryEvent[]
		__AKSEL_TELEMETRY_HOOK__?: (event: TelemetryEvent) => void
	}
}

export {}
