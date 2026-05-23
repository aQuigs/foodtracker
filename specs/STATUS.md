# Status

All planned milestones (M1a → M3) are up as stacked PRs, awaiting review.

## Next up after these merge

You asked for two new features. I've sketched them as M4 + M5 in [MILESTONES.md](./MILESTONES.md). Quick summary so you can sign off on scope:

- **M4 — multiple units per food.** Each food stores a `primaryUnit` (`g | oz | lb | count`) and a `weightPerUnit` (grams). Entries record `{amount, unit}` *and* the resolved grams (for safety — if a food's per-unit weight ever changes, historical entries still reconcile). Reducer + persistence schema bump to v2 with a one-way migration that defaults existing foods to grams and `weightPerUnit: 100`. UI: unit dropdown next to the amount input.
- **M5 — quick-select chips.** A row of 4-6 amount chips below the input, contextual to the selected food's unit. Defaults per unit (g: 50/100/150/200, oz: 1/2/4/8, lb: 0.25/0.5/0.75/1, count: 1/2/3/4) but overridable per food in the Foods view (deferred to M5b if too large).

Open questions worth your input before I start:
- For M4: lock primary unit per food (you pick when adding it) or let user pick freely at log time? My default: lock at add-time, override at log-time.
- For M5: are per-food chip overrides important early, or fine to ship with unit-level defaults only?
- Either of these milestones can be split into a+b like M1 was, if you want smaller PRs.

## Open PRs — stacked, review top-down, merge in order

1. **[#2 — M1a domain + persistence](https://github.com/aQuigs/foodtracker/pull/2)** — pure types, reducer, calc; LocalStorage + InMemory adapters
2. **[#3 — M1b UI + app wiring](https://github.com/aQuigs/foodtracker/pull/3)** — log foods today, persists across reloads
3. **[#4 — M2 date navigation](https://github.com/aQuigs/foodtracker/pull/4)** — view/log/delete on any date
4. **[#5 — M3 custom foods + import/export](https://github.com/aQuigs/foodtracker/pull/5)** — Foods view, soft-delete, recently-used sort, JSON backup

Tests at the tip: **203 passing, 0 failing.** Build clean. Adversarial + simplify subagent reviews both returned GREEN on every milestone before the PR went up (multiple iterations each, per ADR 0006).

## For your review

Things I decided autonomously while you were out. Each is overridable.

### Decisions

- **D1 — Stacked PRs, no auto-merge.** Per your instruction, each PR is stacked on the previous (M1b → M1a, M2 → M1b, M3 → M2) and *none* are merged. After you merge #2, GitHub will automatically retarget #3's base to `main`; same for #4 then #5. If you want me to flatten this into a single PR on `main` instead, say the word.
- **D2 — `selectedDate` is ephemeral, not persisted.** Reloads start on today. Rationale: keeps state shape stable, matches "log food" mental model. If you want persistence, it's a one-line change in M2.
- **D3 — Recently-used window is 30 days.** Foods used in the last 30 days bubble to the top of the empty-search log picker, then alphabetical. Hardcoded in `src/ui/recent.ts`. Easy to tune.
- **D4 — Soft-delete blocks logging.** UI rejects "log on a deleted food" via `parseLogIntent`, even though the reducer accepts it (pinned by M1a's test). This matches the spec note that deleted foods should "no longer appear in pickers" — they're filtered from the picker AND the parse step rejects them. If you want users to be able to log against a deleted food, drop that check in `src/ui/intents.ts`.
- **D5 — AddFood with a soft-deleted food's id is rejected.** I locked this with a test (`tests/domain/foodActions.test.ts`). Alternative would be to allow it (effectively "undelete + change"). Current behavior keeps the model conservative.
- **D6 — Duplicate-name check is case-insensitive and compares against live foods only.** So you can re-add a "Banana" after soft-deleting one. Name comparison ignores casing. See `src/ui/foodIntents.ts`.
- **D7 — Import accepts orphaned entries (entries pointing to missing foods).** They're filtered out at render but kept in storage. Comment in `src/domain/validate.ts` explains why (lets users restore older exports without surprise). If you want a stricter check, the change is a single `every` call in `parseState`.
- **D8 — Export uses clipboard *plus* a fallback textarea.** Always populates a readonly textarea; also calls `navigator.clipboard.writeText` if available, but silently swallows rejection (e.g. permission-denied). The textarea is the durable path. The spec called this out explicitly, so this matches.
- **D9 — Empty grams in food form = 0.** When adding/editing a food, blank protein/carbs/fat fields are treated as 0g/100g rather than rejected (since "water" should be allowed to have 0 protein). Required field is `name` and `kcal`. Open to flipping if you want stricter input.
- **D10 — Date input only accepts `YYYY-MM-DD`.** Clearing or typing an invalid value is silently ignored and the input snaps back. This was a BLOCKER catch in M2's adversarial review (empty date was corrupting `selectedDate`).

### Scope additions I made beyond strict spec

Per your "pragmatic — small obvious additions OK" answer:

- **A1 — Keyboard activation for food picker options.** `role="button" tabindex="0"` items now handle Enter/Space. WCAG-relevant; not in spec.
- **A2 — Foods view has its own search input** (`foodsQuery`). Spec only said "search by name" in M3's in-scope list with no explicit AC; I added the field + AC 13a so the contract is locked.
- **A3 — Clipboard handler is injectable** via `createApp({ copyToClipboard })`. Lets me test export/import without browser permissions. Default uses `navigator.clipboard.writeText`.
- **A4 — Boundary validator extracted to `src/domain/validate.ts`.** Originally inline in `localStorage.ts`; M3 imports it from both there and `importExport.ts`. One source of truth for state shape validation.

### Things I considered but didn't do

- **Skipped: "edit grams in place" on an entry.** Spec M3 explicitly says it's deferred ("workflow is delete + re-log"). I respected that.
- **Skipped: "restore soft-deleted food" UI.** Not in spec. Soft-delete is one-way for now; you can roundtrip via export/import if needed.
- **Skipped: keyboard activation on Foods-view edit/delete buttons.** Standard buttons handle Enter/Space natively; only the picker `<li>` items needed help.
- **Skipped: ARIA live-region for export-completed status.** Felt over-engineered for MVP; textarea visibility is the feedback.

### Files worth glancing at first when reviewing

| File | Why |
|---|---|
| `src/app.ts` | Composition root. Every handler lives here — the easiest place to understand the data flow |
| `src/ui/view.ts` | The full render. Largest file (~310 lines) but each section is named (`renderLogView`, `renderFoodsView`, etc.) |
| `src/domain/reducer.ts` | All state mutations in one pure function |
| `src/domain/validate.ts` | Boundary validator + WHY-comment about orphan entries |
| `specs/decisions/0006-pr-review-pipeline.md` | The loop-to-green review policy that drove the PRs |
| `specs/00*/spec.md` | Per-milestone specs with ACs |

### Test counts

| Layer | Count |
|---|---|
| Domain (types/reducer/calc/validate) | 41 |
| Persistence (localStorage/inMemory) | 18 |
| UI helpers (search/intents/date/recent/foodIntents/importExport) | 50 |
| UI render (view + dateNav.view + foodsView) | 49 |
| App integration | 45 |
| **Total** | **203** |

Two pre-existing tests I updated: M1b's "first food in picker is Oats" assertion (now matches alphabetical, since recent-usage sort falls back to alphabetical with no entries) and reducer's "deferred to M3" test name (now describes the invariant instead of forward-referencing this PR).

See [MILESTONES](./MILESTONES.md) and the per-milestone specs.
