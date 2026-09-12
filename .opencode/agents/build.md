---
description: Build is the project's sole modifying/orchestrating primary agent. Override applied to restrict Build's Task-tool delegation to the project's useful subagents: the built-in Explore (read-only research), the project-specific Reviewer (read-only diff + AGENTS.md compliance), and the project-specific Tester (validation-only commands). All other subagents (general, scout, compaction, title, summary, ...) are denied and removed from the Task tool's description.
mode: primary
permission:
  task:
    "*": deny
    "explore": allow
    "reviewer": allow
    "tester": allow
---
