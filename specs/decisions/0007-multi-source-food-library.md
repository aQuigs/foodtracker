# 0007 — Multi-source food library, IndexedDB-backed, pluggable providers

**Date:** 2026-05-29

## Context

The app originally shipped ~10 hand-seeded foods. Real use needs thousands. Three forces shape the answer:

1. **The catalog must be able to grow.** Two tiers ship today — a small curated set of everyday ingredients with hand-written names, and a larger machine-judged set distilled from the USDA reference data (counts and sizes in the [README](../../README.md#updating-the-food-database)). USDA Branded-scale sources run to hundreds of MB. Bundling any of this into the GH Pages JS payload bloats every page load. At a few thousand rows the read-only catalog is far more than the single localStorage blob should carry, so it lives in IndexedDB while user state stays in localStorage.
2. **The catalog is read-mostly.** The user adds/edits their own foods (`Food` in `state.foods`); USDA-style reference data is never edited.
3. **Future food sources are plausible.** Pantry items (filter by "in-stock"), restaurant menus, meal-kit catalogs. Shipping today should not force a persistence-layer rewrite in a later milestone.

## Decision

### 1. Split read-only sourced foods from writable user state

A `SourcedFood` type and `FoodSourceRepository` live alongside the existing `Food` and `StateRepository`. The log picker reads `state.foods` only; the Catalog tab searches `FoodSourceRepository`, and Add copies the hit into `state.foods` as a normal loggable, edit-locked food.

- `Food` keeps its lifecycle (`createdAt`, `deletedAt`), lives in `state.foods`, owned by `StateRepository` (localStorage).
- `SourcedFood` is immutable per-version, lives in IndexedDB, owned by `FoodSourceRepository`.

Splitting buys clean storage semantics: one writable store (small, localStorage), one read-mostly store (large, IndexedDB). It also matches the layered architecture ([ADR 0005](./0005-layered-architecture.md)) — both repositories are siblings in `src/persistence/`, both behind interfaces, neither known to UI or domain.

### 2. Multi-source data model, not single-catalog

`SourcedFood` carries `source: string`, `sourceId: string`, and optional `tags?: string[]`. The repository is partitioned by source: `hydrate(source, items, manifest)` replaces one partition atomically; `search(query, { limit?, sources? })` filters by `sources`.

- `sources?` filter is wired and tested.
- `SourcedFood.tags` carries the source's category so metadata never has to ride in the display name; nothing filters on it yet.

Picking the multi-source shape now (rather than "single catalog, refactor later") costs almost nothing — the IndexedDB store already needs a `source` index for per-partition replacement. Extensibility comes for free.

### 3. Provider selection is a build-time choice

`FoodSourceProvider` is the fetcher interface. Concrete providers are picked in `src/main.ts` and not configurable at runtime. Today: one `HttpFoodSourceProvider({ name, baseUrl })` per source, with a same-origin `baseUrl` pointing at `public/data/`; it reads `<baseUrl>/<source>-v<version>/`, the directory convention defined once as `datasetDir()` in `src/domain/foodSources.ts` and shared with the build script.

- No "switch source" UI. Sources are architecture decisions, not user preferences.
- Adding a source is a code change: implement the provider, register it in `main.ts`, add a `CATALOG_VERSIONS` entry, classify it in `SOURCE_TIER`.

This avoids a config layer the app doesn't need and keeps the composition root the single source of truth for what the app talks to.

## Alternatives considered

- **Single `Food` table, one writable store** — merges user and external foods, dirties lifecycle semantics, forces a soft-delete model on read-only data. Rejected.
- **Bundle the catalog in the JS payload** — it re-ships with every deploy and parses before any UI renders, and larger sources (full USDA, Branded) would make it unviable. Rejected. (The same-origin static asset under `public/data/` is *not* this: it's a separately-fetched file, not bundled into JS, and is gated by the IndexedDB cache check so existing users skip the network entirely.)
- **Bundle a curated subset** (top-N most-searched foods, ~1k items) inside the app JS as a starter dataset — adds an arbitrary curation decision and inflates the JS bundle. Rejected.
- **GitHub Releases as the hosting tier** — Rejected: `github.com/<user>/<repo>/releases/download/...` does not send `Access-Control-Allow-Origin`, so browsers block the fetch from `aquigs.github.io`. Same-origin under `public/data/` solves it without a third party.
- **jsDelivr CDN proxy** — real global CDN with CORS, free for OSS GitHub repos. Adds a third party to the runtime path. Saved as a future provider if same-origin bandwidth (~100 GB/month soft cap on GH Pages) ever becomes a problem.
- **Sibling `foodtracker-data` GH Pages site** — works but doubles the deploy story for no benefit at this scale. Rejected.
- **Server-backed API for the catalog** — adds backend hosting + cost + an auth story. Rejected — the catalog is static reference data.
- **Single `Catalog*` naming** (one source, one type) — works for one source but locks pantry/menu use cases out without a rename. Rejected on the ~10-line cost of going generic now.
- **Runtime-configurable provider** — picker UI for "where do you want food data from?" — solves a problem nobody has. Rejected.
- **USDA FoodData Central API as the wired provider** — always-fresh data, but requires an API key (awkward to commit to a public repo), 1000/hr rate limit, and per-search latency. Saved as a future provider.

## Consequences

- **First-launch UX** has a one-time download of both tiers (sizes in the [README](../../README.md#updating-the-food-database)) behind a text-only, non-blocking banner. Subsequent launches are instant.
- **App is offline-capable after first hydration.** IndexedDB holds the catalog indefinitely.
- **Catalog search is async (IndexedDB); the log picker stays synchronous over `state.foods`.**
- **Adding a source** = (a) implement a `FoodSourceProvider`, (b) wire it in `main.ts`, (c) add `CATALOG_VERSIONS[source]` and classify it in `SOURCE_TIER` (both `Record<FoodSource, …>`, so the compiler refuses an unclassified source), (d) commit the dataset under `public/data/<source>-v<version>/`. No UI changes if the source returns `SourcedFood`-shaped data.
- **Bumping `CATALOG_VERSIONS[source]`** triggers re-hydration of that source on next boot. No background sync; no delta updates.
- **A failed first-launch fetch affects only the Catalog tab**, which has nothing to show until a source hydrates. The log picker and Foods view work as normal over `state.foods`. A non-blocking error banner explains; reloading retries.
- **The dataset build is a manual local step.** `scripts/build-food-source.ts` resolves both the curated list and the classification file against USDA dumps and emits `foods.json` + `manifest.json` per source into `public/data/<source>-v<version>/`. The human commits and pushes; GH Pages redeploys app and data together. Documented in the [README](../../README.md#updating-the-food-database).
- **Bandwidth ceiling.** GH Pages' soft cap is 100 GB/month. At the gzipped sizes in the [README](../../README.md#updating-the-food-database) a fresh user costs well under 100 KB, so the cap allows over a million fresh-cache hits a month; existing users skip the network (IndexedDB cache). If a future source pushes near the cap, swap `HttpFoodSourceProvider`'s `baseUrl` to a jsDelivr URL with no other code changes.
- **USDA Branded data (~600k items, ~400 MB)** is out of scope. Adding it later is a build-script change + a `public/data/` commit + a `CATALOG_VERSIONS` entry. At that size, switch to jsDelivr.
