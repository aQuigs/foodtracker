import { expect } from '@esm-bundle/chai';
import { GithubReleasesFoodSourceProvider } from '../../src/persistence/githubReleasesFoodSourceProvider.js';
import type { FoodSourceManifest, SourcedFood } from '../../src/domain/types.js';

const SAMPLE_FOODS: SourcedFood[] = [
  {
    id: 'usda:1',
    name: 'Apple',
    nutritionFacts: { calories: 52, protein: 0.3, carbs: 14, fat: 0.2 },
    servingSize: 100,
    servingUnit: 'g',
    source: 'usda',
    sourceId: '1',
  },
  {
    id: 'usda:2',
    name: 'Banana',
    nutritionFacts: { calories: 89, protein: 1.1, carbs: 22.8, fat: 0.3 },
    servingSize: 100,
    servingUnit: 'g',
    source: 'usda',
    sourceId: '2',
  },
];

async function gzipJson(value: unknown): Promise<Uint8Array> {
  const body = new TextEncoder().encode(JSON.stringify(value));
  const cs = new CompressionStream('gzip');
  const stream = new Response(body).body!.pipeThrough(cs);
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

type FetchHandler = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function mockFetch(handler: FetchHandler) {
  const original = globalThis.fetch;
  globalThis.fetch = handler as typeof fetch;
  return () => { globalThis.fetch = original; };
}

const BASE_URL = 'https://example.test/releases/download';
const TAG_PREFIX = 'usda-v';

function makeProvider() {
  return new GithubReleasesFoodSourceProvider({
    name: 'usda',
    baseUrl: BASE_URL,
    tagPrefix: TAG_PREFIX,
  });
}

describe('GithubReleasesFoodSourceProvider', () => {
  describe('basic shape', () => {
    it('exposes name from config', () => {
      expect(makeProvider().name).to.equal('usda');
    });
  });

  describe('fetchManifest()', () => {
    it('GETs <base>/<tagPrefix><version>/manifest.json and returns parsed manifest', async () => {
      const manifest: FoodSourceManifest = {
        source: 'usda', version: '1', itemCount: 2,
        sha256: 'a'.repeat(64), generatedAt: '2026-05-29T00:00:00.000Z',
      };
      let requestedUrl = '';
      const restore = mockFetch(async (url) => {
        requestedUrl = String(url);
        return new Response(JSON.stringify(manifest), { status: 200 });
      });

      try {
        const result = await makeProvider().fetchManifest('1');
        expect(requestedUrl).to.equal(`${BASE_URL}/${TAG_PREFIX}1/manifest.json`);
        expect(result).to.deep.equal(manifest);
      } finally {
        restore();
      }
    });

    it('rejects when HTTP status is not ok', async () => {
      const restore = mockFetch(async () => new Response('not found', { status: 404 }));

      try {
        let threw = false;
        try {
          await makeProvider().fetchManifest('99');
        } catch (e) {
          threw = true;
          expect((e as Error).message).to.match(/manifest/i);
        }
        expect(threw).to.equal(true);
      } finally {
        restore();
      }
    });

    it('rejects when response is not valid JSON', async () => {
      const restore = mockFetch(async () => new Response('not json', { status: 200 }));

      try {
        let threw = false;
        try {
          await makeProvider().fetchManifest('1');
        } catch {
          threw = true;
        }
        expect(threw).to.equal(true);
      } finally {
        restore();
      }
    });

    it('rejects when manifest shape is invalid', async () => {
      const restore = mockFetch(async () => new Response(JSON.stringify({ source: 'usda' }), { status: 200 }));

      try {
        let threw = false;
        try {
          await makeProvider().fetchManifest('1');
        } catch (e) {
          threw = true;
          expect((e as Error).message).to.match(/manifest/i);
        }
        expect(threw).to.equal(true);
      } finally {
        restore();
      }
    });

    it('rejects when manifest.source does not match provider name', async () => {
      const wrongManifest = {
        source: 'pantry', version: '1', itemCount: 0,
        sha256: 'a'.repeat(64), generatedAt: '2026-05-29T00:00:00.000Z',
      };
      const restore = mockFetch(async () => new Response(JSON.stringify(wrongManifest), { status: 200 }));

      try {
        let threw = false;
        try {
          await makeProvider().fetchManifest('1');
        } catch (e) {
          threw = true;
          expect((e as Error).message).to.match(/source/i);
        }
        expect(threw).to.equal(true);
      } finally {
        restore();
      }
    });

    it('rejects when manifest.version does not match requested version', async () => {
      const skewed = {
        source: 'usda', version: '2', itemCount: 0,
        sha256: 'a'.repeat(64), generatedAt: '2026-05-29T00:00:00.000Z',
      };
      const restore = mockFetch(async () => new Response(JSON.stringify(skewed), { status: 200 }));

      try {
        let threw = false;
        try {
          await makeProvider().fetchManifest('1');
        } catch (e) {
          threw = true;
          expect((e as Error).message).to.match(/version/i);
        }
        expect(threw).to.equal(true);
      } finally {
        restore();
      }
    });
  });

  describe('fetchDataset()', () => {
    async function makeManifestForFoods(foods: SourcedFood[], version = '1'): Promise<{
      manifest: FoodSourceManifest;
      gz: Uint8Array;
    }> {
      const gz = await gzipJson(foods);
      const sha = await sha256Hex(gz);
      return {
        gz,
        manifest: {
          source: 'usda', version, itemCount: foods.length,
          sha256: sha, generatedAt: '2026-05-29T00:00:00.000Z',
        },
      };
    }

    it('fetches <base>/<tagPrefix><version>/foods.json.gz, decompresses, and returns the items', async () => {
      const { manifest, gz } = await makeManifestForFoods(SAMPLE_FOODS);
      let requestedUrl = '';
      const restore = mockFetch(async (url) => {
        requestedUrl = String(url);
        return new Response(gz, { status: 200, headers: { 'Content-Length': String(gz.length) } });
      });

      try {
        const items = await makeProvider().fetchDataset(manifest);
        expect(requestedUrl).to.equal(`${BASE_URL}/${TAG_PREFIX}${manifest.version}/foods.json.gz`);
        expect(items).to.have.lengthOf(2);
        expect(items[0].name).to.equal('Apple');
        expect(items[1].name).to.equal('Banana');
      } finally {
        restore();
      }
    });

    it('rejects when payload SHA-256 does not match manifest.sha256', async () => {
      const { manifest, gz } = await makeManifestForFoods(SAMPLE_FOODS);
      const corrupted = { ...manifest, sha256: 'b'.repeat(64) };
      const restore = mockFetch(async () => new Response(gz, { status: 200 }));

      try {
        let threw = false;
        try {
          await makeProvider().fetchDataset(corrupted);
        } catch (e) {
          threw = true;
          expect((e as Error).message).to.match(/sha|hash|integrity/i);
        }
        expect(threw).to.equal(true);
      } finally {
        restore();
      }
    });

    it('rejects when HTTP status is not ok', async () => {
      const { manifest } = await makeManifestForFoods(SAMPLE_FOODS);
      const restore = mockFetch(async () => new Response('', { status: 500 }));

      try {
        let threw = false;
        try {
          await makeProvider().fetchDataset(manifest);
        } catch {
          threw = true;
        }
        expect(threw).to.equal(true);
      } finally {
        restore();
      }
    });

    it('rejects when itemCount in manifest does not match decoded array length', async () => {
      const { manifest, gz } = await makeManifestForFoods(SAMPLE_FOODS);
      const lying = { ...manifest, itemCount: 99 };
      const restore = mockFetch(async () => new Response(gz, { status: 200 }));

      try {
        let threw = false;
        try {
          await makeProvider().fetchDataset(lying);
        } catch (e) {
          threw = true;
          expect((e as Error).message).to.match(/itemCount|count/i);
        }
        expect(threw).to.equal(true);
      } finally {
        restore();
      }
    });

    it('rejects when decoded array contains a non-conforming item', async () => {
      const bad: unknown[] = [SAMPLE_FOODS[0], { id: 'x', name: 'X' }];
      const gz = await gzipJson(bad);
      const sha = await sha256Hex(gz);
      const manifest: FoodSourceManifest = {
        source: 'usda', version: '1', itemCount: 2,
        sha256: sha, generatedAt: '2026-05-29T00:00:00.000Z',
      };
      const restore = mockFetch(async () => new Response(gz, { status: 200 }));

      try {
        let threw = false;
        try {
          await makeProvider().fetchDataset(manifest);
        } catch (e) {
          threw = true;
          expect((e as Error).message).to.match(/item|sourcedfood|invalid/i);
        }
        expect(threw).to.equal(true);
      } finally {
        restore();
      }
    });

    it('rejects when manifest.source !== provider name', async () => {
      const { manifest, gz } = await makeManifestForFoods(SAMPLE_FOODS);
      const restore = mockFetch(async () => new Response(gz, { status: 200 }));

      try {
        let threw = false;
        try {
          await makeProvider().fetchDataset({ ...manifest, source: 'pantry' });
        } catch (e) {
          threw = true;
          expect((e as Error).message).to.match(/source/i);
        }
        expect(threw).to.equal(true);
      } finally {
        restore();
      }
    });

    it('invokes onProgress with (loaded, total) when Content-Length is present', async () => {
      const { manifest, gz } = await makeManifestForFoods(SAMPLE_FOODS);
      const restore = mockFetch(async () => new Response(gz, {
        status: 200,
        headers: { 'Content-Length': String(gz.length) },
      }));

      try {
        const calls: Array<[number, number]> = [];
        await makeProvider().fetchDataset(manifest, (loaded, total) => calls.push([loaded, total]));
        expect(calls.length).to.be.greaterThan(0);

        const last = calls[calls.length - 1];
        expect(last[0]).to.equal(gz.length);
        expect(last[1]).to.equal(gz.length);
      } finally {
        restore();
      }
    });

    it('treats a malformed Content-Length as "unknown" without passing NaN to onProgress', async () => {
      const { manifest, gz } = await makeManifestForFoods(SAMPLE_FOODS);
      const restore = mockFetch(async () => new Response(gz, {
        status: 200,
        headers: { 'Content-Length': 'chunked' },
      }));

      try {
        const calls: Array<[number, number]> = [];
        await makeProvider().fetchDataset(manifest, (loaded, total) => calls.push([loaded, total]));
        for (const [loaded, total] of calls) {
          expect(Number.isFinite(loaded)).to.equal(true);
          expect(Number.isFinite(total)).to.equal(true);
        }
      } finally {
        restore();
      }
    });

    it('wraps gzip decode failures with URL context', async () => {
      const sha = await sha256Hex(new Uint8Array([0xde, 0xad, 0xbe, 0xef]));
      const manifest: FoodSourceManifest = {
        source: 'usda', version: '1', itemCount: 0,
        sha256: sha, generatedAt: '2026-05-29T00:00:00.000Z',
      };
      const restore = mockFetch(async () =>
        new Response(new Uint8Array([0xde, 0xad, 0xbe, 0xef]), { status: 200 }));

      try {
        let threw = false;
        try {
          await makeProvider().fetchDataset(manifest);
        } catch (e) {
          threw = true;
          expect((e as Error).message).to.match(/gzip/i);
          expect((e as Error).message).to.include('foods.json.gz');
        }
        expect(threw).to.equal(true);
      } finally {
        restore();
      }
    });
  });
});
