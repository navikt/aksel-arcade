---
status: superseded by ADR-0005
---

# Apply-then-review agent changes

Aksel Arcade will let authorized agents apply allowed changes directly to the active Arcade project after schema and permission validation, with an automatic checkpoint captured first. We chose apply-then-review with rollback over staged proposal validation because the human already reviews the live preview, staged validation would add significant UI and runtime complexity, and rollback provides a simpler safety mechanism for the MVP.
