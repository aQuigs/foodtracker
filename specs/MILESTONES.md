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

## Later (not scheduled)
Goals/targets, trend charts, meals/recipes, barcode lookup, CSV export, multi-profile, cloud sync, PWA/offline.
