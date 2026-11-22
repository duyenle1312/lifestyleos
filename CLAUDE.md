@AGENTS.md

## Workflow for new features

For any non-trivial feature or behavior change, follow the superpowers workflow in order:

1. **Brainstorm** — `superpowers:brainstorming` (clarify requirements, explore approaches, agree on a design).
2. **Spec** — write the agreed design to `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`.
3. **Plan** — `superpowers:writing-plans` to turn the spec into a step-by-step plan in `docs/superpowers/plans/`.
4. **Execute** — `superpowers:subagent-driven-development` to implement the plan task by task with subagents.

Small fixes (one-line changes, copy tweaks, styling nudges) can skip straight to implementation.
