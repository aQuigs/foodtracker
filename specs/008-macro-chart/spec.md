# M8 — Macro distribution chart

## Goal
Give the user an at-a-glance view of how today's calories are split across protein, carbs, and fat — without having to do the math themselves. A small stacked horizontal bar sits between the totals row and the entry list on the log view.

## In scope
- New pure function `macroDistribution` in `src/domain/calc.ts`
- New UI module `src/ui/macroChart.ts` exporting `renderMacroChart`
- Chart inserted between the totals row and the entry list in the log view
- Chart hidden when total kcal is 0 (no entries for the day)
- Labels overlaid inside each segment: "Protein 45% · 720 cal"
- CSS for the stacked bar in `src/styles.css`

## Out of scope
- Goals / targets overlay
- Multi-day trend charts
- Donut variant (stacked horizontal bar chosen; reads well at narrow widths)
- Per-meal breakdown

## Data

### Calorie contribution per macro
```
protein calories = protein_g × 4
carbs calories   = carbs_g   × 4
fat calories     = fat_g     × 9
```

Note: these three values will not necessarily sum to `totals.kcal` because `kcalPer100g` is measured rather than computed from macros (database value). The chart uses the macro-derived calories only (sum of the three segments = protein_cal + carbs_cal + fat_cal, not `totals.kcal`).

### `macroDistribution(totals: Totals)`

Returns:
```ts
{
  protein: { percent: number; calories: number };
  carbs:   { percent: number; calories: number };
  fat:     { percent: number; calories: number };
}
```

- `calories` = the macro's caloric contribution (g × kcal-per-gram)
- `percent` = share of the macro-calorie total, rounded to 1 decimal place
- When `totals.kcal === 0` (or the macro-calorie total is 0), all values are `{ percent: 0, calories: 0 }`
- Percentages are forced to sum to exactly 100.0 by adding any rounding remainder to the largest segment

### Rounding strategy
Round each raw percentage to 1 decimal place, then check the sum. If it differs from 100.0 (which can happen by ±0.1 due to floating-point), add/subtract 0.1 from the segment with the largest absolute value. This keeps the display accurate without biasing a particular macro.

## UI placement

```
[totals row]
[macro chart]   ← inserted here
[entry list]
```

`renderLogView` returns `[dateNav, form, totalsRow, macroChart (or nothing), list]`. When `totals.kcal === 0`, `renderMacroChart` returns `null` and the caller skips it.

## Segment colours
| Macro   | Colour  | Hex       |
|---------|---------|-----------|
| Protein | blue    | `#4f8ce6` |
| Carbs   | orange  | `#e6a44f` |
| Fat     | purple  | `#9b6ce6` |

These colours were chosen to be visually distinct on a dark background and distinct from the existing accent (`#6ad`).

## Label format
Each segment shows its label inside the bar:

```
Protein 45.0% · 720 cal
```

Labels are hidden (via `overflow: hidden` on each segment) when the segment is too narrow to display them — no JS measurement needed, CSS handles it.

## CSS approach
- `.macro-chart` — outer container, `border-radius`, small `margin-bottom`
- `.macro-chart-bar` — flex row, `height: 1.75rem`, `overflow: hidden`, `border-radius`
- `.macro-chart-segment` — `flex: 0 0 <percent>%`, `display: flex`, `align-items: center`, `padding: 0 0.4rem`, `font-size: 0.7rem`, `overflow: hidden`, `white-space: nowrap`

## Acceptance criteria

**Domain (`macroDistribution`):**
1. Zero totals → all zeros returned
2. Protein-only day → protein 100%, carbs 0%, fat 0%
3. Carbs-only day → carbs 100%, others 0%
4. Fat-only day → fat 100%, others 0%
5. Mixed day → percentages proportional to caloric contribution; sum = 100.0
6. Rounding: inputs that produce raw percentages summing to 99.9 or 100.1 are corrected to sum to exactly 100.0

**UI (`renderMacroChart`):**
7. Returns `null` when `totals.kcal === 0`
8. Returns an `HTMLElement` with three segments when `totals.kcal > 0`
9. Segments are ordered protein → carbs → fat
10. Each segment label contains the percent and the cal count for that macro
11. Segment widths (via `style.flexBasis` or `style.width`) roughly match the expected percentages
