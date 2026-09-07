# M14 — Trends

## Goal
See how intake moves over time. A Trends tab plots the log as one stacked bar per day — calories from protein, carbs and fat — over the last week, month, quarter or year, with a readout of grams, calories and share of calories for any bar the user taps. Rationale: [ADR 0010](../decisions/0010-trend-charts.md).

## In scope
- Trends tab (`Log · Foods · Catalog · Trends`). On it: a range toggle, the chart card, a readout card. The app header wraps, so the tab strip drops under the title on a phone instead of squeezing it.
- Range toggle `7d | 30d | 90d | 1y`, a button group from the factory (`ui/toggleGroup.ts`) the unit pickers are also built on. Default 30d. Transient view state: a tab change resets it, like every other tab's controls.
- Series: one bucket per day for 7d / 30d; one per trailing 7-day block for 90d (13) and 1y (52). The newest bucket always ends on today. A bucket's value is the per-day mean over its logged days; a bucket with no logged day is a gap (no bar), never a zero. Today counts like any other day.
- Chart: one stacked bar per bucket, one segment per `MACRO_KEYS` in calories (grams × calories per gram, so a gram of fat stands 9/4 as tall as a gram of protein or carbs), coloured by `NUTRIENTS[k].sliceColor`, bottom-to-top in `MACRO_KEYS` order. A caption above the plot says what it shows — `Calories per day from protein, carbs and fat` — and a legend below names the segments. A macro added to `NUTRIENTS` gets a segment, a legend row and a readout row with no chart edit.
- The stack is the macros at 4 / 4 / 9 calories per gram. A day's listed calories — what the Log tab totals — can differ from that by a few percent for catalog foods, whose listed calories use per-food factors. The readout shows both, so every number is exact where it is read.
- Axes: y from zero with at most four round intervals and recessive gridlines, labelled in muted text; x labels the last bucket and every k-th before it, as many as the measured plot width can space out (never more than six), as `Sep 5` (a week bucket is labelled by its first day).
- Selection: tapping a bar's column (full plot height, the whole slot width) selects the bucket and outlines its stack. The readout card shows a heading — `Sat, Sep 5` for a day, `Aug 30 – Sep 5 · 5 of 7 days logged` for a week — then a table: one row per macro with grams, calories and share of the day's calories (`113.5 g · 454 cal · 33%`, the share as the entry detail card computes it), and a total row with the day's listed calories (`1365 cal`). Default selection is the newest bucket with data; a range change resets it. A selected gap shows its date with dashes.
- Empty range: the card keeps its size and reads `Nothing logged between Aug 7 and Sep 5.`; the readout shows dashes; the toggle still works.
- Drawing: inline SVG in CSS pixels at the card's measured width and height. The chart takes its scale from the box height (12.5rem, so it grows with the user's text setting), shrinks its axis chrome when that would not fit the width, and publishes the scale as `--trend-scale` for the stylesheet. The chart factory observes its own box and redraws from its last props, so a resize never goes through app state. 2 px surface gaps between bars and between stacked segments; no chart library.
- Entries count exactly as the day total counts them: a soft-deleted food still counts for its old entries, an excluded-unit entry contributes nothing, and recipe-expanded entries (M13) are ordinary entries.

## Out of scope
- A calories-only chart, a trendline, goal lines or target bands (goals milestone).
- Calendar-week buckets; custom date ranges; choosing the bucket size separately from the range.
- Marking a day as fasted (a true zero). Every empty day is a gap.
- Hover tooltips, keyboard bar selection, animation, a table view of the series.
- Jumping from a bar to that day on the Log tab.
- Per-meal or per-food trends; weight or any non-food metric.
- Persisting the chosen range.

## Data
No schema change. Nothing new is persisted.

```ts
// src/domain/types.ts
function nutrientCalories(key: keyof NutritionFacts, n: NutritionFacts): number;   // the calorie field as-is; a macro via its calories per gram
function macroPctOfCalories(n: NutritionFacts): Partial<Record<keyof NutritionFacts, number>>;   // each macro's share of n.calories

// src/domain/calc.ts
function totalsByDate(state: State, from: string, to: string): Map<string, NutritionFacts>;   // one pass; only dates with an entry appear

// src/domain/date.ts
function dateSpan(start: string, count: number): string[];                       // consecutive dates, oldest first

// src/ui/format.ts
function formatIsoDate(date: string, opts: Intl.DateTimeFormatOptions): string;  // "Sep 5", "Sat, Sep 5"

// src/domain/trends.ts
type TrendRange = { label: string; buckets: number; bucketDays: number };
const TREND_RANGES = { week: {7 × 1}, month: {30 × 1}, quarter: {13 × 7}, year: {52 × 7} } satisfies Record<string, TrendRange>;
type TrendRangeKey = keyof typeof TREND_RANGES;                        // key order = toggle order
const DEFAULT_TREND_RANGE: TrendRangeKey;
type TrendBucket = { start: string; end: string; loggedDays: number; perDay: NutritionFacts | null };   // perDay null ⇔ loggedDays 0
type TrendSeries = { bucketDays: number; buckets: TrendBucket[] };    // oldest → newest; last ends on today
function trendData(state: State, today: string, range: TrendRangeKey): TrendSeries;   // one pass over the entries
```

- A logged day is a date with at least one entry. `perDay` is `sumNutrition` over the bucket's entries divided by `loggedDays`.
- Dates come from one `dateSpan` walk, so buckets tile exactly across month ends and DST changes.

View state (`app.ts`, transient): `trendRange: TrendRangeKey`, `trendSelected: string | null` (a bucket start). Handlers: `onTrendRangeChange`, `onTrendSelect`. The chart is `createTrendChart()` in `ui/trendChart.ts`, rendered with `{ series, selected, onSelect }`.

## UI sketch
```
Trends
[ 7d | 30d | 90d | 1y ]                                ← button group, same factory as the unit pickers
┌─────────────────────────────────────────────────┐
│ Calories per day from protein, carbs and fat    │
│ 2000 ┤                                          │
│ 1500 ┤ ▓   ▓ ▓ ▓   ▓ ▓ ▓ █ ▓ ▓ ▓ ▓ ▓ ▓ ▓ ▓ █   │  ← fat on top
│ 1000 ┤ ▒   ▒ ▒ ▒   ▒ ▒ ▒ ▒ ▒ ▒ ▒ ▒ ▒ ▒ ▒ ▒ ▒   │  ← carbs
│  500 ┤ ░   ░ ░ ░   ░ ░ ░ ░ ░ ░ ░ ░ ░ ░ ░ ░ ░   │  ← protein; a gap where nothing was logged
│    0 ┴──────────────────────────────────────────│
│         Aug 12       Aug 20       Aug 28  Sep 5 │
│ ■ Protein  ■ Carbs  ■ Fat                       │
└─────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────┐
│ Sat, Sep 5                                      │  ← selected bucket (tap a column); default: newest with data
│ Protein          120 g       480 cal      24%   │
│ Carbs            210 g       840 cal      42%   │
│ Fat               70 g       630 cal      32%   │
│ ─────────────────────────────────────────────── │
│ Calories                    1980 cal            │  ← the day's listed calories, as the Log tab totals them
└─────────────────────────────────────────────────┘

Week:    heading reads "Aug 30 – Sep 5 · 5 of 7 days logged"; values are per-day means
Empty:   Nothing logged between Aug 7 and Sep 5.
```
- `data-testid`: `view-toggle-trends`; `trend-range-group` (buttons carry `data-value`); `trend-chart` (card); `trend-caption`; `trend-svg` (`role="img"`, `aria-label` like `Calories per day from protein, carbs and fat, Aug 7 to Sep 5: 23 logged days`); `trend-bar` with `data-start` and `data-key` (one per segment; `data-selected` on the selected bucket's); `trend-hit` with `data-start`; `trend-x-label`; `trend-y-label`; `trend-legend` / `trend-legend-{key}`; `trend-readout`, `trend-readout-heading`, `trend-readout-{key}` rows with cells `data-col="grams" | "cal" | "pct"`; `trend-empty`.
- Card, toggle row and readout card occupy the same box whether or not the range has data.

## Acceptance
1. `trendData().buckets` has exactly `buckets` entries oldest-first; the last ends on `today`, each spans `bucketDays`, and consecutive buckets tile with no gap or overlap, including across a month end and a DST change.
2. A date with no entry never appears in `totalsByDate`; a bucket with no logged day has `perDay: null` and `loggedDays: 0`; a week with three logged days reports the mean over three, not seven.
3. An entry on a soft-deleted food still counts; an excluded-unit entry contributes zero but makes its day logged; today counts.
4. The Trends tab renders the range toggle with 30d active; each option repaints the chart; a tab round-trip restores the default.
5. One stacked bar per bucket with data and none for a gap; one segment per `MACRO_KEYS` in calories, stacked in order with the 2 px gap; stack heights proportional to macro calories per day; a zero macro renders a zero-height segment so the testid stays stable; the caption and a `trend-legend-{key}` per key are present.
6. Y ticks start at 0, are round numbers, hold at most four intervals for any peak, and the top tick is at or above the tallest stack; x labels number at most six, include the last bucket, and drop to one where only one fits.
7. Tapping a hit column reports that bucket; a selected bucket's segments carry `data-selected` and the readout shows its weekday and date, each macro's grams, calories and percent, and the day's calories; a week heading shows the range and `n of 7 days logged`; a selected gap shows its date with dashes; default selection is the newest bucket with data; changing the range resets it.
8. With no logged day in range the card shows `trend-empty` naming both dates, hides the plot, keeps the legend strip in flow, draws no bars, and dashes the readout.
9. The unit pickers and the range toggle come from one factory, and every group's buttons carry `data-value`.
10. After the card's width changes the chart is redrawn at the new measured width without an app repaint; the card and the readout do not move between the empty and the populated state.
11. On a narrow box with large text the chart still draws left to right with tappable columns; screenshots at every viewport, including the 48 px-root desktop and the 32 px-root phone, show legible axis text and no label collisions.
12. App JS stays under the 100 KB gzipped gate; no new runtime dependency.
