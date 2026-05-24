import { expect } from '@esm-bundle/chai';
import { filterFoods } from '../../src/ui/search.js';
import type { Food } from '../../src/domain/types.js';

const baseFood = (id: string, name: string, deletedAt: string | null = null): Food => ({
  id, name,
  caloriesPer100g: 100, proteinPer100g: 0, carbsPer100g: 0, fatPer100g: 0,
  createdAt: '2026-01-01T00:00:00Z', deletedAt,
});

describe('filterFoods', () => {
  const foods: Food[] = [
    baseFood('1', 'Banana'),
    baseFood('2', 'Greek yogurt'),
    baseFood('3', 'Chicken breast'),
    baseFood('4', 'Olive oil'),
    baseFood('5', 'Deleted item', '2026-05-01T00:00:00Z'),
  ];

  it('returns all non-deleted foods when query is empty', () => {
    expect(filterFoods(foods, '').map((f) => f.id)).to.deep.equal(['1', '2', '3', '4']);
  });

  it('returns all non-deleted foods when query is whitespace', () => {
    expect(filterFoods(foods, '   ').map((f) => f.id)).to.deep.equal(['1', '2', '3', '4']);
  });

  it('filters by case-insensitive substring', () => {
    expect(filterFoods(foods, 'ban').map((f) => f.id)).to.deep.equal(['1']);
    expect(filterFoods(foods, 'BAN').map((f) => f.id)).to.deep.equal(['1']);
    expect(filterFoods(foods, 'chick').map((f) => f.id)).to.deep.equal(['3']);
  });

  it('matches anywhere in name, not just prefix', () => {
    expect(filterFoods(foods, 'east').map((f) => f.id)).to.deep.equal(['3']);
  });

  it('returns empty list when no match', () => {
    expect(filterFoods(foods, 'xyz')).to.deep.equal([]);
  });

  it('excludes soft-deleted foods from results', () => {
    expect(filterFoods(foods, 'deleted')).to.deep.equal([]);
    expect(filterFoods(foods, '').find((f) => f.id === '5')).to.equal(undefined);
  });

  it('trims surrounding whitespace from query', () => {
    expect(filterFoods(foods, '  banana  ').map((f) => f.id)).to.deep.equal(['1']);
  });
});
