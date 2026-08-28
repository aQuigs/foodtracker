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

The app ships with no built-in foods. On first launch it fetches two read-only USDA tiers from the same origin (`public/data/<source>-v<version>/`, served at `${BASE_URL}data/<source>-v<version>/`) and caches them in IndexedDB; later launches are instant.

| Source | Tier | Items | `foods.json` | Names from |
|---|---|---|---|---|
| `usda` | curated — hand-named everyday staples | 194 | ~40 KB (~6 KB gz) | `scripts/curated-foods.json` |
| `usda-full` | "More results" — every row judged `keep` | 2,282 | ~535 KB (~62 KB gz) | `scripts/food-classifications.json` (6,721 judgments) |

Every nutrition number in both tiers is resolved from USDA FoodData Central at build time. `CATALOG_VERSIONS` in `src/domain/foodSources.ts` pins one version per source; bumping an entry re-hydrates that source on next boot.

Sources beyond USDA (pantry, restaurant menus, …) fit behind the same interface — see [ADR 0007](./specs/decisions/0007-multi-source-food-library.md).

### Rebuilding a dataset

1. Download the Foundation Foods and SR Legacy JSON dumps from [USDA FoodData Central](https://fdc.nal.usda.gov/download-datasets).
2. Edit the relevant list, one entry per food:
   - `scripts/curated-foods.json`: `{ "name", "fdcId", "category", "countGrams"? }` — `countGrams` marks a count-logged food (1 count weighing that many grams); everything else ships per 100 g.
   - `scripts/food-classifications.json`: `{ "fdcId", "keep", "name"?, "reason"? }` — `name` is required when `keep` is true.
3. Build. `<version>` is an integer, one higher than the current directory's (`usda-v5` → `6`):

   ```bash
   npm run build-food-source -- curated <version> <curated-foods.json> <usda-dump.json> [more dumps...]
   npm run build-food-source -- full    <version> <food-classifications.json> <curated-foods.json> <usda-dump.json> [more dumps...]
   ```

   Output: `public/data/<source>-v<version>/foods.json` + `manifest.json`. Curated mode fails on duplicate names/ids, an `fdcId` missing from the dumps, or a bad `countGrams`. Full mode fails listing every eligible dump row without a judgment, on a `keep` row without a name, on a name colliding with a curated name, or on duplicate names.

   For byte-identical reruns pin the manifest timestamp:

   ```bash
   FOODTRACKER_BUILD_TIMESTAMP=2026-07-03T00:00:00.000Z \
     npm run build-food-source -- curated 6 scripts/curated-foods.json foundation.json sr-legacy.json
   ```

4. Bump the matching `CATALOG_VERSIONS` entry in `src/domain/foodSources.ts`, commit it together with `public/data/<source>-v<version>/`, and push. GH Pages redeploys app and data together, same-origin under `aquigs.github.io/foodtracker/data/<source>-v<version>/`.

## License

MIT. See [LICENSE](./LICENSE).
