# M8 — Macro distribution donut chart

## Goal
Show at-a-glance how a day's calories split across protein / carbs / fat — a small donut chart with one slice per macro, above the existing day total row.

## In scope
- Donut chart on the log view, between the entry list and the day total row.
- One slice per key in `MACRO_KEYS` (today: protein, carbs, fat). Both the slice angle and the legend percentage are share-of-macro-calories, so the slices form a complete ring and the displayed percentages sum to 100 (within rounding). The day total row's percentages (share of labelled calories) keep their existing behaviour — the two views are intentionally distinct.
- Slice colours come from `NUTRIENTS[k].sliceColor` so the chart, legend swatch, and any future macro stay in sync — adding a macro is one edit in `domain/types.ts`.
- Compact: 96px square via inline SVG `viewBox`. Renders fluidly with the surrounding flex column.
- Legend right of the ring — percentage only, e.g. "52%". Marked `aria-hidden` so screen readers read the single svg `aria-label` summary instead of the legend rows.
- Hidden entirely when no macro contributes calories (no zero ring).
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
1. With at least one logged entry whose units resolve and contribute a macro, the chart appears between the entry list and the day total row.
2. A `data-testid="macro-slice-{key}"` and `data-testid="macro-legend-{key}"` exist for every key in `MACRO_KEYS`. A macro with zero share renders an empty (zero-sweep) path so the testid stays stable; the legend row shows `0%`.
3. When only one macro is non-zero, the chart renders a complete ring (two half-arc paths) — no degenerate single-arc path.
4. Slice angles sum to a complete ring; legend percentages sum to 100 within rounding (99 / 100 / 101 acceptable).
5. Empty day, or a day on which no macro contributes calories ⇒ chart container is `hidden`; no svg visible.
6. Date change re-renders the chart against the new day's totals.
7. Soft-deleting a food that contributed to today's macros immediately updates the slices (same render path as the day total row).
8. Excluded-unit entries (those for which `entryServings` returns null) don't contribute to slices.
9. Adding a new macro to `NUTRIENTS` (i.e. a future key with `calPerGram > 0` and a `sliceColor`) automatically gets its own slice + legend row with no edits at the chart render site.
10. SVG carries `role="img"` and an `aria-label` summarising the split; the legend is `aria-hidden`.
11. Per-meal headers and the existing day-total row are unchanged.
