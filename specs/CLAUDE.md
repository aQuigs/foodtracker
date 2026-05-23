# specs/ instructions

## Layout
- `specs/NNN-name/spec.md` — per-milestone. Add `plan.md`, `data-model.md` etc. if needed.
- `specs/decisions/NNNN-name.md` — ADRs, append-only. Don't edit closed ones; supersede instead.
- `specs/agent-handoff.md` — orientation for fresh agents.

## Naming
- Milestones: `NNN-kebab-case` (3 digits, matches M-number)
- ADRs: `NNNN-kebab-case.md` (4 digits, monotonic). Update `decisions/README.md`.

## Style
- Terse. Bullets > paragraphs.
- Written for a fresh, contextless reader. No references to "decided in chat", "review pass", or current session activity.
- ADRs: **Context / Decision / Alternatives / Consequences**. Alternatives are the highest-value part for future readers.
- Milestone `spec.md`: goal, in/out of scope, data, UI sketch (ASCII fine), acceptance.
- Don't repeat `MILESTONES.md`; link.
