import { expect } from '@esm-bundle/chai';
import { DATA_PATHS, brandFileKey, brandFood, type BrandRow } from '../../src/domain/dataFiles.js';
import { isBrandFileEntry, isBrandList, isCatalogManifest, isSourcedFood } from '../../src/domain/validate.js';

const ROW: BrandRow = [2490831, 'Barbecue kettle chips', 'Chips, Pretzels & Snacks', 536, 7.1, 60.7, 28.6];

describe('DATA_PATHS', () => {
  it('names every file under public/data/ relative to it', () => {
    expect(DATA_PATHS.manifest).to.equal('manifest.json');
    expect(DATA_PATHS.source('usda-full')).to.equal('usda-full.json');
    expect(DATA_PATHS.brandList).to.equal('brands/index.json');
    expect(DATA_PATHS.brandFile('k')).to.equal('brands/k.json');
  });
});

describe('brandFileKey()', () => {
  it('files a brand under its first letter, and everything else under 0-9', () => {
    expect(brandFileKey('kroger')).to.equal('k');
    expect(brandFileKey('365-whole-foods-market')).to.equal('0-9');
    expect(brandFileKey('ñu-foods')).to.equal('0-9');
  });
});

describe('brandFood()', () => {
  it('rebuilds the food a brand row stands for: per 100 g, tagged with the brand, keyed by source and USDA id', () => {
    expect(brandFood('kettle', 'Kettle', ROW)).to.deep.equal({
      id: 'brand:kettle:2490831',
      name: 'Barbecue kettle chips',
      brand: 'Kettle',
      nutritionFacts: { calories: 536, protein: 7.1, carbs: 60.7, fat: 28.6 },
      servingSize: 100,
      servingUnit: 'g',
      source: 'brand:kettle',
      sourceId: '2490831',
      tags: ['Chips, Pretzels & Snacks'],
    });
  });

  it('gives a row with an empty category no tag', () => {
    expect(brandFood('kettle', 'Kettle', [1, 'Chips', '', 1, 2, 3, 4]).tags).to.deep.equal([]);
  });

  it('yields a food the app\'s own validator accepts', () => {
    expect(isSourcedFood(brandFood('kettle', 'Kettle', ROW))).to.equal(true);
  });
});

describe('isCatalogManifest()', () => {
  it('accepts the build manifest, whatever else it carries, and needs only a version', () => {
    expect(isCatalogManifest({ version: '56342eddb37c', releases: {}, counts: {} })).to.equal(true);
    expect(isCatalogManifest({ version: '' })).to.equal(false);
    expect(isCatalogManifest({ version: 1 })).to.equal(false);
    expect(isCatalogManifest(null)).to.equal(false);
  });
});

describe('isBrandList()', () => {
  it('accepts brands with a letter file and brands listed without one', () => {
    expect(isBrandList({ brands: [['kettle', 'Kettle', 2, 'k'], ['0j', '0J', 1, null]] })).to.equal(true);
    expect(isBrandList({ brands: [] })).to.equal(true);
  });

  it('rejects an entry with an empty id or label, a bad count, a bad file, or the wrong length', () => {
    for (const entry of [
      ['', 'Kettle', 2, 'k'],
      ['kettle', '', 2, 'k'],
      ['kettle', 'Kettle', -1, 'k'],
      ['kettle', 'Kettle', 1.5, 'k'],
      ['kettle', 'Kettle', 2, ''],
      ['kettle', 'Kettle', 2, 7],
      ['kettle', 'Kettle', 2],
    ]) {
      expect(isBrandList({ brands: [entry] }), JSON.stringify(entry)).to.equal(false);
    }
  });

  it('rejects a list that is not an object holding a brands array', () => {
    expect(isBrandList(null)).to.equal(false);
    expect(isBrandList({ brands: {} })).to.equal(false);
    expect(isBrandList([])).to.equal(false);
  });
});

describe('isBrandFileEntry()', () => {
  it('accepts a label and rows', () => {
    expect(isBrandFileEntry({ label: 'Kettle', rows: [ROW] })).to.equal(true);
    expect(isBrandFileEntry({ label: 'Kettle', rows: [] })).to.equal(true);
  });

  it('rejects an empty label, a missing rows array, or any malformed row', () => {
    const cases: unknown[] = [
      { label: '', rows: [ROW] },
      { label: 'Kettle' },
      { label: 'Kettle', rows: [[1.5, 'Chips', '', 1, 2, 3, 4]] },
      { label: 'Kettle', rows: [[0, 'Chips', '', 1, 2, 3, 4]] },
      { label: 'Kettle', rows: [[1, '', '', 1, 2, 3, 4]] },
      { label: 'Kettle', rows: [[1, 'Chips', null, 1, 2, 3, 4]] },
      { label: 'Kettle', rows: [[1, 'Chips', '', -1, 2, 3, 4]] },
      { label: 'Kettle', rows: [[1, 'Chips', '', 1, 2, 3]] },
      { label: 'Kettle', rows: [[1, 'Chips', '', 1, 2, 3, 4, 5]] },
      null,
    ];

    for (const entry of cases) {
      expect(isBrandFileEntry(entry), JSON.stringify(entry)).to.equal(false);
    }
  });
});
