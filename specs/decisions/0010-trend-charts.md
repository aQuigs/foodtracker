# 0010 — Trend charts: computed on read, unlogged days are gaps, inline SVG

**Date:** 2026-09-05

## Context

The log stores one entry per food eaten, keyed by date, and every figure the app shows is derived from those entries at render time (`dailyTotals`, the M9 donut). A trends view needs the same figures for up to a year of days at once, drawn as bars and a trendline, on a static site whose app bundle is gated at 100 KB gzipped (24 KB before this) and whose only chart so far is a hand-drawn SVG donut.

Two properties of the data shape the design. Users log intermittently, so a day with no entries almost always means "didn't log", not "ate nothing". And edits, deletes, imports and food changes rewrite history freely, so a stored aggregate can be wrong the moment after it is written.

## Decision

1. **Series are computed on read from `state.entries`.** One pass groups entries by date (`totalsByDate`); `trendSeries` buckets the dates. Nothing about trends is persisted and the blob does not change.
2. **An unlogged day is a gap, not a zero.** It draws no bar, is left out of every mean — a week bucket's per-day mean and the 7-day trailing average both divide by logged days only — and is counted in the readout (`5 of 7 days logged`). A logged day is a date with at least one entry, whatever it resolves to.
3. **Week buckets are trailing 7-day blocks ending today, valued as per-day means.** The newest bucket is always complete, and the y-axis reads "per day" in every range, so a bar is comparable to a daily figure whichever range is shown.
4. **Every series is in calories; macros stack grams × calories per gram.** Both charts share one axis, a gram of fat stands 9/4 as tall as a gram of protein or carbs, and the stack's height is the day's macro calories. The readout gives each macro as grams with its calories, so the gram figure goals are set in is one tap away.
5. **The chart is inline SVG drawn by the app in pixels at the measured box.** Bars, one polyline, tick text; geometry scales with the root font size so the chart grows with the user's text setting. The chart factory owns a ResizeObserver and redraws itself from its last props. No chart library.
6. **Trends get their own tab**, with a metric toggle and a range toggle built on the same button-group factory as the unit pickers.

## Alternatives considered

- **Daily aggregates stored in the blob** — faster reads, but derived state goes stale on every edit, delete, import and food change, and the validator would have to police a redundant field. Rejected; one pass over a few thousand entries is cheap.
- **Unlogged day = 0 cal** — honest for a fast, wrong for the common case; zeros drag every mean toward nothing and make the trendline meaningless for anyone who skips days. Rejected. A "fasted day" marker is the way to record a real zero if one is ever wanted.
- **Calendar weeks (Mon–Sun)** — stable labels, but the newest bucket is nearly always partial and the week start depends on locale. Rejected for trailing blocks; a block is labelled by its first day.
- **Weekly sums** — the natural aggregate, but the y-axis would change meaning between ranges and a weekly sum is not comparable to a daily goal. Rejected.
- **Macros stacked in grams** — the unit goals and labels use, but a gram of fat and a gram of carbs would stand equally tall while carrying very different energy, and the stack's height would mean nothing. Rejected; the readout carries the grams instead.
- **A chart library (Chart.js, uPlot, …)** — richer out of the box, but 15–70 KB gzipped against a 100 KB gate, a canvas or its own DOM to test through, and its own theming, for two mark types. Rejected; M9 already drew a donut by hand.
- **Charts on the Log tab under the day total** — no new tab, but the log view is already long on a phone and range controls have no place under a single day. Rejected.
- **viewBox scaling instead of measured width** — no observer, but non-uniform scaling distorts gaps and scales the tick text with the width rather than with the user's font size. Rejected; the app column is 32 rem wide, so the observer rarely fires.

## Consequences

- Trends cost one pass over `state.entries` per paint of the Trends tab; other tabs pay nothing.
- A real fasted day cannot be recorded; it reads as unlogged. Goals (planned) should inherit the gap rule so "days on target" counts logged days only.
- Trailing-block boundaries move every day, so a week bar is not a stable "week of Sep 1"; the readout shows the exact range.
- There is no tooltip; the readout card is the one place values are read, which also keeps the chart card's geometry fixed.
- A nutrient added to `NUTRIENTS` with `calPerGram > 0` gets a stacked segment and a legend row automatically, as it gets a donut slice.
- Anything else that wants a time series (weight, goal adherence) reuses the bucketing; a bucket carries `NutritionFacts` today and would generalise to one value per bucket.
