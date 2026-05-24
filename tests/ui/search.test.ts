import { expect } from '@esm-bundle/chai';
import { filterFoods } from '../../src/ui/search.js';
import type { Food } from '../../src/domain/types.js';

function f(id: string, name: string, deletedAt: string | null = null): Food {
  return {
    id, name,
    nutritionFacts: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    createdAt: '2026-01-01T00:00:00Z', deletedAt,
  };
}

describe('filterFoods', () => {
  const foods: Food[] = [
    f('1', 'Banana'),
    f('2', 'Oats'),
    f('3', 'Chicken breast'),
    f('4', 'Old kale', '2026-05-01T00:00:00Z'),
  ];

  it('returns all live foods when query is empty', () => {
    const r = filterFoods(foods, '');
    expect(r.map((x) => x.id)).to.deep.equal(['1', '2', '3']);
  });

  it('filters case-insensitively by substring on name', () => {
    expect(filterFoods(foods, 'oat').map((x) => x.name)).to.deep.equal(['Oats']);
    expect(filterFoods(foods, 'BREAST').map((x) => x.name)).to.deep.equal(['Chicken breast']);
  });

  it('drops soft-deleted foods even when query matches', () => {
    expect(filterFoods(foods, 'kale')).to.deep.equal([]);
  });

  it('treats whitespace-only query as empty', () => {
    expect(filterFoods(foods, '   ').map((x) => x.id)).to.deep.equal(['1', '2', '3']);
  });
});
