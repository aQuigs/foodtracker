# 0006 — PR review pipeline (adversarial + simplify before user)

**Date:** 2026-05-23

## Context

The user wants every code change vetted before they see it. Two specific lenses they care about:
1. **Adversarial:** actively look for bugs, edge cases, missed requirements, security/correctness issues.
2. **Simplification:** trim cruft. Especially over-commented code and code that's more verbose than it needs to be.

## Decision

**No PR is handed to the user without both reviews coming back green.**

Per code change (one PR or one milestone):

1. **Implement** following TDD ([ADR 0004](./0004-strict-tdd.md)) and the layering rules ([ADR 0005](./0005-layered-architecture.md)).
2. **Adversarial review pass** — **must be a subagent** (Agent tool, `reviewer` or `general-purpose`). Never self-review; the main agent has too much context to be adversarial. Brief: "find what's wrong." Look for:
   - Missing acceptance criteria
   - Edge cases (empty/null/boundary values, malformed storage blobs, race conditions)
   - Layer violations (UI touching storage, domain touching DOM)
   - Type holes / `any` leaks
   - Test gaps — features without tests, tests without assertions, etc.
   - Style/convention violations from `CLAUDE.md`
   - Anything load-bearing that isn't tested
3. **Simplify pass** — **must be a subagent** (Agent tool, or `/simplify`). Focus:
   - **Comments:** delete any that restate code. Keep only *why*-comments.
   - Dead code, unused imports, redundant variables.
   - Verbose patterns that have a one-liner.
   - Premature abstraction.
4. **Iterate to green.** Address findings, then **re-run the same review pass with a fresh subagent**. Repeat until the pass reports no BLOCKER and no SHOULD-FIX (or every SHOULD-FIX has an explicit deferral justification accepted in writing). NITs may be deferred but should be acknowledged. This applies to **both** the adversarial pass and the simplify pass independently.
5. If you disagree with a finding, raise it with the user before merging — don't unilaterally dismiss.
6. **Then** ping the user to review the PR.

Review-pass findings stay out of the PR description — they describe internal process invisible to a future reader.

## Alternatives considered

- **Run reviews via CI** (GitHub Actions calling Claude): nicer in theory, but adds infra cost and a feedback loop measured in minutes. Local subagent passes are seconds and cheaper. Reconsider if/when the team grows.
- **Single combined "review" agent** instead of two passes: rejected — the two lenses pull in opposite directions (adversarial = "what if this breaks", simplify = "what can be cut"). Separating them gets sharper feedback.
- **Skip simplify on small PRs:** rejected — comment bloat creeps in fastest on small PRs.

## Consequences

- Every PR has at least three sub-tasks: implement, adversarial review-to-green, simplify-to-green. Track them in `TaskCreate`.
- Each review pass may take multiple iterations. Expect 2-3 rounds for non-trivial milestones.
- Slower per-PR cycle (~minutes), but cleaner output and fewer round-trips with the user.
- Review-pass output is session-scoped and never lands in the PR description, commit messages, or code comments.
