import type { DesktopAgentTransportEndpoint } from './desktopAgentSessionCoordinator'

const REDACTED_AGENT_PAIRING_DATA = '[redacted Agent pairing handoff]'
const REDACTED_AGENT_ENDPOINT = '[redacted Agent endpoint]'
const REDACTED_AGENT_AUTHORIZATION = 'Authorization: Bearer [redacted]'
const REDACTED_AGENT_AUTHORIZATION_VALUE = 'Bearer [redacted]'

const AGENT_PAIRING_COMMAND_PATTERN = /\bcurl\b(?=[^\r\n]*getAgentInstructions)[^\r\n]*/gi
const LOOPBACK_ENDPOINT_PATTERN =
  /\bhttps?:\/\/(?:127\.0\.0\.1|localhost):\d+(?:\/[^\s'"`<>)\]]*)?/gi
const AUTHORIZATION_HEADER_PATTERN = /\bAuthorization\s*:\s*Bearer\s+[^'",\s)}\]]+/gi
const BEARER_TOKEN_PATTERN = /\bBearer\s+(?!\[redacted\])[^'",\s)}\]]+/gi
const AUTHORIZATION_HEADER_VALUE_PATTERN =
  /(\bauthorizationHeader["']?\s*[:=]\s*["']?)Bearer\s+[^'",}\]\s]+(["']?)/gi
const PAIRING_CREDENTIAL_VALUE_PATTERN =
  /(\bpairingCredential["']?\s*[:=]\s*["']?)[^'",}\]\s]+(["']?)/gi
const INSTRUCTIONS_MARKDOWN_VALUE_PATTERN =
  /(\binstructionsMarkdown["']?\s*[:=]\s*["']?)[\s\S]*?(["']?\s*[,}])/gi

export interface AgentHandoffLogContext {
  knownSecrets?: readonly (string | null | undefined)[]
}

export const collectAgentHandoffLogSecrets = (session: {
  pairingCredential?: string
  transportEndpoint?: DesktopAgentTransportEndpoint
}): string[] => [
  session.pairingCredential,
  session.transportEndpoint?.endpoint,
  session.transportEndpoint?.authorizationHeader,
].filter(isNonEmptyString)

export const redactAgentHandoffSecrets = (
  value: string,
  context: AgentHandoffLogContext = {}
): string => {
  const withKnownSecretsRedacted = redactKnownSecrets(value, context.knownSecrets ?? [])

  return withKnownSecretsRedacted
    .replace(AGENT_PAIRING_COMMAND_PATTERN, REDACTED_AGENT_PAIRING_DATA)
    .replace(AUTHORIZATION_HEADER_VALUE_PATTERN, `$1${REDACTED_AGENT_AUTHORIZATION_VALUE}$2`)
    .replace(PAIRING_CREDENTIAL_VALUE_PATTERN, `$1${REDACTED_AGENT_PAIRING_DATA}$2`)
    .replace(INSTRUCTIONS_MARKDOWN_VALUE_PATTERN, `$1${REDACTED_AGENT_PAIRING_DATA}$2`)
    .replace(AUTHORIZATION_HEADER_PATTERN, REDACTED_AGENT_AUTHORIZATION)
    .replace(BEARER_TOKEN_PATTERN, REDACTED_AGENT_AUTHORIZATION_VALUE)
    .replace(LOOPBACK_ENDPOINT_PATTERN, REDACTED_AGENT_ENDPOINT)
}

export const formatAgentErrorForLog = (
  error: unknown,
  context: AgentHandoffLogContext = {}
): string => {
  if (error instanceof Error) {
    return redactAgentHandoffSecrets(`${error.name}: ${error.message}`, context)
  }

  if (typeof error === 'string') {
    return redactAgentHandoffSecrets(error, context)
  }

  return redactAgentHandoffSecrets(stringifyUnknownError(error), context)
}

const redactKnownSecrets = (
  value: string,
  knownSecrets: readonly (string | null | undefined)[]
): string =>
  knownSecrets.reduce(
    (redacted, secret) =>
      isNonEmptyString(secret) ? redacted.split(secret).join(REDACTED_AGENT_PAIRING_DATA) : redacted,
    value
  )

const stringifyUnknownError = (error: unknown): string => {
  try {
    const serialized = JSON.stringify(error)
    return serialized ?? String(error)
  } catch {
    return String(error)
  }
}

const isNonEmptyString = (value: string | null | undefined): value is string =>
  typeof value === 'string' && value.trim().length > 0
