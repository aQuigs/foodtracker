// Fails the build when the app JS outgrows its budget. The catalog is fetched
// at runtime; the budget is the tripwire for someone bundling it instead.
import { readdir, readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';

const BUDGET_BYTES = 100 * 1024;
const assets = new URL('../dist/assets/', import.meta.url);

let gzipped = 0;
for (const file of await readdir(assets)) {
  if (file.endsWith('.js')) {
    gzipped += gzipSync(await readFile(new URL(file, assets)), { level: 9 }).length;
  }
}

console.log(`app js gzipped: ${gzipped} bytes (budget ${BUDGET_BYTES})`);

if (gzipped > BUDGET_BYTES) {
  console.error('App JS exceeds its gzipped budget.');
  process.exit(1);
}
