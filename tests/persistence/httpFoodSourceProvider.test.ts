import { expect } from '@esm-bundle/chai';
import { HttpFoodSourceProvider } from '../../src/persistence/httpFoodSourceProvider.js';
import type { FoodSourceManifest, SourcedFood } from '../../src/domain/types.js';
import { rejectionOf, sha256Hex } from '../_helpers.js';

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

function encodeJson(value: unknown): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(JSON.stringify(value));
}

type FetchHandler = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function mockFetch(handler: FetchHandler) {
  const original = globalThis.fetch;
  globalThis.fetch = handler as typeof fetch;
  return () => { globalThis.fetch = original; };
}

const BASE_URL = 'https://example.test/data';

function makeProvider() {
  return new HttpFoodSourceProvider({ name: 'usda', baseUrl: BASE_URL });
}

describe('HttpFoodSourceProvider', () => {
  describe('basic shape', () => {
    it('exposes name from config', () => {
      expect(makeProvider().name).to.equal('usda');
    });
  });

  describe('fetchManifest()', () => {
    it('GETs <base>/<source>-v<version>/manifest.json and returns parsed manifest', async () => {
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
        expect(requestedUrl).to.equal(`${BASE_URL}/usda-v1/manifest.json`);
        expect(result).to.deep.equal(manifest);
      } finally {
        restore();
      }
    });

    it('rejects when HTTP status is not ok', async () => {
      const restore = mockFetch(async () => new Response('not found', { status: 404 }));

      try {
        const e = await rejectionOf(makeProvider().fetchManifest('99'));
        expect(e.message).to.match(/manifest/i);
      } finally {
        restore();
      }
    });

    it('rejects when response is not valid JSON', async () => {
      const restore = mockFetch(async () => new Response('not json', { status: 200 }));

      try {
        await rejectionOf(makeProvider().fetchManifest('1'));
      } finally {
        restore();
      }
    });

    it('rejects when manifest shape is invalid', async () => {
      const restore = mockFetch(async () => new Response(JSON.stringify({ source: 'usda' }), { status: 200 }));

      try {
        const e = await rejectionOf(makeProvider().fetchManifest('1'));
        expect(e.message).to.match(/manifest/i);
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
        const e = await rejectionOf(makeProvider().fetchManifest('1'));
        expect(e.message).to.match(/source/i);
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
        const e = await rejectionOf(makeProvider().fetchManifest('1'));
        expect(e.message).to.match(/version/i);
      } finally {
        restore();
      }
    });
  });

  describe('fetchDataset()', () => {
    async function makeManifestForFoods(foods: SourcedFood[], version = '1'): Promise<{
      manifest: FoodSourceManifest;
      body: Uint8Array<ArrayBuffer>;
    }> {
      const body = encodeJson(foods);
      const sha = await sha256Hex(body);
      return {
        body,
        manifest: {
          source: 'usda', version, itemCount: foods.length,
          sha256: sha, generatedAt: '2026-05-29T00:00:00.000Z',
        },
      };
    }

    it('fetches <base>/<source>-v<version>/foods.json and returns the items', async () => {
      const { manifest, body } = await makeManifestForFoods(SAMPLE_FOODS);
      let requestedUrl = '';
      const restore = mockFetch(async (url) => {
        requestedUrl = String(url);
        return new Response(body, { status: 200, headers: { 'Content-Length': String(body.length) } });
      });

      try {
        const items = await makeProvider().fetchDataset(manifest);
        expect(requestedUrl).to.equal(`${BASE_URL}/usda-v${manifest.version}/foods.json`);
        expect(items).to.have.lengthOf(2);
        expect(items[0]!.name).to.equal('Apple');
        expect(items[1]!.name).to.equal('Banana');
      } finally {
        restore();
      }
    });

    it('rejects when payload SHA-256 does not match manifest.sha256', async () => {
      const { manifest, body } = await makeManifestForFoods(SAMPLE_FOODS);
      const corrupted = { ...manifest, sha256: 'b'.repeat(64) };
      const restore = mockFetch(async () => new Response(body, { status: 200 }));

      try {
        const e = await rejectionOf(makeProvider().fetchDataset(corrupted));
        expect(e.message).to.match(/sha|hash|integrity/i);
      } finally {
        restore();
      }
    });

    it('rejects when HTTP status is not ok', async () => {
      const { manifest } = await makeManifestForFoods(SAMPLE_FOODS);
      const restore = mockFetch(async () => new Response('', { status: 500 }));

      try {
        await rejectionOf(makeProvider().fetchDataset(manifest));
      } finally {
        restore();
      }
    });

    it('rejects when itemCount in manifest does not match decoded array length', async () => {
      const { manifest, body } = await makeManifestForFoods(SAMPLE_FOODS);
      const lying = { ...manifest, itemCount: 99 };
      const restore = mockFetch(async () => new Response(body, { status: 200 }));

      try {
        const e = await rejectionOf(makeProvider().fetchDataset(lying));
        expect(e.message).to.match(/itemCount|count/i);
      } finally {
        restore();
      }
    });

    it('rejects when decoded array contains a non-conforming item', async () => {
      const bad: unknown[] = [SAMPLE_FOODS[0], { id: 'x', name: 'X' }];
      const body = encodeJson(bad);
      const sha = await sha256Hex(body);
      const manifest: FoodSourceManifest = {
        source: 'usda', version: '1', itemCount: 2,
        sha256: sha, generatedAt: '2026-05-29T00:00:00.000Z',
      };
      const restore = mockFetch(async () => new Response(body, { status: 200 }));

      try {
        const e = await rejectionOf(makeProvider().fetchDataset(manifest));
        expect(e.message).to.match(/item|sourcedfood|invalid/i);
      } finally {
        restore();
      }
    });

    it('rejects when manifest.source !== provider name', async () => {
      const { manifest, body } = await makeManifestForFoods(SAMPLE_FOODS);
      const restore = mockFetch(async () => new Response(body, { status: 200 }));

      try {
        const e = await rejectionOf(makeProvider().fetchDataset({ ...manifest, source: 'pantry' }));
        expect(e.message).to.match(/source/i);
      } finally {
        restore();
      }
    });

    it('reports cumulative bytes loaded as the body streams, whatever Content-Length says', async () => {
      const { manifest, body } = await makeManifestForFoods(SAMPLE_FOODS);
      const restore = mockFetch(async () => new Response(body, {
        status: 200,
        headers: { 'Content-Length': 'chunked' },
      }));

      try {
        const calls: number[] = [];
        await makeProvider().fetchDataset(manifest, (loaded) => calls.push(loaded));
        expect(calls.length).to.be.greaterThan(0);
        expect(calls.every((n) => Number.isFinite(n))).to.equal(true);
        expect(calls[calls.length - 1]).to.equal(body.length);
      } finally {
        restore();
      }
    });

    it('wraps JSON decode failures with URL context', async () => {
      const junk = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
      const sha = await sha256Hex(junk);
      const manifest: FoodSourceManifest = {
        source: 'usda', version: '1', itemCount: 0,
        sha256: sha, generatedAt: '2026-05-29T00:00:00.000Z',
      };
      const restore = mockFetch(async () => new Response(junk, { status: 200 }));

      try {
        const e = await rejectionOf(makeProvider().fetchDataset(manifest));
        expect(e.message).to.match(/json/i);
        expect(e.message).to.include('foods.json');
      } finally {
        restore();
      }
    });
  });
});
