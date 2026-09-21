import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { FOOD_SOURCES } from '../src/domain/foodSources.js';
import { DATA_PATHS, type BrandList, type CatalogManifest } from '../src/domain/dataFiles.js';
import { searchKey } from '../src/domain/searchKey.js';
import type { SourcedFood } from '../src/domain/types.js';
import { isSourcedFood } from '../src/domain/validate.js';
import { BrandCollector, type BrandDataset, type BrandedFood } from './brandedMapper.js';
import { brandOutput } from './brandFiles.js';
import { filesDigest, byPath, type NamedBytes } from './filesDigest.js';
import { JsonArrayItemScanner } from './jsonArrayScanner.js';
import { mapClassifiedFoods, mapCuratedFoods, type CuratedFood, type FoodClassification, type UsdaDump } from './usdaMapper.js';
import { RELEASE_KINDS, parseReleases, releaseZipName, releaseZipUrl, type ReleaseKind } from './usdaReleases.js';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RELEASES_PATH = join(REPO_ROOT, 'scripts', 'usda-releases.json');
const CURATED_PATH = join(REPO_ROOT, 'scripts', 'curated-foods.json');
const CLASSIFICATIONS_PATH = join(REPO_ROOT, 'scripts', 'food-classifications.json');
const OUT_DIR = join(REPO_ROOT, 'public', 'data');
const CACHE_DIR = process.env.USDA_CACHE_DIR ?? join(REPO_ROOT, '.cache', 'usda');

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

async function exists(path: string): Promise<boolean> {
  return stat(path).then(() => true, () => false);
}

// Named as USDA names them, so a folder of earlier downloads is reused as
// is. A download lands under .part first: an interrupted one must never pass
// for a complete zip.
async function ensureZip(kind: ReleaseKind, date: string): Promise<string> {
  const path = join(CACHE_DIR, releaseZipName(kind, date));

  if (await exists(path)) {
    return path;
  }

  const url = releaseZipUrl(kind, date);
  console.log(`Downloading ${url}`);

  const res = await fetch(url);
  if (!res.ok || res.body === null) {
    throw new Error(`${url}: HTTP ${res.status}`);
  }

  await mkdir(CACHE_DIR, { recursive: true });
  await pipeline(Readable.fromWeb(res.body), createWriteStream(`${path}.part`));
  await rename(`${path}.part`, path);

  return path;
}

// The one file inside a USDA zip, streamed rather than extracted: the
// Branded Foods JSON alone is over 3 GB.
async function* unzipText(zip: string): AsyncGenerator<string> {
  const child = spawn('unzip', ['-p', zip], { stdio: ['ignore', 'pipe', 'inherit'] });
  const exit = new Promise<number | null>((resolve, reject) => {
    child.once('error', reject);
    child.once('close', resolve);
  });

  child.stdout.setEncoding('utf8');
  for await (const chunk of child.stdout) {
    yield chunk as string;
  }

  const code = await exit;
  if (code !== 0) {
    throw new Error(`unzip -p ${zip} exited with code ${code}`);
  }
}

async function loadDump(zip: string): Promise<UsdaDump> {
  let text = '';
  for await (const chunk of unzipText(zip)) {
    text += chunk;
  }

  const parsed: unknown = JSON.parse(text);
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(`${zip}: top-level value is not an object`);
  }

  return parsed as UsdaDump;
}

async function buildUsdaTiers(zips: Record<ReleaseKind, string>): Promise<{ usda: SourcedFood[]; usdaFull: SourcedFood[] }> {
  const curated = await loadList(CURATED_PATH, isCuratedFood, 'curated food');
  const classifications = await loadList(CLASSIFICATIONS_PATH, isClassification, 'classification');
  const dumps = [await loadDump(zips.foundation), await loadDump(zips.srLegacy)];

  // A full-tier name may not repeat a curated one, so the two tiers never
  // show the same title twice.
  const reserved = new Set(curated.map((c) => searchKey(c.name)));

  return {
    usda: mapCuratedFoods(dumps, curated, FOOD_SOURCES.USDA),
    usdaFull: mapClassifiedFoods(dumps, classifications, FOOD_SOURCES.USDA_FULL, reserved),
  };
}

async function collectBrands(zip: string): Promise<BrandDataset[]> {
  const scanner = new JsonArrayItemScanner();
  const collector = new BrandCollector();
  let rows = 0;

  for await (const chunk of unzipText(zip)) {
    for (const item of scanner.push(chunk)) {
      rows++;

      if (typeof item === 'object' && item !== null) {
        collector.add(item as BrandedFood);
      }
    }
  }

  scanner.end();

  if (rows === 0) {
    throw new Error(`${zip}: its first JSON array is empty; expected {"BrandedFoods":[...]}`);
  }

  const brands = collector.datasets();
  if (brands.length === 0) {
    throw new Error(`${zip}: no row made a shippable brand food`);
  }

  return brands;
}

// Nothing checks the data after this build, so every row is held to the
// same validator the app reads it through.
function assertValid(what: string, foods: SourcedFood[]): void {
  const bad = foods.find((food) => !isSourcedFood(food));

  if (bad !== undefined) {
    throw new Error(`${what}: invalid row ${JSON.stringify(bad)}`);
  }
}

function jsonFile(path: string, value: unknown): NamedBytes {
  return { path, bytes: Buffer.from(JSON.stringify(value)) };
}

function brandCounts(list: BrandList): { brands: number; brandsIncluded: number; brandRows: number } {
  const included = list.brands.filter(([, , , file]) => file !== null);
  return {
    brands: list.brands.length,
    brandsIncluded: included.length,
    brandRows: included.reduce((sum, [, , count]) => sum + count, 0),
  };
}

function printSummary(files: NamedBytes[], counts: ReturnType<typeof brandCounts>, elapsedMs: number): void {
  const n = (v: number): string => v.toLocaleString('en-US');
  const rows = [...files].sort(byPath).map((f) => [f.path, f.bytes.length, gzipSync(f.bytes).length] as const);
  const width = Math.max(...rows.map(([path]) => path.length), 'total'.length);
  const line = (label: string, raw: number, gz: number): string => `  ${label.padEnd(width)}  ${n(raw).padStart(12)}  ${n(gz).padStart(11)}`;

  console.log(`\n${OUT_DIR}`);
  console.log(`  ${'file'.padEnd(width)}  ${'bytes'.padStart(12)}  ${'gzip'.padStart(11)}`);
  for (const [path, raw, gz] of rows) {
    console.log(line(path, raw, gz));
  }

  console.log(line('total', rows.reduce((s, [, raw]) => s + raw, 0), rows.reduce((s, [, , gz]) => s + gz, 0)));
  console.log(`\nBrands: ${n(counts.brandsIncluded)} included, ${n(counts.brands - counts.brandsIncluded)} listed only; ${n(counts.brandRows)} rows`);
  console.log(`Built in ${(elapsedMs / 1000).toFixed(1)} s`);
}

async function main(): Promise<void> {
  const started = performance.now();
  const releases = parseReleases(JSON.parse(await readFile(RELEASES_PATH, 'utf8')));

  const zips = Object.fromEntries(await Promise.all(
    RELEASE_KINDS.map(async (kind) => [kind, await ensureZip(kind, releases[kind])] as const),
  )) as Record<ReleaseKind, string>;

  console.log('Mapping Foundation + SR Legacy…');
  const { usda, usdaFull } = await buildUsdaTiers(zips);
  assertValid(FOOD_SOURCES.USDA, usda);
  assertValid(FOOD_SOURCES.USDA_FULL, usdaFull);

  console.log('Streaming Branded Foods…');
  const { list, files: brandFiles } = brandOutput(await collectBrands(zips.branded));
  const files = [
    jsonFile(DATA_PATHS.source(FOOD_SOURCES.USDA), usda),
    jsonFile(DATA_PATHS.source(FOOD_SOURCES.USDA_FULL), usdaFull),
    jsonFile(DATA_PATHS.brandList, list),
    ...[...brandFiles].map(([key, file]) => jsonFile(DATA_PATHS.brandFile(key), file)),
  ];

  // An identifier for the whole build, so the app can tell a rebuild from
  // what it has cached; not an integrity check.
  const version = (await filesDigest(files)).slice(0, 12);
  const counts = { usda: usda.length, usdaFull: usdaFull.length, ...brandCounts(list) };
  const manifest: CatalogManifest & Record<string, unknown> = { version, releases, counts };
  files.push({ path: DATA_PATHS.manifest, bytes: Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`) });

  await rm(OUT_DIR, { recursive: true, force: true });
  for (const file of files) {
    const path = join(OUT_DIR, file.path);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, file.bytes);
  }

  printSummary(files, counts, performance.now() - started);
}

main().catch((e: unknown) => {
  process.stderr.write(`ERROR: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});
