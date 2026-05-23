# 0006 — PR review pipeline (adversarial + simplify before user)

**Date:** 2026-05-23

## Context

The user wants every code change vetted before they see it. Two specific lenses they care about:
1. **Adversarial:** actively look for bugs, edge cases, missed requirements, security/correctness issues.
2. **Simplification:** trim cruft. Especially over-commented code and code that's more verbose than it needs to be.

## Decision

**No PR is handed to the user without going through both reviews first.**

Per code change (one PR or one milestone):

1. **Implement** following TDD ([ADR 0004](./0004-strict-tdd.md)) and the layering rules ([ADR 0005](./0005-layered-architecture.md)).
2. **Adversarial review pass** — launch a subagent (Agent tool with `reviewer` or `general-purpose`) with an explicit "find what's wrong" brief. Look for:
   - Missing acceptance criteria
   - Edge cases (empty/null/boundary values, malformed storage blobs, race conditions)
   - Layer violations (UI touching storage, domain touching DOM)
   - Type holes / `any` leaks
   - Test gaps — features without tests, tests without assertions, etc.
   - Style/convention violations from `CLAUDE.md`
   - Anything load-bearing that isn't tested
3. **Simplify pass** — invoke `/simplify` (or equivalent subagent) with focus on:
   - **Comments:** delete any that restate code. Keep only *why*-comments.
   - Dead code, unused imports, redundant variables.
   - Verbose patterns that have a one-liner.
   - Premature abstraction.
4. **Address findings** from both passes. If any disagreement, note it in the PR description.
5. **Then** ping the user to review the PR.

## Alternatives considered

- **Run reviews via CI** (GitHub Actions calling Claude): nicer in theory, but adds infra cost and a feedback loop measured in minutes. Local subagent passes are seconds and cheaper. Reconsider if/when the team grows.
- **Single combined "review" agent** instead of two passes: rejected — the two lenses pull in opposite directions (adversarial = "what if this breaks", simplify = "what can be cut"). Separating them gets sharper feedback.
- **Skip simplify on small PRs:** rejected — comment bloat creeps in fastest on small PRs.

## Consequences

- Every PR has at least three sub-tasks: implement, adversarial review, simplify. Track them in `TaskCreate`.
- PR description should briefly note what each pass flagged and how it was addressed.
- Slower per-PR cycle (~minutes), but cleaner output and fewer round-trips with the user.
- If a review subagent flags something the implementer disagrees with, document the disagreement in the PR rather than silently ignoring it.
