# foodtracker

Browser-based food tracker. Static site, localStorage-backed, no backend.

**Status:** see [specs/STATUS.md](./specs/STATUS.md). **Plan:** see [specs/MILESTONES.md](./specs/MILESTONES.md).

## Stack

TypeScript, Vite, Web Test Runner + Playwright. Deployed to GitHub Pages. Installable as a PWA; a service worker keeps the app shell available offline ([ADR 0011](./specs/decisions/0011-offline-app-shell.md)).

## Local dev

```bash
npm install
npx playwright install chromium
npm run build-data  # food data → public/data/ (see below)
npm run dev         # localhost:5173 (no service worker)
npm run build       # → dist/, including sw.js
npm run preview     # serves dist/ with the service worker
npm test
```

## Updating the food database

The app ships with no built-in foods: it fetches read-only catalogs from `${BASE_URL}data/` and caches them in IndexedDB. None of that data is in git. Every deploy and PR preview builds it from USDA FoodData Central's public bulk downloads, at the release dates pinned in `scripts/usda-releases.json`.

| File under `public/data/` | What | Items | Size (gzip) |
|---|---|---|---|
| `usda.json` | Everyday foods: hand-named staples from Foundation + SR Legacy | 194 | 40 KB (6 KB) |
| `usda-full.json` | All USDA foods: every Foundation + SR Legacy row judged `keep` | 2,282 | 534 KB (62 KB) |
| `brands/index.json` | `{ brands }`: every Branded Foods brand as `[id, label, count, included]` | 33,171 brands | 1.3 MB (353 KB) |
| `brands/<a…z, 0-9>.json` | `{ <brand id>: { label, rows } }` for each brand filed under that first character; a row is `[fdcId, name, category, calories, protein, carbs, fat]` per 100 g | 376,546 rows | 33 MB in all (8.1 MB) |
| `manifest.json` | `version` (a hash of the other files), the releases, counts | | |

A brand ships rows when it has at least two items or is a store's house brand; the rest are listed with their count and `included` false. Brand names come from the dump and are cleaned by rule, not by hand; see [ADR 0012](./specs/decisions/0012-brand-partitions-store-bundles.md). Sources beyond USDA (restaurant menus, Open Food Facts, …) fit behind the same interface; see [ADR 0007](./specs/decisions/0007-multi-source-food-library.md).

### How the app reads it

- Every boot fetches `manifest.json` with `cache: 'no-cache'`. Its `version` is the build that every source is expected to match. Every other file is fetched as `<file>?v=<version>`, so GitHub Pages' ten-minute cache never serves a file from an older build.
- A source's rows are cached in IndexedDB (`foodtracker-catalog`) together with the version they came from. When a source is on and its cached version differs from the manifest's, it downloads again. A brand downloads its letter file and keeps only its own entry; brands that download together share one request per letter file.
- The same database keeps copies of the manifest and the brand list, so an offline boot still searches what is cached. If neither the network nor a copy is available, nothing is hydrated and the catalog shows its failure state. If a newer build left the database at a higher schema version, this build deletes and rebuilds it. It never touches `foodtracker-foods`, where earlier builds, the live site among them, keep the catalog.
- Only the source picker reads the brand list, the first time it opens; a copy at the manifest's version is used without a fetch. A brand that is on hydrates and is named without it. A store is one checkbox. The localStorage blob stores it by its own id (`costco`). Search and hydration expand it to its house brands, which are never listed under Brands.

### Building

`npm run build-data` downloads the pinned zips into `.cache/usda/` (about 220 MB the first time; set `USDA_CACHE_DIR` to reuse a folder of earlier downloads, since file names match USDA's), then rewrites `public/data/` in about a minute. The 3.3 GB Branded Foods JSON is streamed out of its zip, never extracted. Output is deterministic.

In CI, `.github/actions/food-data` runs it before `npm run build` in both the deploy and the PR preview workflows. The output is cached on the pins plus `scripts/` and `src/domain/`, and the zips on the pins alone, so a code change rebuilds without downloading again.

The build fails, and so does the deploy, when:
- a curated name or `fdcId` repeats, an `fdcId` is missing from the dumps, or a `countGrams` is not positive;
- an eligible Foundation / SR Legacy row has no judgment in `food-classifications.json` (they are listed), a kept row has no name, or a kept name repeats or collides with a curated one;
- a store in `STORE_BUNDLES` names a brand the Branded dump no longer produces (a USDA rename);
- any row fails the validator the app reads it through.

### New USDA releases

`.github/workflows/usda-releases.yml` runs every Monday (or by hand from the Actions tab). It runs `npm run check-usda-releases`, which moves each pin to the newest release USDA's download page lists, and when a pin moved, opens a PR from `usda-releases/branded-<date>-foundation-<date>-sr-legacy-<date>`; its preview shows the rebuilt data. It needs a `USDA_PR_TOKEN` repository secret: a fine-grained token with Contents and Pull requests write on this repo. The default token cannot be used because the repo does not let Actions create PRs, and a PR opened with it would run no workflows.

To bump by hand, edit a date in `scripts/usda-releases.json` (or run `npm run check-usda-releases`), run `npm run build-data`, and open a PR. A new Foundation or SR Legacy release usually brings rows nobody has judged yet; the build lists them.

### Hand-written inputs

- `scripts/curated-foods.json`: `{ "name", "fdcId", "category", "countGrams"? }`. `countGrams` marks a count-logged food (1 count weighing that many grams); everything else ships per 100 g.
- `scripts/food-classifications.json`: `{ "fdcId", "keep", "name"?, "reason"? }`. `name` is required when `keep` is true.
- `STORE_BUNDLES` in `src/domain/foodSources.ts`: each store's house brand ids.

Brands take no list. Spellings that fold alike are one brand (`LAY'S`, `Lays` → `lays`), labelled with the most frequent mixed-case spelling or, failing that, a title-cased one. Within a brand, rows sharing a cleaned name and the same rounded calories, protein, carbs and fat collapse to the latest publication; the same name with different numbers ships twice.

## License

MIT. See [LICENSE](./LICENSE).
