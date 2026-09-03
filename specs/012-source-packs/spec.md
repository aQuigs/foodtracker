# M12 — Source packs: opt-in store-brand catalogs

## Goal
Let the user pick which catalog sources are searched. Twelve store-brand packs distilled from USDA Branded Foods ship off by default; the two USDA tiers stay on. A source picker on the Catalog tab — checkboxes behind a fuzzy filter — turns sources on and off, and turning one on downloads it then and there. Rationale: [ADR 0008](../decisions/0008-opt-in-source-packs.md).

## In scope
- `FOOD_SOURCE_META: Record<FoodSource, FoodSourceMeta>` in `src/domain/foodSources.ts` — one struct per source (`label`, `tier`, `version`, `defaultOn`) replacing `SOURCE_TIER` + `CATALOG_VERSIONS`. Twelve pack entries.
- `state.enabledSources: string[]`, additive on the existing `version: 2` blob (absent → defaults, so the live site and a PR preview can share one localStorage blob). Reducer action `SetSourceEnabled`.
- Boot hydrates enabled sources only. Enabling a source hydrates it at once (same banner as boot); disabling drops it from search and leaves its cached partition alone.
- Catalog search runs over enabled sources only; with none enabled the results list says so and no search runs.
- Results: curated hits flat, then one fold per non-curated source with hits, labeled with the source label and count. When a query answers with no curated rows every fold opens; otherwise every fold starts closed. A new query recomputes; a same-query refresh (Add, hydration finishing) keeps the folds as they are.
- Source picker: a disclosure row above the search box (`▸ Sources (2 of 14)`); open, it shows a filter input and one checkbox per wired source. The filter is the app's fuzzy matcher with highlights. Disclosure and filter reset on tab change.
- Hydration banners name the source by its label.
- `FoodSourceRepository.search` with `sources` walks only those partitions (per-source index), so a disabled pack costs nothing per keystroke.
- Build: `packs` mode streams the USDA Branded dump once, matches rows to packs by `scripts/brand-packs.json`, cleans names mechanically, dedupes, and emits one dataset per pack.

## Out of scope
- Restaurants, Open Food Facts, the live USDA API.
- Label serving sizes: packs ship per 100 g, millilitre rows counted as grams.
- Hand-curated pack names. Clean-up is mechanical (rules below).
- Browsing a pack without a query; row-level brand badges.
- Evicting a disabled pack's cached partition; per-pack bandwidth accounting.

## Data

### Registry (`src/domain/foodSources.ts`)
```ts
type FoodSourceMeta = { label: string; tier: CatalogTier; version: string; defaultOn: boolean };
const FOOD_SOURCE_META: Record<FoodSource, FoodSourceMeta>;   // registry order = picker order = fold order
function sourceLabel(source: string): string;                 // unknown source → its own name
function sourceTier(source: string): CatalogTier;             // unknown source → deep
function catalogVersions(): Record<FoodSource, string>;
function defaultEnabledSources(): FoodSource[];
```
Packs, all `deep`, version `1`, off by default: `costco`, `heb`, `kroger`, `meijer`, `publix`, `safeway`, `sams-club`, `target`, `trader-joes`, `walmart`, `wegmans`, `whole-foods`. `usda` ("Everyday foods") and `usda-full` ("All USDA foods") stay on by default.

### State (`src/domain/types.ts`, `validate.ts`, `reducer.ts`)
- `State = { version: 2; enabledSources: string[]; foods; meals; entries }`. `freshState()` seeds `defaultEnabledSources()`.
- `parseState`: a blob without `enabledSources` (any pre-M12 write, or a v1 blob after its migration) gets the defaults; a present value must be an array of non-empty strings (deduped) or the blob is rejected; unknown names are kept (the registry may shrink) and ignored at use. No version bump: the field is additive with a default, and the live site's parser ignores it.
- `{ type: 'SetSourceEnabled'; source; enabled }`: adds or removes one name; no-op when already in that state or the name is empty.
- `app.ts` treats `enabledSources ∩ keys(catalogVersions)` as the live set for hydration and search; the picker lists `keys(catalogVersions)` in order.

### Pack config (`scripts/brand-packs.json`)
```ts
type BrandPack = { source: FoodSource; owners: string[]; brands: string[]; strip: string[] };
```
- A dump row belongs to a pack when `searchKey(brandOwner)` is in `owners` or `searchKey(brandName)` is in `brands` (config strings are folded the same way). A row matching two packs ships in both.
- `strip`: brand phrases removed from descriptions (owner and brand names, plus house sub-brands).
- Eligible rows: numeric `fdcId`, non-empty `description`, `servingSizeUnit` in `g`/`GRM`/`GM`/`ml`/`MLT`. Nutrition comes from `foodNutrients` (per 100 g) through the same extractor as the USDA tiers.
- Also eligible only if `foodNutrients` has a finite amount for energy, protein, carbs or fat; an explicit 0 counts as present, but a row with none of them (no real nutrition data) is dropped.

### Name clean-up (`scripts/brandedMapper.ts`)
1. Remove every `strip` phrase on word boundaries, case-insensitively.
2. Split on commas; trim; drop empty segments; drop a segment whose every word already appeared in an earlier segment ("COOKIES, CHOCOLATE CHIP, CHOCOLATE CHIP" → "Cookies, chocolate chip").
3. Rejoin with ", "; collapse whitespace; sentence case (first letter up, rest down) keeping an acronym allowlist (`BBQ`, `USDA`, `IPA`, `BLT`, `MSG`, `GMO`, `XL`, `UHT`, `DHA`, `A2`).
4. Empty result → row dropped.
- Dedupe within a pack on `searchKey(name)`: keep the latest `publicationDate`, then the highest `fdcId`. Cross-source name collisions are allowed (the app hides a hit once one namesake is in the user's foods).
- `id` = `<source>:<fdcId>`, `sourceId` = `fdcId`, `tags` = `[brandedFoodCategory]`, `servingSize: 100`, `servingUnit: 'g'`; nutrition rounded to 0.1. Sorted by search key then `sourceId`, so a rebuild is byte-identical under `FOODTRACKER_BUILD_TIMESTAMP`.

### Build CLI
```
npm run build-food-source -- packs <version> scripts/brand-packs.json <branded-dump.json> [source...]
```
One streaming pass (`scripts/jsonArrayScanner.ts` yields each element of the dump's top-level array without loading the 3 GB file); every pack — or only the named ones — lands in `public/data/<source>-v<version>/`. Fails on a pack whose `source` is not registered, on an empty pack, and on a config string that folds to nothing.

## UI sketch
```
Catalog
┌──────────────────────────────────────────┐
│ ▾ Sources (3 of 14)                      │  ← disclosure; collapsed reads "▸ Sources (3 of 14)"
│   [ Filter sources          ]            │  ← fuzzy, highlighted matches
│   ☑ Everyday foods                       │
│   ☑ All USDA foods                       │
│   ☑ Costco                               │
│   ☐ H-E-B                                │
│   …                                      │
│ [ peanut butter             ]            │
│ Peanut butter          588 cal / 100 g Add│  ← curated, flat
│ ▸ All USDA foods (14)                    │  ← one fold per non-curated source with hits
│ ▸ Costco (3)                             │
└──────────────────────────────────────────┘
No sources on:   Turn on a source above to search the catalog.
Banner:          Costco: downloading… 41 KB   |   Costco: couldn't load. Reload to retry.
                 All USDA foods: couldn't update. Using the cached copy (1).
```

## Acceptance
1. `FOOD_SOURCE_META` has an entry for every `FOOD_SOURCES` value; each pack directory under `public/data/` matches its pinned version and the dataset test validates every item.
2. A fresh state enables exactly the default-on sources; a blob without `enabledSources` loads with the same defaults and every food, meal and entry intact; a blob with a malformed `enabledSources` is rejected.
3. `SetSourceEnabled` adds, removes, is idempotent, never duplicates, and ignores an empty name.
4. Boot hydrates only enabled sources: a wired-but-disabled source fetches nothing and shows no banner.
5. Checking a source hydrates it (banner, then rows for the current query once loaded); checking it again while it is downloading does not start a second download. Unchecking removes its rows from the next search and leaves its partition cached, so re-checking at the same version fetches nothing.
6. Catalog search passes exactly the enabled wired sources; with none enabled it does not call the repository and the list shows the "turn on a source" hint.
7. Results: curated rows flat; each non-curated source with hits gets a fold `<label> (N)`, capped at 200 rows when open; every fold opens when the query had no curated rows, otherwise closed; toggling one fold leaves the others alone; a new query recomputes the defaults while Add and hydration keep them. The "already in your foods" and "no matches" hints sum across sources.
8. Picker: disclosure toggles the panel and shows `n of m`; the filter narrows by fuzzy match with highlights and an empty match says so; each row is a labelled checkbox reflecting `enabledSources`; a change fires `onToggleSource(source, checked)`. Tab change collapses it and clears the filter.
9. Banners read `<label>: downloading… N KB`, `<label>: couldn't load. Reload to retry.`, `<label>: couldn't update. Using the cached copy (v)`.
10. `search(q, { sources })` returns the same rows and order as before but reads only the listed partitions; `[]` still returns nothing; omitted still reads all.
11. `packs` mode: rows match by folded owner or brand; names follow the clean-up rules; duplicates keep the latest publication; a row with an unsupported serving unit or an empty cleaned name is dropped; an unregistered pack, an empty pack, or a blank config string fails the build.
12. README lists every pack with its row count and size and the `packs` CLI; app JS stays under the 100 KB gzipped gate.
