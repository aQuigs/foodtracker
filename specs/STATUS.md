# Status

M1a–M9 are up as stacked PRs (M5 still in progress). Each one passed adversarial + simplify subagent reviews. All tests green at every branch tip; CI passing.

## Open PRs — merge in order

1. **[#2 — M1a domain + persistence](https://github.com/aQuigs/foodtracker/pull/2)**
2. **[#3 — M1b UI + app wiring](https://github.com/aQuigs/foodtracker/pull/3)**
3. **[#4 — M2 date navigation](https://github.com/aQuigs/foodtracker/pull/4)**
4. **[#5 — M3 custom foods + import/export](https://github.com/aQuigs/foodtracker/pull/5)**
5. **[#6 — M4 multiple units per food (g/oz/lb/count)](https://github.com/aQuigs/foodtracker/pull/6)**
6. **[#7 — M6 clickable entries with detail card](https://github.com/aQuigs/foodtracker/pull/7)**
7. **[#10 — M7 ordered meals per day](https://github.com/aQuigs/foodtracker/pull/10)**
8. **[#8 — M8 macro distribution chart](https://github.com/aQuigs/foodtracker/pull/8)**
9. **[#9 — M9 typo-tolerant fuzzy search](https://github.com/aQuigs/foodtracker/pull/9)**

M5a (quick-select chips) is pending PR. M5b (per-food chip overrides) is implemented on branch `m5b-per-food-chips`.

## Things to sign off on

- **D11 — Egg seeded as `count` (50g/unit).** All other seeds are `g`/100. So the count UI is useful out of the box. Easy to flip in `src/domain/seed.ts`.
- **D14 — M8 percent rounding** uses integer-tenths + nudge-the-largest so segments always sum to exactly 100.0. Spec was silent on the algorithm.
- **D15 — M8 chart hides when `protein + carbs + fat === 0`**, even if kcal > 0 — otherwise a kcal-but-no-macros food (rare custom case) renders an empty bar.
- **D16 — M9 fuzzy scorer** is hand-rolled subsequence match with gap penalty (no library). Score = `matchedChars − 0.1 × skippedChars`; can go negative for sparse matches. Algorithm rationale in `specs/009-fuzzy-search/spec.md`.
- **D18 — M7 meal names are positional** ("Meal 1", "Meal 2") computed from sorted-by-createdAt order. Stored `Meal.name` is kept for future rename UI.
- **D20 — M6 "Edit" on a soft-deleted food is a no-op** (not hidden). Spec was silent. Alternative: hide the button.
- **D22 — CLAUDE.md coding standards** picked up braced if-guards + blank-line rules. M4+ code follows; M1a–M3 sweep is queued.

See [MILESTONES](./MILESTONES.md) for the milestone list and per-milestone `specs/00*/spec.md` for ACs.
