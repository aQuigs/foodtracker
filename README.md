# foodtracker

Browser food tracker. Static site, localStorage, no backend. Milestones: [specs/MILESTONES.md](./specs/MILESTONES.md).

## Stack

- TypeScript, Vite
- Web Test Runner + Playwright
- GitHub Pages. Installable PWA; opens offline ([ADR 0011](./specs/decisions/0011-offline-app-shell.md)).

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

- The app fetches read-only catalogs from `${BASE_URL}data/`. They are not committed.
- Every deploy and PR preview builds them from the USDA FoodData Central releases pinned in `scripts/usda-releases.json`.

| File under `public/data/` | What | Items | Size (gzip) |
|---|---|---|---|
| `usda.json` | Everyday foods: hand-named staples from Foundation + SR Legacy | 194 | 40 KB (6 KB) |
| `usda-full.json` | All USDA foods: every Foundation + SR Legacy row judged `keep` | 2,282 | 534 KB (62 KB) |
| `brands/index.json` | `{ brands }`: every Branded Foods brand as `[id, label, count, included]` | 33,171 brands | 1.3 MB (353 KB) |
| `brands/<a…z, 0-9>.json` | `{ <brand id>: { label, rows } }` for each brand filed under that first character; a row is `[fdcId, name, category, servingSize, servingUnit, piecesPerServing, pieceNoun, calories, protein, carbs, fat]` for the label's own serving (`servingUnit` is `g` or `ml`; `piecesPerServing`/`pieceNoun` are `0`/`''` when the label doesn't state a piece count) | 377,544 rows | 38 MB in all (8.6 MB) |
| `manifest.json` | `version` (a hash of the other files), the releases, counts | | |

- A brand ships rows if it has 2+ items or is a store's house brand. Other brands: listed, `included` false ([ADR 0012](./specs/decisions/0012-brand-partitions-store-bundles.md)).
- The source interface is not USDA-specific ([ADR 0007](./specs/decisions/0007-multi-source-food-library.md)).

### How the app reads it

- Boot fetches `manifest.json` with `cache: 'no-cache'`, and every other file as `<file>?v=<version>`, so GitHub Pages' 10-minute cache can't mix builds.
- IndexedDB `foodtracker-catalog` stores each source's rows and version. An enabled source re-downloads when its version ≠ the manifest's.
- IndexedDB also stores copies of the manifest and brand list.
  - Brand-list copy at the current version: used without a fetch.
  - Offline: search uses the cache.
  - No network and no copy: the catalog shows its error state.
- Brands are fetched per letter file: 1 request per file per batch.
- A store is 1 checkbox standing for its house brands.
- Details: [specs/agent-handoff.md](./specs/agent-handoff.md).

### Building

- `npm run build-data` downloads the pinned zips to `.cache/usda/` (220 MB on first run) and rewrites `public/data/` in ~1 minute. Output is deterministic.
- To reuse downloads, set `USDA_CACHE_DIR` to a folder of zips with USDA's file names.
- The 3.3 GB Branded Foods JSON streams from its zip; it is never extracted.
- CI: `.github/actions/food-data` runs it before `npm run build`.
  - Output cache key: the pins, `scripts/`, `src/domain/`.
  - Zip cache key: the pins. A code change doesn't re-download.

The build, and so the deploy, fails when:
- a curated name or `fdcId` repeats, an `fdcId` is missing from the dumps, or a `countGrams` isn't positive;
- an eligible Foundation / SR Legacy row isn't in `food-classifications.json` (the build lists them), or a kept name repeats or collides with a curated one;
- a store in `STORE_BUNDLES` names a brand missing from the Branded dump (a USDA rename);
- any row fails the app's validator.

### New USDA releases

- `.github/workflows/usda-releases.yml` runs every Monday and on manual dispatch.
- It runs `npm run check-usda-releases`, which moves each pin to USDA's newest release.
- If a pin moved, it opens a PR from `usda-releases/branded-<date>-foundation-<date>-sr-legacy-<date>`.
- Requires repository secret `USDA_PR_TOKEN`: a fine-grained token with Contents and Pull requests write on this repo. The default token fails: Actions can't open PRs here, and a PR it opens runs no workflows.
- By hand: edit a date in `scripts/usda-releases.json` (or run `npm run check-usda-releases`), run `npm run build-data`, open a PR.

### Hand-written inputs

- `scripts/curated-foods.json`: `{ "name", "fdcId", "category", "countGrams"? }`.
  - With `countGrams`: logged by count; 1 count = `countGrams` g.
  - Without: per 100 g.
- `scripts/food-classifications.json`: `{ "fdcId", "keep", "name"?, "reason"? }`. `name` is required when `keep` is true.
- `STORE_BUNDLES` in `src/domain/foodSources.ts`: each store's house brand ids.

Brands have no hand-written list:
- Spellings that normalize to one id are one brand (`LAY'S`, `Lays` → `lays`).
- Label: the most common mixed-case spelling, else title case.
- Rows with the same cleaned name and rounded calories, protein, carbs and fat collapse to the latest published.

## License

MIT. See [LICENSE](./LICENSE).
