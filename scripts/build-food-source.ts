import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mapClassifiedFoods, mapCuratedFoods, sortByName, type CuratedFood, type FoodClassification, type UsdaDump } from './usdaMapper.js';
import { BrandCollector, buildBrandsIndex, packShards, type BrandedFood } from './brandedMapper.js';
import { JsonArrayItemScanner } from './jsonArrayScanner.js';
import type { BrandShardManifest, FoodSourceManifest, SourcedFood } from '../src/domain/types.js';
import { BRANDS_DATASET, FOOD_SOURCES, datasetDir } from '../src/domain/foodSources.js';
import { searchKey } from '../src/domain/searchKey.js';

const PUBLIC_DATA_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data');

// Small enough that turning on one brand is a quick fetch on a phone, large
// enough that a thousand-odd files cover the whole dump.
const SHARD_TARGET_BYTES = 100_000;

function usage(): never {
  process.stderr.write(`Usage:
  npm run build-food-source -- curated <version> <curated-foods.json> <usda-dump.json> [more dumps...]
  npm run build-food-source -- full    <version> <food-classifications.json> <curated-foods.json> <usda-dump.json> [more dumps...]
  npm run build-food-source -- brands  <version> <branded-dump.json>

curated: resolves the hand-named curated list (source "usda") — the primary
catalog tier.
full: ships every kept row of the classification file (source "usda-full") —
the fallback tier behind "More results". Fails loudly if the dumps contain
eligible rows the classification file has never judged, so a dataset update
forces a decision on exactly the new rows. Also reads the curated list and
rejects any kept name that collides with a curated name, so the two tiers
can never show the same title twice.
brands: streams a USDA Branded Foods dump once and files every row under its
brand name, cleaning names mechanically and collapsing rows that share a name
and nutrition to the latest publication. Emits one index naming every brand
and a set of shards holding the rows (source "brand:<id>" per brand).

curated/full read USDA FoodData Central dumps (Foundation / SR Legacy JSON
downloads from https://fdc.nal.usda.gov/download-datasets); brands reads a
Branded Foods JSON download from the same site, streamed rather than parsed
whole so a multi-gigabyte file never sits in memory at once.

curated/full emit public/data/<source>-v<version>/foods.json + manifest.json;
brands emits public/data/brands-v<version>/index.json + shard-<i>.json.
Vite copies public/ into dist/ on build, so the deployed app serves these at
\${BASE_URL}data/... — same-origin, no CORS.
Datasets ship as plain JSON (transport compression handles size); every
sha256 is computed over the exact bytes the browser will receive.

Output is deterministic when FOODTRACKER_BUILD_TIMESTAMP is set; without it,
the generatedAt field defaults to "now" and will differ between runs.

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

function generatedAt(): string {
  return process.env.FOODTRACKER_BUILD_TIMESTAMP ?? new Date().toISOString();
}

function sha256(body: Buffer): string {
  return createHash('sha256').update(body).digest('hex');
}

// Encodes, hashes, and writes the foods.json + manifest.json pair the USDA
// modes produce, so both share one place that defines that layout.
async function writeDataset(sourceName: string, version: string, items: SourcedFood[]): Promise<{ dir: string; bytes: number }> {
  const body = Buffer.from(JSON.stringify(items), 'utf8');

  const manifest: FoodSourceManifest = {
    source: sourceName,
    version,
    itemCount: items.length,
    sha256: sha256(body),
    generatedAt: generatedAt(),
  };

  const dir = datasetDir(sourceName, version);
  const outDir = join(PUBLIC_DATA_ROOT, dir);
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, 'foods.json'), body);
  await writeFile(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');

  process.stderr.write(`Wrote ${outDir}/foods.json (${body.length} bytes)\n`);
  process.stderr.write(`Wrote ${outDir}/manifest.json\n`);

  return { dir, bytes: body.length };
}

async function runUsdaMode(mode: 'curated' | 'full', rest: string[]): Promise<void> {
  const [version, listPath, ...dumpPaths] = rest;

  if (!version || !listPath || dumpPaths.length === 0) {
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
  const { dir } = await writeDataset(sourceName, version, items);
  process.stderr.write(`\nNext: commit public/data/${dir}/* and push. GH Pages redeploys.\n`);
}

// Streams the dump once, handing every element of its top-level array (an
// object; malformed rows are skipped) to visit — never loads the file whole.
// Returns the total element count so the caller can catch a dump whose
// shape didn't match (wrong top-level array, or an empty one).
async function streamBrandedRows(path: string, visit: (row: BrandedFood) => void): Promise<number> {
  const scanner = new JsonArrayItemScanner();
  const stream = createReadStream(path, { encoding: 'utf8', highWaterMark: 1024 * 1024 });
  let total = 0;

  for await (const chunk of stream) {
    for (const item of scanner.push(chunk as string)) {
      total++;
      if (typeof item === 'object' && item !== null) {
        visit(item as BrandedFood);
      }
    }
  }

  scanner.end();
  return total;
}

async function runBrandsMode(rest: string[]): Promise<void> {
  const [version, dumpPath] = rest;

  if (!version || !dumpPath) {
    usage();
  }

  const collector = new BrandCollector();

  process.stderr.write(`Streaming ${dumpPath}…\n`);
  const total = await streamBrandedRows(dumpPath, (row) => collector.add(row));

  if (total === 0) {
    throw new Error(`${dumpPath}: streamed zero items from the first array — check the dump's shape (expected e.g. {"BrandedFoods":[...]})`);
  }

  const brands = collector.datasets();
  if (brands.length === 0) {
    throw new Error('no brand matched a shippable row');
  }

  const shards = packShards(brands, SHARD_TARGET_BYTES);

  // A previous build may have used more shards; a stale shard-<i>.json
  // beyond the new count would otherwise sit there unreferenced.
  const dir = datasetDir(BRANDS_DATASET, version);
  const outDir = join(PUBLIC_DATA_ROOT, dir);
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  const manifests: BrandShardManifest[] = [];
  let totalBytes = 0;
  for (const [i, shard] of shards.entries()) {
    const foods = sortByName(shard.flatMap((brand) => brand.foods));
    const body = Buffer.from(JSON.stringify(foods), 'utf8');
    await writeFile(join(outDir, `shard-${i}.json`), body);
    manifests.push({ sha256: sha256(body), itemCount: foods.length, bytes: body.length });
    totalBytes += body.length;
  }

  const index = buildBrandsIndex({ version, generatedAt: generatedAt(), shards, manifests });
  const indexBody = Buffer.from(JSON.stringify(index), 'utf8');
  await writeFile(join(outDir, 'index.json'), indexBody);

  const rows = brands.reduce((sum, b) => sum + b.foods.length, 0);
  process.stderr.write(`Wrote ${outDir}/index.json (${indexBody.length} bytes): ${brands.length} brands, ${rows} rows\n`);
  process.stderr.write(`Wrote ${shards.length} shards (${totalBytes} bytes)\n`);
  process.stderr.write(`\nNext: commit public/data/${dir}/* and push. GH Pages redeploys.\n`);
}

async function main(): Promise<void> {
  const [, , mode, ...rest] = process.argv;

  if (mode === 'curated' || mode === 'full') {
    await runUsdaMode(mode, rest);
    return;
  }

  if (mode === 'brands') {
    await runBrandsMode(rest);
    return;
  }

  usage();
}

main().catch((e: unknown) => {
  process.stderr.write(`ERROR: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});
