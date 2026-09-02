import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mapClassifiedFoods, mapCuratedFoods, type CuratedFood, type FoodClassification, type UsdaDump } from './usdaMapper.js';
import type { FoodSourceManifest, SourcedFood } from '../src/domain/types.js';
import { FOOD_SOURCES, datasetDir } from '../src/domain/foodSources.js';
import { searchKey } from '../src/domain/searchKey.js';

const PUBLIC_DATA_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data');

function usage(): never {
  process.stderr.write(`Usage:
  npm run build-food-source -- curated <version> <curated-foods.json> <usda-dump.json> [more dumps...]
  npm run build-food-source -- full    <version> <food-classifications.json> <curated-foods.json> <usda-dump.json> [more dumps...]

curated: resolves the hand-named curated list (source "usda") — the primary
catalog tier.
full: ships every kept row of the classification file (source "usda-full") —
the fallback tier behind "More results". Fails loudly if the dumps contain
eligible rows the classification file has never judged, so a dataset update
forces a decision on exactly the new rows. Also reads the curated list and
rejects any kept name that collides with a curated name, so the two tiers
can never show the same title twice.

Both read USDA FoodData Central dumps (Foundation / SR Legacy JSON downloads
from https://fdc.nal.usda.gov/download-datasets) and emit
public/data/<source>-v<version>/foods.json and manifest.json.
Vite copies public/ into dist/ on build, so the deployed app serves these at
\${BASE_URL}data/<source>-v<version>/... — same-origin, no CORS.
The dataset ships as plain JSON (transport compression handles size); the
manifest sha256 is computed over the exact bytes the browser will receive.

Output is deterministic when FOODTRACKER_BUILD_TIMESTAMP is set; without it,
the manifest.generatedAt field defaults to "now" and will differ between runs.

After building, commit the new files under public/data/ and push. GH Pages
redeploys the app + dataset together.
`);
  process.exit(2);
}

function isCuratedFood(v: unknown): v is CuratedFood {
  if (typeof v !== 'object' || v === null) {
    return false;
  }

  const e = v as Record<string, unknown>;
  if (typeof e.name !== 'string' || e.name.length === 0) {
    return false;
  }

  if (typeof e.fdcId !== 'number' || typeof e.category !== 'string') {
    return false;
  }

  return e.countGrams === undefined || typeof e.countGrams === 'number';
}

function isClassification(v: unknown): v is FoodClassification {
  if (typeof v !== 'object' || v === null) {
    return false;
  }

  const e = v as Record<string, unknown>;
  if (typeof e.fdcId !== 'number' || typeof e.keep !== 'boolean') {
    return false;
  }

  return e.name === undefined || typeof e.name === 'string';
}

async function loadList<T>(path: string, isItem: (v: unknown) => v is T, what: string): Promise<T[]> {
  const parsed: unknown = JSON.parse(await readFile(path, 'utf8'));

  if (!Array.isArray(parsed)) {
    throw new Error(`${path}: expected a JSON array`);
  }

  const bad = parsed.findIndex((e) => !isItem(e));
  if (bad !== -1) {
    throw new Error(`${path}: entry ${bad} is not a valid ${what}: ${JSON.stringify(parsed[bad])}`);
  }

  return parsed as T[];
}

async function loadDump(path: string): Promise<UsdaDump> {
  const parsed: unknown = JSON.parse(await readFile(path, 'utf8'));

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(`${path}: top-level value is not an object`);
  }

  return parsed as UsdaDump;
}

async function main(): Promise<void> {
  const [, , mode, version, listPath, ...dumpPaths] = process.argv;

  if ((mode !== 'curated' && mode !== 'full') || !version || !listPath || dumpPaths.length === 0) {
    usage();
  }

  const sourceName = mode === 'curated' ? FOOD_SOURCES.USDA : FOOD_SOURCES.USDA_FULL;

  process.stderr.write(`Reading ${mode} list and USDA dumps…\n`);

  let items: SourcedFood[];
  if (mode === 'curated') {
    const curated = await loadList(listPath, isCuratedFood, 'curated food');
    const dumps = await Promise.all(dumpPaths.map(loadDump));
    process.stderr.write(`Resolving ${curated.length} curated foods…\n`);
    items = mapCuratedFoods(dumps, curated, sourceName);
  } else {
    const [curatedPath, ...fullDumpPaths] = dumpPaths;
    if (!curatedPath || fullDumpPaths.length === 0) {
      usage();
    }

    const classifications = await loadList(listPath, isClassification, 'classification');
    const curated = await loadList(curatedPath, isCuratedFood, 'curated food');
    const dumps = await Promise.all(fullDumpPaths.map(loadDump));
    const reserved = new Set(curated.map((c) => searchKey(c.name)));
    process.stderr.write(`Applying ${classifications.length} classifications…\n`);
    items = mapClassifiedFoods(dumps, classifications, sourceName, reserved);
  }

  process.stderr.write(`Mapped ${items.length} items. Encoding…\n`);
  const body = Buffer.from(JSON.stringify(items), 'utf8');
  const sha256 = createHash('sha256').update(body).digest('hex');

  const generatedAt = process.env.FOODTRACKER_BUILD_TIMESTAMP ?? new Date().toISOString();
  const manifest: FoodSourceManifest = {
    source: sourceName,
    version,
    itemCount: items.length,
    sha256,
    generatedAt,
  };

  const dir = datasetDir(sourceName, version);
  const outDir = join(PUBLIC_DATA_ROOT, dir);
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, 'foods.json'), body);
  await writeFile(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');

  process.stderr.write(`Wrote ${outDir}/foods.json (${body.length} bytes)\n`);
  process.stderr.write(`Wrote ${outDir}/manifest.json\n`);
  process.stderr.write(`\nNext: commit public/data/${dir}/* and push. GH Pages redeploys.\n`);
}

main().catch((e: unknown) => {
  process.stderr.write(`ERROR: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});
