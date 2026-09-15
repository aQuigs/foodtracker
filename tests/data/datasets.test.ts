import { expect } from '@esm-bundle/chai';
import {
  BRANDS_DATASET, BRANDS_VERSION, STORE_BUNDLES, brandEntry, brandSource, catalogVersions, datasetDir,
} from '../../src/domain/foodSources.js';
import { isBrandsIndex, isFoodSourceManifest, isSourcedFood } from '../../src/domain/validate.js';
import type { BrandsIndex } from '../../src/domain/types.js';
import { sha256Hex } from '../_helpers.js';

// The build script runs locally, not in CI, so this is the only check that the
// committed manifest still describes the committed foods.json. A drift here
// would fail hydration for every fresh user.
describe('committed datasets under public/data/', () => {
  for (const [source, version] of Object.entries(catalogVersions())) {
    const dir = `/public/data/${datasetDir(source, version)}`;

    it(`${dir}: manifest matches foods.json and every item is a valid ${source} food`, async () => {
      const manifestRes = await fetch(`${dir}/manifest.json`);
      expect(manifestRes.ok, `${dir}/manifest.json is served`).to.equal(true);

      const manifest: unknown = await manifestRes.json();
      if (!isFoodSourceManifest(manifest)) {
        throw new Error(`${dir}/manifest.json is not a valid manifest`);
      }

      expect(manifest.source).to.equal(source);
      expect(manifest.version).to.equal(version);

      const foodsRes = await fetch(`${dir}/foods.json`);
      expect(foodsRes.ok, `${dir}/foods.json is served`).to.equal(true);

      const body = await foodsRes.arrayBuffer();
      expect(await sha256Hex(body)).to.equal(manifest.sha256);

      const items: unknown = JSON.parse(new TextDecoder().decode(body));
      if (!Array.isArray(items)) {
        throw new Error(`${dir}/foods.json is not an array`);
      }

      expect(items.length).to.equal(manifest.itemCount);

      const invalid = items.filter((it: unknown) => !isSourcedFood(it) || it.source !== source);
      expect(invalid.length, 'items failing validation').to.equal(0);
    });
  }
});

describe('committed brands dataset under public/data/', () => {
  const dir = `/public/data/${datasetDir(BRANDS_DATASET, BRANDS_VERSION)}`;
  let index: BrandsIndex;

  before(async () => {
    const res = await fetch(`${dir}/index.json`);
    expect(res.ok, `${dir}/index.json is served`).to.equal(true);

    const raw: unknown = await res.json();
    if (!isBrandsIndex(raw)) {
      throw new Error(`${dir}/index.json is not a valid brands index`);
    }

    index = raw;
  });

  it('is the version the app expects, with every brand listed once', () => {
    expect(index.version).to.equal(BRANDS_VERSION);
    expect(new Set(index.brands.map(([id]) => id)).size).to.equal(index.brands.length);
    expect(index.brands.length).to.be.greaterThan(1000);
  });

  it('lists every brand a store bundles, so ticking a store never names a brand that cannot load', () => {
    const missing = Object.entries(STORE_BUNDLES)
      .flatMap(([store, bundle]) => bundle.brands.filter((id) => brandEntry(index, id) === undefined).map((id) => `${store}: ${id}`));
    expect(missing).to.deep.equal([]);
  });

  // Every shard is read once, so the whole dataset streams through the
  // browser; the build wrote it and only this proves what was committed is
  // what the index says.
  it('every shard hashes as the index says and holds exactly the rows the index counts, all valid and tagged', async function () {
    this.timeout(180_000);

    const expected = new Map<number, Map<string, number>>();
    for (const [id, , count, shard] of index.brands) {
      let byBrand = expected.get(shard);
      if (byBrand === undefined) {
        byBrand = new Map();
        expected.set(shard, byBrand);
      }

      byBrand.set(brandSource(id), count);
    }

    for (let i = 0; i < index.shards.length; i++) {
      const manifest = index.shards[i]!;
      const res = await fetch(`${dir}/shard-${i}.json`);
      expect(res.ok, `${dir}/shard-${i}.json is served`).to.equal(true);

      const body = await res.arrayBuffer();
      expect(body.byteLength, `shard-${i} bytes`).to.equal(manifest.bytes);
      expect(await sha256Hex(body), `shard-${i} sha256`).to.equal(manifest.sha256);

      const items: unknown = JSON.parse(new TextDecoder().decode(body));
      if (!Array.isArray(items)) {
        throw new Error(`${dir}/shard-${i}.json is not an array`);
      }

      expect(items.length, `shard-${i} itemCount`).to.equal(manifest.itemCount);

      const counts = new Map<string, number>();
      for (const item of items as unknown[]) {
        if (!isSourcedFood(item) || item.brand === undefined) {
          throw new Error(`shard-${i} holds an invalid or untagged row: ${JSON.stringify(item).slice(0, 200)}`);
        }

        counts.set(item.source, (counts.get(item.source) ?? 0) + 1);
      }

      expect(Object.fromEntries(counts), `shard-${i} rows per brand`).to.deep.equal(Object.fromEntries(expected.get(i) ?? []));
    }
  });
});
