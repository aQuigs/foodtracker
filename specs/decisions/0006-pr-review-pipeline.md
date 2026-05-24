# 0006 — PR review pipeline (adversarial + simplify before user)

**Date:** 2026-05-23

## Context

Every code change is vetted before user review against two lenses:
1. **Adversarial:** actively look for bugs, edge cases, missed requirements, security/correctness issues.
2. **Simplification:** trim cruft. Especially over-commented code and code that's more verbose than it needs to be.

## Severity labels

Reviewers categorize every finding into one of four buckets. The label drives whether the leader must address it before handoff.

- **BLOCKER** — correctness, security, or layering violation. Must fix before handoff. No deferral.
- **SHOULD-FIX** — a real issue but not catastrophic. Must fix before handoff unless explicitly deferred in writing.
- **CONSIDER** — judgment call. Reasonable engineers could decide either way. Must reach an explicit address-or-skip decision (see step 5) — never silently dropped.
- **NIT** — minor / cosmetic. Same decision rule as CONSIDER, but the leader may batch-skip a group of related NITs with one summary line ("all 6 wording NITs in the spec deferred — cosmetic").

## Decision

**No PR is handed to the user without both reviews coming back green and every non-mandated finding decided.**

Per code change (one PR or one milestone):

1. **Implement** following TDD ([ADR 0004](./0004-strict-tdd.md)) and the layering rules ([ADR 0005](./0005-layered-architecture.md)).
2. **Adversarial review pass** — **must be a subagent** (Agent tool, `reviewer` or `general-purpose`). Never self-review; the main agent has too much context to be adversarial. Scope: review the whole branch as if seeing it for the first time, not just the latest diff. A bug in an older file is still a bug. Brief: "find what's wrong." See [Adversarial checklist](#adversarial-checklist) below.
3. **Simplify pass** — **must be a subagent** (Agent tool, or `/simplify`). Focus: comments that restate code, dead code, unused imports, redundant variables, verbose patterns with a one-liner, premature abstraction.
4. **Iterate to green.** Address findings, then re-run the same review pass with a fresh subagent. Repeat until the pass reports no BLOCKER and no SHOULD-FIX. SHOULD-FIX may be deferred only with an explicit written justification accepted by the user.
5. **Decide on every non-mandated finding (CONSIDER / NIT).** The **leader (main agent)** — not the subagent that produced the finding — makes an explicit address-or-skip-or-defer decision with a one-line reason. Cheap, high-signal CONSIDERs (a clearer name, an early-return rewrite) should usually be addressed. Suggestions can be skipped when the existing coverage is adequate, the concern is cosmetic, or addressing it would be over-engineering. "Defer" is allowed when the suggestion is worth doing but out of scope for this PR — record the follow-up task. NITs may be batched ("all wording NITs in spec X deferred").
6. **Resolve cross-pass conflicts.** When an adversarial CONSIDER and a simplify CONSIDER demand opposite changes (e.g. "extract this helper" vs. "inline this helper"), the leader picks one and records the conflict in the decision line.
7. **Disagreement on a mandated finding.** If the leader believes a BLOCKER or SHOULD-FIX is wrong, raise it with the user before handoff — don't unilaterally dismiss.
8. **Handoff.** Ping the user with: the green status of both passes, the CONSIDER/NIT decisions (recorded in the chat handoff — **not** in the PR description, commit messages, or code comments).

## Adversarial checklist

Things the adversarial subagent should look for:

- Missing acceptance criteria.
- Edge cases (empty/null/boundary values, malformed storage blobs, race conditions).
- Layer violations (UI touching storage, domain touching DOM).
- Type holes / `any` leaks — especially **`Array.isArray()` narrowing to `any[]`**, untyped `as` casts at boundaries, untyped catch params.
- Platform/runtime failure modes — APIs that can throw (`localStorage.setItem` quota / private-mode, `navigator.clipboard` permission denied, `crypto.randomUUID` missing in older Safari, `JSON.parse` on huge blobs). Identify each call to a browser API and ask "what happens if this throws?"
- Test correctness, not just test count. For every test, ask: "does this test actually exercise the path its name claims?" Common traps: `JSON.stringify({x: NaN})` produces `null`; `JSON.stringify` drops `undefined`; `deep.equal` on objects with extra properties might still pass; a test with no failing-input baseline.
- Test gaps — features without tests, tests without assertions, etc.
- Style/convention violations from `CLAUDE.md`.
- Anything load-bearing that isn't tested.

## Alternatives considered

- **Run reviews via CI** (GitHub Actions calling Claude): nicer in theory, but adds infra cost and a feedback loop measured in minutes. Local subagent passes are seconds and cheaper. Reconsider if/when the team grows.
- **Single combined "review" agent** instead of two passes: rejected — the two lenses pull in opposite directions (adversarial = "what if this breaks", simplify = "what can be cut"). Separating them gets sharper feedback.
- **Skip simplify on small PRs:** rejected — comment bloat creeps in fastest on small PRs.
- **Treat CONSIDER/NIT as fire-and-forget:** rejected — silent skipping hides judgment calls from the user. Forcing a one-line address-or-skip decision keeps the user able to redirect cheaply.
- **Drop NIT from the decision rule entirely:** rejected, but with concessions — NITs may be batched (one summary line for a group of cosmetic findings), so the rule scales when reviewers emit many NITs.

## Consequences

- Every PR has at least three sub-tasks: implement, adversarial review-to-green, simplify-to-green.
- Each review pass may take multiple iterations. Expect 2-3 rounds for non-trivial milestones.
- Handoff includes per-CONSIDER/NIT decisions, not just "green/green".
- Slower per-PR cycle (~minutes), but cleaner output and fewer round-trips with the user.
- All review-related artifacts (findings, decisions) live in the session, not in the PR description, commit messages, or code comments.
