import { expect } from '@esm-bundle/chai';
import { HttpBrandsProvider } from '../../src/persistence/brandsProvider.js';
import type { BrandsIndex, SourcedFood } from '../../src/domain/types.js';
import { rejectionOf, sha256Hex } from '../_helpers.js';
import { brandRow } from '../brandsFakes.js';

const BASE_URL = 'https://example.test/data';

type FetchHandler = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function mockFetch(handler: FetchHandler) {
  const original = globalThis.fetch;
  globalThis.fetch = handler as typeof fetch;
  return () => { globalThis.fetch = original; };
}

function encodeJson(value: unknown): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(JSON.stringify(value));
}

const CHOBANI = [brandRow('chobani', 'Chobani', '1', 'Greek Yogurt'), brandRow('chobani', 'Chobani', '2', 'Oat Milk')];
const NATURE_VALLEY = [brandRow('nature-valley', 'Nature Valley', '3', 'Granola Bar')];

// Both brands share shard 0, in the order the build writes them (by name).
const SHARD_0: SourcedFood[] = [NATURE_VALLEY[0]!, CHOBANI[0]!, CHOBANI[1]!];

async function indexFor(shards: SourcedFood[][], version = '1'): Promise<{ index: BrandsIndex; bodies: Uint8Array<ArrayBuffer>[] }> {
  const bodies = shards.map(encodeJson);
  const manifests = await Promise.all(bodies.map(async (b, i) => ({ sha256: await sha256Hex(b), itemCount: shards[i]!.length, bytes: b.length })));

  return {
    bodies,
    index: {
      source: 'brands',
      version,
      generatedAt: '2026-09-15T00:00:00.000Z',
      brands: [['chobani', 'Chobani', 2, 0], ['nature-valley', 'Nature Valley', 1, 0]],
      shards: manifests,
    },
  };
}

function serve(files: Record<string, Uint8Array<ArrayBuffer> | string>, seen: string[] = []) {
  return mockFetch(async (url) => {
    const path = String(url).slice(BASE_URL.length + 1);
    seen.push(path);
    const body = files[path];
    return body === undefined
      ? new Response('not found', { status: 404 })
      : new Response(body as BodyInit, { status: 200 });
  });
}

function provider(version = '1') {
  return new HttpBrandsProvider({ baseUrl: `${BASE_URL}/`, version });
}

describe('HttpBrandsProvider', () => {
  describe('fetchIndex()', () => {
    it('GETs <base>/brands-v<version>/index.json and returns the validated index', async () => {
      const { index } = await indexFor([SHARD_0]);
      const seen: string[] = [];
      const restore = serve({ 'brands-v1/index.json': JSON.stringify(index) }, seen);

      try {
        expect(await provider().fetchIndex()).to.deep.equal(index);
        expect(seen).to.deep.equal(['brands-v1/index.json']);
      } finally {
        restore();
      }
    });

    it('revalidates the index with the server on every load, never trusting a copy the HTTP cache still holds', async () => {
      const { index } = await indexFor([SHARD_0]);
      let init: RequestInit | undefined;
      const restore = mockFetch(async (_url, i) => {
        init = i;
        return new Response(JSON.stringify(index), { status: 200 });
      });

      try {
        await provider().fetchIndex();
        expect(init?.cache).to.equal('no-cache');
      } finally {
        restore();
      }
    });

    it('rejects a missing index, a non-JSON body, a malformed index, and a version skew', async () => {
      const { index } = await indexFor([SHARD_0], '2');
      const cases: Array<[Record<string, string>, RegExp]> = [
        [{}, /HTTP 404/],
        [{ 'brands-v1/index.json': 'nope' }, /invalid JSON/],
        [{ 'brands-v1/index.json': JSON.stringify({ source: 'brands' }) }, /shape/],
        [{ 'brands-v1/index.json': JSON.stringify(index) }, /version/],
      ];

      for (const [files, message] of cases) {
        const restore = serve(files);

        try {
          const e = await rejectionOf(provider().fetchIndex());
          expect(e.message).to.match(message);
        } finally {
          restore();
        }
      }
    });
  });

  describe('providerFor()', () => {
    it('returns null for a non-brand source and for a brand the index does not list', async () => {
      const { index } = await indexFor([SHARD_0]);
      expect(provider().providerFor('usda', index)).to.equal(null);
      expect(provider().providerFor('brand:', index)).to.equal(null);
      expect(provider().providerFor('brand:oikos', index)).to.equal(null);
    });

    it('names the provider after the source', async () => {
      const { index } = await indexFor([SHARD_0]);
      expect(provider().providerFor('brand:chobani', index)!.name).to.equal('brand:chobani');
    });
  });

  describe('brand provider', () => {
    it('derives the manifest from the index: the brand count, the shard sha, the index timestamp', async () => {
      const { index } = await indexFor([SHARD_0]);
      const manifest = await provider().providerFor('brand:chobani', index)!.fetchManifest('1');

      expect(manifest).to.deep.equal({
        source: 'brand:chobani',
        version: '1',
        itemCount: 2,
        sha256: index.shards[0]!.sha256,
        generatedAt: '2026-09-15T00:00:00.000Z',
      });
    });

    it('rejects a manifest request for a version the index does not carry', async () => {
      const { index } = await indexFor([SHARD_0]);
      const e = await rejectionOf(provider().providerFor('brand:chobani', index)!.fetchManifest('2'));
      expect(e.message).to.match(/version/);
    });

    it('fetches the shard, verifies it whole, and hands back only this brand’s rows', async () => {
      const { index, bodies } = await indexFor([SHARD_0]);
      const seen: string[] = [];
      const restore = serve({ 'brands-v1/shard-0.json': bodies[0]! }, seen);

      try {
        const brand = provider().providerFor('brand:chobani', index)!;
        const rows = await brand.fetchDataset(await brand.fetchManifest('1'));

        expect(rows).to.deep.equal(CHOBANI);
        expect(seen).to.deep.equal(['brands-v1/shard-0.json']);
      } finally {
        restore();
      }
    });

    it('reports progress in bytes received', async () => {
      const { index, bodies } = await indexFor([SHARD_0]);
      const restore = serve({ 'brands-v1/shard-0.json': bodies[0]! });

      try {
        const brand = provider().providerFor('brand:nature-valley', index)!;
        const loads: number[] = [];
        await brand.fetchDataset(await brand.fetchManifest('1'), (loaded) => loads.push(loaded));

        expect(loads.length).to.be.greaterThan(0);
        expect(loads.at(-1)).to.equal(bodies[0]!.length);
      } finally {
        restore();
      }
    });

    it('rejects a manifest for another source', async () => {
      const { index } = await indexFor([SHARD_0]);
      const brand = provider().providerFor('brand:chobani', index)!;
      const other = await provider().providerFor('brand:nature-valley', index)!.fetchManifest('1');

      const e = await rejectionOf(brand.fetchDataset(other));
      expect(e.message).to.match(/source/);
    });

    it('rejects a shard whose bytes do not hash to the index sha', async () => {
      const { index } = await indexFor([SHARD_0]);
      const restore = serve({ 'brands-v1/shard-0.json': encodeJson([...SHARD_0].reverse()) });

      try {
        const brand = provider().providerFor('brand:chobani', index)!;
        const e = await rejectionOf(brand.fetchDataset(await brand.fetchManifest('1')));
        expect(e.message).to.match(/SHA-256/);
      } finally {
        restore();
      }
    });

    it('rejects a shard that is not an array of SourcedFood, or that holds a different count for the brand', async () => {
      const notArray = encodeJson({ rows: SHARD_0 });
      const badRow = encodeJson([{ ...CHOBANI[0], nutritionFacts: null }]);
      const short = encodeJson([CHOBANI[0]]);

      const cases: Array<[Uint8Array<ArrayBuffer>, RegExp]> = [
        [notArray, /not an array/],
        [badRow, /not a valid SourcedFood/],
        [short, /itemCount mismatch/],
      ];

      for (const [body, message] of cases) {
        const { index } = await indexFor([[]]);
        index.shards[0]!.sha256 = await sha256Hex(body);
        const restore = serve({ 'brands-v1/shard-0.json': body });

        try {
          const brand = provider().providerFor('brand:chobani', index)!;
          const e = await rejectionOf(brand.fetchDataset(await brand.fetchManifest('1')));
          expect(e.message).to.match(message);
        } finally {
          restore();
        }
      }
    });
  });
});
