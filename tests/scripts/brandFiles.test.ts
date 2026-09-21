import { expect } from '@esm-bundle/chai';
import { MIN_BRAND_ITEMS, brandOutput, brandRow } from '../../scripts/brandFiles.js';
import { mapBrandRows, type BrandDataset } from '../../scripts/brandedMapper.js';
import { brandFood } from '../../src/domain/dataFiles.js';
import type { StoreBundle } from '../../src/domain/foodSources.js';
import type { SourcedFood } from '../../src/domain/types.js';

function food(brandId: string, label: string, fdcId: number, name = `Item ${fdcId}`): SourcedFood {
  return {
    id: `brand:${brandId}:${fdcId}`,
    name,
    brand: label,
    nutritionFacts: { calories: 100, protein: 10, carbs: 20, fat: 5 },
    servingSize: 100,
    servingUnit: 'g',
    source: `brand:${brandId}`,
    sourceId: String(fdcId),
    tags: ['Snacks'],
  };
}

function brand(id: string, itemCount: number, label = id.toUpperCase()): BrandDataset {
  return { id, label, foods: Array.from({ length: itemCount }, (_, i) => food(id, label, i + 1)) };
}

function stores(entries: Record<string, StoreBundle>): ReadonlyMap<string, StoreBundle> {
  return new Map(Object.entries(entries));
}

const NO_STORES = stores({});

const NUTRIENTS = [
  { nutrient: { id: 1008 }, amount: 250 },
  { nutrient: { id: 1003 }, amount: 3 },
  { nutrient: { id: 1005 }, amount: 30 },
  { nutrient: { id: 1004 }, amount: 12 },
];

describe('brandRow()', () => {
  const acme = brand('acme', 1, 'Acme');

  it('keeps only what varies per row: USDA id, name, category, then nutrition', () => {
    expect(brandRow(acme, food('acme', 'Acme', 42, 'Cheese pizza'))).to.deep.equal([42, 'Cheese pizza', 'Snacks', 100, 10, 20, 5]);
  });

  it('writes an empty category for a row with no tag', () => {
    expect(brandRow(acme, { ...food('acme', 'Acme', 42), tags: [] })[2]).to.equal('');
  });

  it('throws on a row the app would not decode back to the same food', () => {
    const base = food('acme', 'Acme', 42);
    const deviants: SourcedFood[] = [
      { ...base, servingSize: 1 },
      { ...base, servingUnit: 'count' },
      { ...base, source: 'brand:other' },
      { ...base, brand: 'ACME' },
      { ...base, id: 'brand:acme:43' },
      { ...base, sourceId: '042', id: 'brand:acme:042' },
      { ...base, tags: ['Snacks', 'Chips'] },
      { ...base, barcode: '0123' } as SourcedFood,
    ];

    for (const row of deviants) {
      expect(() => brandRow(acme, row), JSON.stringify(row)).to.throw(/acme/);
    }
  });

  it('round-trips whatever the branded collector produces: the app decodes each row back to the food it came from', () => {
    const rows = [
      { fdcId: 1, description: 'CHIPS', brandName: 'ZAPPS', brandedFoodCategory: 'Chips', servingSizeUnit: 'g', foodNutrients: NUTRIENTS },
      { fdcId: 2, description: 'VOODOO CHIPS', brandName: 'ZAPPS', servingSizeUnit: 'g', foodNutrients: NUTRIENTS },
    ];
    const [zapps] = mapBrandRows(rows);

    for (const f of zapps!.foods) {
      expect(brandFood(zapps!.id, zapps!.label, brandRow(zapps!, f))).to.deep.equal(f);
    }
  });
});

describe('brandOutput()', () => {
  it('lists every brand by id with label, count and file, and ships rows only for brands with enough items', () => {
    const { list, files } = brandOutput([brand('beta', 1), brand('alpha', MIN_BRAND_ITEMS), brand('365', 3)], NO_STORES);

    expect(list).to.deep.equal({
      brands: [
        ['365', '365', 3, '0-9'],
        ['alpha', 'ALPHA', MIN_BRAND_ITEMS, 'a'],
        ['beta', 'BETA', 1, null],
      ],
    });
    expect([...files.keys()]).to.deep.equal(['0-9', 'a']);
    expect(Object.keys(files.get('a')!)).to.deep.equal(['alpha']);
  });

  it('files each brand with its label beside its rows, so its letter file alone rebuilds it', () => {
    const { files } = brandOutput([brand('alpha', 2, 'Alpha')], NO_STORES);
    const entry = files.get('a')!['alpha']!;

    expect(entry.label).to.equal('Alpha');
    expect(entry.rows).to.have.lengthOf(2);
    expect(entry.rows.map((row) => brandFood('alpha', entry.label, row))).to.deep.equal(brand('alpha', 2, 'Alpha').foods);
  });

  it('ships a store\'s house brand whatever its size, and leaves the stores themselves to the app', () => {
    const bundles = stores({ 'acme-mart': { label: 'Acme Mart', brands: ['acme', 'acme-select'] } });
    const { list, files } = brandOutput([brand('acme', 1), brand('acme-select', 2), brand('other', 1)], bundles);

    expect(list.brands.map(([id, , , file]) => [id, file])).to.deep.equal([['acme', 'a'], ['acme-select', 'a'], ['other', null]]);
    expect(Object.keys(files.get('a')!)).to.deep.equal(['acme', 'acme-select']);
    expect(Object.keys(list)).to.deep.equal(['brands']);
  });

  it('throws naming a store brand the dump did not produce', () => {
    const bundles = stores({ 'acme-mart': { label: 'Acme Mart', brands: ['acme', 'acme-gone'] } });
    expect(() => brandOutput([brand('acme', 2)], bundles)).to.throw(/acme-mart: acme-gone/);
  });

  it('throws on a brand the app would refuse to read, shipped or listed only', () => {
    expect(() => brandOutput([brand('acme', 2, '')], NO_STORES)).to.throw(/acme/);
    expect(() => brandOutput([brand('acme', 1, '')], NO_STORES)).to.throw(/brand list/);
  });
});
