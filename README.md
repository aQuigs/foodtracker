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

The app ships with ~10 hand-seeded foods. On first launch it fetches a USDA dataset (~16k items, ~8 MB gzipped) from the same origin (`public/data/usda-v<n>/` → served at `${BASE_URL}data/usda-v<n>/`) and caches it in IndexedDB. Subsequent launches are instant. Bumping `catalogVersions.usda` (in `src/main.ts`) triggers re-hydration on next boot.

The architecture supports multiple food sources beyond USDA (pantry, restaurant menus, …) behind one interface — see [ADR 0007](./specs/decisions/0007-multi-source-food-library.md).

### Rebuilding the USDA dataset

1. Download three JSON dumps from [USDA FoodData Central](https://fdc.nal.usda.gov/download-datasets): Foundation Foods, SR Legacy, FNDDS Survey.
2. Run the build script:

   ```bash
   npm run build-food-source -- <version> <foundation.json> <sr-legacy.json> <fndds.json>
   ```

   `<version>` is a free-form suffix (e.g. `1`, `2026-05-29-1`). Outputs land in `public/data/usda-v<version>/` and are picked up by Vite at build time.

   For byte-identical reruns, pin the manifest timestamp:

   ```bash
   FOODTRACKER_BUILD_TIMESTAMP=2026-05-29T12:00:00.000Z \
     npm run build-food-source -- 1 foundation.json sr-legacy.json fndds.json
   ```

3. Commit the new files and push:

   ```bash
   git add public/data/usda-v<version>
   git commit -m "data: USDA v<version>"
   git push
   ```

   GH Pages redeploys with the app and dataset bundled. No release upload, no third-party CDN — same-origin under `aquigs.github.io/foodtracker/data/usda-v<version>/`.

4. Bump `catalogVersions.usda` in `src/main.ts` to the new version (typically in the same commit as step 3). Next app launch re-hydrates IndexedDB from the new dataset.

## License

MIT. See [LICENSE](./LICENSE).
