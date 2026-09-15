# foodtracker

Browser-based food tracker. Static site, localStorage-backed, no backend.

**Status:** see [specs/STATUS.md](./specs/STATUS.md). **Plan:** see [specs/MILESTONES.md](./specs/MILESTONES.md).

## Stack

TypeScript, Vite, Web Test Runner + Playwright. Deployed to GitHub Pages. Installable as a PWA; a service worker keeps the app shell available offline ([ADR 0011](./specs/decisions/0011-offline-app-shell.md)).

## Local dev

```bash
npm install
npx playwright install chromium
npm run dev       # localhost:5173 (no service worker)
npm run build     # → dist/, including sw.js
npm run preview   # serves dist/ with the service worker
npm test
```

## Updating the food database

The app ships with no built-in foods. On first launch it fetches the read-only sources the user has turned on from the same origin (`public/data/<source>-v<version>/`, served at `${BASE_URL}data/<source>-v<version>/`) and caches them in IndexedDB; later launches are instant. Two USDA tiers are on by default; every brand is off until ticked in the Catalog tab's source picker, and downloads on the spot.

| Source | What | Items | Download | Names from |
|---|---|---|---|---|
| `usda` | Everyday foods — hand-named staples, listed first | 194 | ~40 KB (~6 KB gz) | `scripts/curated-foods.json` |
| `usda-full` | All USDA foods — every row judged `keep`, behind a fold | 2,282 | ~535 KB (~62 KB gz) | `scripts/food-classifications.json` (6,721 judgments) |
| `brand:<id>` | One brand each — `brand:chobani`, `brand:kirkland-signature`, … 33,171 of them | 390,075 rows in all | the ~100 KB shard holding the brand (shared with its shard-mates), plus the 1.4 MB index (~460 KB gz) once | USDA Branded label text, cleaned mechanically |

Every brand lives in one dataset, `public/data/brands-v<version>/`: an `index.json` listing each brand as `[id, label, count, shard]` plus each shard's `{ sha256, itemCount, bytes }`, and ~1,120 `shard-<n>.json` files (~107 MB in all). The app fetches the index (revalidated against the server) the first time in a session that the source picker opens or a boot finds an enabled brand, and keeps a copy in IndexedDB beside the catalog for offline boots. Ticking a brand fetches the single shard the index names for it, verifies that whole shard's SHA-256, and keeps the rows whose `source` is that brand; brands packed into the same shard share the one download. The picker's Stores rows (`STORE_BUNDLES` in `src/domain/foodSources.ts`) are shortcuts over a chain's house brands — one checkbox turning them on together.

Every nutrition number is resolved from USDA FoodData Central at build time: Foundation Foods + SR Legacy for the two USDA tiers, the Branded Foods dump for brands. Brand rows ship per 100 g (millilitre rows counted as grams) with names cleaned by rule, not by hand — see [ADR 0012](./specs/decisions/0012-brand-partitions-store-bundles.md). `FOOD_SOURCE_META` in `src/domain/foodSources.ts` pins a version per USDA tier and `BRANDS_VERSION` pins the brands dataset as a whole; bumping either re-hydrates what it covers on next boot.

Sources beyond USDA (restaurant menus, Open Food Facts, …) fit behind the same interface — see [ADR 0007](./specs/decisions/0007-multi-source-food-library.md).

### Rebuilding a dataset

1. Download the dumps from [USDA FoodData Central](https://fdc.nal.usda.gov/download-datasets): Foundation Foods and SR Legacy JSON for the USDA tiers, the Branded Foods JSON (about 3 GB unzipped; it is streamed, never loaded whole) for the brands.
2. Edit the relevant list, one entry per food — brands take no list; the dump's own brand names are the partition:
   - `scripts/curated-foods.json`: `{ "name", "fdcId", "category", "countGrams"? }` — `countGrams` marks a count-logged food (1 count weighing that many grams); everything else ships per 100 g.
   - `scripts/food-classifications.json`: `{ "fdcId", "keep", "name"?, "reason"? }` — `name` is required when `keep` is true.
3. Build. `<version>` is an integer, one higher than the current directory's (`usda-v6` → `7`):

   ```bash
   npm run build-food-source -- curated <version> scripts/curated-foods.json <usda-dump.json> [more dumps...]
   npm run build-food-source -- full    <version> scripts/food-classifications.json scripts/curated-foods.json <usda-dump.json> [more dumps...]
   npm run build-food-source -- brands  <version> <branded-dump.json>
   ```

   Output: `public/data/<source>-v<version>/foods.json` + `manifest.json` for the USDA tiers, `public/data/brands-v<version>/index.json` + `shard-<n>.json` for brands. Curated mode fails on duplicate names/ids, an `fdcId` missing from the dumps, or a bad `countGrams`. Full mode fails listing every eligible dump row without a judgment, on a `keep` row without a name, on a name colliding with a curated name, or on duplicate names. Brands mode streams the Branded dump once, keeping rows that carry a brand name, a gram or millilitre serving size and at least one nutrition number: spellings that fold alike are one brand (`LAY'S`, `Lays` → `brand:lays`), labelled with the most frequent mixed-case spelling or, failing that, a title-cased one; within a brand, rows sharing a cleaned name and the same rounded calories/protein/carbs/fat collapse to the latest publication, while the same name with different numbers ships twice. It bin-packs the brands into ~100 KB shards, then writes the index naming them. It fails on a dump whose first array is empty and on one with no eligible row.

   For byte-identical reruns pin the manifest timestamp:

   ```bash
   FOODTRACKER_BUILD_TIMESTAMP=2026-07-03T00:00:00.000Z \
     npm run build-food-source -- curated 6 scripts/curated-foods.json foundation.json sr-legacy.json
   ```

4. Bump the matching version in `src/domain/foodSources.ts` — the `FOOD_SOURCE_META` entry for a USDA tier, `BRANDS_VERSION` for brands — commit it together with the new `public/data/` directory, and push. GH Pages redeploys app and data together, same-origin under `aquigs.github.io/foodtracker/data/<source>-v<version>/`.

## License

MIT. See [LICENSE](./LICENSE).
