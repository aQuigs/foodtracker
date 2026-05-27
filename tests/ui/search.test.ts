import { expect } from '@esm-bundle/chai';
import { byScoreThen, fuzzyMatch, liveFoods } from '../../src/ui/search.js';
import type { Food } from '../../src/domain/types.js';

function f(id: string, name: string, deletedAt: string | null = null): Food {
  return {
    id, name,
    nutritionFacts: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    servingSize: 100, servingUnit: 'g',
    createdAt: '2026-01-01T00:00:00Z', deletedAt,
  };
}

describe('liveFoods', () => {
  it('drops soft-deleted foods', () => {
    const foods = [f('1', 'Banana'), f('2', 'Old kale', '2026-05-01T00:00:00Z')];
    expect(liveFoods(foods).map((x) => x.id)).to.deep.equal(['1']);
  });
});

describe('fuzzyMatch', () => {
  const foods: Food[] = [
    f('1', 'Banana'),
    f('2', 'Oats'),
    f('3', 'Chicken breast'),
    f('4', 'Greek yogurt'),
    f('5', 'Broccoli'),
  ];

  it('returns every food with score 0 when query is empty', () => {
    const r = fuzzyMatch(foods, '');
    expect(r).to.have.lengthOf(foods.length);
    expect(r.every((m) => m.score === 0)).to.equal(true);
    expect(r.every((m) => m.indices.length === 0)).to.equal(true);
    expect(r.map((m) => m.food.id)).to.deep.equal(['1', '2', '3', '4', '5']);
  });

  it('treats whitespace-only query as empty', () => {
    const r = fuzzyMatch(foods, '   ');
    expect(r.map((m) => m.food.id)).to.deep.equal(['1', '2', '3', '4', '5']);
  });

  it('matches an exact substring', () => {
    const r = fuzzyMatch(foods, 'oat');
    expect(r.map((m) => m.food.name)).to.deep.equal(['Oats']);
    expect(r[0]!.indices.length).to.be.greaterThan(0);
  });

  it('tolerates transposed/extra letters (typo)', () => {
    const names = fuzzyMatch(foods, 'bananna').map((m) => m.food.name);
    expect(names).to.include('Banana');
  });

  it('matches out-of-order tokens', () => {
    const names = fuzzyMatch(foods, 'chk brst').map((m) => m.food.name);
    expect(names).to.include('Chicken breast');
  });

  it('matches initials via character subsequence', () => {
    const names = fuzzyMatch(foods, 'gy').map((m) => m.food.name);
    expect(names).to.include('Greek yogurt');
  });

  it('returns empty array when nothing matches', () => {
    const r = fuzzyMatch(foods, 'xyzqq');
    expect(r).to.deep.equal([]);
  });

  it('returns indices into the food name', () => {
    const r = fuzzyMatch(foods, 'oat');
    const match = r[0]!;
    expect(match.indices.length).to.be.greaterThan(0);
    const [start, end] = match.indices[0]!;
    const slice = match.food.name.slice(start, end + 1).toLowerCase();
    expect(slice).to.contain('o');
  });
});

describe('byScoreThen', () => {
  const foods: Food[] = [
    f('1', 'Apple'),
    f('2', 'Avocado'),
    f('3', 'Apricot'),
  ];

  it('sorts by score ascending then by the tie-breaker on equal score', () => {
    const matches = [
      { food: foods[1]!, score: 0.2, indices: [] as ReadonlyArray<readonly [number, number]> },
      { food: foods[0]!, score: 0.2, indices: [] },
      { food: foods[2]!, score: 0.1, indices: [] },
    ];
    matches.sort(byScoreThen((a, b) => a.name.localeCompare(b.name)));
    expect(matches.map((m) => m.food.name)).to.deep.equal(['Apricot', 'Apple', 'Avocado']);
  });
});
