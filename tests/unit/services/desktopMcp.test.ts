import { describe, expect, it } from 'vitest'
import { formatDesktopMcpVsCodeConfig } from '@/services/desktopMcp'

describe('desktopMcp service', () => {
  it('formats a minimal VS Code mcp.json snippet for the Desktop MCP server', () => {
    expect(formatDesktopMcpVsCodeConfig('aksel-arcade', 'http://127.0.0.1:3846/mcp')).toBe(`{
  "servers": {
    "aksel-arcade": {
      "type": "http",
      "url": "http://127.0.0.1:3846/mcp"
    }
  }
}`)
  })
})
