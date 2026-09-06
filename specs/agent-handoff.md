# Agent handoff

Read [STATUS](./STATUS.md) first for current state. Then this for orientation.

## What
Browser-based food tracker. Single-user, localStorage, no backend. Static site on GitHub Pages.

## Where things live
- [STATUS](./STATUS.md) — current state, in-flight PRs
- [MILESTONES](./MILESTONES.md) — roadmap
- [`../CLAUDE.md`](../CLAUDE.md) — conventions, stack, commands, layering
- `specs/NNN-name/` — per-milestone specs
- `specs/decisions/` — ADRs (append-only)

## Architecture
Strict layering — [ADR 0005](./decisions/0005-layered-architecture.md):

```
ui  →  domain  ←  persistence
        ↑
       app
```

`domain/` is pure. `persistence/` is behind an interface. `ui/` never touches storage. `app.ts` is the only thing that knows all three.

## How we work
- One milestone at a time. **Pause for user review between milestones.**
- **All changes go via PR** so user can preview the GH Pages deploy.
- **Every PR runs through adversarial-review + `/simplify` subagents before user sees it** ([ADR 0006](./decisions/0006-pr-review-pipeline.md))
- Strict TDD ([ADR 0004](./decisions/0004-strict-tdd.md))
- TypeScript everywhere incl. tests
- Vite → `dist/` → GH Pages. PR previews via `rossjrw/pr-preview-action@v1`.
- localStorage, single versioned JSON blob, validator at the boundary

## Style
- Terse over verbose (user preference)
- Comments only for *why*, never *what*
- No backward-compat shims for unreleased internal code
- No `Co-Authored-By` in commits
- Don't delete PR template items, just check/uncheck

## Don't
- Cross layers wrong (UI → persistence, domain → DOM, etc.)
- Add a framework (React/Svelte/Vue)
- Swap the test runner
- Add cloud sync before all planned milestones ship
- Skip the failing-test-first step
- Run past a milestone boundary without user review
- Merge to main without a PR
- Put plan/design docs outside `specs/` (root is only CLAUDE.md, README.md, LICENSE)
- Put user state in IndexedDB — it holds only the read-only catalog; everything the user writes stays in the localStorage blob
- Write to `FoodSourceRepository` from anywhere except `app.ts` hydration — at boot, or when the user turns a source on (sourced foods are read-only at runtime)

## Food sources system

The food library has two layers:

- **User-created foods** — `state.foods`, writable, lifecycle (`createdAt`, `deletedAt`), localStorage via `StateRepository`. The log picker searches only these.
- **Sourced foods** — read-only, immutable per-version, IndexedDB via `FoodSourceRepository`. Fourteen sources: `usda` (curated tier, "Everyday foods") and `usda-full` ("All USDA foods") on by default, plus twelve store-brand packs (`costco`, `target`, …) off by default. `state.enabledSources` (localStorage blob, additive on v2) says which are on; boot hydrates only those, ticking one in the Catalog tab's source picker hydrates it on the spot, and search covers only what is on. Each source is fetched from a versioned dataset under the site's own `public/data/`. Add copies a hit into `state.foods` as an edit-locked `Food`.

See [011-external-food-db/spec.md](./011-external-food-db/spec.md), [012-source-packs/spec.md](./012-source-packs/spec.md), [ADR 0007](./decisions/0007-multi-source-food-library.md) and [ADR 0008](./decisions/0008-opt-in-source-packs.md).

Key files:
- `src/domain/foodSources.ts` — `FOOD_SOURCES` (names), `FOOD_SOURCE_META` (one struct per source: `label`, `tier`, pinned `version`, `defaultOn`; registry order = picker order = fold order), `sourceLabel()`, `sourceBrand()` (label for a store pack, null for USDA — drives the brand tag), `searchText(name, source)` (name plus brand — what every search matches on), `sourceTier()` (curated vs deep — flat vs folded), `catalogVersions()`, `defaultEnabledSources()`, `isFoodSource()`, and `datasetDir(source, version)` → `<source>-v<version>`, the one definition of the dataset directory convention, used by the build script and the HTTP provider
- `src/domain/searchKey.ts` — `searchKey(name)`: lowercased, diacritics stripped, punctuation folded to spaces. Both repository adapters index and match on it, the fzf ranker classifies tiers on it, and the pack build folds brand strings with it, so every search path agrees
- `src/domain/foodNames.ts` — `foodIdentityKey({ name, source? })` and `nameTaken(item, items, ignoreId?)`: live identity is name plus brand (a pack row's identity includes its tag) for foods, name alone for recipes (no brand) — one rule shared by both, enforced by the reducer (AddFood / EditFood / ReviveFood / AddRecipe / EditRecipe), repaired at the state boundary, and surfaced with messages by the food form, the recipe editor and catalog Add
- `src/persistence/foodSourceRepository.ts` — read-mostly multi-source library interface: `currentVersion(source)`, `hydrate(source, items, manifest)` (replaces that source's partition), `search(query, opts)` (`opts.sources` walks only those partitions)
- `src/persistence/indexedDbFoodSource.ts` — IndexedDB adapter (`idb`, DB `foodtracker-foods`)
- `src/persistence/inMemoryFoodSource.ts` — test fake
- `src/persistence/foodNameMatch.ts` — shared token matcher so both adapters match identically
- `src/persistence/foodSourceProvider.ts` — provider interface (fetch a dataset for one named source)
- `src/persistence/httpFoodSourceProvider.ts` — configured with `{ name, baseUrl }`; fetches `manifest.json` + `foods.json` from `<baseUrl>/<source>-v<version>/`, validates SHA-256, returns `SourcedFood[]`
- `src/ui/sourcePicker.ts` — the Sources disclosure on the Catalog tab: fuzzy filter + one checkbox per wired source
- `scripts/build-food-source.ts` — offline dataset builder. Three modes: `curated` (`scripts/curated-foods.json` → source `usda`), `full` (`scripts/food-classifications.json` → source `usda-full`, refuses to ship unjudged rows), `packs` (`scripts/brand-packs.json` + the USDA Branded dump, streamed by `scripts/jsonArrayScanner.ts`, names cleaned mechanically by `scripts/brandedMapper.ts` → one dataset per pack). All emit `public/data/<source>-v<version>/foods.json` + `manifest.json`; committed and served same-origin under GH Pages. CLI in the [README](../README.md#updating-the-food-database)

`app.ts` is the only place that knows about both repositories; layering ([ADR 0005](./decisions/0005-layered-architecture.md)) still applies.

## Recipes

A recipe (`Recipe`) is a named list of portions (`Portion = { foodId, amount, unit }`) over the user's live foods. Logging one writes one plain `Entry` per portion (amount × servings) into the latest meal, all tagged with a `RecipeLog { id, recipeId, servings }` through `entry.recipeLogId`; calc, totals, the chart and export never see recipes ([ADR 0009](./decisions/0009-recipes-expand-into-grouped-entries.md)). The log view groups a meal's entries by recipe log under a header that deletes the group; a recipe log dies with its last entry, like a meal. A food a live recipe uses can't be soft-deleted or flip its count/weight axis. Both fields are additive on the v2 blob; `parseState` drops a `recipeLogId` that names no record instead of rejecting, because an older build sharing the localStorage blob drops `recipes` and `recipeLogs` when it re-saves. See [013-recipes/spec.md](./013-recipes/spec.md).

Key files:
- `src/domain/recipes.ts` — `liveRecipes`, `recipeNutrition(recipe, foodsById)` (skips deleted foods), `liveRecipeUsing(recipes, foodId)`, `referencedRecipeLogs(recipeLogs, entries)` (the one pruning rule, used by the reducer and the validator)
- `src/domain/foodLocks.ts` — `axisLock(state, foodId)`: why a food's count/weight axis can't change (entries, or a live recipe), shared by the reducer and the food form intent
- `src/ui/recipeIntents.ts` — `parseRecipeIntent` (editor form → AddRecipe / EditRecipe), `RecipeDraft` (amounts keyed by food id, plus servings), `draftForRecipe`, `parseRecipeDraft` (the card's live totals and the log intent share it), `parseRecipeLogIntent` (→ LogRecipe)
- `src/ui/logPicker.ts` — `searchPicker(state, query, now)`: live foods and recipes as `PickerItem`s, ranked by match tier, then recency (`compareForLog` counts a recipe's logged entries), then name
- `src/ui/recipeEditor.ts` — the Recipes tab form: `createRecipeEditor()` → `{ node, render }`, item rows keyed by food id so typing keeps focus
- `src/ui/pickerOption.ts`, `src/ui/listRow.ts`, `src/ui/unitPicker.ts` — shared factories: every clickable picker row (log picker, editor food picker), every Foods / Recipes list row, every unit button group
- `src/ui/foodTitle.ts` — `foodTitle()` (highlighted name plus brand tag) and `foodLabel()` (name plus brand as plain text): the shared brand-aware rendering every food-facing row, aria-label and detail region uses

## Still TBD
- Linter/formatter (Prettier/ESLint) — TBD as repo grows
- Cloud sync architecture — deferred past current plan
