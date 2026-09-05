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
- `src/domain/foodNames.ts` — `foodIdentityKey({ name, source })` and `nameTaken(food, foods, ignoreId?)`: live foods are unique by name plus brand (a pack row's identity includes its tag), enforced by the reducer (AddFood / EditFood / ReviveFood), repaired at the state boundary, and surfaced with messages by the food form and catalog Add
- `src/persistence/foodSourceRepository.ts` — read-mostly multi-source library interface: `currentVersion(source)`, `hydrate(source, items, manifest)` (replaces that source's partition), `search(query, opts)` (`opts.sources` walks only those partitions)
- `src/persistence/indexedDbFoodSource.ts` — IndexedDB adapter (`idb`, DB `foodtracker-foods`)
- `src/persistence/inMemoryFoodSource.ts` — test fake
- `src/persistence/foodNameMatch.ts` — shared token matcher so both adapters match identically
- `src/persistence/foodSourceProvider.ts` — provider interface (fetch a dataset for one named source)
- `src/persistence/httpFoodSourceProvider.ts` — configured with `{ name, baseUrl }`; fetches `manifest.json` + `foods.json` from `<baseUrl>/<source>-v<version>/`, validates SHA-256, returns `SourcedFood[]`
- `src/ui/sourcePicker.ts` — the Sources disclosure on the Catalog tab: fuzzy filter + one checkbox per wired source
- `scripts/build-food-source.ts` — offline dataset builder. Three modes: `curated` (`scripts/curated-foods.json` → source `usda`), `full` (`scripts/food-classifications.json` → source `usda-full`, refuses to ship unjudged rows), `packs` (`scripts/brand-packs.json` + the USDA Branded dump, streamed by `scripts/jsonArrayScanner.ts`, names cleaned mechanically by `scripts/brandedMapper.ts` → one dataset per pack). All emit `public/data/<source>-v<version>/foods.json` + `manifest.json`; committed and served same-origin under GH Pages. CLI in the [README](../README.md#updating-the-food-database)

`app.ts` is the only place that knows about both repositories; layering ([ADR 0005](./decisions/0005-layered-architecture.md)) still applies.

## Trends

The Trends tab is computed on read from `state.entries`; nothing about it is persisted. An unlogged day is a gap, never a zero, and stays out of every mean. See [014-trends/spec.md](./014-trends/spec.md) and [ADR 0010](./decisions/0010-trend-charts.md).

Key files:
- `src/domain/trends.ts` — `TREND_RANGES` (key order = toggle order; `buckets × bucketDays`), `TREND_METRICS` (which nutrient keys each chart stacks; every series is in calories), `trendSeries(state, today, range)` → `TrendBucket[]` (per-day means over logged days, `perDay: null` for a gap), `trailingAverage(state, today, range)` (7-day trailing mean of calories for day-bucketed ranges, `[]` otherwise)
- `src/domain/calc.ts` — `totalsByDate(state, from, to)`: one pass over entries; only dates with an entry appear
- `src/domain/types.ts` — `nutrientCalories(key, n)`: the calories a nutrient contributes; the donut and the macros chart both use it
- `src/ui/trendChart.ts` — `createTrendChart()` → `{ node, render(props) }`: bars, stacked segments, trendline, axes, hit columns, the readout card, and the empty state; draws in pixels at the measured box, scales geometry by the root font size, and redraws itself from a ResizeObserver
- `src/ui/toggleGroup.ts` — `createToggleGroup()` and `setActive()`: the one button-group factory behind the unit pickers, the metric toggle and the range toggle
- `src/ui/legend.ts`, `src/ui/svg.ts` — the legend row and SVG element builder shared by the donut and the trend chart

## Still TBD
- Linter/formatter (Prettier/ESLint) — TBD as repo grows
- Cloud sync architecture — deferred past current plan
