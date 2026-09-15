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
  it('folds the food\'s brand into the key', () => {
    expect(foodIdentityKey({ name: 'Almonds', brand: 'Kirkland Signature' })).to.equal('almonds kirkland signature');
  });

  it('is name alone for a food without a brand, whatever its source', () => {
    expect(foodIdentityKey({ name: 'Almonds', source: 'usda' })).to.equal('almonds');
    expect(foodIdentityKey({ name: 'Almonds' })).to.equal('almonds');
  });

  it('reads the brand off the food, never off the source name', () => {
    expect(foodIdentityKey({ name: 'Almonds', source: 'brand:kirkland-signature' })).to.equal('almonds');
  });

  it('is case-insensitive', () => {
    expect(foodIdentityKey({ name: 'ALMONDS', brand: 'Kirkland Signature' }))
      .to.equal(foodIdentityKey({ name: 'almonds', brand: 'kirkland signature' }));
  });
});

describe('nameTaken()', () => {
  it('collides two untagged foods with the same name', () => {
    const foods = [food({ id: 'a', name: 'Almonds' })];
    expect(nameTaken({ name: 'almonds' }, foods)).to.equal(true);
  });

  it('does not collide a tagged food with a same name from a different brand', () => {
    const foods = [food({ id: 'a', name: 'Almonds', brand: 'Kirkland Signature' })];
    expect(nameTaken({ name: 'Almonds', brand: 'Great Value' }, foods)).to.equal(false);
  });

  it('collides two foods of the same brand and name', () => {
    const foods = [food({ id: 'a', name: 'Almonds', brand: 'Kirkland Signature' })];
    expect(nameTaken({ name: 'Almonds', brand: 'Kirkland Signature' }, foods)).to.equal(true);
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
