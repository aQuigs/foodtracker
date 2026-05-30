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
- Write to `FoodSourceRepository` from anywhere except `app.ts` boot-time hydration (sourced foods are read-only at runtime)

## Food sources system

The food library has two layers:

- **User-created foods** — `state.foods`, writable, lifecycle (`createdAt`, `deletedAt`), localStorage via `StateRepository`.
- **Sourced foods** — read-only, immutable per-version, IndexedDB via `FoodSourceRepository`. Hydrated on first launch by fetching a versioned dataset from a `FoodSourceProvider` (today: a GitHub Release asset for the `usda` source).

The picker queries both and merges results. See [011-external-food-db/spec.md](./011-external-food-db/spec.md) and [ADR 0007](./decisions/0007-multi-source-food-library.md).

Key files:
- `src/persistence/foodSourceRepository.ts` — read-mostly multi-source library interface
- `src/persistence/indexedDbFoodSource.ts` — IndexedDB adapter
- `src/persistence/inMemoryFoodSource.ts` — test fake
- `src/persistence/foodSourceProvider.ts` — provider interface (fetch a dataset for one named source)
- `src/persistence/httpFoodSourceProvider.ts` — fetches `foods.json.gz` + `manifest.json` from `<baseUrl>/<tagPrefix><version>/`, validates SHA-256, decompresses, returns `SourcedFood[]`
- `src/domain/foodSources.ts` — known source-name constants (`FOOD_SOURCES.USDA = 'usda'`)
- `scripts/build-food-source.ts` — offline dataset builder (USDA dumps → `public/data/usda-v<version>/foods.json.gz` + `manifest.json`; committed and served same-origin under GH Pages)

`app.ts` is the only place that knows about both repositories; layering ([ADR 0005](./decisions/0005-layered-architecture.md)) still applies.

## Still TBD
- Linter/formatter (Prettier/ESLint) — TBD as repo grows
- Cloud sync architecture — deferred past current plan
