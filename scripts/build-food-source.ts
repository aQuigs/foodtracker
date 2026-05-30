import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mapUsdaDumps, type UsdaDump } from './usdaMapper.js';
import type { FoodSourceManifest } from '../src/domain/types.js';

const SOURCE_NAME = 'usda';
const PUBLIC_DATA_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data');

function usage(): never {
  process.stderr.write(`Usage: npm run build-food-source -- <version> <foundation.json> <sr-legacy.json> <fndds.json>

Emits public/data/${SOURCE_NAME}-v<version>/foods.json.gz and manifest.json.
Vite copies public/ into dist/ on build, so the deployed app serves these at
\${BASE_URL}data/${SOURCE_NAME}-v<version>/... — same-origin, no CORS.

Output is deterministic when FOODTRACKER_BUILD_TIMESTAMP is set; without it,
the manifest.generatedAt field defaults to "now" and will differ between runs.

After building, commit the new files under public/data/ and push. GH Pages
redeploys the app + dataset together.
`);
  process.exit(2);
}

async function loadDump(path: string): Promise<UsdaDump> {
  const raw = await readFile(path, 'utf8');
  const parsed: unknown = JSON.parse(raw);

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(`${path}: top-level value is not an object`);
  }

  return parsed as UsdaDump;
}

async function main(): Promise<void> {
  const [, , version, foundationPath, srLegacyPath, fnddsPath] = process.argv;

  if (!version || !foundationPath || !srLegacyPath || !fnddsPath) {
    usage();
  }

  process.stderr.write(`Reading USDA dumps…\n`);
  const dumps = await Promise.all([
    loadDump(foundationPath),
    loadDump(srLegacyPath),
    loadDump(fnddsPath),
  ]);

  process.stderr.write(`Mapping to SourcedFood…\n`);
  const items = mapUsdaDumps(dumps, SOURCE_NAME);

  process.stderr.write(`Mapped ${items.length} items. Encoding & gzipping…\n`);
  const json = JSON.stringify(items);
  const gz = gzipSync(Buffer.from(json, 'utf8'), { level: 9 });
  const sha256 = createHash('sha256').update(gz).digest('hex');

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
  await writeFile(join(outDir, 'foods.json.gz'), gz);
  await writeFile(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');

  process.stderr.write(`Wrote ${outDir}/foods.json.gz (${gz.length} bytes)\n`);
  process.stderr.write(`Wrote ${outDir}/manifest.json\n`);
  process.stderr.write(`\nNext: commit public/data/${SOURCE_NAME}-v${version}/* and push. GH Pages redeploys.\n`);
}

main().catch((e: unknown) => {
  process.stderr.write(`ERROR: ${(e as Error).message}\n`);
  process.exit(1);
});
