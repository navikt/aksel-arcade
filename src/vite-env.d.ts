/// <reference types="vite/client" />

import type { TelemetryEvent } from './services/telemetry'
import type { AgentBridge } from './services/agentBridge'

declare global {
  interface Window {
    __AKSEL_TELEMETRY_LOG__?: TelemetryEvent[]
    __AKSEL_TELEMETRY_HOOK__?: (event: TelemetryEvent) => void
    __COPIED_SHARE_URL__?: string
    __AKSEL_ARCADE_AGENT_BRIDGE__?: AgentBridge
  }
}

export {}
