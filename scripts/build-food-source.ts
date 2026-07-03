import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mapCuratedFoods, type CuratedFood, type UsdaDump } from './usdaMapper.js';
import type { FoodSourceManifest } from '../src/domain/types.js';

const SOURCE_NAME = 'usda';
const PUBLIC_DATA_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data');

function usage(): never {
  process.stderr.write(`Usage: npm run build-food-source -- <version> <curated-foods.json> <usda-dump.json> [more dumps...]

Resolves each entry of the curated food list against the USDA FoodData
Central dumps (Foundation / SR Legacy JSON downloads from
https://fdc.nal.usda.gov/download-datasets) and emits
public/data/${SOURCE_NAME}-v<version>/foods.json and manifest.json.
Vite copies public/ into dist/ on build, so the deployed app serves these at
\${BASE_URL}data/${SOURCE_NAME}-v<version>/... — same-origin, no CORS.
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

async function loadCurated(path: string): Promise<CuratedFood[]> {
  const parsed: unknown = JSON.parse(await readFile(path, 'utf8'));

  if (!Array.isArray(parsed)) {
    throw new Error(`${path}: expected a JSON array`);
  }

  const bad = parsed.findIndex((e) => !isCuratedFood(e));
  if (bad !== -1) {
    throw new Error(`${path}: entry ${bad} is not a valid curated food: ${JSON.stringify(parsed[bad])}`);
  }

  return parsed as CuratedFood[];
}

async function loadDump(path: string): Promise<UsdaDump> {
  const parsed: unknown = JSON.parse(await readFile(path, 'utf8'));

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(`${path}: top-level value is not an object`);
  }

  return parsed as UsdaDump;
}

async function main(): Promise<void> {
  const [, , version, curatedPath, ...dumpPaths] = process.argv;

  if (!version || !curatedPath || dumpPaths.length === 0) {
    usage();
  }

  process.stderr.write(`Reading curated list and USDA dumps…\n`);
  const curated = await loadCurated(curatedPath);
  const dumps = await Promise.all(dumpPaths.map(loadDump));

  process.stderr.write(`Resolving ${curated.length} curated foods…\n`);
  const items = mapCuratedFoods(dumps, curated, SOURCE_NAME);

  process.stderr.write(`Mapped ${items.length} items. Encoding…\n`);
  const body = Buffer.from(JSON.stringify(items), 'utf8');
  const sha256 = createHash('sha256').update(body).digest('hex');

  const generatedAt = process.env.FOODTRACKER_BUILD_TIMESTAMP ?? new Date().toISOString();
  const manifest: FoodSourceManifest = {
    source: SOURCE_NAME,
    version,
    itemCount: items.length,
    sha256,
    generatedAt,
  };

  const outDir = join(PUBLIC_DATA_ROOT, `${SOURCE_NAME}-v${version}`);
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, 'foods.json'), body);
  await writeFile(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');

  process.stderr.write(`Wrote ${outDir}/foods.json (${body.length} bytes)\n`);
  process.stderr.write(`Wrote ${outDir}/manifest.json\n`);
  process.stderr.write(`\nNext: commit public/data/${SOURCE_NAME}-v${version}/* and push. GH Pages redeploys.\n`);
}

main().catch((e: unknown) => {
  process.stderr.write(`ERROR: ${(e as Error).message}\n`);
  process.exit(1);
});
