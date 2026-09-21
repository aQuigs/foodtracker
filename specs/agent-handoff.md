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
- **Sourced foods** — read-only, immutable per-version, IndexedDB via `FoodSourceRepository`. Two static sources — `usda` (curated tier, "Everyday foods") and `usda-full` ("All USDA foods") — are on by default; beyond them every brand in USDA Branded Foods is a source of its own, `brand:<id>` (~33,000 brands, ~380,000 rows), off until ticked. `state.enabledSources` (localStorage blob, additive on v2) says which are on; boot hydrates only those, ticking one in the Catalog tab's source picker hydrates it on the spot, and search covers only what is on. All of it is served from the site's own `public/data/`. CI builds that directory on every deploy and preview, and none of it is committed ([README](../README.md#updating-the-food-database)). It holds one file per static source, and the brands filed by the first character of their id, one letter file each. The `version` in `manifest.json` is the one build every source is expected to match. A source cached at a different version downloads again. A row carries its own brand (`SourcedFood.brand`, `Food.brand`) — the brand tag, the brand half of the search text and food identity all read that field, never the source name. Add copies a hit into `state.foods` as an edit-locked `Food`.

A store (`STORE_BUNDLES`) is one picker checkbox for its house brands, either checked or not. `enabledSources` lists it by its own id (`costco`, the name the old store packs had). `expandStores()` turns it into its house brands' `brand:<id>` sources, each listed once, and only where search and hydration need concrete sources. House brands never appear under Brands. When a stored blob has one on by itself, parsing rewrites it to its store (`houseBrandsAsStores()`). A food added from an old store pack keeps the store's label as its `brand`.

See [011-external-food-db/spec.md](./011-external-food-db/spec.md), [ADR 0007](./decisions/0007-multi-source-food-library.md) and [ADR 0012](./decisions/0012-brand-partitions-store-bundles.md), which supersedes the per-store datasets of [ADR 0008](./decisions/0008-opt-in-source-packs.md).

Key files:
- `src/domain/foodSources.ts` — `FOOD_SOURCES` (names), `FOOD_SOURCE_META` (one struct per static source: `label`, `tier`, `defaultOn`; registry order = picker order = fold order), `brandSource(id)` / `brandIdOf(source)`, `brandDirectory(list)` (the brand list decoded once for the picker: `byId`, and `searchable`, every brand but the house brands with its match key), `STORE_BUNDLES` + `isStore()` / `isHouseBrand()` / `expandStores()` / `sourcesByPick()` (each enabled name with the sources it reaches, which the hydration banners group by) / `houseBrandsAsStores()`, `sourceLabel()` (the registry label, a store's label, else the brand id read back as words; a result fold and a download banner read the brand list's label once it is loaded, else the label the brand's rows carry, and the picker the brand list's), `searchText(name, brand?)` (name plus brand) and `brandedSearchKey(name, brand?)` (what every search matches on), `sourceTier()` (curated vs deep, i.e. flat vs folded; a brand folds like the deep tier), `defaultEnabledSources()`, `isFoodSource()`
- `src/domain/dataFiles.ts` — the wire format the build writes and the app reads: `DATA_PATHS`, `CatalogManifest`, `BrandList` (every brand as `[id, label, count, included]`, where `included` is false for a brand listed without rows), `brandFileKey(id)` (which letter file holds a brand), `BrandFile` / `BrandRow`, and `brandFood()`, the only decoder of a row. The validators sit with the others in `src/domain/validate.ts`. `scripts/brandFiles.ts` writes through the same types and checks every entry with the validator the app reads it through
- `src/domain/searchKey.ts` — `searchKey(name)`: lowercased, diacritics stripped, punctuation folded to spaces. Both repository adapters index and match on it, the fzf ranker classifies tiers on it, and the brands build keys brand ids by it, so every search path agrees
- `src/domain/foodNames.ts` — `foodIdentityKey({ name, brand? })` and `nameTaken(item, items, ignoreId?)`: live identity is name plus brand (a branded row's identity includes its tag) for foods, name alone for recipes (no brand) — one rule shared by both, enforced by the reducer (AddFood / EditFood / ReviveFood / AddRecipe / EditRecipe), repaired at the state boundary, and surfaced with messages by the food form, the recipe editor and catalog Add
- `src/persistence/foodSourceRepository.ts` — read-mostly multi-source library interface: `currentVersion(source)`, `hydrate(source, items, version)` (replaces that source's partition and records its version), `search(query, opts)` (`opts.sources` walks only those partitions), `getMeta(key)` / `setMeta(key, value)` (the offline copies of the manifest and the brand list)
- `src/persistence/indexedDbFoodSource.ts` — IndexedDB adapter (`idb`, DB `foodtracker-catalog`, schema 1; an upgrade drops every store). It has a foods store whose `name_key` index is `brandedSearchKey(name, brand)`, a versions store holding each source's version, and a `meta` store holding `catalog-manifest` and `brand-list`. A database a newer build left at a higher schema is deleted and rebuilt. An upgrade or delete another tab holds up rejects at once instead of waiting, and a tab that holds the database closes it when another build asks. It never opens or deletes the retired `foodtracker-foods` database; a later build will remove it
- `src/persistence/inMemoryFoodSource.ts` — test fake
- `src/persistence/foodNameMatch.ts` — shared token matcher so both adapters match identically
- `src/persistence/foodSourceProvider.ts` — `FoodSourceProvider` (`name`, `fetchRows(version, onProgress?)`) and `BrandsProvider` (`fetchList(version)`, and `batch(run)`, whose `run` gets a provider for any brand id; the brands hydrated inside one `run` share each letter file's download, let go when `run` settles). Brands are declared by one list rather than registered one by one
- `src/persistence/httpFoodSourceProvider.ts` — `fetchCatalogManifest(baseUrl)` (fetched with `cache: 'no-cache'`) and `HttpFoodSourceProvider` (`<baseUrl>/<source>.json?v=<version>`, every row validated)
- `src/persistence/brandsProvider.ts` — `HttpBrandsProvider`: fetches the brand list, and fetches a brand's rows from its letter file (`brands/<key>.json?v=<version>`, one request per file and build for all of one batch's brands; app.ts makes a batch of each pick and each import, and boot one per letter file), taking only that brand's entry, or none when the file lacks it, and decoding it with `brandFood()`
- `src/domain/sharedLoad.ts` — `sharedLoad(start)`: one promise every caller shares, forgotten when it fails so the next need retries; the manifest and the IndexedDB connection load through it
- `src/persistence/fetchJson.ts` — `dataUrl()` (appends `?v=<version>`) and `fetchJson()` (reads with progress, parses, and labels any error with the URL), used by both HTTP providers
- `src/ui/sourcePicker.ts` — the Sources disclosure on the Catalog tab: a fuzzy filter over three sections, in order USDA (the static sources), Brands and Stores. With no filter, Brands lists only the brands that are on. With a filter, it searches the brand list and shows the top 25, ranked by match quality, then row count. The list loads when the picker first opens; a failed load retries on the next open or filter keystroke. House brands are left out of Brands. A brand listed without rows appears in the same row as any other, with a disabled checkbox and the note "not included (N items)". Stores has one checkbox per store
- `scripts/build-data.ts` — builds all of `public/data/` from USDA's bulk downloads: the curated and full USDA sources (`scripts/usdaMapper.ts`), and the brands (the Branded dump streamed by `scripts/jsonArrayScanner.ts`, names cleaned and brands collected by `scripts/brandedMapper.ts`, written by `scripts/brandFiles.ts`). CLI and CI in the [README](../README.md#updating-the-food-database)

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
