# Milestones

Iterative. One milestone = one PR (or a small handful). Pause for review between milestones.

## M0 — Bootstrap
Vite + TS + Web Test Runner scaffold. `index.html` shows placeholder. GH Actions: test on PR, deploy `dist/` to `gh-pages` on merge, PR previews via `rossjrw/pr-preview-action`. README with local dev steps.

**Done:** main deploys to `https://aquigs.github.io/foodtracker/`, PRs get preview URLs.

## M1a — Domain + persistence (no UI)
Pure types, reducer, kcal math, repository interface + localStorage adapter + in-memory fake. Fully tested in isolation. `index.html` still shows a placeholder. See [001-mvp/spec.md](./001-mvp/spec.md).

**Done:** unit tests pass for log/delete/totals; round-trips through localStorage.

## M1b — MVP UI: log foods today
Wire domain + persistence to a minimal UI: search seeded foods, enter grams, log it, see today's entries + totals, delete entries. Persists across reloads.

**Done:** can log 3 foods, refresh, still there.

## M2 — Date navigation
Prev/next arrows + date picker. View/edit/delete entries on any date. "Jump to today" shortcut. Local-time date handling.

**Done:** log something yesterday, navigate, edit it.

## M3 — Manage food DB
Foods view: list, search, add, edit, soft-delete custom foods. "Recently used" on log screen. JSON import/export.

**Done:** add a custom food, log it.

## M4 — Multiple units per food
A food can be logged in grams, ounces, pounds, or count (e.g. "2 eggs"). Each food stores a *primary* unit and a per-unit weight so kcal math always reconciles back to per-100g. Picker shows the food's primary unit by default; the input lets you switch. Existing entries keep their grams field; new entries record both the entered amount + unit and the resolved grams.

**Done:** log "2 eggs" and "0.25 lb chicken" and see correct kcal totals.

## M5 — Quick-select unit chips
Below the amount input, show 4-6 chips of common amounts for the selected food's unit (e.g. for lb: 0.25, 0.5, 0.75, 1; for count: 1, 2, 3, 4; for g: 50, 100, 150, 200). Tap a chip to set the amount instantly. Chips are per-unit and tunable per food (or sensible defaults).

**Done:** log a banana in 2 taps (pick + chip), log "0.25 lb chicken" in 3 taps.

## M6 — Clickable entries with detail card
Click an entry in the log to reveal a detail card: per-100g nutrition for the underlying food *and* the same numbers scaled to the entry's amount. From the card you can also delete or jump to "edit" (which becomes a workflow to delete + re-log with a prefilled form, since per-entry editing is still deferred).

**Done:** click a logged banana, see "120g = 107 cal, 1.3g protein, 27g carbs, 0.4g fat" alongside the per-100g panel.

## M7 — Meals (breakfast / lunch / dinner / snack)
Entries get a `meal` field. The log view shows a per-meal grouping with each meal's subtotal, plus the day total. A "Next meal" button advances which meal new logs go into, so the typical day is "log breakfast items → tap Next → log lunch items → tap Next → ...". The meal is picked once per logging session, not per entry.

**Done:** log 2 things to breakfast, tap Next, log 3 things to lunch, see two subtotal rows + a day total.

## M8 — Macro distribution chart
A small inline chart on the log view shows the day's macro split as both percentage of calories and absolute calories from each macro (Protein × 4, Carbs × 4, Fat × 9). Stacked-bar or donut, whichever reads better at narrow widths. Updates live as entries are logged or deleted.

**Done:** glance at the chart and see "45% carbs / 30% protein / 25% fat" without doing the math.

## M9 — Fuzzy search

Replace the case-insensitive substring filter on both the Log picker and the Foods picker with a typo-tolerant fuzzy match. Uses a subsequence scorer with gap penalty (no external library). Empty query returns the full sorted/recent list as before.

**Done:** "bana" finds Banana; "chiken" finds Chicken breast; "olv ol" finds Olive oil; gibberish ("zzzzqq") returns empty.

## Later (not scheduled)
Goals/targets, trend lines (multi-day macro charts), recipes, barcode lookup, CSV export, multi-profile, cloud sync, PWA/offline.
