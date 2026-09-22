# foodtracker

Browser-based food tracker: a static, localStorage-backed site with no backend. Past milestones: [specs/MILESTONES.md](./specs/MILESTONES.md).

## Stack

TypeScript, Vite, Web Test Runner + Playwright. Deployed to GitHub Pages. Installable as a PWA that opens offline ([ADR 0011](./specs/decisions/0011-offline-app-shell.md)).

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

The app fetches read-only catalogs from `${BASE_URL}data/`. None of it is committed: every deploy and PR preview builds it from the USDA FoodData Central releases pinned in `scripts/usda-releases.json`.

| File under `public/data/` | What | Items | Size (gzip) |
|---|---|---|---|
| `usda.json` | Everyday foods: hand-named staples from Foundation + SR Legacy | 194 | 40 KB (6 KB) |
| `usda-full.json` | All USDA foods: every Foundation + SR Legacy row judged `keep` | 2,282 | 534 KB (62 KB) |
| `brands/index.json` | `{ brands }`: every Branded Foods brand as `[id, label, count, included]` | 33,171 brands | 1.3 MB (353 KB) |
| `brands/<a…z, 0-9>.json` | `{ <brand id>: { label, rows } }` for each brand filed under that first character; a row is `[fdcId, name, category, servingSize, servingUnit, piecesPerServing, pieceNoun, calories, protein, carbs, fat]` for the label's own serving (`servingUnit` is `g` or `ml`; `piecesPerServing`/`pieceNoun` are `0`/`''` when the label doesn't state a piece count) | 377,544 rows | 38 MB in all (8.6 MB) |
| `manifest.json` | `version` (a hash of the other files), the releases, counts | | |

A brand ships rows if it has two or more items or is a store's house brand; the rest are listed with `included` false ([ADR 0012](./specs/decisions/0012-brand-partitions-store-bundles.md)). Sources beyond USDA would fit the same interface ([ADR 0007](./specs/decisions/0007-multi-source-food-library.md)).

### How the app reads it

Each boot fetches `manifest.json` with `cache: 'no-cache'` and every other file as `<file>?v=<version>`, so GitHub Pages' ten-minute cache can't mix builds. IndexedDB (`foodtracker-catalog`) keeps each source's rows with their version; a source that's on downloads again whenever that version doesn't match the manifest. It also keeps copies of the manifest and brand list. A brand-list copy at the current version is used without a fetch, and offline the app searches what's cached; with no network and no copy, the catalog shows its error state. Brands are fetched by letter file, one request per file per batch. A store is one checkbox that stands for its house brands. Details are in [specs/agent-handoff.md](./specs/agent-handoff.md).

### Building

`npm run build-data` downloads the pinned zips into `.cache/usda/` (about 220 MB the first time) and rewrites `public/data/` in about a minute. Output is deterministic. To reuse earlier downloads, point `USDA_CACHE_DIR` at a folder of them with USDA's file names. The 3.3 GB Branded Foods JSON is streamed from its zip, never extracted.

In CI, `.github/actions/food-data` runs it before `npm run build`. Its output is cached on the pins, `scripts/` and `src/domain/`, and the zips on the pins alone, so a code change doesn't download again.

The build, and so the deploy, fails when:
- a curated name or `fdcId` repeats, an `fdcId` is missing from the dumps, or a `countGrams` isn't positive;
- an eligible Foundation / SR Legacy row isn't in `food-classifications.json` (the build lists them), or a kept name repeats or collides with a curated one;
- a store in `STORE_BUNDLES` names a brand the Branded dump no longer has (a USDA rename);
- any row fails the app's validator.

### New USDA releases

Every Monday, or by hand from the Actions tab, `.github/workflows/usda-releases.yml` runs `npm run check-usda-releases` to move each pin to USDA's newest release. If a pin moved, it opens a PR from `usda-releases/branded-<date>-foundation-<date>-sr-legacy-<date>`. It needs a `USDA_PR_TOKEN` repository secret: a fine-grained token with Contents and Pull requests write access on this repo. The default token won't do: this repo doesn't let Actions open PRs, and a PR it opened would run no workflows.

To update by hand, edit a date in `scripts/usda-releases.json` (or run `npm run check-usda-releases`), run `npm run build-data`, and open a PR.

### Hand-written inputs

- `scripts/curated-foods.json`: `{ "name", "fdcId", "category", "countGrams"? }`. With `countGrams`, a food is logged by count, one count weighing that many grams; otherwise it ships per 100 g.
- `scripts/food-classifications.json`: `{ "fdcId", "keep", "name"?, "reason"? }`, with `name` required when `keep` is true.
- `STORE_BUNDLES` in `src/domain/foodSources.ts`: each store's house brand ids.

Brands need no list. Spellings that fold to the same id are one brand (`LAY'S`, `Lays` → `lays`), labelled with its most common mixed-case spelling, or title case if there's none. Within a brand, rows with the same cleaned name and rounded calories, protein, carbs and fat collapse to the latest published row.

## License

MIT. See [LICENSE](./LICENSE).
