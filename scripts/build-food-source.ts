import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mapUsdaDumps, type UsdaDump } from './usdaMapper.js';
import type { FoodSourceManifest } from '../src/domain/types.js';

const SOURCE_NAME = 'usda';
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist-food-source');

function usage(): never {
  process.stderr.write(`Usage: npm run build-food-source -- <version> <foundation.json> <sr-legacy.json> <fndds.json>

Emits dist-food-source/foods.json.gz and manifest.json. Output is
deterministic when FOODTRACKER_BUILD_TIMESTAMP is set; without it,
the manifest.generatedAt field defaults to "now" and will differ
between runs.
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

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(join(OUT_DIR, 'foods.json.gz'), gz);
  await writeFile(join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');

  process.stderr.write(`Wrote ${OUT_DIR}/foods.json.gz (${gz.length} bytes)\n`);
  process.stderr.write(`Wrote ${OUT_DIR}/manifest.json\n`);
  process.stderr.write(`\nNext: gh release create ${SOURCE_NAME}-v${version} ${OUT_DIR}/foods.json.gz ${OUT_DIR}/manifest.json\n`);
}

main().catch((e: unknown) => {
  process.stderr.write(`ERROR: ${(e as Error).message}\n`);
  process.exit(1);
});
