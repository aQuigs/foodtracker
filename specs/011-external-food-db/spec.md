# M11 — External food sources, IndexedDB-backed, pluggable providers

## Goal
Replace the hand-seeded foods with a read-only USDA catalog in two tiers, both fetched from the site's own static data on first launch and cached in IndexedDB:

- **Curated** (`usda`) — a small set of everyday ingredients with hand-written names ("Apple", "Egg", "Chicken breast (cooked)").
- **Full** (`usda-full`) — a larger machine-judged set: every USDA row a classification file marks `keep`, renamed to everyday terms.

Names are curated in-repo; every nutrition number comes from USDA FoodData Central (Foundation Foods + SR Legacy) at build time. Counts, sizes, and rebuild steps: [README](../../README.md#updating-the-food-database). Rationale: [ADR 0007](../decisions/0007-multi-source-food-library.md).

## In scope
- `FoodSourceRepository` (`src/persistence/`) — read-mostly, partitioned by source. Adapters: `IndexedDbFoodSourceRepository`, `InMemoryFoodSourceRepository` (tests).
- `FoodSourceProvider` — fetches a versioned dataset for one named source. `HttpFoodSourceProvider` reads plain JSON from `<baseUrl>/<source>-v<version>/`, same origin. Plain, not pre-gzipped, so the manifest SHA-256 covers the exact bytes the browser receives even when the server applies transport compression.
- Hydration on boot, per configured source: missing or stale partition → fetch manifest + dataset → verify SHA-256 → replace partition. Text-only, non-blocking banner per source.
- Version pinning per source: `CATALOG_VERSIONS` in `src/domain/foodSources.ts`, one entry per source. Bumping an entry re-hydrates that source on next boot.
- Log-view picker searches only `state.foods`, synchronously, ranked by match tier (exact → prefix → word-start → substring → fuzzy).
- **Catalog tab** (top nav: Log / Foods / Catalog): async search over the repository. Curated hits first; `usda-full` hits behind a collapsed "More results (N)" button — or listed directly when nothing curated matched. Add copies a hit into `state.foods`; the copy carries `source`, renders a disabled Edit button (the reducer also rejects `EditFood`), and stays deletable.
- Build pipeline (`scripts/build-food-source.ts`): `curated` mode resolves `scripts/curated-foods.json` → source `usda`; `full` mode ships every `keep` row of `scripts/food-classifications.json` → source `usda-full`, refusing any eligible dump row nobody has judged.

## Out of scope
- Editing external foods. User-created foods keep their `StateRepository` lifecycle.
- Picking sources in the UI — sources are wired at build time in `src/main.ts`.
- Delta sync, background updates, "re-download" / "clear cache" controls. Re-hydration only via a `CATALOG_VERSIONS` bump, which re-downloads that source in full.
- Bundled fallback catalog. A failed first-launch fetch leaves the Catalog tab empty, with an error banner, until a reload succeeds.
- A "my foods only" / "recent only" picker toggle — unnecessary: the picker only ever shows the user's foods.
- Tag-based UI filters, migrating old `seed-*` ids, barcode lookup, images.
- Further sources — pantry, restaurant menus, USDA Branded (~600k items), live USDA API. The data model accommodates them; no UI.

## Data

### Types (`src/domain/types.ts`, `src/domain/foodSources.ts`)
```ts
type SourcedFood = {
  id: SourcedFoodId;            // `${source}:${sourceId}` — unique across sources
  name: string;
  nutritionFacts: NutritionFacts;
  servingSize: number;
  servingUnit: Unit;
  source: string;
  sourceId: string;
  tags?: string[];              // reserved for future filtering
};
type FoodSourceManifest = { source: string; version: string; itemCount: number; sha256: string; generatedAt: string };
type SearchOptions = { limit?: number; sources?: string[]; tags?: { include?: string[]; exclude?: string[] } };
const FOOD_SOURCES = { USDA: 'usda', USDA_FULL: 'usda-full' } as const;
const CATALOG_VERSIONS: Record<FoodSource, string>;               // pinned dataset version per source
function datasetDir(source: string, version: string): string;   // `${source}-v${version}`, shared by build script and provider
```

`SourcedFood` is a sibling of `Food`, not a replacement. Add converts the hit to a `Food` keyed by the sourced id: re-add is idempotent; a soft-deleted import is revived with current catalog nutrition; revive is refused with an error if the serving axis (count vs weight) changed while entries still reference it.

### Interfaces (`src/persistence/`)
```ts
interface FoodSourceRepository {
  currentVersion(source: string): Promise<string | null>;
  hydrate(source: string, items: SourcedFood[], manifest: FoodSourceManifest): Promise<void>;  // replaces the partition atomically, records the manifest
  search(query: string, opts: SearchOptions): Promise<SourcedFood[]>;
}
interface FoodSourceProvider {
  readonly name: string;
  fetchManifest(version: string): Promise<FoodSourceManifest>;
  fetchDataset(manifest: FoodSourceManifest, onProgress?: (loaded: number) => void): Promise<SourcedFood[]>;
}
```

- `search`: AND of whitespace tokens, each a substring of the lowercased name (`foodNameMatch.ts`, shared so both adapters match identically). `sources` restricts; `[]` returns nothing; omitted = all. `limit` caps the alphabetical walk; omitted = every match (the app ranks first, so it omits it). `tags` is accepted and ignored.
- `HttpFoodSourceProvider({ name, baseUrl })` fetches `<baseUrl>/<datasetDir>/manifest.json`, then `foods.json`; checks manifest source + version, SHA-256, item count, item shape.
- IndexedDB (`idb`): DB `foodtracker-foods`; store `foods` keyed by `id`, indexed on `source` and `name_lower`; manifests keyed by `source`.

### Hydration (`src/app.ts`)
```
for each (source, expected) in CATALOG_VERSIONS:
  if await repo.currentVersion(source) === expected: continue
  banner[source] = fetching
  manifest = await provider.fetchManifest(expected)
  items    = await provider.fetchDataset(manifest, onProgress)   // throws on SHA / count / shape mismatch
  await repo.hydrate(source, items, manifest)                    // prior partition survives any failure above
  banner[source] = cleared
on any failure above (including currentVersion): banner[source] = failed; next source still runs
```

### Datasets (`public/data/<source>-v<version>/foods.json` + `manifest.json`)
- Curation entry (`scripts/curated-foods.json`): `{ "name", "fdcId", "category", "countGrams"? }`.
- Classification entry (`scripts/food-classifications.json`): `{ "fdcId", "keep", "name"?, "reason"? }`.
- `category` ships as the item's single tag. Servings are per 100 g, except `countGrams` foods ship as 1 count weighing that many grams with nutrition rescaled.
- Versions are plain integers; output is committed, so GH Pages deploys app and data together.

## UI sketch
```
[ Log ] [ Foods ] [ Catalog ]        ← Catalog hidden when no catalog is wired

Catalog
┌──────────────────────────────────────────┐
│ apple                                    │
│ Apple                 52 cal / 100 g  Add│
│ Apple juice           48 cal / 100 g  Add│
│ ▸ More results (14)                      │   ← folds shut when the query changes;
└──────────────────────────────────────────┘     absent (rows listed directly) when nothing curated matched
Hydration banner — one per source that is downloading or failed, text only, non-blocking; the
underlying error is the element's title. The cached-version check itself shows nothing.
  Downloading the everyday food list… 39 KB
  Couldn't load the full food list. Reload to retry.                    ← nothing cached
  Couldn't update the full food list. Using the cached copy (1).        ← prior version cached
Log picker with no foods:  No foods yet. Add some from the Catalog tab.
```

## Acceptance
1. `src/main.ts` wires `IndexedDbFoodSourceRepository` plus one `HttpFoodSourceProvider` per `FOOD_SOURCES` entry; `CATALOG_VERSIONS` pins one version per source.
2. Empty IndexedDB → banner per source → both datasets download → banners clear → Catalog search returns hits.
3. SHA-256 mismatch aborts that source, leaves its existing partition intact, and shows the error banner.
4. Bumping a `CATALOG_VERSIONS` entry re-hydrates that source on next boot; a matching version is a no-op (no fetch, no banner).
5. Log picker returns only `state.foods`, ranked by match tier, synchronously; it never queries the catalog and is never disabled by hydration.
6. Catalog tab: hits deduped against live user foods; Add copies into `state.foods`; re-adding a soft-deleted import revives it; tab hidden when no catalog is wired.
7. Curated (`usda`) hits render first; `usda-full` hits sit behind "More results (N)", which collapses when the query changes. When nothing curated matched, the `usda-full` hits list directly with no fold.
8. Imported foods render a disabled Edit button and the reducer rejects `EditFood` for them; Delete still works, and every row keeps the same shape.
9. First-launch failure (nothing cached): "Couldn't load <tier>…" banner naming the tier that failed; the other tier keeps working. Later failure with a cached copy: "Couldn't update <tier>… Using the cached copy (<version>)"; Catalog search works against the cache. Any failure — including the repository refusing to open — lands that source in the failed banner without blocking the other sources. A rejected catalog search clears the rows and shows the error above the list.
10. localStorage user state is untouched; no migration of `state.foods`.
11. `SearchOptions.sources`: `['usda']` returns only that source; `[]` returns nothing; omitted returns all sources.
12. `SearchOptions.tags` is accepted and ignored; a test asserts it does not change results (kept deliberately — removing it later is an interface change).
13. App JS on GH Pages stays under 100 KB gzipped; the catalog is fetched, not bundled.
14. Build is deterministic with `FOODTRACKER_BUILD_TIMESTAMP` set (byte-identical reruns); without it only `manifest.generatedAt` differs.
15. Curated mode fails on duplicate names/ids, an `fdcId` missing from the dumps, or a bad `countGrams`. Full mode fails listing every eligible dump row without a judgment, on a `keep` row without a name, on a name colliding with a curated name, or on duplicate names.
16. Both datasets are committed under `public/data/` and deploy with the site.
17. README documents the rebuild: CLI for both modes, where to download the dumps, what bumping `CATALOG_VERSIONS` does.
18. A test hashes each committed `foods.json` against its `manifest.json` and validates every item, so a rebuild that drifts from its manifest fails CI rather than hydration.
