import { expect } from '@esm-bundle/chai';
import { HttpBrandsProvider } from '../../src/persistence/brandsProvider.js';
import type { BrandFile, BrandList } from '../../src/domain/dataFiles.js';
import { BASE_URL, mockFetch, rejectionOf } from '../_helpers.js';

const LIST: BrandList = {
  brands: [['chobani', 'Chobani', 2, true], ['cheddar-co', 'Cheddar Co', 1, false], ['nature-valley', 'Nature Valley', 1, true]],
};

// Two brands share the letter file, as they do whenever ids start alike.
const C_FILE: BrandFile = {
  chobani: { label: 'Chobani', rows: [[1, 'Greek yogurt', 'Yogurt', 59, 10, 3.6, 0.4], [2, 'Oat milk', '', 50, 1, 7, 2.5]] },
  'chocolate-co': { label: 'Chocolate Co', rows: [[3, 'Bar', 'Candy', 500, 5, 60, 30]] },
};

function serve(files: Record<string, unknown>, seen: string[] = []) {
  return mockFetch(async (url) => {
    const path = String(url).slice(BASE_URL.length + 1);
    seen.push(path);
    const body = files[path];
    return body === undefined
      ? new Response('not found', { status: 404 })
      : new Response(typeof body === 'string' ? body : JSON.stringify(body), { status: 200 });
  });
}

function provider() {
  return new HttpBrandsProvider({ baseUrl: `${BASE_URL}/` });
}

describe('HttpBrandsProvider', () => {
  describe('fetchList()', () => {
    it('GETs <base>/brands/index.json for the build it is asked for and returns the validated list', async () => {
      const seen: string[] = [];
      const restore = serve({ 'brands/index.json?v=abc': LIST }, seen);

      try {
        expect(await provider().fetchList('abc')).to.deep.equal(LIST);
        expect(seen).to.deep.equal(['brands/index.json?v=abc']);
      } finally {
        restore();
      }
    });

    it('rejects a missing list, a non-JSON body, and a malformed list', async () => {
      const cases: Array<[Record<string, unknown>, RegExp]> = [
        [{}, /HTTP 404/],
        [{ 'brands/index.json?v=abc': 'nope' }, /invalid JSON/],
        [{ 'brands/index.json?v=abc': { brands: [['chobani', '', 2, true]] } }, /shape/],
      ];

      for (const [files, message] of cases) {
        const restore = serve(files);

        try {
          const e = await rejectionOf(provider().fetchList('abc'));
          expect(e.message).to.match(message);
        } finally {
          restore();
        }
      }
    });
  });

  describe('providerFor()', () => {
    it('names the provider after the brand source', () => {
      expect(provider().providerFor('chobani').name).to.equal('brand:chobani');
    });

    it('fetches the brand\'s letter file alone, for the build asked for, and decodes only this brand\'s rows', async () => {
      const seen: string[] = [];
      const restore = serve({ 'brands/c.json?v=abc': C_FILE }, seen);

      try {
        const rows = await provider().providerFor('chobani').fetchRows('abc');

        expect(seen).to.deep.equal(['brands/c.json?v=abc']);
        expect(rows.map((r) => [r.id, r.name, r.brand, r.source, r.tags])).to.deep.equal([
          ['brand:chobani:1', 'Greek yogurt', 'Chobani', 'brand:chobani', ['Yogurt']],
          ['brand:chobani:2', 'Oat milk', 'Chobani', 'brand:chobani', []],
        ]);
      } finally {
        restore();
      }
    });

    it('files a brand whose id starts with a digit under 0-9', async () => {
      const seen: string[] = [];
      const restore = serve({ 'brands/0-9.json?v=abc': { '365': { label: '365', rows: [[4, 'Oats', '', 380, 13, 67, 6.5]] } } }, seen);

      try {
        expect(await provider().providerFor('365').fetchRows('abc')).to.have.lengthOf(1);
        expect(seen).to.deep.equal(['brands/0-9.json?v=abc']);
      } finally {
        restore();
      }
    });

    it('reports progress in bytes received', async () => {
      const body = JSON.stringify(C_FILE);
      const restore = serve({ 'brands/c.json?v=abc': body });

      try {
        const loads: number[] = [];
        await provider().providerFor('chobani').fetchRows('abc', (loaded) => loads.push(loaded));

        expect(loads.length).to.be.greaterThan(0);
        expect(loads.at(-1)).to.equal(new TextEncoder().encode(body).length);
      } finally {
        restore();
      }
    });

    it('reads a brand its letter file does not hold as no rows: one this build lists without rows, or no longer has', async () => {
      const restore = serve({ 'brands/c.json?v=abc': C_FILE });

      try {
        expect(await provider().providerFor('cheddar-co').fetchRows('abc')).to.deep.equal([]);
        expect(await provider().providerFor('constructor').fetchRows('abc')).to.deep.equal([]);
      } finally {
        restore();
      }
    });

    it('rejects a malformed entry, and a letter file that is not an object of brands', async () => {
      const cases: Array<[unknown, RegExp]> = [
        [{ chobani: { label: 'Chobani', rows: [[1, 'Greek yogurt', 'Yogurt', -59, 10, 3.6, 0.4]] } }, /chobani.*malformed/],
        [[C_FILE], /not an object/],
        [null, /not an object/],
      ];

      for (const [file, message] of cases) {
        const restore = serve({ 'brands/c.json?v=abc': file });

        try {
          const e = await rejectionOf(provider().providerFor('chobani').fetchRows('abc'));
          expect(e.message, JSON.stringify(file)).to.match(message);
        } finally {
          restore();
        }
      }
    });

    it('fetches a letter file once per build for every brand filed in it, counting its bytes toward the brand that asked first', async () => {
      const seen: string[] = [];
      const body = JSON.stringify(C_FILE);
      const restore = serve({ 'brands/c.json?v=abc': body, 'brands/c.json?v=def': body }, seen);

      try {
        const brands = provider();
        const loads: Record<string, number[]> = { chobani: [], 'chocolate-co': [] };
        const read = (id: string, version = 'abc') => brands.providerFor(id).fetchRows(version, (loaded) => loads[id]!.push(loaded));

        const [chobani, chocolate] = await Promise.all([read('chobani'), read('chocolate-co')]);
        expect(chobani.map((r) => r.id)).to.deep.equal(['brand:chobani:1', 'brand:chobani:2']);
        expect(chocolate.map((r) => r.id)).to.deep.equal(['brand:chocolate-co:3']);
        expect(await read('chobani')).to.have.lengthOf(2);
        expect(seen).to.deep.equal(['brands/c.json?v=abc']);

        expect(loads.chobani!.at(-1)).to.equal(new TextEncoder().encode(body).length);
        expect(loads['chocolate-co']).to.deep.equal([]);

        await read('chocolate-co', 'def');
        expect(seen).to.deep.equal(['brands/c.json?v=abc', 'brands/c.json?v=def']);
      } finally {
        restore();
      }
    });

    it('fetches a letter file again after a failed fetch', async () => {
      let calls = 0;
      const restore = mockFetch(async () => (++calls === 1
        ? new Response('down', { status: 503 })
        : new Response(JSON.stringify(C_FILE), { status: 200 })));

      try {
        const brands = provider();
        await rejectionOf(brands.providerFor('chobani').fetchRows('abc'));
        expect(await brands.providerFor('chobani').fetchRows('abc')).to.have.lengthOf(2);
        expect(calls).to.equal(2);
      } finally {
        restore();
      }
    });
  });
});
