import { expect } from '@esm-bundle/chai';
import { HttpFoodSourceProvider, fetchCatalogManifest } from '../../src/persistence/httpFoodSourceProvider.js';
import type { SourcedFood } from '../../src/domain/types.js';
import { BASE_URL, encodeJson, mockFetch, rejectionOf } from '../_helpers.js';

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

function makeProvider() {
  return new HttpFoodSourceProvider({ name: 'usda', baseUrl: `${BASE_URL}/` });
}

describe('fetchCatalogManifest()', () => {
  it('GETs <base>/manifest.json, revalidating with the server, and returns it', async () => {
    const manifest = { version: '30a277f32682', releases: { branded: '2026-04-30' }, counts: { usda: 194 } };
    let requested = '';
    let init: RequestInit | undefined;
    const restore = mockFetch(async (url, i) => {
      requested = String(url);
      init = i;
      return new Response(JSON.stringify(manifest), { status: 200 });
    });

    try {
      expect(await fetchCatalogManifest(`${BASE_URL}/`)).to.deep.equal(manifest);
      expect(requested).to.equal(`${BASE_URL}/manifest.json`);
      expect(init?.cache).to.equal('no-cache');
    } finally {
      restore();
    }
  });

  it('rejects a missing manifest, a non-JSON body, and one without a version', async () => {
    const cases: Array<[Response, RegExp]> = [
      [new Response('not found', { status: 404 }), /HTTP 404/],
      [new Response('nope', { status: 200 }), /invalid JSON/],
      [new Response(JSON.stringify({ releases: {} }), { status: 200 }), /manifest/],
    ];

    for (const [response, message] of cases) {
      const restore = mockFetch(async () => response);

      try {
        const e = await rejectionOf(fetchCatalogManifest(BASE_URL));
        expect(e.message).to.match(message);
      } finally {
        restore();
      }
    }
  });
});

describe('HttpFoodSourceProvider', () => {
  it('exposes name from config', () => {
    expect(makeProvider().name).to.equal('usda');
  });

  it('fetches <base>/<source>.json for the build it is asked for and returns the rows', async () => {
    let requested = '';
    const restore = mockFetch(async (url) => {
      requested = String(url);
      return new Response(encodeJson(SAMPLE_FOODS), { status: 200 });
    });

    try {
      expect(await makeProvider().fetchRows('30a277f32682')).to.deep.equal(SAMPLE_FOODS);
      expect(requested).to.equal(`${BASE_URL}/usda.json?v=30a277f32682`);
    } finally {
      restore();
    }
  });

  it('rejects an HTTP failure, a non-JSON body, a payload that is not an array, and a malformed row', async () => {
    const cases: Array<[Response, RegExp]> = [
      [new Response('', { status: 500 }), /HTTP 500/],
      [new Response(new Uint8Array([0xde, 0xad, 0xbe, 0xef]), { status: 200 }), /invalid JSON.*usda\.json/],
      [new Response(JSON.stringify({ rows: SAMPLE_FOODS }), { status: 200 }), /not an array/],
      [new Response(JSON.stringify([SAMPLE_FOODS[0], { id: 'x', name: 'X' }]), { status: 200 }), /index 1/],
    ];

    for (const [response, message] of cases) {
      const restore = mockFetch(async () => response);

      try {
        const e = await rejectionOf(makeProvider().fetchRows('1'));
        expect(e.message).to.match(message);
      } finally {
        restore();
      }
    }
  });

  it('reports cumulative bytes loaded as the body streams, whatever Content-Length says', async () => {
    const body = encodeJson(SAMPLE_FOODS);
    const restore = mockFetch(async () => new Response(body, {
      status: 200,
      headers: { 'Content-Length': 'chunked' },
    }));

    try {
      const calls: number[] = [];
      await makeProvider().fetchRows('1', (loaded) => calls.push(loaded));
      expect(calls.length).to.be.greaterThan(0);
      expect(calls.every((n) => Number.isFinite(n))).to.equal(true);
      expect(calls[calls.length - 1]).to.equal(body.length);
    } finally {
      restore();
    }
  });
});
