import { expect } from '@esm-bundle/chai';
import { foodIdentityKey, nameTaken } from '../../src/domain/foodNames.js';
import type { Food } from '../../src/domain/types.js';

function food(overrides: Partial<Food> & { id: string; name: string }): Food {
  return {
    nutritionFacts: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    servingSize: 100,
    servingUnit: 'g',
    createdAt: '2026-01-01T00:00:00Z',
    deletedAt: null,
    ...overrides,
  };
}

describe('foodIdentityKey()', () => {
  it('folds a brand source\'s label into the key', () => {
    expect(foodIdentityKey({ name: 'Almonds', source: 'costco' })).to.equal('almonds costco');
  });

  it('is name alone for a reference source or no source', () => {
    expect(foodIdentityKey({ name: 'Almonds', source: 'usda' })).to.equal('almonds');
    expect(foodIdentityKey({ name: 'Almonds' })).to.equal('almonds');
  });

  it('is case-insensitive', () => {
    expect(foodIdentityKey({ name: 'ALMONDS', source: 'costco' }))
      .to.equal(foodIdentityKey({ name: 'almonds', source: 'costco' }));
  });
});

describe('nameTaken()', () => {
  it('collides two untagged foods with the same name', () => {
    const foods = [food({ id: 'a', name: 'Almonds' })];
    expect(nameTaken({ name: 'almonds' }, foods)).to.equal(true);
  });

  it('does not collide a brand-tagged food with a same name from a different brand', () => {
    const foods = [food({ id: 'a', name: 'Almonds', source: 'costco' })];
    expect(nameTaken({ name: 'Almonds', source: 'target' }, foods)).to.equal(false);
  });

  it('collides a user-made food with a reference-source food of the same name (both untagged)', () => {
    const foods = [food({ id: 'a', name: 'Almonds', source: 'usda' })];
    expect(nameTaken({ name: 'Almonds' }, foods)).to.equal(true);
  });

  it('ignores a soft-deleted food', () => {
    const foods = [food({ id: 'a', name: 'Almonds', deletedAt: '2026-01-02T00:00:00Z' })];
    expect(nameTaken({ name: 'Almonds' }, foods)).to.equal(false);
  });

  it('ignores the food named by ignoreId', () => {
    const foods = [food({ id: 'b', name: 'Almonds' })];
    expect(nameTaken({ name: 'Almonds' }, foods, 'b')).to.equal(false);
  });
});
