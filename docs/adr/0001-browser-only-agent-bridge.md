---
status: superseded by ADR-0003
---

# Browser-only agent bridge for MVP agent access

For the first agent workflow, Aksel Arcade will expose a consent-gated browser page bridge while an agent session is active, rather than adding in-app LLM provider calls, a backend, a localhost service, an MCP connector, or a browser extension. This keeps the MVP aligned with Arcade's browser-only model, avoids provider credentials and backend privacy/cost concerns, and gives external coding agents an intentional control surface without relying on brittle DOM automation.
