import { expect } from '@esm-bundle/chai';
import { DATA_PATHS, brandFileKey, brandFood, type BrandRow } from '../../src/domain/dataFiles.js';
import { isBrandFileEntry, isBrandFileObject, isBrandList, isCatalogManifest, isSourcedFood } from '../../src/domain/validate.js';

const ROW: BrandRow = [2490831, 'Barbecue kettle chips', 'Chips, Pretzels & Snacks', 40, 'g', 0, '', 536, 7.1, 60.7, 28.6];
const BOTTLE_ROW: BrandRow = [2640216, 'Mixed berry vanilla drink', 'Yogurt', 296, 'ml', 1, 'bottle', 169, 8, 25, 3];

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
  it('rebuilds the food a brand row stands for: its own serving, tagged with the brand, keyed by source and USDA id', () => {
    expect(brandFood('kettle', 'Kettle', ROW)).to.deep.equal({
      id: 'brand:kettle:2490831',
      name: 'Barbecue kettle chips',
      brand: 'Kettle',
      nutritionFacts: { calories: 536, protein: 7.1, carbs: 60.7, fat: 28.6 },
      servingSize: 40,
      servingUnit: 'g',
      source: 'brand:kettle',
      sourceId: '2490831',
      tags: ['Chips, Pretzels & Snacks'],
    });
  });

  it('gives a row with an empty category no tag', () => {
    expect(brandFood('kettle', 'Kettle', [1, 'Chips', '', 40, 'g', 0, '', 1, 2, 3, 4]).tags).to.deep.equal([]);
  });

  it('adds pieces when piecesPerServing is greater than zero, with its noun', () => {
    expect(brandFood('chobani', 'Chobani', BOTTLE_ROW).pieces).to.deep.equal({ perServing: 1, noun: 'bottle' });
  });

  it('yields a food the app\'s own validator accepts', () => {
    expect(isSourcedFood(brandFood('kettle', 'Kettle', ROW))).to.equal(true);
    expect(isSourcedFood(brandFood('chobani', 'Chobani', BOTTLE_ROW))).to.equal(true);
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
  it('accepts brands shipped with rows and brands listed without them', () => {
    expect(isBrandList({ brands: [['kettle', 'Kettle', 2, true], ['0j', '0J', 1, false]] })).to.equal(true);
    expect(isBrandList({ brands: [] })).to.equal(true);
  });

  it('rejects an entry with an empty id or label, a bad count, an included flag that is not a boolean, or the wrong length', () => {
    for (const entry of [
      ['', 'Kettle', 2, true],
      ['kettle', '', 2, true],
      ['kettle', 'Kettle', -1, true],
      ['kettle', 'Kettle', 1.5, true],
      ['kettle', 'Kettle', 2, 'k'],
      ['kettle', 'Kettle', 2, null],
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

describe('isBrandFileObject()', () => {
  it('accepts an object of brand entries without looking inside them', () => {
    expect(isBrandFileObject({})).to.equal(true);
    expect(isBrandFileObject({ kettle: { label: 'Kettle', rows: [ROW] }, broken: 7 })).to.equal(true);
  });

  it('rejects anything but an object: null, an array, a string', () => {
    for (const file of [null, [], [{ kettle: { label: 'Kettle', rows: [] } }], 'kettle']) {
      expect(isBrandFileObject(file), JSON.stringify(file)).to.equal(false);
    }
  });
});

describe('isBrandFileEntry()', () => {
  it('accepts a label and rows, with or without pieces', () => {
    expect(isBrandFileEntry({ label: 'Kettle', rows: [ROW] })).to.equal(true);
    expect(isBrandFileEntry({ label: 'Chobani', rows: [BOTTLE_ROW] })).to.equal(true);
    expect(isBrandFileEntry({ label: 'Kettle', rows: [] })).to.equal(true);
  });

  it('rejects an empty label, a missing rows array, or any malformed row', () => {
    const cases: unknown[] = [
      { label: '', rows: [ROW] },
      { label: 'Kettle' },
      { label: 'Kettle', rows: [[1.5, 'Chips', '', 40, 'g', 0, '', 1, 2, 3, 4]] },
      { label: 'Kettle', rows: [[0, 'Chips', '', 40, 'g', 0, '', 1, 2, 3, 4]] },
      { label: 'Kettle', rows: [[1, '', '', 40, 'g', 0, '', 1, 2, 3, 4]] },
      { label: 'Kettle', rows: [[1, 'Chips', null, 40, 'g', 0, '', 1, 2, 3, 4]] },
      { label: 'Kettle', rows: [[1, 'Chips', '', -1, 'g', 0, '', 1, 2, 3, 4]] },
      { label: 'Kettle', rows: [[1, 'Chips', '', 0, 'g', 0, '', 1, 2, 3, 4]] },
      { label: 'Kettle', rows: [[1, 'Chips', '', 40, 'oz', 0, '', 1, 2, 3, 4]] },
      { label: 'Kettle', rows: [[1, 'Chips', '', 40, 'g', -1, '', 1, 2, 3, 4]] },
      { label: 'Kettle', rows: [[1, 'Chips', '', 40, 'g', 0, 'bottle', 1, 2, 3, 4]] },
      { label: 'Kettle', rows: [[1, 'Chips', '', 40, 'g', 1, '', 1, 2, 3, 4]] },
      { label: 'Kettle', rows: [[1, 'Chips', '', 40, 'g', 1, null, 1, 2, 3, 4]] },
      { label: 'Kettle', rows: [[1, 'Chips', '', 40, 'g', 0, '', -1, 2, 3, 4]] },
      { label: 'Kettle', rows: [[1, 'Chips', '', 40, 'g', 0, '', 1, 2, 3]] },
      { label: 'Kettle', rows: [[1, 'Chips', '', 40, 'g', 0, '', 1, 2, 3, 4, 5]] },
      null,
    ];

    for (const entry of cases) {
      expect(isBrandFileEntry(entry), JSON.stringify(entry)).to.equal(false);
    }
  });
});
