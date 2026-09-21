import { expect } from '@esm-bundle/chai';
import { MIN_BRAND_ITEMS, brandOutput } from '../../scripts/brandFiles.js';
import type { BrandDataset } from '../../scripts/brandedMapper.js';
import type { StoreBundle } from '../../src/domain/foodSources.js';

function brand(id: string, itemCount: number, label = id.toUpperCase()): BrandDataset {
  return { id, label, rows: Array.from({ length: itemCount }, (_, i) => [i + 1, `Item ${i + 1}`, 'Snacks', 100, 10, 20, 5]) };
}

function stores(entries: Record<string, StoreBundle>): ReadonlyMap<string, StoreBundle> {
  return new Map(Object.entries(entries));
}

const NO_STORES = stores({});

describe('brandOutput()', () => {
  it('lists every brand by id with label, count and whether it ships rows, which only brands with enough items do', () => {
    const { list, files } = brandOutput([brand('beta', 1), brand('alpha', MIN_BRAND_ITEMS), brand('365', 3)], NO_STORES);

    expect(list).to.deep.equal({
      brands: [
        ['365', '365', 3, true],
        ['alpha', 'ALPHA', MIN_BRAND_ITEMS, true],
        ['beta', 'BETA', 1, false],
      ],
    });
    expect([...files.keys()]).to.deep.equal(['0-9', 'a']);
    expect(Object.keys(files.get('a')!)).to.deep.equal(['alpha']);
  });

  it('files each brand with its label beside its rows, so its letter file alone rebuilds it', () => {
    const { files } = brandOutput([brand('alpha', 2, 'Alpha')], NO_STORES);
    expect(files.get('a')!['alpha']).to.deep.equal({ label: 'Alpha', rows: brand('alpha', 2, 'Alpha').rows });
  });

  it('ships a store\'s house brand whatever its size, and leaves the stores themselves to the app', () => {
    const bundles = stores({ 'acme-mart': { label: 'Acme Mart', brands: ['acme', 'acme-select'] } });
    const { list, files } = brandOutput([brand('acme', 1), brand('acme-select', 2), brand('other', 1)], bundles);

    expect(list.brands.map(([id, , , included]) => [id, included])).to.deep.equal([['acme', true], ['acme-select', true], ['other', false]]);
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
