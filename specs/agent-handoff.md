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
- Write to `FoodSourceRepository` from anywhere except `app.ts` boot-time hydration (sourced foods are read-only at runtime)

## Food sources system

The food library has two layers:

- **User-created foods** — `state.foods`, writable, lifecycle (`createdAt`, `deletedAt`), localStorage via `StateRepository`. The log picker searches only these.
- **Sourced foods** — read-only, immutable per-version, IndexedDB via `FoodSourceRepository`. Two sources: `usda` (curated tier) and `usda-full` (machine-judged tier), each hydrated on first launch from a `FoodSourceProvider` that fetches a versioned dataset from the site's own `public/data/`. Searched only from the Catalog tab; Add copies a hit into `state.foods` as an edit-locked `Food`.

See [011-external-food-db/spec.md](./011-external-food-db/spec.md) and [ADR 0007](./decisions/0007-multi-source-food-library.md).

Key files:
- `src/domain/foodSources.ts` — `FOOD_SOURCES` (`USDA = 'usda'`, `USDA_FULL = 'usda-full'`), `CATALOG_VERSIONS` (pinned dataset version per source), and `datasetDir(source, version)` → `<source>-v<version>`, the one definition of the dataset directory convention, used by the build script and the HTTP provider
- `src/persistence/foodSourceRepository.ts` — read-mostly multi-source library interface: `currentVersion(source)`, `hydrate(source, items, manifest)` (replaces that source's partition), `search(query, opts)`
- `src/persistence/indexedDbFoodSource.ts` — IndexedDB adapter (`idb`, DB `foodtracker-foods`)
- `src/persistence/inMemoryFoodSource.ts` — test fake
- `src/persistence/foodNameMatch.ts` — shared token matcher so both adapters match identically
- `src/persistence/foodSourceProvider.ts` — provider interface (fetch a dataset for one named source)
- `src/persistence/httpFoodSourceProvider.ts` — configured with `{ name, baseUrl }`; fetches `manifest.json` + `foods.json` from `<baseUrl>/<source>-v<version>/`, validates SHA-256, returns `SourcedFood[]`
- `scripts/build-food-source.ts` — offline dataset builder. Two modes: `curated` (`scripts/curated-foods.json` → source `usda`) and `full` (`scripts/food-classifications.json` → source `usda-full`, refuses to ship unjudged rows). Both emit `public/data/<source>-v<version>/foods.json` + `manifest.json`; committed and served same-origin under GH Pages. CLI in the [README](../README.md#updating-the-food-database)

`app.ts` is the only place that knows about both repositories; layering ([ADR 0005](./decisions/0005-layered-architecture.md)) still applies.

## Still TBD
- Linter/formatter (Prettier/ESLint) — TBD as repo grows
- Cloud sync architecture — deferred past current plan
