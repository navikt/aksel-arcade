import { describe, expect, it } from 'vitest'
import {
  collectAgentHandoffLogSecrets,
  formatAgentErrorForLog,
  redactAgentHandoffSecrets,
} from '@/services/agentHandoffRedaction'

describe('agent handoff redaction', () => {
  it('redacts copied commands, endpoints, Authorization headers, credentials, and fetched instructions', () => {
    const endpoint = 'http://127.0.0.1:48123'
    const authorizationHeader = 'Bearer copied-agent-secret'
    const command = `curl -sS -X POST '${endpoint}' -H 'Authorization: ${authorizationHeader}' -H 'Content-Type: application/json' --data '{"jsonrpc":"2.0","id":"agent-instructions-1","method":"getAgentInstructions"}'`
    const fetchedInstructions = JSON.stringify({
      endpoint,
      authorizationHeader,
      pairingCredential: 'raw-pairing-secret',
      instructionsMarkdown: `Aksel Arcade Agent pairing handoff\nEndpoint: ${endpoint}\nAuthorization: ${authorizationHeader}`,
    })

    const redacted = redactAgentHandoffSecrets(
      `Copy failed for ${command}. Fetched payload: ${fetchedInstructions}.`,
      {
        knownSecrets: [command],
      }
    )

    expect(redacted).toContain('[redacted Agent pairing handoff]')
    expect(redacted).not.toContain('[redacted]]')
    expect(redacted).not.toContain(command)
    expect(redacted).not.toContain(endpoint)
    expect(redacted).not.toContain(authorizationHeader)
    expect(redacted).not.toContain('copied-agent-secret')
    expect(redacted).not.toContain('raw-pairing-secret')
    expect(redacted).not.toContain('Aksel Arcade Agent pairing handoff')
  })

  it('formats thrown errors as redacted strings instead of passing raw Error objects to logs', () => {
    const endpoint = {
      endpoint: 'http://localhost:51234',
      sessionId: 'agent-session-1',
      authorizationHeader: 'Bearer transport-secret',
    }
    const error = new Error(
      `Transport failed for ${endpoint.endpoint} with Authorization: ${endpoint.authorizationHeader}`
    )

    const formatted = formatAgentErrorForLog(error, {
      knownSecrets: collectAgentHandoffLogSecrets({
        pairingCredential: 'transport-secret',
        transportEndpoint: endpoint,
      }),
    })

    expect(formatted).toMatch(/^Error: /)
    expect(formatted).not.toContain('[redacted]]')
    expect(formatted).not.toContain(endpoint.endpoint)
    expect(formatted).not.toContain(endpoint.authorizationHeader)
    expect(formatted).not.toContain('transport-secret')
  })
})
