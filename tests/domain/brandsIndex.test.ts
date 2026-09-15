import { expect } from '@esm-bundle/chai';
import { isBrandsIndex, isSourcedFood } from '../../src/domain/validate.js';
import { BRAND_SOURCE_PREFIX, brandIdOf, brandSource } from '../../src/domain/foodSources.js';

const sourced = {
  id: 'brand:chobani:1',
  name: 'Greek yogurt, blueberry',
  brand: 'Chobani',
  nutritionFacts: { calories: 100, protein: 10, carbs: 20, fat: 5 },
  servingSize: 100,
  servingUnit: 'g',
  source: 'brand:chobani',
  sourceId: '1',
  tags: ['Yogurt'],
};

const index = {
  source: 'brands',
  version: '1',
  generatedAt: '2026-09-15T00:00:00.000Z',
  brands: [['chobani', 'Chobani', 415, 1], ['nature-valley', 'Nature Valley', 445, 0]],
  shards: [{ sha256: 'ab', itemCount: 445, bytes: 100 }, { sha256: 'cd', itemCount: 415, bytes: 90 }],
};

describe('isSourcedFood() with a brand', () => {
  it('accepts a row carrying a brand label and one without', () => {
    expect(isSourcedFood(sourced)).to.equal(true);

    const { brand: _brand, ...untagged } = sourced;
    expect(isSourcedFood(untagged)).to.equal(true);
  });

  it('rejects an empty or non-string brand', () => {
    expect(isSourcedFood({ ...sourced, brand: '' })).to.equal(false);
    expect(isSourcedFood({ ...sourced, brand: 7 })).to.equal(false);
  });
});

describe('isBrandsIndex()', () => {
  it('accepts a well-formed index', () => {
    expect(isBrandsIndex(index)).to.equal(true);
    expect(isBrandsIndex({ ...index, brands: [], shards: [] })).to.equal(true);
  });

  it('rejects a wrong source, a missing version, or a non-array brands list', () => {
    expect(isBrandsIndex({ ...index, source: 'usda' })).to.equal(false);
    expect(isBrandsIndex({ ...index, version: '' })).to.equal(false);
    expect(isBrandsIndex({ ...index, brands: {} })).to.equal(false);
  });

  it('rejects a brand tuple with an empty id, an empty label, a bad count, or a shard the index does not have', () => {
    expect(isBrandsIndex({ ...index, brands: [['', 'Chobani', 1, 0]] })).to.equal(false);
    expect(isBrandsIndex({ ...index, brands: [['chobani', '', 1, 0]] })).to.equal(false);
    expect(isBrandsIndex({ ...index, brands: [['chobani', 'Chobani', -1, 0]] })).to.equal(false);
    expect(isBrandsIndex({ ...index, brands: [['chobani', 'Chobani', 1.5, 0]] })).to.equal(false);
    expect(isBrandsIndex({ ...index, brands: [['chobani', 'Chobani', 1, 2]] })).to.equal(false);
    expect(isBrandsIndex({ ...index, brands: [['chobani', 'Chobani', 1]] })).to.equal(false);
  });

  it('rejects a shard manifest with a non-string sha or a negative count', () => {
    expect(isBrandsIndex({ ...index, shards: [{ sha256: 1, itemCount: 1, bytes: 10 }] })).to.equal(false);
    expect(isBrandsIndex({ ...index, shards: [{ sha256: 'ab', itemCount: -1, bytes: 10 }] })).to.equal(false);
  });

  it('rejects a non-object', () => {
    expect(isBrandsIndex(null)).to.equal(false);
    expect(isBrandsIndex('brands')).to.equal(false);
  });
});

describe('brand source names', () => {
  it('prefixes a brand id and reads it back', () => {
    expect(brandSource('chobani')).to.equal(`${BRAND_SOURCE_PREFIX}chobani`);
    expect(brandIdOf('brand:chobani')).to.equal('chobani');
  });

  it('reads null for a static source, a bare prefix, or an unrelated name', () => {
    expect(brandIdOf('usda')).to.equal(null);
    expect(brandIdOf('brand:')).to.equal(null);
    expect(brandIdOf('brands')).to.equal(null);
  });
});
