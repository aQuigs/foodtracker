# M14 — Trends: implementation plan

Vertical slices, each red → green → refactor, each through the adversarial + `/simplify` passes before the next starts ([ADR 0006](../decisions/0006-pr-review-pipeline.md)). One PR.

## Slices
1. **Domain series.** `totalsByDate` in `calc.ts`; `TREND_RANGES`, `TREND_METRICS`, `trendSeries`, `trailingAverage` in `domain/trends.ts`. Tests: tiling across a month end and a DST switch, gap buckets, week means over logged days only, lookback across the range start, soft-deleted foods, excluded units. No UI.
2. **Toggle-group factory.** Lift `createUnitPicker` out of `view.ts` into `ui/toggleGroup.ts` as `createToggleGroup<T>(testid, label, options)`; the unit picker becomes an instance (its `data-unit` attribute stays so its tests pass unchanged). No new behaviour.
3. **Trends tab, Calories mode.** `ViewName` gains `trends`; view state and handlers; `ui/trendChart.ts` factory `{ node, render(props) }` drawing bars, ticks, x labels, trendline, hit columns, with its own ResizeObserver; readout; empty state. Tests: view tests for every testid and the empty state; app tests for tab reset, default selection, reset on range change.
4. **Macros mode.** Stacked segments per `MACRO_KEYS`, legend, readout in grams. Tests: one segment per key, stack order, zero-height segments, legend rows.
5. **Visual pass.** `scripts/screenshot-pages.mjs` gains a `trends` page that seeds a month of entries into localStorage before loading (the empty state is not the interesting picture); read all four viewports; check the tab strip at 480 px with five tabs once M13 is in. Bundle gate.

## Test strategy
- Domain tests use a fixed `today` and hand-built states; no clock.
- View tests render through `render()` with `baseVm`, as the donut tests do; bar geometry is checked through relative `height` attributes, never pixel constants.
- Resize is tested by changing the container's width and awaiting a frame.
- A chai DOM diff hangs the tab: assert on attributes and counts, never `expect(element).to.equal(null)`.

## Risks
- Five tabs at 375 px once M13 lands. Measure first; if the strip wraps, fix `.view-toggle`, not one tab.
- 52 bars at 375 px are about 5 px wide with a 2 px gap; the hit column is the whole slot, so taps still land.
- `trailingAverage` at the left edge of 30d reads days before the range. Correct, but a test that seeds only inside the range will see the edge average differ from a naive reading; seed the lookback deliberately.
