/// <reference types="vite/client" />

import type { TelemetryEvent } from './services/telemetry'

declare global {
	interface Window {
		__AKSEL_TELEMETRY_LOG__?: TelemetryEvent[]
		__AKSEL_TELEMETRY_HOOK__?: (event: TelemetryEvent) => void
	}
}

export {}
