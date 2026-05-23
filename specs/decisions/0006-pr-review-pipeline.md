# 0006 — PR review pipeline (adversarial + simplify before user)

**Date:** 2026-05-23

## Context

The user wants every code change vetted before they see it. Two specific lenses they care about:
1. **Adversarial:** actively look for bugs, edge cases, missed requirements, security/correctness issues.
2. **Simplification:** trim cruft. Especially over-commented code and code that's more verbose than it needs to be.

## Decision

**No PR is handed to the user without both reviews coming back green and every non-mandated finding decided.**

Per code change (one PR or one milestone):

1. **Implement** following TDD ([ADR 0004](./0004-strict-tdd.md)) and the layering rules ([ADR 0005](./0005-layered-architecture.md)).
2. **Adversarial review pass** — **must be a subagent** (Agent tool, `reviewer` or `general-purpose`). Never self-review; the main agent has too much context to be adversarial. Scope: review the whole branch as if seeing it for the first time, not just the latest diff. A bug in an older file is still a bug. Brief: "find what's wrong." Look for:
   - Missing acceptance criteria
   - Edge cases (empty/null/boundary values, malformed storage blobs, race conditions)
   - Layer violations (UI touching storage, domain touching DOM)
   - Type holes / `any` leaks — especially **`Array.isArray()` narrowing to `any[]`**, untyped `as` casts at boundaries, untyped catch params
   - Platform/runtime failure modes — APIs that can throw (`localStorage.setItem` quota / private-mode, `navigator.clipboard` permission denied, `crypto.randomUUID` missing in older Safari, `JSON.parse` on huge blobs). Identify each call to a browser API and ask "what happens if this throws?"
   - Test correctness, not just test count. For every test, ask: "does this test actually exercise the path its name claims?" Common traps: `JSON.stringify({x: NaN})` produces `null`; `JSON.stringify` drops `undefined`; `deep.equal` on objects with extra properties might still pass; a test with no failing-input baseline.
   - Test gaps — features without tests, tests without assertions, etc.
   - Style/convention violations from `CLAUDE.md`
   - Anything load-bearing that isn't tested
3. **Simplify pass** — **must be a subagent** (Agent tool, or `/simplify`). Focus:
   - **Comments:** delete any that restate code. Keep only *why*-comments.
   - Dead code, unused imports, redundant variables.
   - Verbose patterns that have a one-liner.
   - Premature abstraction.
4. **Iterate to green.** Address findings, then **re-run the same review pass with a fresh subagent**. Repeat until the pass reports no BLOCKER and no SHOULD-FIX (or every SHOULD-FIX has an explicit deferral justification accepted in writing). This applies to **both** the adversarial pass and the simplify pass independently.
5. **Decide on every non-mandated finding (CONSIDER / NIT).** A green review still produces suggestions. For each one, make an explicit address-or-skip call with a one-line reason — never silently skip. Cheap, high-signal CONSIDERs (a missing test, a one-line guard, a name) should usually be addressed. Suggestions can be skipped when the existing coverage is adequate, the concern is cosmetic, or addressing it would over-engineer. Either way, the call is recorded.
6. If you disagree with a mandated finding (BLOCKER / SHOULD-FIX), raise it with the user before merging — don't unilaterally dismiss.
7. **Then** ping the user to review the PR — include the CONSIDER/NIT decisions inline in the handoff so the user can redirect if any call was wrong.

Review-pass findings stay out of the PR description — they describe internal process invisible to a future reader.

## Alternatives considered

- **Run reviews via CI** (GitHub Actions calling Claude): nicer in theory, but adds infra cost and a feedback loop measured in minutes. Local subagent passes are seconds and cheaper. Reconsider if/when the team grows.
- **Single combined "review" agent** instead of two passes: rejected — the two lenses pull in opposite directions (adversarial = "what if this breaks", simplify = "what can be cut"). Separating them gets sharper feedback.
- **Skip simplify on small PRs:** rejected — comment bloat creeps in fastest on small PRs.
- **Treat CONSIDER/NIT as fire-and-forget:** rejected — silent skipping hides judgment calls from the user. Forcing a one-line address-or-skip decision keeps the user able to redirect cheaply.

## Consequences

- Every PR has at least three sub-tasks: implement, adversarial review-to-green, simplify-to-green. Track them in `TaskCreate`.
- A green review is not the end of the loop — non-mandated findings (CONSIDER/NIT) must each get an address-or-skip decision with a one-line reason, surfaced to the user at handoff. "Both passes were green" alone is not a handoff.
- Each review pass may take multiple iterations. Expect 2-3 rounds for non-trivial milestones.
- Slower per-PR cycle (~minutes), but cleaner output and fewer round-trips with the user.
- Review-pass output is session-scoped and never lands in the PR description, commit messages, or code comments.
