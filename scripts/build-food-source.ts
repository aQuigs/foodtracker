import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mapClassifiedFoods, mapCuratedFoods, type CuratedFood, type FoodClassification, type UsdaDump } from './usdaMapper.js';
import { isBrandPack, mapBrandedFoods, matchesPackKeys, type BrandedFood, type BrandPack } from './brandedMapper.js';
import { JsonArrayItemScanner } from './jsonArrayScanner.js';
import type { FoodSourceManifest, SourcedFood } from '../src/domain/types.js';
import { FOOD_SOURCES, datasetDir, isFoodSource } from '../src/domain/foodSources.js';
import { searchKey } from '../src/domain/searchKey.js';

const PUBLIC_DATA_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data');

function usage(): never {
  process.stderr.write(`Usage:
  npm run build-food-source -- curated <version> <curated-foods.json> <usda-dump.json> [more dumps...]
  npm run build-food-source -- full    <version> <food-classifications.json> <curated-foods.json> <usda-dump.json> [more dumps...]
  npm run build-food-source -- packs   <version> <brand-packs.json> <branded-dump.json> [source...]

curated: resolves the hand-named curated list (source "usda") — the primary
catalog tier.
full: ships every kept row of the classification file (source "usda-full") —
the fallback tier behind "More results". Fails loudly if the dumps contain
eligible rows the classification file has never judged, so a dataset update
forces a decision on exactly the new rows. Also reads the curated list and
rejects any kept name that collides with a curated name, so the two tiers
can never show the same title twice.
packs: streams a USDA Branded Foods dump once and sorts rows into store-brand
packs by folded owner/brand name (scripts/brand-packs.json), cleaning names
mechanically and deduping same-name rows to the latest publication. Name one
or more sources after the dump path to build only those packs. Fails on a
pack whose source isn't registered in src/domain/foodSources.ts, an empty
pack, an unknown named source, or a config string that folds to nothing.

curated/full read USDA FoodData Central dumps (Foundation / SR Legacy JSON
downloads from https://fdc.nal.usda.gov/download-datasets); packs reads a
Branded Foods JSON download from the same site, streamed rather than parsed
whole so a multi-gigabyte file never sits in memory at once.

All three emit public/data/<source>-v<version>/foods.json and manifest.json.
Vite copies public/ into dist/ on build, so the deployed app serves these at
\${BASE_URL}data/<source>-v<version>/... — same-origin, no CORS.
Datasets ship as plain JSON (transport compression handles size); the
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

// Encodes, hashes, and writes the foods.json + manifest.json pair every mode
// produces, so the three modes share one place that defines that layout.
async function writeDataset(sourceName: string, version: string, items: SourcedFood[]): Promise<{ dir: string; bytes: number }> {
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

function validatePacks(packs: BrandPack[]): void {
  const seen = new Set<string>();

  for (const pack of packs) {
    if (!isFoodSource(pack.source)) {
      throw new Error(`brand pack "${pack.source}" is not registered in src/domain/foodSources.ts`);
    }

    if (seen.has(pack.source)) {
      throw new Error(`brand pack "${pack.source}" is listed more than once in the config`);
    }

    seen.add(pack.source);

    for (const s of [...pack.owners, ...pack.brands, ...pack.strip]) {
      if (searchKey(s) === '') {
        throw new Error(`brand pack "${pack.source}": config string folds to nothing: ${JSON.stringify(s)}`);
      }
    }
  }
}

function selectPacks(packs: BrandPack[], names: string[]): BrandPack[] {
  if (names.length === 0) {
    return packs;
  }

  return [...new Set(names)].map((name) => {
    const pack = packs.find((p) => p.source === name);
    if (!pack) {
      throw new Error(`unknown pack "${name}"`);
    }

    return pack;
  });
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

async function runPacksMode(rest: string[]): Promise<void> {
  const [version, packsPath, dumpPath, ...restrict] = rest;

  if (!version || !packsPath || !dumpPath) {
    usage();
  }

  const packs = await loadList(packsPath, isBrandPack, 'brand pack');
  validatePacks(packs);
  const scope = selectPacks(packs, restrict);

  const buckets = new Map<string, BrandedFood[]>(scope.map((p) => [p.source, []]));

  process.stderr.write(`Streaming ${dumpPath}…\n`);
  const total = await streamBrandedRows(dumpPath, (row) => {
    const ownerKey = row.brandOwner !== undefined ? searchKey(row.brandOwner) : null;
    const brandKey = row.brandName !== undefined ? searchKey(row.brandName) : null;

    for (const pack of scope) {
      if (matchesPackKeys(ownerKey, brandKey, pack)) {
        buckets.get(pack.source)!.push(row);
      }
    }
  });

  if (total === 0) {
    throw new Error(`${dumpPath}: streamed zero items from the first array — check the dump's shape (expected e.g. {"BrandedFoods":[...]})`);
  }

  // Map and validate every pack before writing any of them, so a failure
  // partway through never leaves public/data with some packs rebuilt and
  // others stale.
  const mapped = scope.map((pack) => ({ pack, items: mapBrandedFoods(buckets.get(pack.source)!, pack, pack.source) }));

  const empty = mapped.find((m) => m.items.length === 0);
  if (empty) {
    throw new Error(`pack "${empty.pack.source}" matched no shippable rows`);
  }

  for (const { pack, items } of mapped) {
    const { dir } = await writeDataset(pack.source, version, items);
    process.stderr.write(`${pack.source}: ${buckets.get(pack.source)!.length} matched, ${items.length} shipped -> ${dir}\n`);
  }

  process.stderr.write(`\nNext: commit public/data/*-v${version}/* and push. GH Pages redeploys.\n`);
}

async function main(): Promise<void> {
  const [, , mode, ...rest] = process.argv;

  if (mode === 'curated' || mode === 'full') {
    await runUsdaMode(mode, rest);
    return;
  }

  if (mode === 'packs') {
    await runPacksMode(rest);
    return;
  }

  usage();
}

main().catch((e: unknown) => {
  process.stderr.write(`ERROR: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});
