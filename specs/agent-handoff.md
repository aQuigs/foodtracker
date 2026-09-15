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
- **Sourced foods** — read-only, immutable per-version, IndexedDB via `FoodSourceRepository`. Two static sources — `usda` (curated tier, "Everyday foods") and `usda-full` ("All USDA foods") — are on by default; beyond them every brand in USDA Branded Foods is a source of its own, `brand:<id>` (~33,000 brands, ~390,000 rows), off until ticked. `state.enabledSources` (localStorage blob, additive on v2) says which are on; boot hydrates only those, ticking one in the Catalog tab's source picker hydrates it on the spot, and search covers only what is on. Each static source is fetched from its own versioned dataset under the site's own `public/data/`; every brand comes from the one sharded `brands-v<version>` dataset there. A row carries its own brand (`SourcedFood.brand`, `Food.brand`) — the brand tag, the brand half of the search text and food identity all read that field, never the source name. Add copies a hit into `state.foods` as an edit-locked `Food`.

A store is a bundle of brand ids (`STORE_BUNDLES`), shown as one picker checkbox that turns its house brands on together and sits indeterminate while only some are on. Nothing about a store is persisted: a stored blob naming one expands to its brands at parse, and a food added under a store keeps the store's label as its `brand`.

See [011-external-food-db/spec.md](./011-external-food-db/spec.md), [ADR 0007](./decisions/0007-multi-source-food-library.md) and [ADR 0012](./decisions/0012-brand-partitions-store-bundles.md), which supersedes the per-store datasets of [ADR 0008](./decisions/0008-opt-in-source-packs.md).

Key files:
- `src/domain/foodSources.ts` — `FOOD_SOURCES` (names), `FOOD_SOURCE_META` (one struct per static source: `label`, `tier`, pinned `version`, `defaultOn`; registry order = picker order = fold order), `BRANDS_DATASET` + `BRANDS_VERSION` (one pin for every brand), `brandSource(id)` / `brandIdOf(source)` / `brandEntry(index, id)`, `STORE_BUNDLES` + `bundleSources()` + `expandLegacySources()`, `sourceLabel()` (registry label, else the brand id read back as words while the index is unloaded), `searchText(name, brand?)` (name plus brand) and `brandedSearchKey(name, brand?)` (what every search matches on), `sourceTier()` (curated vs deep — flat vs folded; a brand folds like the deep tier), `catalogVersions()`, `defaultEnabledSources()`, `isFoodSource()`, and `datasetDir(source, version)` → `<source>-v<version>`, the one definition of the dataset directory convention, used by the build script and both providers
- `src/domain/searchKey.ts` — `searchKey(name)`: lowercased, diacritics stripped, punctuation folded to spaces. Both repository adapters index and match on it, the fzf ranker classifies tiers on it, and the brands build keys brand ids by it, so every search path agrees
- `src/domain/foodNames.ts` — `foodIdentityKey({ name, brand? })` and `nameTaken(item, items, ignoreId?)`: live identity is name plus brand (a branded row's identity includes its tag) for foods, name alone for recipes (no brand) — one rule shared by both, enforced by the reducer (AddFood / EditFood / ReviveFood / AddRecipe / EditRecipe), repaired at the state boundary, and surfaced with messages by the food form, the recipe editor and catalog Add
- `src/persistence/foodSourceRepository.ts` — read-mostly multi-source library interface: `currentVersion(source)`, `hydrate(source, items, manifest)` (replaces that source's partition), `search(query, opts)` (`opts.sources` walks only those partitions), `getMeta(key)` / `setMeta(key, value)` (the offline copy of the brands index)
- `src/persistence/indexedDbFoodSource.ts` — IndexedDB adapter (`idb`, DB `foodtracker-foods`, schema 4: a foods store whose `name_key` index is `brandedSearchKey(name, brand)`, plus a `meta` store holding the brands index under `brands-index`)
- `src/persistence/inMemoryFoodSource.ts` — test fake
- `src/persistence/foodNameMatch.ts` — shared token matcher so both adapters match identically
- `src/persistence/foodSourceProvider.ts` — `FoodSourceProvider` (fetch a dataset for one named source) and `BrandsProvider` (`version`, `fetchIndex()`, `providerFor(source, index)`): brands are declared by one index rather than registered one by one
- `src/persistence/httpFoodSourceProvider.ts` — configured with `{ name, baseUrl }`; fetches `manifest.json` + `foods.json` from `<baseUrl>/<source>-v<version>/`, validates SHA-256, returns `SourcedFood[]`
- `src/persistence/brandsProvider.ts` — `HttpBrandsProvider`: fetches `index.json` (every brand as `[id, label, count, shard]`, plus each shard's hash and size) and turns a `brand:<id>` source into a provider over its shard — validates the whole shard's SHA-256, hands back only that brand's rows
- `src/persistence/fetchBytes.ts` — `fetchVerifiedJson()`: the one hash-checked fetch behind both HTTP providers
- `src/ui/sourcePicker.ts` — the Sources disclosure on the Catalog tab: a fuzzy filter over three sections — USDA (the static sources), Stores (one checkbox per bundle), Brands (from the index: unfiltered it lists only the brands that are on, a filter searches all of them, capped at 25 matches)
- `scripts/build-food-source.ts` — offline dataset builder. Three modes: `curated` (`scripts/curated-foods.json` → source `usda`), `full` (`scripts/food-classifications.json` → source `usda-full`, refuses to ship unjudged rows), `brands` (the USDA Branded dump, streamed by `scripts/jsonArrayScanner.ts`, names cleaned and brands collected by `scripts/brandedMapper.ts` → `public/data/brands-v<version>/index.json` + `shard-<n>.json`). The USDA modes emit `public/data/<source>-v<version>/foods.json` + `manifest.json`; everything is committed and served same-origin under GH Pages. CLI in the [README](../README.md#updating-the-food-database)

`app.ts` is the only place that knows about both repositories; layering ([ADR 0005](./decisions/0005-layered-architecture.md)) still applies.

## Recipes

A recipe (`Recipe`) is a named list of portions (`Portion = { foodId, amount, unit }`) over the user's live foods. Logging one writes one plain `Entry` per portion (amount × servings) into the latest meal, all tagged with a `RecipeLog { id, recipeId, servings }` through `entry.recipeLogId`; calc, totals, the chart and export never see recipes ([ADR 0009](./decisions/0009-recipes-expand-into-grouped-entries.md)). The log view groups a meal's entries by recipe log under a header that deletes the group; a recipe log dies with its last entry, like a meal. A food a live recipe uses can't be soft-deleted or flip its count/weight axis. Both fields are additive on the v2 blob; `parseState` drops a `recipeLogId` that names no record instead of rejecting, because an older build sharing the localStorage blob drops `recipes` and `recipeLogs` when it re-saves. See [013-recipes/spec.md](./013-recipes/spec.md).

Key files:
- `src/domain/recipes.ts` — `liveRecipes`, `recipeNutrition(recipe, foodsById)` (skips deleted foods), `liveRecipeUsing(recipes, foodId)`, `referencedRecipeLogs(recipeLogs, entries)` (the one pruning rule, used by the reducer and the validator)
- `src/domain/foodLocks.ts` — `axisLock(state, foodId)`: why a food's count/weight axis can't change (entries, or a live recipe), shared by the reducer and the food form intent
- `src/ui/recipeIntents.ts` — `parseRecipeIntent` (editor form → AddRecipe / EditRecipe), `RecipeDraft` (amounts keyed by food id, plus servings), `draftForRecipe`, `parseRecipeDraft` (the card's live totals and the log intent share it), `parseRecipeLogIntent` (→ LogRecipe)
- `src/ui/logPicker.ts` — `searchPicker(state, query, now)`: live foods and recipes as `PickerItem`s, ranked by match tier, then recency (`compareForLog` counts a recipe's logged entries), then name
- `src/ui/recipeEditor.ts` — the Recipes tab form: `createRecipeEditor()` → `{ node, render }`, item rows keyed by food id so typing keeps focus
- `src/ui/pickerOption.ts`, `src/ui/listRow.ts`, `src/ui/unitPicker.ts` — shared factories: every clickable picker row (log picker, editor food picker), every Foods / Recipes list row, every unit button group (`createUnitPicker()`, a `createToggleGroup` over `UNITS`)
- `src/ui/foodTitle.ts` — `foodTitle()` (highlighted name plus brand tag) and `foodLabel()` (name plus brand as plain text): the shared brand-aware rendering every food-facing row, aria-label and detail region uses

## Trends

The Trends tab is one stacked chart — calories per day from each macro — computed on read from `state.entries`; nothing about it is persisted. An unlogged day is a gap, never a zero, and stays out of every mean. See [014-trends/spec.md](./014-trends/spec.md) and [ADR 0010](./decisions/0010-trend-charts.md).

Key files:
- `src/domain/trends.ts` — `TREND_RANGES` (key order = toggle order; `buckets × bucketDays`), `trendData(state, today, range)` → `{ bucketDays, buckets }`: one pass over the entries; buckets are per-day means over logged days (`perDay: null` for a gap)
- `src/domain/calc.ts` — `totalsByDate(state, from, to)`: one pass over entries; only dates with an entry appear
- `src/domain/types.ts` — `nutrientCalories(key, n)` and `macroPctOfCalories(n)`: the calories a macro contributes and its share of the stated calorie line, behind the donut slices and the trend readout; `macroSharePct(n)` is the same macro's share of the macro calories as whole numbers that sum to 100, behind the donut legend and the detail cards
- `src/ui/trendChart.ts` — `createTrendChart()` → `{ node, render(props) }`: one stack per bucket (a segment per `MACRO_KEYS` in calories), axes, hit columns, caption and legend, the readout table (grams, calories, share per macro, plus the day's calories), and the empty state; draws in pixels at the measured box, scales its chrome with the box, and redraws itself from a ResizeObserver
- `src/ui/toggleGroup.ts` — `createToggleGroup()` and `setActive()`: the one button-group factory behind the unit pickers and the range toggle
- `src/ui/legend.ts`, `src/ui/svg.ts` — the legend row and SVG element builder shared by the donut and the trend chart

## Offline

A service worker precaches the app shell per build and serves it when the network is unreachable; the catalog stays in IndexedDB, and `npm run dev` has no worker. See [ADR 0011](./decisions/0011-offline-app-shell.md) for the routing rules and why.

Key files:
- `src/sw/sw.ts` — the worker: install precaches (revalidating), activate drops this scope's older caches, fetch applies `route()`. Bundled on its own, imports nothing from the app; type-checked under the WebWorker lib by `src/sw/tsconfig.json` (the root tsconfig excludes `src/sw`)
- `src/sw/routing.ts` — pure rules: `route(request, installed)` → `shell | precached | network` (only the scope's own document is `shell`; a deeper navigation such as a PR preview under the site's scope passes through), `cacheName(base, hash)`, `staleCaches(names, base, hash)`; the `ShellManifest` type the build injects as `__SHELL__`
- `src/sw/strategies.ts` — `fetchWhole(url, cache, timeoutMs, fetcher)` (resolves only once the whole body arrived, aborts on timeout) and `networkFirst(load, fallback)`; the fetch is injected so tests drive them without a worker
- `scripts/serviceWorkerPlugin.ts` — Vite plugin: after the app bundle is written, collects it plus `public/`'s top-level files, hashes them through `scripts/shellManifest.ts` (sorted paths, 8-hex content hash, source maps dropped) and runs a second single-file `vite build` that emits `dist/sw.js`; refuses a shell without `index.html` or the app bundle, a path listed twice, or a worker that is not one classic script
- `src/main.ts` — registers `${BASE_URL}sw.js` when `import.meta.env.PROD`

To see it: `npm run build && npm run preview`, then DevTools → Application → Service Workers / Cache Storage, or stop the server and reload.

## Still TBD
- Linter/formatter (Prettier/ESLint) — TBD as repo grows
- Cloud sync architecture — deferred past current plan
