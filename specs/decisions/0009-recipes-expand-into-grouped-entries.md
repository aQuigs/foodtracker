# 0009 — Recipes expand into grouped entries

**Date:** 2026-09-05

## Context

A recipe is a named preset of foods with portions. Logging one has to land in the day's log somehow, and the shape chosen decides how much of the app has to learn about recipes: calorie math, per-meal and per-day totals, the macro chart, the entry detail card, the validator, export/import.

## Decision

Logging a recipe writes **one ordinary `Entry` per item**, amounts already multiplied by the servings count, plus one `RecipeLog { id, recipeId, servings }` record that the entries reference through `entry.recipeLogId`.

- Calc, totals, the chart, the entry detail card and export stay unchanged: they see plain entries.
- The log view groups entries by `recipeLogId` inside their meal, under a header that reads the live recipe's name and the servings count. The header's × dispatches `DeleteRecipeLog`; item rows keep their own ×, and the record is garbage-collected when its last entry goes — the same shape as `Meal`.
- The header reads the recipe's current name, as entry rows read the food's current name; a soft-deleted recipe keeps its record so history still resolves.
- Amounts are snapshotted per entry, so editing the recipe later never rewrites history.
- `parseState` treats a `recipeLogId` that names no record as absent instead of rejecting the blob. The live site and PR previews share one localStorage blob; a build that predates recipes re-saves entries verbatim (extra fields ride along) but drops `recipes` and `recipeLogs` entirely. One visit to the live site therefore loses the recipe library; a strict check would then wipe everything else on the next preview visit.

## Alternatives considered

- **One composite entry per logged recipe** (`Entry` becomes a union). Cleaner history and one row per dish, but every consumer of entries — calc, detail card, chart, validator, export — grows a second branch, and a single item can't be removed after logging.
- **Tag each entry with the group data** (`entry.recipe = { id, name, servings }`, no record). No extra collection, but the same fields repeat across entries and must agree; a validator can only check consistency, not own it.
- **Reject dangling `recipeLogId`** like `mealId`. Consistent, but fails the shared-blob case above; meals never had this hazard because the version bump that introduced them was a one-way migration.

## Consequences

- The domain owns three new reducer actions and two guards on foods (a food in a live recipe can't be deleted or flip its count/weight axis) so every live recipe stays loggable.
- A group is only as durable as its entries: delete every item and the header goes with them.
- Renaming a recipe relabels past groups. Acceptable for a single-user tracker and consistent with foods.
