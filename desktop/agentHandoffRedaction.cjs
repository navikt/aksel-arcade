const getRedactedAgentErrorMessage = (error, fallback) => {
  const message = error instanceof Error ? error.message : fallback
  return redactAgentHandoffSecrets(message)
}

const redactAgentHandoffSecrets = (value) =>
  value
    .replace(/\bcurl\b(?=[^\r\n]*getAgentInstructions)[^\r\n]*/gi, '[redacted Agent pairing handoff]')
    .replace(
      /(\bauthorizationHeader["']?\s*[:=]\s*["']?)Bearer\s+[^'",}\]\s]+(["']?)/gi,
      '$1Bearer [redacted]$2'
    )
    .replace(/\bAuthorization\s*:\s*Bearer\s+[^'",\s)}\]]+/gi, 'Authorization: Bearer [redacted]')
    .replace(/\bBearer\s+(?!\[redacted\])[^'",\s)}\]]+/gi, 'Bearer [redacted]')
    .replace(
      /\bhttps?:\/\/(?:127\.0\.0\.1|localhost):\d+(?:\/[^\s'"`<>)\]]*)?/gi,
      '[redacted Agent endpoint]'
    )

module.exports = {
  getRedactedAgentErrorMessage,
  redactAgentHandoffSecrets,
}
