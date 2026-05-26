# Milestones

Iterative. One milestone = one PR (or a small handful). Pause for review between milestones.

## M0 — Bootstrap
Vite + TS + Web Test Runner scaffold. `index.html` shows placeholder. GH Actions: test on PR, deploy `dist/` to `gh-pages` on merge, PR previews via `rossjrw/pr-preview-action`. README with local dev steps.

**Done:** main deploys to `https://aquigs.github.io/foodtracker/`, PRs get preview URLs.

## M1a — Domain + persistence (no UI)
Pure types, reducer, calorie math, repository interface + localStorage adapter + in-memory fake. Fully tested in isolation. `index.html` still shows a placeholder. See [001-mvp/spec.md](./001-mvp/spec.md).

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

## M4 — Per-serving nutrition + multi-unit logging
Foods carry per-serving nutrition + a serving size + serving unit (g/oz/lb/count). Entries log an `amount` and `unit`; calories/macros resolve via servings at calc time. See [004-multi-unit/spec.md](./004-multi-unit/spec.md).

**Done:** log a banana in oz, log eggs in count, totals correct.

## M5a — Quick-select amount chips
Row of 4 amount chips below the log form, shown when a food is picked. Chip values are unit-level defaults (g: 50/100/150/200, oz: 1/2/4/8, lb: 0.25/0.5/0.75/1, count: 1/2/3/4). Tapping a chip fills the amount input. See [005a-quick-select-chips/spec.md](./005a-quick-select-chips/spec.md).

**Done:** pick a food, tap a chip, log it — two taps.

## M6 — Clickable entry detail card
Tap a logged entry row to expand an inline detail card showing resolved calories + macros (with macro %-of-calories). One card open at a time; mutually exclusive with selection-state. See [006-entry-detail/spec.md](./006-entry-detail/spec.md).

**Done:** log a banana, tap the row, see the per-entry breakdown.

## M7 — Food detail card in the picker
Pick a food in the log-view picker → an inline detail card opens below it. Two columns: "Per serving" (food's stored nutrition) and "This entry" (live for the current amount + unit). Mutually exclusive with the M6 entry card. See [007-food-detail/spec.md](./007-food-detail/spec.md).

**Done:** pick Banana, see per-serving nutrition + live per-amount nutrition side-by-side.

## Later (not scheduled)
Per-food chip overrides, goals/targets, trend charts, meals/recipes, barcode lookup, CSV export, multi-profile, cloud sync, PWA/offline.
