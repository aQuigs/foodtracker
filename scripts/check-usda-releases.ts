import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DOWNLOAD_PAGE_URL, RELEASE_KINDS, latestReleases, parseReleases } from './usdaReleases.js';

const RELEASES_PATH = join(dirname(fileURLToPath(import.meta.url)), 'usda-releases.json');

async function main(): Promise<void> {
  const res = await fetch(DOWNLOAD_PAGE_URL);
  if (!res.ok) {
    throw new Error(`${DOWNLOAD_PAGE_URL}: HTTP ${res.status}`);
  }

  const latest = latestReleases(await res.text());
  const pinned = parseReleases(JSON.parse(await readFile(RELEASES_PATH, 'utf8')));
  const newer = RELEASE_KINDS.filter((kind) => latest[kind] > pinned[kind]);

  if (newer.length === 0) {
    console.log('USDA releases are up to date.');
    return;
  }

  const next = Object.fromEntries(RELEASE_KINDS.map((kind) => [kind, newer.includes(kind) ? latest[kind] : pinned[kind]]));
  await writeFile(RELEASES_PATH, `${JSON.stringify(next, null, 2)}\n`);

  for (const kind of newer) {
    console.log(`${kind}: ${pinned[kind]} -> ${latest[kind]}`);
  }
}

main().catch((e: unknown) => {
  process.stderr.write(`ERROR: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});
