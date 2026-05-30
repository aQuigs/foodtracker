# 0007 — Multi-source food library, IndexedDB-backed, pluggable providers

**Date:** 2026-05-29

## Context

The app ships ~10 hand-seeded foods. Real use needs thousands. Three forces shape the answer:

1. **The catalog is large** (~16k items / ~8 MB gz for USDA Foundation+SR Legacy+FNDDS today; could grow to ~50 MB+ if Branded is added). Bundling it into the GH Pages payload bloats every page load.
2. **The catalog is read-mostly**. The user adds/edits their own foods (`Food` in `state.foods`); USDA-style reference data is never edited.
3. **Future food sources are plausible.** Pantry items (filter by "in-stock"), restaurant menus, meal-kit catalogs. We don't want to ship today and rewrite the persistence layer in M12.

## Decision

**Three concrete choices, captured here so future agents don't relitigate them.**

### 1. Split read-only sourced foods from writable user state

A new `SourcedFood` type and `FoodSourceRepository` live alongside the existing `Food` and `StateRepository`. The picker queries both and merges results.

- `Food` keeps its lifecycle (`createdAt`, `deletedAt`), lives in `state.foods`, owned by `StateRepository` (localStorage).
- `SourcedFood` is immutable per-version, lives in IndexedDB, owned by `FoodSourceRepository`.

Splitting buys clean storage semantics: one writable store (small, localStorage), one read-mostly store (large, IndexedDB). It also matches the existing layered architecture ([ADR 0005](./0005-layered-architecture.md)) — both repositories are siblings in `src/persistence/`, both behind interfaces, neither known to UI or domain.

### 2. Multi-source data model, not single-catalog

`SourcedFood` carries `source: string`, `sourceId: string`, and optional `tags?: string[]`. The repository is partitioned by source: `hydrate(source, items, manifest)`, `clear(source)`, `count(source?)`. Search accepts `SearchOptions { limit, sources?, tags? }`.

- `sources?` filter is wired and tested.
- `tags?` is accepted-but-ignored in M11; the parameter is in the interface so future tag-aware sources (pantry filter, dietary tags) don't require an interface change.

Picking the multi-source shape now (rather than "single catalog, refactor later") costs almost nothing — the IndexedDB object stores already need `source` as an index for per-partition `clear()`. We get extensibility for free.

### 3. Provider selection is a build-time choice

`FoodSourceProvider` is the fetcher interface. Concrete providers (`HttpFoodSourceProvider` today, with a same-origin `baseUrl` pointing at `public/data/`; future jsDelivr / USDA API providers) are picked in `src/main.ts` and not configurable at runtime.

- No "switch source" UI. Sources are intentional architecture decisions, not user preferences.
- Adding a new source is a code change: implement the provider, register it in `main.ts`, bump `catalogVersions`.

This avoids a config layer the app doesn't need yet and keeps the composition root the single source of truth for what the app talks to.

## Alternatives considered

- **Single `Food` table, one writable store** — merges user and external foods, dirties lifecycle semantics, forces a soft-delete model on read-only data. Rejected.
- **Bundle the catalog in the JS payload** — ~8 MB gz parsed on every cold cache hit before any UI renders. Page load becomes catalog load. Rejected. (The same-origin static asset under `public/data/` is *not* this: it's a separately-fetched file, not bundled into JS, and is gated by the IndexedDB cache check so existing users skip the network entirely.)
- **Bundle a curated subset** (top-N most-searched foods, ~1k items) inside the app JS as a starter dataset — adds an arbitrary curation decision and inflates the JS bundle. Rejected.
- **GitHub Releases as the hosting tier** — initial plan. Rejected when verified: `github.com/<user>/<repo>/releases/download/...` does not send `Access-Control-Allow-Origin`, so browsers block the fetch from `aquigs.github.io`. Same-origin under `public/data/` solves it without a third party.
- **jsDelivr CDN proxy** — real global CDN with CORS, free for OSS GitHub repos. Adds a third-party in the runtime path. Saved as a future provider if same-origin bandwidth (~100 GB/month soft cap on GH Pages) ever becomes a problem.
- **Sibling `foodtracker-data` GH Pages site** — works but doubles the deploy story for no benefit at this scale. Rejected.
- **Server-backed API for the catalog** — adds backend hosting + cost + an auth story. Rejected — the catalog is static reference data.
- **Single `Catalog*` naming** (one source, one type) — works for M11 but locks pantry/menu use cases out without a rename. Rejected on the ~10-line cost of going generic now.
- **Runtime-configurable provider** — picker UI for "where do you want food data from?" — solves a problem nobody has. Rejected.
- **USDA FoodData Central API as the wired provider** — always-fresh data, but requires an API key (awkward to commit to a public repo), 1000/hr rate limit, and per-search latency. Saved as a future provider.

## Consequences

- **First-launch UX** has a one-time ~8 MB download with a progress banner. Subsequent launches are instant.
- **App is offline-capable after first hydration.** IndexedDB holds the catalog indefinitely.
- **Search becomes async.** The picker's sync `state.foods.filter(...)` is replaced by a thin app-layer `searchFoods(query, opts?)` that awaits the IndexedDB repo. This sync→async hop is the main UI plumbing change in PR3.
- **Adding a source** = (a) implement a `FoodSourceProvider`, (b) wire it in `main.ts`, (c) bump `catalogVersions[source]`, (d) commit the dataset under `public/data/<source>-v<version>/`. No domain or UI changes if the source returns `SourcedFood`-shaped data.
- **Bumping `catalogVersions.<source>`** in code triggers re-hydration on next boot. No background sync; no delta updates.
- **A failed first-launch fetch leaves the picker on seed foods only** with a non-blocking error banner. The user can still log from the ~10 seed foods while reloading to retry.
- **The dataset build is a manual local step.** A script (`scripts/build-food-source.ts`) ingests USDA dumps, emits `foods.json.gz` + `manifest.json` into `public/data/<source>-v<version>/`. The human commits and pushes. GH Pages redeploys the app and dataset together. Documented in `README.md`.
- **Bandwidth ceiling.** GH Pages' soft cap is 100 GB/month — at ~8 MB per fresh user, that's ~12,500 fresh-cache hits/month. Existing users skip the network (IndexedDB cache). If a future source pushes us near the cap, swap the `HttpFoodSourceProvider`'s `baseUrl` to a jsDelivr URL with no other code changes.
- **Branded USDA data (~600k items, ~400 MB)** is explicitly out of scope. Adding it later is a build-script change + a `public/data/` commit + a `catalogVersions` bump. The ~400 MB blob would push hard against the GH Pages soft cap; switch to jsDelivr at that point.
