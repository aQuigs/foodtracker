# M11 — External food sources, IndexedDB-backed, pluggable providers

## Goal
Grow the food library from ~10 hand-seeded entries to ~13.6k without bloating the app bundle. On first launch, the browser fetches the USDA Foundation + SR Legacy + FNDDS dataset (~380 KB gzipped) from the site's own static assets and caches it in IndexedDB. The app JS stays small; the library lives client-side after one download.

Architected from day one to host **multiple food sources** (USDA today; future: user pantry, restaurant menus, meal-kit catalogs, etc.) behind one interface, with optional source/tag filtering at search time. Only one source ships in M11.

## In scope
- New `FoodSourceRepository` interface in `src/persistence/` for the read-mostly multi-source food library (distinct from the writable `StateRepository` for user logs).
- `IndexedDbFoodSourceRepository` adapter — async, holds the bulk library (~13.6k items at M11; per-source partitioning so multiple sources can coexist later).
- `FoodSourceProvider` interface — fetches a versioned dataset for one named source. Pluggable, picked at composition time in `src/main.ts`.
- Concrete first provider: **`HttpFoodSourceProvider`** — fetches a gzipped JSON dataset from the site's own static assets (URL: `<site>/data/usda-v<n>/foods.json.gz`). Same-origin, so no CORS exposure.
- A one-time build script (`scripts/build-food-source.ts`) that ingests the three USDA datasets, normalizes the JSON shape, and emits `foods.json.gz` + `manifest.json` into `public/data/usda-v<n>/`. No filtering, no curation. Run locally; output committed so GH Pages deploys app + dataset together.
- Hydration flow: on app boot, for each configured source, if IndexedDB partition is empty or version-stale, fetch from the provider, validate, write to IndexedDB. UI shows progress while it downloads.
- SHA-256 integrity check on the downloaded dataset.
- Version pinning per source: app pins an expected version for each configured source (`catalogVersions` map in `src/main.ts`). Bumping a version triggers re-hydration of that source on next boot.
- Search/lookup adapter changes so existing UI code (food picker, fuzzy search) reads from `FoodSourceRepository` instead of `state.foods` directly.

## Out of scope
- Editing/extending external foods (sourced foods are read-only; user-created foods stay in `state.foods` via the existing `StateRepository`).
- Server-side / cloud sync.
- Picking sources via UI — sources are wired at build time in `src/main.ts`. Adding or swapping one is a code change.
- Background incremental updates / delta sync. Bumping a source's version re-downloads the full dataset for that source.
- Manual "re-download" / "clear cache" controls. Re-hydration only happens via a `catalogVersions` bump.
- Bundled fallback library. If first-launch fetch fails, the app shows an error state until the user reloads. The existing 10 `seed-*` foods in `state.foods` stay there from prior `freshState()` calls but are not relied on as a runtime safety net.
- USDA Branded dataset (~600k items, ~400 MB). Future milestone.
- Pantry source, menu sources, tag-based UI filters. The data model accommodates them; no UI ships in M11.
- Barcode lookup, image fetching.
- Migrating existing `seed-*` IDs into the external library.

## Data

### New types (`src/domain/types.ts`)

```ts
export type SourcedFoodId = string;

export interface SourcedFood {
  id: SourcedFoodId;
  name: string;
  nutritionFacts: NutritionFacts;
  servingSize: number;
  servingUnit: ServingUnit;
  source: string;      // e.g. "usda" — names a FoodSourceProvider
  sourceId: string;    // upstream identifier within that source
  tags?: string[];     // optional, free-form; reserved for future filtering (pantry, dietary, locale, etc.)
}

export interface FoodSourceManifest {
  source: string;           // matches FoodSourceProvider.name
  version: string;          // e.g. "2026-05-28-1"
  itemCount: number;
  sha256: string;           // expected hash of the dataset payload
  generatedAt: string;      // ISO
}
```

`SourcedFood` is a sibling concept to `Food`, not a replacement. User-created foods (`Food`, in `state.foods`) keep their write lifecycle (`createdAt`, `deletedAt`). The picker queries both and merges results. Unifying them is a future decision (e.g. when "save a USDA food as a favorite" lands).

`source` is a free-form string today. A small registry (`src/domain/food-sources.ts`) declares known names as constants to keep call sites typo-safe:

```ts
export const FOOD_SOURCES = {
  USDA: 'usda',
  // future: PANTRY: 'pantry', MENU_CHIPOTLE: 'menu-chipotle', ...
} as const;
```

### New interfaces (`src/persistence/`)

```ts
// food-source-repository.ts
export interface SearchOptions {
  limit: number;
  sources?: string[];                                  // restrict to these sources (omit = all)
  tags?: { include?: string[]; exclude?: string[] };   // tag filter (omit = no filter)
}

export interface FoodSourceRepository {
  isHydrated(source: string): Promise<boolean>;
  currentVersion(source: string): Promise<string | null>;
  hydrate(source: string, items: SourcedFood[], manifest: FoodSourceManifest): Promise<void>;
  clear(source: string): Promise<void>;
  search(query: string, opts: SearchOptions): Promise<SourcedFood[]>;
  getById(id: SourcedFoodId): Promise<SourcedFood | null>;
  count(source?: string): Promise<number>;
}

// food-source-provider.ts
export interface FoodSourceProvider {
  readonly name: string;
  fetchManifest(version: string): Promise<FoodSourceManifest>;
  fetchDataset(
    manifest: FoodSourceManifest,
    onProgress?: (loaded: number, total: number) => void,
  ): Promise<SourcedFood[]>;
}
```

`search` filtering: `sources` and `tags` are post-filters over the name-index hit set; M11 only needs the source filter wired. `tags` field on `SourcedFood` is optional and unused at search time in M11 — the parameter is reserved so adding pantry-style filtering later doesn't require an interface change.

### Concrete adapters

- `IndexedDbFoodSourceRepository` — uses `idb` (~1 KB wrapper) or hand-rolled. Object store `foods` keyed by `id`, with indexes on `source` and `name_lower`. Meta store holds per-source manifests keyed by `source`.
- `InMemoryFoodSourceRepository` — for tests; arrays + linear scan.
- `HttpFoodSourceProvider` — fetches `manifest.json` and `foods.json.gz` from a configured base URL + versioned path, decompresses (browser `DecompressionStream`), parses, validates count + SHA-256 against the manifest, returns `SourcedFood[]`. Other `FoodSourceProvider` implementations remain in *Future providers* below.

### Versioning

A `catalogVersions` map in `src/main.ts` names the expected version per source. Boot logic, per configured source:

```
for each (source, expectedVersion) in catalogVersions:
  current = await repo.currentVersion(source)
  if current !== expectedVersion:
    provider = providers[source]
    manifest = await provider.fetchManifest(expectedVersion)
    items    = await provider.fetchDataset(manifest, onProgress)
    if sha256(items) mismatch → abort this source, keep prior
    await repo.clear(source)
    await repo.hydrate(source, items, manifest)
```

If hydration for a source fails (network, hash mismatch, parse error), the app surfaces an error state for that source. If IndexedDB has a prior version cached for that source, it keeps using it. If empty, that source contributes nothing to search until next attempt succeeds (user reloads to retry).

## UI sketch

### First-run hydration banner
```
┌──────────────────────────────────────────┐
│  Downloading food database…             │
│  ████████████░░░░░░░░░░  0.2 / 0.4 MB    │
└──────────────────────────────────────────┘
```
Non-modal. Sits above the log view. Picker shows an empty/disabled state until hydration finishes.

### Failure state (first launch, IndexedDB still empty)
```
┌──────────────────────────────────────────┐
│  Couldn't download food database.        │
│  Check your connection and reload.       │
└──────────────────────────────────────────┘
```

### Failure state (subsequent launch, prior version cached)
```
┌──────────────────────────────────────────┐
│  Couldn't update food database.          │
│  Using cached copy (v2026-04-12).        │
└──────────────────────────────────────────┘
```
Non-blocking. Search works against the cached copy.

## Architecture notes

- `FoodSourceRepository` lives in `src/persistence/` alongside `StateRepository`. Same layer rules ([ADR 0005](../decisions/0005-layered-architecture.md)): UI never imports it; domain doesn't know it exists; `app.ts` wires it.
- The food picker today reads `state.foods` directly. M11 introduces a thin `searchFoods(query, opts?)` boundary in app/wiring that merges:
  1. user-created foods from `state.foods` (matched by existing fuzzy search)
  2. sourced foods from `FoodSourceRepository.search(query, opts)`
  Results are tagged with origin (`'user' | 'sourced'`) so UI can render a subtle badge if desired.
- `FoodSourceProvider` and `FoodSourceRepository` are both async; existing search code is sync. That sync→async hop is the main UI plumbing change.
- New ADR: **0007 — Multi-source food library, IndexedDB-backed, pluggable providers** covering (a) splitting read-only sourced foods from writable user state, (b) the multi-source data model (`source` field, optional `tags`, search filters) chosen over a single-catalog design, (c) build-time provider wiring rather than runtime config.

## Wired provider — same-origin static data

Ships `HttpFoodSourceProvider` configured against a `usda` source. Dataset is built offline from three USDA dumps (Foundation Foods + SR Legacy + FNDDS Survey) — **~13.6k items after name-dedup, ~380 KB gzipped**. Committed under `public/data/`, deployed with the site, fetched by the browser on hydration.

- URL pattern: `<site>/data/usda-v<n>/foods.json.gz` + `manifest.json` sibling (Vite copies `public/` into `dist/`).
- Trust model: same origin as the app — no third party in the runtime path. (GitHub Releases asset hosting was rejected: its download URLs don't send CORS headers, so browsers block the fetch — see [ADR 0007](../decisions/0007-multi-source-food-library.md).)
- Versioned by directory name; `catalogVersions.usda` in `src/main.ts` pins the version the app expects.

### Dataset build script — `scripts/build-food-source.ts`

Runs locally, not in CI. Steps:
1. Read three USDA JSON dumps (Foundation, SR Legacy, FNDDS) — paths passed as args.
2. For each item, normalize to `SourcedFood` shape: `source: "usda"`, map USDA nutrient IDs → `NutritionFacts` scaled to the serving, pull `servingSize` + `servingUnit` from upstream (default to 100 g if upstream lacks a usable portion). `tags` omitted.
3. Concatenate all three, dedup by lowercased name, sort deterministically by `name`.
4. Emit `public/data/usda-v<version>/foods.json.gz` and `manifest.json` with `source: "usda"`, `version`, `itemCount`, `sha256` of the gzipped payload, `generatedAt`.

Output is committed; pushing redeploys app + dataset together. `generatedAt` defaults to wall-clock time — set `FOODTRACKER_BUILD_TIMESTAMP` to make the manifest reproducible.

## Future providers / sources

The interface accommodates these without changes:
- **jsDelivr CDN proxy** of a sibling `foodtracker-data` repo. Faster global delivery, third-party dependency. Same `usda` source, different provider.
- **USDA FoodData Central API** (live). Search-time hydration variant — call upstream on each query, cache into IndexedDB. No bulk download UX. Requires API key handling.
- **Pantry source** — user-managed list of "in-stock" items, surfaced via the `tags` filter (`tags: { include: ['in-pantry'] }`). Likely a different repository implementation (user-writable), but the search shape is the same.
- **Restaurant menu sources** — per-restaurant `FoodSourceProvider` instances (e.g. `menu-chipotle`, `menu-sweetgreen`), each its own `source` name, all queried via the same `search` call.

## Acceptance

1. New `FoodSourceRepository` interface + `IndexedDbFoodSourceRepository` implementation + `InMemoryFoodSourceRepository` fake exist with passing unit tests.
2. New `FoodSourceProvider` interface + `HttpFoodSourceProvider` implementation exist with passing unit/contract tests (with mocked `fetch`).
3. `src/main.ts` wires `HttpFoodSourceProvider` for the `usda` source and `IndexedDbFoodSourceRepository`. Adding or swapping a provider is a one-line change at the composition root.
4. Boot flow: empty IndexedDB → hydration banner appears → dataset downloads → IndexedDB populated → banner clears → library usable in picker.
5. SHA-256 mismatch on download aborts hydration for that source without clobbering its existing partition. UI surfaces the error.
6. `catalogVersions.usda` bump on next boot triggers re-hydration of the `usda` source; matching version is a no-op.
7. Picker search returns merged results from `state.foods` (user) + `FoodSourceRepository.search(...)` (sourced), de-duplicated by `id`.
8. First-launch failure (network or hash mismatch, IndexedDB empty): app shows a non-blocking error banner; picker is disabled until reload retry succeeds.
9. Subsequent-launch failure (IndexedDB has prior version): app keeps using the cached copy; non-blocking banner tells the user the update failed.
10. Existing localStorage state for user logs is untouched. No data migration for `state.foods`.
11. `SearchOptions.sources` filter works: a query restricted to `['usda']` returns only sourced foods; an empty array returns nothing; omitting the option returns all sources.
12. `SearchOptions.tags` parameter is accepted by the interface and ignored by M11 implementations (no-op pass-through). A unit test asserts the parameter is plumbed without changing results — this guards against the next contributor "cleaning up" an apparently-unused field.
13. ADR 0007 lands in this PR.
14. Bundle size guard: app JS shipped on GH Pages stays under 100 KB gzipped (the library is *not* bundled).
15. `scripts/build-food-source.ts` produces a deterministic `foods.json.gz` from the three USDA dumps; with `FOODTRACKER_BUILD_TIMESTAMP` set, running it twice on the same input produces byte-identical output (without it, `manifest.generatedAt` differs).
16. A versioned dataset (`public/data/usda-v<n>/foods.json.gz` + `manifest.json`) is committed and deploys with the site.
17. `README.md` (and `specs/agent-handoff.md` if relevant) updated with: how to run `scripts/build-food-source.ts`, where to download the USDA source dumps, what bumping `catalogVersions` does, and a note that the architecture supports multiple sources beyond USDA.
