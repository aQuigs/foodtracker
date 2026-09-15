# M16 — Brand catalogs: every brand is a source

## Goal
Find any product by its brand. Every brand in USDA Branded Foods — some 33,000, from Chobani and Nature Valley to Great Value — is a source the user can turn on from the Sources picker, replacing the twelve hand-picked store packs. A store stays in the picker as a bundle of its house brands, so ticking Walmart still turns on Great Value, Marketside and Sam's Choice together. A row lives in exactly one brand and carries that brand as its tag, so one product can never show up twice across sources. Rationale: [ADR 0012](../decisions/0012-brand-partitions-store-bundles.md).

## In scope
- One `brands` dataset: an index naming every brand and a set of shards holding the rows. A brand is a source named `brand:<id>`; turning it on fetches its shard, keeps its rows, and caches them as their own partition, like a store pack did.
- `SourcedFood.brand` and `Food.brand` (additive, optional): the brand label the row was built under, copied by Add. The tag, the brand half of search and food identity all read `brand` off the food; nothing derives a brand from the source name any more.
- Store bundles: a domain table of the twelve stores, each a label and a list of brand ids. The picker shows a store as one checkbox that is on when all its brands are on; ticking it turns them all on or off. Bundles are not persisted; `enabledSources` holds brands.
- Picker: three sections — USDA, Stores, Brands. The filter matches every USDA tier, store and brand in the index; with it empty the Brands section lists only the brands that are on. Brand rows show their row count. The disclosure reads `Sources (n on)`.
- Results: curated hits flat; a fold for All USDA foods; then one fold per brand with hits, alphabetical by label. Fold labels and hydration banners use the brand's label from the index.
- Same-item rule at build: within a brand, two rows collapse only when their cleaned name and their rounded nutrition both match (latest publication wins); a same-named row with different numbers ships too.
- Parse-time repair: a legacy store name in `enabledSources` expands to its bundle's brands; a food with a legacy store `source` and no `brand` gets the store's label as its brand, so its identity and tag are unchanged.
- Build: `brands` mode replaces `packs`; the twelve `public/data/<store>-v1/` datasets are deleted. The dataset test validates the index, every shard it names, and every bundle's brand ids.

## Out of scope
- Rows with no brand name in the dump (~4%): dropped, not attributed to their owner.
- Hand-curated brand labels or product names; label serving sizes; restaurants; Open Food Facts; browsing a brand without a query.
- Suggesting "turn on Chobani" from the catalog search box when the query names a brand that is off (follow-up).
- Searching brands that are off; evicting a cached brand partition; a per-brand version pin (one version covers the dataset).

## Data

### Registry (`src/domain/foodSources.ts`)
```ts
const FOOD_SOURCES = { USDA: 'usda', USDA_FULL: 'usda-full' };              // the static datasets; FOOD_SOURCE_META as today
const BRANDS_VERSION: string;                                                // pins public/data/brands-v<version>/
const BRAND_SOURCE_PREFIX = 'brand:';
function brandSource(id: string): string;                                    // 'brand:chobani'
function brandIdOf(source: string): string | null;                           // null for a static source
type StoreBundle = { label: string; brands: string[] };                      // brand ids
const STORE_BUNDLES: Record<StoreId, StoreBundle>;                           // twelve stores; order = picker order
function expandLegacySources(enabled: string[]): string[];                   // 'costco' → its bundle's brand sources; unknown names kept
function searchText(name: string, brand?: string): string;                   // `${name} ${brand}` when tagged
function brandedSearchKey(name: string, brand?: string): string;             // repository name_key; SCHEMA_VERSION bumps
```
`sourceBrand`, `SOURCE_KINDS` and the twelve pack entries go away. `sourceTier` reads every non-static source as deep.

### Index (`public/data/brands-v<version>/index.json`)
```ts
type BrandsIndex = {
  source: 'brands'; version: string; generatedAt: string;
  brands: [id: string, label: string, count: number, shard: number][];      // sorted by id
  shards: { sha256: string; itemCount: number; bytes: number }[];            // shard i ↔ shard-<i>.json
};
```
- `id` = `labelSearchKey(brandName)` with spaces as hyphens; spellings that fold alike are one brand (`LAY'S`, `Lays`).
- `label` = the most frequent spelling with a lowercase letter; else the most frequent spelling title-cased word by word, leaving a word alone when it has no vowel or three or fewer letters (`H-E-B`, `BBQ`, `365`).
- Shards: the build assigns brands largest-first to the lightest shard, targeting ~100 KB each (~1,000 shards for 97 MB); the index says which, so the app never computes one. A shard is `SourcedFood[]` sorted by search key then id; a row is `{ id: 'brand:<id>:<fdcId>', source: 'brand:<id>', brand: label, sourceId, name, nutritionFacts, servingSize: 100, servingUnit: 'g', tags }`.
- The index is fetched once per version (about 1 MB; on first picker open, or at boot when a brand is on) and kept in the repository's metadata store so an offline boot still resolves labels and shards.

### Hydration (`src/persistence/brandsProvider.ts`, `app.ts`)
`BrandsProvider({ baseUrl, version })` fetches and validates the index and resolves `brand:<id>` to a `FoodSourceProvider` whose `fetchManifest` returns `{ source, version, itemCount: count, sha256: shard sha }` and whose `fetchDataset` downloads the shard (progress in bytes), checks the sha over the whole file, and returns the rows whose `source` matches. `hydrateSource` is unchanged; only the provider lookup learns to ask the brands provider. Sibling brands in one shard hit the HTTP cache.

### State (`types.ts`, `validate.ts`, `reducer.ts`)
- `Food.brand?: string` — non-empty when present; a blob without it loads (repair above). No version bump: additive, and the live parser ignores it.
- `enabledSources` — brands as `brand:<id>`; `parseState` runs `expandLegacySources`, dedupes, keeps unknown names.
- `{ type: 'SetSourcesEnabled'; sources: string[]; enabled: boolean }` replaces `SetSourceEnabled`: one action per checkbox change, whether one brand or a bundle.
- Identity stays name plus brand: `foodIdentityKey({ name, brand })`. A second same-named variant of a brand is hidden in the catalog once one is in your foods; rename the first to add both.

### Build (`scripts/build-food-source.ts brands`)
```
npm run build-food-source -- brands <version> <branded-dump.json>
```
One streaming pass. Eligibility, nutrition extraction and name clean-up as `packs` had, stripping the row's own brand spellings. Emits `public/data/brands-v<version>/index.json` + `shard-<i>.json`; byte-identical under `FOODTRACKER_BUILD_TIMESTAMP`. Fails on a brand id that collides after folding to the empty string, or on a bundle in `STORE_BUNDLES` naming a brand the dump lacks.

## UI sketch
```
Catalog
┌──────────────────────────────────────────────┐
│ ▾ Sources (5 on)                             │
│   [ Find a source or brand      ]            │  ← fuzzy over USDA tiers, stores and every brand in the index
│   USDA                                       │
│   ☑ Everyday foods                           │
│   ☑ All USDA foods                           │
│   Stores                                     │
│   ☑ Walmart        ☐ Costco   ☐ Target  …    │  ← bundle: on ⇔ all its brands on
│   Brands                                     │
│   ☑ Chobani (415)  ☑ Great Value (3,425) …   │  ← brands that are on; a filter adds matches, capped
│ [ greek yogurt                  ]            │
│ Greek yogurt, plain      59 cal / 100 g  Add │  ← curated, flat
│ ▸ All USDA foods (3)                         │
│ ▾ Chobani (12)                               │  ← one fold per brand with hits, A–Z
│ Greek yogurt, blueberry ⟨Chobani⟩       Add  │  ← tag = food.brand
│ ▸ Great Value (4)                            │
└──────────────────────────────────────────────┘
Filter "fage":   Brands  ☐ Fage (105)                      (a brand that is off, from the index)
Index pending:   Brands  Loading brands…   |   Couldn't load brands. Reload to retry.
Banner:          Chobani: downloading… 41 KB   |   Chobani: couldn't load. Reload to retry.
```
`data-testid`: `source-section` with `data-section="usda|stores|brands"`; `source-option` with `data-source` (`brand:<id>` or a store id) and `data-count`; `source-index-status`; existing picker, fold, tag and banner ids unchanged.

## Acceptance
1. `brandSource`/`brandIdOf` round-trip; `expandLegacySources(['usda', 'costco'])` yields `usda` plus Costco's brand sources, keeps an unknown name, never duplicates; every `STORE_BUNDLES` brand id exists in the committed index (dataset test).
2. `parseState`: a blob with `enabledSources: ['costco']` loads with Costco's brands on; a food `{ source: 'costco' }` without `brand` loads with `brand: 'Costco'` and the same identity as before; `brand: ''` rejects the blob; a blob without `brand` anywhere loads unchanged otherwise.
3. Identity, the boundary rename, catalog hiding and `nameTaken` compare name plus `food.brand`; a Kirkland Signature and a Great Value "Almonds" coexist; an untagged user "Almonds" and USDA "Almonds" still collide.
4. Both repositories index `brandedSearchKey(name, brand)`; `search('chobani')` finds a Chobani row; the picker and catalog ranker match `chobani greek` and highlight inside the tag; the IndexedDB schema version bumps.
5. `SetSourcesEnabled` adds or removes every listed source, is idempotent, never duplicates, ignores empty names; ticking a store dispatches its brands; a store shows on iff all its brands are on.
6. Turning on `brand:chobani` fetches the index once (not again for a second brand at the same version), then its shard, hydrates only Chobani's rows under `brand:chobani`, shows `Chobani: downloading… N KB`, and a search running during the download re-runs when it lands. A shard sha mismatch or a missing brand fails with the labelled banner. Re-ticking a cached brand at the same version fetches nothing.
7. Boot hydrates only the enabled brands; with the index already stored, an offline boot renders their labels and searches their cached rows.
8. Picker: the three sections appear only when they have rows; empty filter lists USDA, every store, and only the brands that are on; `fage` lists Fage from the index with its count; matches are capped and the cap is stated; the disclosure reads `Sources (n on)`; while the index loads the Brands section says so and stores still list; tab change collapses and clears as before.
9. Results: one fold per brand with hits, A–Z by label, after the All USDA foods fold; fold and tag text is the brand label; the same row never appears twice with any combination of sources on.
10. Build: brands fold to one id across spellings; labels follow the label rule; same-name rows collapse only when nutrition also matches; a row without a brand name is dropped; every row lands in exactly one shard; the index's `count` per brand and `itemCount` per shard match the files; a rebuild is byte-identical.
11. README lists the brands dataset (brand count, row count, shard layout, size) and the `brands` CLI, and drops the pack table; agent-handoff and ADR index updated; app JS under the 100 KB gzipped gate; the datasets test passes over the committed index and shards.
12. Screenshots at every viewport show the sectioned picker with a filter hit, a brand fold with tagged rows, and the download banner.
