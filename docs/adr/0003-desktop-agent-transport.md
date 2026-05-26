---
status: accepted
---

# Desktop Agent transport for agent-enabled Arcade

Aksel Arcade will keep Web Arcade and Desktop Arcade on the same Arcade project model and workspace UX, but Agent sessions are Desktop Arcade-only. Desktop Arcade will expose the existing Agent bridge commands through a swappable same-device Agent transport, with short-lived loopback HTTP JSON-RPC and an Agent pairing credential as the first adapter; Web Arcade will not show Agent UI or initialize Agent runtime. The Desktop Arcade renderer stays browser-like with desktop capabilities exposed only through narrow preload IPC, so Electron owns local agent connectivity without giving the React app broad Node access; this supersedes the browser-only bridge while preserving ADR-0002's apply-then-review Checkpoint model and keeping Export/Import packages as the cross-shell sharing path.
