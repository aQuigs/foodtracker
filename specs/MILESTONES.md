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

## M8 — Ordered meals per day
Each day groups its entries into an ordered list of auto-named meals ("Meal 1", "Meal 2", …). "New meal" button appends a meal; new logs go into the latest meal. Per-meal headers show cal + P/C/F. Day total stays at the bottom. State bumps `version` 1→2 with a one-way migration. See [008-meals/spec.md](./008-meals/spec.md).

**Done:** log breakfast, tap New meal, log lunch — two meal blocks with their own subtotals.

## M9 — Macro distribution donut chart
Small donut between the entry list and the day total row showing share of calories per macro (protein/carbs/fat). Slice colours come from `NUTRIENTS[k].sliceColor` so adding a future macro is a one-line edit. Hidden when no macro contributes calories. See [009-macro-chart/spec.md](./009-macro-chart/spec.md).

**Done:** log a day's worth of food, see the macro split as a donut + legend.

## M10 — Typo-tolerant fuzzy search
Both food searches (log-view picker and Foods-view list) match through typos, transpositions, abbreviations, initials (`gy` → "Greek yogurt"), and out-of-order tokens. Matched characters highlight via `<mark>` inside the rendered name. Existing recency / alphabetical orderings become tie-breakers on equal fuzzy score. See [010-fuzzy-search/spec.md](./010-fuzzy-search/spec.md).

**Done:** type `bananna` or `gy`, find the right food.

## M11 — External food sources (USDA, ~16k items)
Library grows from ~10 seed foods to ~16k by fetching a USDA bundle (Foundation + SR Legacy + FNDDS, ~8 MB gzipped) from a GitHub Release on first launch and caching it in IndexedDB. Subsequent launches are instant; bumping the pinned version triggers re-hydration. Picker merges user-created foods (writable, localStorage) with sourced foods (read-only, IndexedDB). Architected from day one for additional sources (pantry, restaurant menus, …) behind one interface. See [011-external-food-db/spec.md](./011-external-food-db/spec.md) and [ADR 0007](./decisions/0007-multi-source-food-library.md).

**Done:** first launch downloads the catalog with a progress banner; picker searches across ~16k foods.

## Later (not scheduled)
Per-food chip overrides, goals/targets, trend charts, recipes, barcode lookup, CSV export, multi-profile, cloud sync, PWA/offline, USDA Branded dataset (~600k items), tag-based source filtering (pantry, dietary, restaurant menus).
