# M14 — Trends

## Goal
See how intake moves over time. A Trends tab plots what the log already computes — calories, or protein / carbs / fat stacked — day by day over the last week, month, quarter or year, with a 7-day trailing average as the trendline and a readout for any bar the user taps. Rationale: [ADR 0010](../decisions/0010-trend-charts.md).

## In scope
- Trends tab (`Log · Foods · Catalog · Trends`; `Recipes` slots before `Catalog` once M13 lands). On it: two toggle rows, the chart card, a readout row. Nothing else.
- Metric toggle `Calories | Macros` and range toggle `7d | 30d | 90d | 1y`, both button groups from one factory that the unit picker also becomes an instance of. Defaults Calories / 30d. Transient view state: a tab change resets them, like every other tab's controls.
- Series: one bucket per day for 7d / 30d; one per trailing 7-day block for 90d (13) and 1y (52). The newest bucket always ends on today. A bucket's value is the per-day mean over its logged days; a bucket with no logged day is a gap (no bar), never a zero. Today counts like any other day.
- Trendline: in day-bucketed ranges, a line of the trailing 7-day mean (that day and the six before it, logged days only, reading past the range start). Absent in week-bucketed ranges, whose bars are already means.
- Calories: one bar per bucket in the accent colour, plus the trendline. Macros: one stacked bar per bucket, one segment per `MACRO_KEYS` in grams, coloured by `NUTRIENTS[k].sliceColor`, bottom-to-top in `MACRO_KEYS` order, plus a legend. A macro added to `NUTRIENTS` gets a segment and a legend row with no chart edit.
- Axes: y from zero with three or four round ticks and recessive gridlines, labelled in muted text; x labels the last bucket and every k-th before it, k chosen so at most six labels show, as `Sep 5` (a week bucket is labelled by its first day).
- Selection: tapping a bar's column (full plot height, the whole slot width) selects the bucket. The readout reads `Sep 5 · 1,980 cal · P 120 g · C 210 g · F 70 g`, a week `Aug 30 – Sep 5 · 5 of 7 days logged · …`, and adds `7-day avg 2,050 cal` when the trendline exists. Default selection is the newest bucket with data; a metric or range change resets it.
- Empty range: the card keeps its size and reads `Nothing logged between Aug 7 and Sep 5.`; the readout is blank; the toggles still work.
- Drawing: inline SVG in CSS pixels at the card's measured width; the chart factory observes its own width and redraws from its last props, so a resize never goes through app state. 2 px surface gaps between bars and between stacked segments; 2 px trendline; no chart library.
- Entries count exactly as the day total counts them: a soft-deleted food still counts for its old entries, an excluded-unit entry contributes nothing, and recipe-expanded entries (M13) are ordinary entries.

## Out of scope
- Goal lines or target bands (goals milestone).
- Calendar-week buckets; custom date ranges; choosing the bucket size separately from the range.
- Marking a day as fasted (a true zero). Every empty day is a gap.
- Hover tooltips, keyboard bar selection, animation, a table view of the series.
- Jumping from a bar to that day on the Log tab.
- Per-meal or per-food trends; weight or any non-food metric.
- Persisting the chosen metric or range.

## Data
No schema change. Nothing new is persisted.

```ts
// src/domain/calc.ts
function totalsByDate(state: State, from: string, to: string): Map<string, NutritionFacts>;   // one pass; only dates with an entry appear

// src/domain/trends.ts
type TrendRange = { label: string; buckets: number; bucketDays: number };
const TREND_RANGES = { week: {7 × 1}, month: {30 × 1}, quarter: {13 × 7}, year: {52 × 7} } satisfies Record<string, TrendRange>;
type TrendRangeKey = keyof typeof TREND_RANGES;                        // key order = toggle order
type TrendMetric = { label: string; keys: readonly (keyof NutritionFacts)[]; stacked: boolean };
const TREND_METRICS = { calories: { keys: ['calories'], stacked: false }, macros: { keys: MACRO_KEYS, stacked: true } };
type TrendMetricKey = keyof typeof TREND_METRICS;
type TrendBucket = { start: string; end: string; loggedDays: number; perDay: NutritionFacts | null };   // perDay null ⇔ loggedDays 0
function trendSeries(state: State, today: string, range: TrendRangeKey): TrendBucket[];             // oldest → newest; last ends on today
function trailingAverage(state: State, today: string, range: TrendRangeKey): (number | null)[];    // calories per bucket; [] when bucketDays > 1
```

- A logged day is a date with at least one entry. `perDay` is `sumNutrition` over the bucket's entries divided by `loggedDays`.
- Dates move through `shiftDate`, so buckets tile exactly across month ends and DST changes.
- `trailingAverage[i]` is the mean of `calories` over the logged days in `[bucket.start − 6, bucket.start]`, null when there are none. It reads days before the range start, so the line is right at the left edge.

View state (`app.ts`, transient): `trendMetric: TrendMetricKey`, `trendRange: TrendRangeKey`, `trendSelected: string | null` (a bucket start). Handlers: `onTrendMetricChange`, `onTrendRangeChange`, `onTrendSelect`.

## UI sketch
```
Trends
[ Calories | Macros ]   [ 7d | 30d | 90d | 1y ]      ← two button groups, same factory as the unit picker
┌─────────────────────────────────────────────────┐
│ 2500 ┤                                          │
│ 2000 ┤ ▄   ▄ ▄ ▄   ▄ ▄ ▄ █ ▄ ▄ ▄ ▄ ▄ ▄ ▄ ▄ █   │  ← a bar per bucket, a gap where nothing was logged
│ 1500 ┤ █ ─ █ █ █ ─ █ █ █ █ █ █ █ █ █ █ █ █ █   │  ← 7-day trailing mean (day-bucketed ranges only)
│ 1000 ┤ █   █ █ █   █ █ █ █ █ █ █ █ █ █ █ █ █   │
│    0 ┴──────────────────────────────────────────│
│       Aug 7      Aug 14     Aug 21     Sep 5    │
└─────────────────────────────────────────────────┘
Sep 5 · 1,980 cal · P 120 g · C 210 g · F 70 g    ← selected bucket (tap a column); default: newest with data
7-day avg 2,050 cal

Macros:  same card, one stacked bar per bucket, legend under the plot   ■ Protein  ■ Carbs  ■ Fat
Empty:   Nothing logged between Aug 7 and Sep 5.
```
- `data-testid`: `view-toggle-trends`; `trend-metric-group` / `trend-range-group` (buttons carry `data-value`); `trend-chart` (card); `trend-svg` (`role="img"`, `aria-label` like `Calories per day, Aug 7 to Sep 5: 23 logged days, average 2,050 cal`); `trend-bar-{start}` (Calories) / `trend-segment-{start}-{key}` (Macros); `trend-hit-{start}`; `trend-avg-line`; `trend-x-label`; `trend-legend-{key}`; `trend-readout`; `trend-empty`.
- Card, toggle rows and readout row occupy the same box in every state: empty, Calories, Macros.

## Acceptance
1. `trendSeries` returns exactly `buckets` entries oldest-first; the last ends on `today`, each spans `bucketDays`, and consecutive buckets tile with no gap or overlap, including across a month end.
2. A date with no entry never appears in `totalsByDate`; a bucket with no logged day has `perDay: null` and `loggedDays: 0`; a week with three logged days reports the mean over three, not seven.
3. `trailingAverage` returns one value per bucket for `week` / `month` and `[]` for `quarter` / `year`; a day whose lookback holds one logged day equals that day; the lookback crosses the range start; no logged day in the window gives null.
4. An entry on a soft-deleted food still counts; an excluded-unit entry contributes zero but makes its day logged; today counts.
5. The Trends tab renders both toggles with Calories / 30d active; each toggle repaints the chart; a tab round-trip restores the defaults.
6. Calories mode draws one `trend-bar-{start}` per bucket with data and none for a gap; bar heights are proportional to `perDay.calories`; `trend-avg-line` exists for 7d / 30d and not for 90d / 1y.
7. Macros mode draws one `trend-segment-{start}-{key}` per `MACRO_KEYS` per bucket with data, stacked in order with the 2 px gap, and one `trend-legend-{key}` per key; a zero-gram macro renders a zero-height segment so the testid stays stable.
8. Y ticks start at 0, are round numbers, and the top tick is at or above the tallest bar; x labels number at most six and include the last bucket.
9. Tapping `trend-hit-{start}` selects that bucket, marks its bar, and the readout shows its date, calories and macro grams; a week readout shows the range and `n of 7 days logged`; `7-day avg` appears only when the trendline exists; default selection is the newest bucket with data; changing metric or range resets it.
10. With no logged day in range the card shows `trend-empty` naming both dates, no bars, and an empty readout, at the same card height as a populated chart.
11. The unit picker, metric toggle and range toggle come from one factory; the existing unit-picker tests pass unchanged.
12. After the card's width changes the chart is redrawn at the new width without an app repaint.
13. The tab appears in `npm run screenshots` at all four viewports with a seeded month of entries, and the tab strip fits at 480 px.
14. App JS stays under the 100 KB gzipped gate; no new dependency.
