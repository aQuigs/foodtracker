# foodtracker

Browser-based food tracker. Static site, localStorage-backed, no backend.

**Status:** see [specs/STATUS.md](./specs/STATUS.md). **Plan:** see [specs/MILESTONES.md](./specs/MILESTONES.md).

## Stack

TypeScript, Vite, Web Test Runner + Playwright. Deployed to GitHub Pages.

## Local dev

```bash
npm install
npx playwright install chromium
npm run dev       # localhost:5173
npm run build     # → dist/
npm test
```

## Updating the food database

The app ships with no built-in foods. On first launch it fetches the read-only sources the user has turned on from the same origin (`public/data/<source>-v<version>/`, served at `${BASE_URL}data/<source>-v<version>/`) and caches them in IndexedDB; later launches are instant. Two USDA tiers are on by default; the store-brand packs are off until ticked in the Catalog tab's source picker, and download on the spot.

| Source | What | Items | `foods.json` | Names from |
|---|---|---|---|---|
| `usda` | Everyday foods — hand-named staples, listed first | 194 | ~40 KB (~6 KB gz) | `scripts/curated-foods.json` |
| `usda-full` | All USDA foods — every row judged `keep`, behind a fold | 2,282 | ~535 KB (~62 KB gz) | `scripts/food-classifications.json` (6,721 judgments) |
| `costco` | Costco (Kirkland Signature) | 134 | ~33 KB (~6 KB gz) | USDA Branded label text, cleaned mechanically |
| `heb` | H-E-B | 1,327 | ~321 KB (~47 KB gz) | ″ |
| `kroger` | Kroger (Simple Truth, Private Selection, …) | 4,969 | ~1.2 MB (~172 KB gz) | ″ |
| `meijer` | Meijer | 4,580 | ~1.1 MB (~153 KB gz) | ″ |
| `publix` | Publix (GreenWise, …) | 1,729 | ~425 KB (~62 KB gz) | ″ |
| `safeway` | Safeway & Albertsons (Signature Select, O Organics, Lucerne, …) | 5,837 | ~1.5 MB (~204 KB gz) | ″ |
| `sams-club` | Sam's Club (Member's Mark) | 805 | ~200 KB (~29 KB gz) | ″ |
| `target` | Target (Good & Gather, Market Pantry, Favorite Day, …) | 7,203 | ~1.8 MB (~250 KB gz) | ″ |
| `trader-joes` | Trader Joe's | 293 | ~72 KB (~10 KB gz) | ″ |
| `walmart` | Walmart (Great Value, Sam's Choice, Marketside) | 4,851 | ~1.2 MB (~177 KB gz) | ″ |
| `wegmans` | Wegmans | 3,971 | ~986 KB (~135 KB gz) | ″ |
| `whole-foods` | Whole Foods (365, …) | 3,806 | ~959 KB (~129 KB gz) | ″ |

Every nutrition number is resolved from USDA FoodData Central at build time: Foundation Foods + SR Legacy for the two USDA tiers, the Branded Foods dump for the packs. Packs ship per 100 g (millilitre rows counted as grams) with names cleaned by rule, not by hand — see [ADR 0008](./specs/decisions/0008-opt-in-source-packs.md). `FOOD_SOURCE_META` in `src/domain/foodSources.ts` pins one version per source; bumping an entry re-hydrates that source on next boot.

Sources beyond USDA (restaurant menus, Open Food Facts, …) fit behind the same interface — see [ADR 0007](./specs/decisions/0007-multi-source-food-library.md).

### Rebuilding a dataset

1. Download the dumps from [USDA FoodData Central](https://fdc.nal.usda.gov/download-datasets): Foundation Foods and SR Legacy JSON for the USDA tiers, the Branded Foods JSON (about 3 GB unzipped; it is streamed, never loaded whole) for the packs.
2. Edit the relevant list, one entry per food or pack:
   - `scripts/curated-foods.json`: `{ "name", "fdcId", "category", "countGrams"? }` — `countGrams` marks a count-logged food (1 count weighing that many grams); everything else ships per 100 g.
   - `scripts/food-classifications.json`: `{ "fdcId", "keep", "name"?, "reason"? }` — `name` is required when `keep` is true.
   - `scripts/brand-packs.json`: `{ "source", "owners", "brands", "strip" }` — a dump row joins the pack when its brand owner is in `owners` or its brand name is in `brands` (compared case- and punctuation-insensitively); `strip` lists the brand phrases removed from names. `source` must be registered in `FOOD_SOURCE_META`.
3. Build. `<version>` is an integer, one higher than the current directory's (`usda-v6` → `7`):

   ```bash
   npm run build-food-source -- curated <version> scripts/curated-foods.json <usda-dump.json> [more dumps...]
   npm run build-food-source -- full    <version> scripts/food-classifications.json scripts/curated-foods.json <usda-dump.json> [more dumps...]
   npm run build-food-source -- packs   <version> scripts/brand-packs.json <branded-dump.json> [source...]
   ```

   Output: `public/data/<source>-v<version>/foods.json` + `manifest.json` per source. Curated mode fails on duplicate names/ids, an `fdcId` missing from the dumps, or a bad `countGrams`. Full mode fails listing every eligible dump row without a judgment, on a `keep` row without a name, on a name colliding with a curated name, or on duplicate names. Packs mode streams the Branded dump once and writes every pack (or only the named ones), failing on an unregistered pack, an empty pack, or a blank config string; within a pack, rows whose cleaned names collide keep the latest publication.

   For byte-identical reruns pin the manifest timestamp:

   ```bash
   FOODTRACKER_BUILD_TIMESTAMP=2026-07-03T00:00:00.000Z \
     npm run build-food-source -- curated 6 scripts/curated-foods.json foundation.json sr-legacy.json
   ```

4. Bump the matching `FOOD_SOURCE_META` version in `src/domain/foodSources.ts`, commit it together with `public/data/<source>-v<version>/`, and push. GH Pages redeploys app and data together, same-origin under `aquigs.github.io/foodtracker/data/<source>-v<version>/`.

## License

MIT. See [LICENSE](./LICENSE).
