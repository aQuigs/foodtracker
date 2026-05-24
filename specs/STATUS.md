# Status

All planned milestones (M1a → M9) are implemented and up as a single linear stack of PRs. Each branch passed adversarial + simplify subagent reviews. Tests green at every branch tip; CI passing.

## Open PRs — merge bottom-up

| # | Branch → base | Milestone |
|---|---|---|
| [#2](https://github.com/aQuigs/foodtracker/pull/2) | `m1a-domain-persistence` → `main` | M1a domain + persistence |
| [#3](https://github.com/aQuigs/foodtracker/pull/3) | `m1b-ui` → `m1a-domain-persistence` | M1b UI + app wiring |
| [#4](https://github.com/aQuigs/foodtracker/pull/4) | `m2-date-navigation` → `m1b-ui` | M2 date navigation |
| [#5](https://github.com/aQuigs/foodtracker/pull/5) | `m3-custom-foods` → `m2-date-navigation` | M3 custom foods + import/export |
| [#6](https://github.com/aQuigs/foodtracker/pull/6) | `m4-multi-unit` → `m3-custom-foods` | M4 multiple units per food |
| [#11](https://github.com/aQuigs/foodtracker/pull/11) | `m5a-quick-chips` → `m4-multi-unit` | M5a quick-select amount chips |
| [#15](https://github.com/aQuigs/foodtracker/pull/15) | `m5b-per-food-chips` → `m5a-quick-chips` | M5b per-food chip overrides |
| [#7](https://github.com/aQuigs/foodtracker/pull/7) | `m6-entry-detail` → `m5b-per-food-chips` | M6 clickable entries + detail card |
| [#10](https://github.com/aQuigs/foodtracker/pull/10) | `m7-meals` → `m6-entry-detail` | M7 ordered meals per day |
| [#8](https://github.com/aQuigs/foodtracker/pull/8) | `m8-macro-chart` → `m7-meals` | M8 macro distribution chart |
| [#9](https://github.com/aQuigs/foodtracker/pull/9) | `m9-fuzzy-search` → `m8-macro-chart` | M9 typo-tolerant fuzzy search |

### Out-of-band PRs

| # | Branch → base | Purpose |
|---|---|---|
| [#13](https://github.com/aQuigs/foodtracker/pull/13) | `docs-review-consider-decisions` → `main` | ADR 0006 update: review pipeline must decide on non-mandated findings |

## Things to sign off on

- **D11 — Egg seeded as `count` (50g/unit).** All other seeds are `g`/100. So the count UI is useful out of the box. Easy to flip in `src/domain/seed.ts`.
- **D14 — M8 percent rounding** uses integer-tenths + nudge-the-largest so segments always sum to exactly 100.0. Spec was silent on the algorithm.
- **D15 — M8 chart hides when `protein + carbs + fat === 0`**, even if kcal > 0 — otherwise a kcal-but-no-macros food (rare custom case) renders an empty bar.
- **D16 — M9 fuzzy scorer** is hand-rolled subsequence match with gap penalty (no library). Score = `matchedChars − 0.1 × skippedChars`; can go negative for sparse matches. Algorithm rationale in `specs/009-fuzzy-search/spec.md`.
- **D18 — M7 meal names are positional** ("Meal 1", "Meal 2") computed from sorted-by-createdAt order. Stored `Meal.name` is kept for future rename UI.
- **D20 — M6 "Edit" on a soft-deleted food is a no-op** (not hidden). Spec was silent. Alternative: hide the button.
- **D23 — M5b schema bumps `version: 2 → 4`** (skipping v3). v3 is reserved for the parallel M7 branch (`meals[]`); skipping in M5b avoids a collision when the two milestones meet.

See [MILESTONES](./MILESTONES.md) for the milestone list and per-milestone `specs/00*/spec.md` for ACs.
