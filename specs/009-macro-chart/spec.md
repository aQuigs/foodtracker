# M8 — Macro distribution donut chart

## Goal
Show at-a-glance how a day's calories split across protein / carbs / fat — a small donut chart with one slice per macro, above the existing day total row.

## In scope
- Donut chart on the log view, between the entry list and the day total row.
- One slice per key in `MACRO_KEYS` (today: protein, carbs, fat). Slice size = that macro's share of total macro-calories (i.e. the share that already powers the existing percentages in the day total row).
- Slice colours come from the accent family in `styles.css`. No new CSS variables.
- Compact: ~96px square via inline SVG `viewBox`. Renders fluidly with the surrounding flex column.
- Label per slice (or in a legend below the ring) — percentage only, e.g. "52%".
- Hidden entirely when day total calories is 0 (no zero ring).
- Reacts to the same state that drives the day total row — date change, log, delete, soft-delete propagate automatically. One render path.
- Excluded-unit entries are not counted (same posture as day total).

## Out of scope
- Absolute gram tooltips on hover.
- A goal/target ring or rings.
- Animation / transitions.
- Per-meal charts (M-later).
- Calorie / macro goals.

## Data
No schema changes. No new domain types.

Pure render of `dailyTotals(state, selectedDate)` + `macroPctOfCalories(totals)`. Both already exist. The chart re-uses `MACRO_KEYS` for slice iteration so adding a future macro (e.g. fiber with `calPerGram > 0`) shows up automatically.

## UI sketch

```
[ entry list … ]

     ╭─ ─ ─ ─╮
   ╱           ╲
  │   ╭───╮     │       Protein 22%
  │   │   │     │       Carbs   62%
   ╲   ╲ ╱     ╱        Fat     16%
     ╰─ ─ ─ ─╯

─── Day total ───────────  760 cal · P 56g · C 61g · F 34g ───
```

- Donut svg on the left, legend on the right; stacks vertically on narrow screens (`@media (max-width: 480px)`).
- `data-testid="macro-chart"` on the container; `data-testid="macro-slice-{key}"` on each `<path>`; `data-testid="macro-legend-{key}"` on each legend row.
- Container hidden via `.hidden` attribute when totals are 0.
- `role="img"` on the SVG with an `aria-label` like `"Macro split: Protein 22%, Carbs 62%, Fat 16%"` so screen readers get a single line.

## Acceptance
1. With at least one logged entry whose units resolve, the chart appears between the entry list and the day total row.
2. Three slices render — one per key in `MACRO_KEYS` — and their angles are proportional to `macroPctOfCalories(dailyTotals(state, selectedDate))` over the macro keys.
3. Legend shows the same keys with `"{label} {N}%"` text, integer-rounded; sum of displayed integers may be 99 / 100 / 101 due to rounding — acceptable.
4. Calories on a fresh day (or after the last entry is deleted) ⇒ chart container is `hidden`; no svg visible.
5. Date change re-renders the chart against the new day's totals.
6. Soft-deleting a food that contributed to today's macros immediately updates the slices (same render path as the day total row).
7. Excluded-unit entries (those for which `entryServings` returns null) don't contribute to slices — chart agrees with `dailyTotals` exactly.
8. Adding a new macro to `NUTRIENTS` (i.e. a future key with `calPerGram > 0`) automatically gets its own slice + legend row with no edits at the chart render site.
9. SVG carries `role="img"` and a single `aria-label` summarising the split.
10. Per-meal headers and the existing day-total row are unchanged.
