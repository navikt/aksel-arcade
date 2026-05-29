---
status: superseded by ADR-0003
---

# Browser-only agent bridge for MVP agent access

This historical browser-only Agent bridge direction is no longer a Web Arcade feature. Current Aksel Arcade keeps Agent access Desktop Arcade-only through the Desktop Agent transport; Web Arcade has no Agent UI, Agent runtime initialization, browser-global Agent bridge, or Web-facing Agent pairing handoff.

For the first agent workflow, Aksel Arcade will expose a consent-gated browser page bridge while an agent session is active, rather than adding in-app LLM provider calls, a backend, a localhost service, an MCP connector, or a browser extension. This keeps the MVP aligned with Arcade's browser-only model, avoids provider credentials and backend privacy/cost concerns, and gives external coding agents an intentional control surface without relying on brittle DOM automation.
