# foodtracker

Browser-based food tracker. Static site, localStorage-backed, no backend.

**History:** [specs/MILESTONES.md](./specs/MILESTONES.md) lists the milestones so far.

## Stack

TypeScript, Vite, Web Test Runner + Playwright, deployed to GitHub Pages. It installs as a PWA, and a service worker caches the app shell so it opens offline ([ADR 0011](./specs/decisions/0011-offline-app-shell.md)).

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

The app has no built-in foods. It fetches read-only catalogs from `${BASE_URL}data/` and caches them in IndexedDB. That data isn't in git: every deploy and PR preview builds it from USDA FoodData Central's bulk downloads, using the releases pinned in `scripts/usda-releases.json`.

| File under `public/data/` | What | Items | Size (gzip) |
|---|---|---|---|
| `usda.json` | Everyday foods: hand-named staples from Foundation + SR Legacy | 194 | 40 KB (6 KB) |
| `usda-full.json` | All USDA foods: every Foundation + SR Legacy row judged `keep` | 2,282 | 534 KB (62 KB) |
| `brands/index.json` | `{ brands }`: every Branded Foods brand as `[id, label, count, included]` | 33,171 brands | 1.3 MB (353 KB) |
| `brands/<a…z, 0-9>.json` | `{ <brand id>: { label, rows } }` for each brand filed under that first character; a row is `[fdcId, name, category, servingSize, servingUnit, piecesPerServing, pieceNoun, calories, protein, carbs, fat]` for the label's own serving (`servingUnit` is `g` or `ml`; `piecesPerServing`/`pieceNoun` are `0`/`''` when the label doesn't state a piece count) | 377,544 rows | 38 MB in all (8.6 MB) |
| `manifest.json` | `version` (a hash of the other files), the releases, counts | | |

A brand ships its rows if it has at least two items or is a store's house brand. Other brands are still listed, with their count and `included` false. Brand names come from the dump and are cleaned up by rules, not by hand ([ADR 0012](./specs/decisions/0012-brand-partitions-store-bundles.md)). Other sources, such as restaurant menus or Open Food Facts, can plug into the same interface ([ADR 0007](./specs/decisions/0007-multi-source-food-library.md)).

### How the app reads it

- On every boot the app fetches `manifest.json` with `cache: 'no-cache'`. Its `version` names the build every source should match. Every other file is fetched as `<file>?v=<version>`, so GitHub Pages' ten-minute cache never serves a file from an older build.
- Each source's rows are cached in IndexedDB (`foodtracker-catalog`) with the version they came from. A source that is on downloads again when its cached version doesn't match the manifest. A brand downloads its letter file and keeps only its own entry. Brands loaded together share one request per letter file: at boot, each letter file is one batch; picking brands or importing a backup loads all the brands it turns on in one batch.
- The same database keeps copies of the manifest and the brand list, so the app can still search cached foods when it starts offline. With no network and no copy, nothing loads and the catalog shows its error state. If a newer build left the database at a higher schema version, this build deletes and rebuilds it. It never opens or deletes the old `foodtracker-foods` database; a later build will remove it.
- Only the source picker reads the brand list, the first time it opens. If the cached copy matches the manifest's version, it isn't fetched again. A brand that is on loads and shows its name without the list. A store is a single checkbox, saved in the localStorage blob under its own id (`costco`). Search and loading expand a store into its house brands, which never appear under Brands.

### Building

`npm run build-data` downloads the pinned zips into `.cache/usda/` (about 220 MB the first time), then rewrites `public/data/` in about a minute. To reuse zips you already have, point `USDA_CACHE_DIR` at their folder; the file names match USDA's. The 3.3 GB Branded Foods JSON is streamed out of its zip, never extracted. The same inputs always give the same output.

In CI, `.github/actions/food-data` runs it before `npm run build` in both the deploy and PR preview workflows. The output cache is keyed on the pins, `scripts/` and `src/domain/`, and the zip cache on the pins alone, so a code change rebuilds the data without downloading again.

The build, and so the deploy, fails when:
- a curated name or `fdcId` repeats, an `fdcId` is missing from the dumps, or a `countGrams` is not positive;
- an eligible Foundation / SR Legacy row has no entry in `food-classifications.json` (the build lists them), a kept row has no name, or a kept name repeats or matches a curated one;
- a store in `STORE_BUNDLES` names a brand that's no longer in the Branded dump (USDA renamed it);
- any row fails the validator the app reads it with.

### New USDA releases

`.github/workflows/usda-releases.yml` runs every Monday, or by hand from the Actions tab. It runs `npm run check-usda-releases`, which moves each pin to the newest release on USDA's download page. If a pin moved, it opens a PR from `usda-releases/branded-<date>-foundation-<date>-sr-legacy-<date>`, and that PR's preview shows the rebuilt data. The workflow needs a `USDA_PR_TOKEN` repository secret: a fine-grained token with write access to Contents and Pull requests on this repo. The default token won't work: the repo doesn't let Actions create PRs, and a PR opened with that token wouldn't run any workflows.

To update by hand, edit a date in `scripts/usda-releases.json` (or run `npm run check-usda-releases`), run `npm run build-data`, and open a PR. A new Foundation or SR Legacy release usually adds rows that aren't classified yet; the build lists them.

### Hand-written inputs

- `scripts/curated-foods.json`: `{ "name", "fdcId", "category", "countGrams"? }`. With `countGrams`, the food is logged by count, one count weighing that many grams. Everything else ships per 100 g.
- `scripts/food-classifications.json`: `{ "fdcId", "keep", "name"?, "reason"? }`. `name` is required when `keep` is true.
- `STORE_BUNDLES` in `src/domain/foodSources.ts`: each store's house brand ids.

Brands need no hand-written list. Spellings that normalize to the same id are one brand (`LAY'S`, `Lays` → `lays`). Its label is the most common mixed-case spelling, or a title-cased one if there is none. Within a brand, rows with the same cleaned name and the same rounded calories, protein, carbs and fat collapse into the most recently published one. The same name with different numbers ships as two rows.

## License

MIT. See [LICENSE](./LICENSE).
