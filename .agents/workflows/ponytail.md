---
name: ponytail
description: Switch ponytail intensity level (lite/full/ultra/off) or apply lazy senior dev mode
---

# Workflow: ponytail

Switch to ponytail mode. With no level specified, keep the current level, or switch on at the default level (`full`).

Levels:
- **lite**: Build what was asked. Name the smaller option in one line and let the user pick.
- **full** (default): The standard ladder. Does it need to exist (YAGNI)? Already in codebase? Standard library or platform feature? Existing dependency? One line? Write minimum code that works.
- **ultra**: Question the request: before building, push back on any part the need does not justify.
- **off**: Return to normal mode.

Follow the instructions in `.agents/skills/ponytail/SKILL.md`.
