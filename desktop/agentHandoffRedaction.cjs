const REDACTED_AGENT_PAIRING_DATA = '[redacted Agent pairing handoff]'
const REDACTED_AGENT_OPERATING_INSTRUCTIONS = '[redacted Agent operating instructions]'
const REDACTED_AGENT_ENDPOINT = '[redacted Agent endpoint]'
const REDACTED_AGENT_AUTHORIZATION = 'Authorization: Bearer [redacted]'
const REDACTED_AGENT_AUTHORIZATION_VALUE = 'Bearer [redacted]'

const AGENT_PAIRING_COMMAND_PATTERN =
  /\bcurl\b(?=[^\r\n]*getAgentInstructions)[^\r\n]*?--data\s+(?:"(?:\\.|[^"\\])*getAgentInstructions(?:\\.|[^"\\])*"|'(?:'\\''|\\.|[^'\\])*getAgentInstructions(?:'\\''|\\.|[^'\\])*'|[^\s'"`]*getAgentInstructions[^\s'"`]*)/gi
const LOOPBACK_ENDPOINT_PATTERN =
  /\bhttps?:\/\/(?:127\.0\.0\.1|localhost):\d+(?:\/[^\s'"`<>)\]]*)?/gi
const AUTHORIZATION_HEADER_PATTERN = /\bAuthorization\s*:\s*Bearer\s+[^'",\s)}\]]+/gi
const BEARER_TOKEN_PATTERN = /\bBearer\s+(?!\[redacted\])[^'",\s)}\]]+/gi
const AUTHORIZATION_HEADER_VALUE_PATTERN =
  /(\bauthorizationHeader["']?\s*[:=]\s*["']?)Bearer\s+[^'",}\]\s]+(["']?)/gi
const PAIRING_CREDENTIAL_VALUE_PATTERN =
  /(\bpairingCredential["']?\s*[:=]\s*["']?)[^'",}\]\s]+(["']?)/gi
const INSTRUCTIONS_MARKDOWN_QUOTED_VALUE_PATTERN =
  /((?:"instructionsMarkdown"|'instructionsMarkdown'|\binstructionsMarkdown\b)\s*[:=]\s*)(["'])(?:\\[\s\S]|(?!\2)[\s\S])*?\2/gi
const INSTRUCTIONS_MARKDOWN_BARE_VALUE_PATTERN =
  /((?:"instructionsMarkdown"|'instructionsMarkdown'|\binstructionsMarkdown\b)\s*[:=]\s*)(?!["'])[^,\r\n}]*/gi

const getRedactedAgentErrorMessage = (error, fallback) => {
  const message = error instanceof Error ? error.message : fallback
  return redactAgentHandoffSecrets(message)
}

const redactAgentHandoffSecrets = (value) =>
  redactAgentOperatingInstructions(value)
    .replace(AGENT_PAIRING_COMMAND_PATTERN, REDACTED_AGENT_PAIRING_DATA)
    .replace(AUTHORIZATION_HEADER_VALUE_PATTERN, `$1${REDACTED_AGENT_AUTHORIZATION_VALUE}$2`)
    .replace(PAIRING_CREDENTIAL_VALUE_PATTERN, `$1${REDACTED_AGENT_PAIRING_DATA}$2`)
    .replace(AUTHORIZATION_HEADER_PATTERN, REDACTED_AGENT_AUTHORIZATION)
    .replace(BEARER_TOKEN_PATTERN, REDACTED_AGENT_AUTHORIZATION_VALUE)
    .replace(LOOPBACK_ENDPOINT_PATTERN, REDACTED_AGENT_ENDPOINT)

const redactAgentOperatingInstructions = (value) =>
  value
    .replace(
      INSTRUCTIONS_MARKDOWN_QUOTED_VALUE_PATTERN,
      (_match, prefix, quote) => `${prefix}${quote}${REDACTED_AGENT_OPERATING_INSTRUCTIONS}${quote}`
    )
    .replace(INSTRUCTIONS_MARKDOWN_BARE_VALUE_PATTERN, `$1${REDACTED_AGENT_OPERATING_INSTRUCTIONS}`)

module.exports = {
  getRedactedAgentErrorMessage,
  redactAgentHandoffSecrets,
}
