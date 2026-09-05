import { expect } from '@esm-bundle/chai';
import { byRank, fuzzyMatch, liveFoods } from '../../src/ui/search.js';
import type { Food } from '../../src/domain/types.js';

function f(id: string, name: string, deletedAt: string | null = null, source?: string): Food {
  return {
    id, name,
    nutritionFacts: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    servingSize: 100, servingUnit: 'g',
    createdAt: '2026-01-01T00:00:00Z', deletedAt,
    ...(source !== undefined ? { source } : {}),
  };
}

function litOf(text: string, indices: ReadonlyArray<readonly [number, number]>): string {
  return indices.flatMap(([s, e]) => Array.from(text.slice(s, e))).join('').toLowerCase();
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

  it('returns every food at tier 0 when query is empty', () => {
    const r = fuzzyMatch(foods, '');
    expect(r).to.have.lengthOf(foods.length);
    expect(r.every((m) => m.tier === 0)).to.equal(true);
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

  it('matches abbreviated multi-token queries', () => {
    const names = fuzzyMatch(foods, 'chk brst').map((m) => m.food.name);
    expect(names).to.include('Chicken breast');
  });

  it('matches multi-token queries in any token order', () => {
    const names = fuzzyMatch(foods, 'breast chicken').map((m) => m.food.name);
    expect(names).to.include('Chicken breast');
  });

  it('matches natural word order against comma-inverted catalog names', () => {
    const usda = [f('1', 'Yogurt, Greek, plain, nonfat')];
    const names = fuzzyMatch(usda, 'greek yogurt').map((m) => m.food.name);
    expect(names).to.include('Yogurt, Greek, plain, nonfat');
  });

  it('matches initials via character subsequence', () => {
    const names = fuzzyMatch(foods, 'gy').map((m) => m.food.name);
    expect(names).to.include('Greek yogurt');
  });

  it('matches case-insensitively regardless of query casing', () => {
    expect(fuzzyMatch(foods, 'GY').map((m) => m.food.name)).to.include('Greek yogurt');
    expect(fuzzyMatch(foods, 'BANANA').map((m) => m.food.name)).to.include('Banana');
  });

  it('highlights exactly the query-length characters for a contiguous prefix match', () => {
    const m = fuzzyMatch([f('1', 'Babyfood, apple-banana juice')], 'baby')[0]!;
    expect(m.indices).to.deep.equal([[0, 4]]);
  });

  it('highlights only the matched initials for a subsequence query', () => {
    const m = fuzzyMatch([f('1', 'Greek yogurt')], 'gy')[0]!;
    const lit = m.indices.flatMap(([s, e]) => Array.from(m.food.name.slice(s, e)));
    expect(lit.join('').toLowerCase()).to.equal('gy');
  });

  it('does not highlight the space between words for a multi-token query', () => {
    const m = fuzzyMatch([f('1', 'Chicken breast')], 'chk brst')[0]!;
    const lit = m.indices.flatMap(([s, e]) => Array.from(m.food.name.slice(s, e)));
    expect(lit).to.not.include(' ');
  });

  it('matches an accented query against a plain name and a plain query against an accented one', () => {
    const both = [f('1', 'Creme brulee'), f('2', 'Crème de menthe')];
    expect(fuzzyMatch(both, 'crème').map((m) => m.food.id)).to.have.members(['1', '2']);
    expect(fuzzyMatch(both, 'creme').map((m) => m.food.id)).to.have.members(['1', '2']);
  });

  it('highlights the accented characters a plain query matched', () => {
    const [m] = fuzzyMatch([f('1', 'Rosé wine')], 'rose');
    expect(m!.indices).to.deep.equal([[0, 4]]);
  });

  it('returns empty array when nothing matches', () => {
    const r = fuzzyMatch(foods, 'xyzqq');
    expect(r).to.deep.equal([]);
  });

  it('returns half-open indices into the food name', () => {
    const r = fuzzyMatch(foods, 'oat');
    const match = r[0]!;
    expect(match.indices.length).to.be.greaterThan(0);
    const [start, end] = match.indices[0]!;
    const slice = match.food.name.slice(start, end).toLowerCase();
    expect(slice).to.equal('oat');
  });
});

describe('ranking tiers', () => {
  const alpha = (a: Food, b: Food): number => a.name.localeCompare(b.name);
  const ranked = (foods: Food[], query: string): string[] =>
    fuzzyMatch(foods, query).sort(byRank(alpha)).map((m) => m.food.name);

  it('ranks an exact match first', () => {
    expect(ranked([f('1', 'Apple juice'), f('2', 'Apple')], 'apple'))
      .to.deep.equal(['Apple', 'Apple juice']);
  });

  it('ranks a prefix match above a word-start match', () => {
    expect(ranked([f('1', 'Caramel apple'), f('2', 'Apple juice')], 'apple'))
      .to.deep.equal(['Apple juice', 'Caramel apple']);
  });

  it('ranks a word-start match above a mid-word substring match', () => {
    expect(ranked([f('1', 'Pineapple'), f('2', 'Caramel apple')], 'apple'))
      .to.deep.equal(['Caramel apple', 'Pineapple']);
  });

  it('ranks a prefix match above a fuzzy subsequence match', () => {
    expect(ranked([f('1', 'Greek yogurt'), f('2', 'Gym bar')], 'gy'))
      .to.deep.equal(['Gym bar', 'Greek yogurt']);
  });

  it('matches reordered word-start tokens against comma-inverted names', () => {
    expect(ranked([f('1', 'Yogurt, Greek, plain, nonfat')], 'greek yogurt'))
      .to.deep.equal(['Yogurt, Greek, plain, nonfat']);
  });

  it('folds punctuation in the query, so "peanut-butter" is an exact match for "Peanut butter"', () => {
    expect(ranked([f('1', 'Peanut butter cookie'), f('2', 'Peanut butter')], 'peanut-butter'))
      .to.deep.equal(['Peanut butter', 'Peanut butter cookie']);
    expect(fuzzyMatch([f('1', 'Peanut butter')], 'peanut-butter')[0]!.indices).to.deep.equal([[0, 6], [7, 13]]);
  });

  it('classifies against the folded name, so a plain query is a prefix of an accented name', () => {
    expect(ranked([f('1', 'Pickled jalapeno relish'), f('2', 'Jalapeños (canned)')], 'jalapeno'))
      .to.deep.equal(['Jalapeños (canned)', 'Pickled jalapeno relish']);
  });
});

describe('brand-aware matching', () => {
  it('matches a brand query against the source label, with separate index ranges for name and brand', () => {
    const [m] = fuzzyMatch([f('1', 'Almonds', null, 'costco')], 'costco almonds');
    expect(m).to.not.equal(undefined);
    expect(litOf(m!.food.name, m!.indices)).to.equal('almonds');
    expect(litOf('Costco', m!.brandIndices)).to.equal('costco');
  });

  it('leaves brandIndices empty for a name-only query', () => {
    const [m] = fuzzyMatch([f('1', 'Almonds', null, 'costco')], 'almonds');
    expect(m!.brandIndices).to.deep.equal([]);
  });

  it('does not match a reference source by its own registry name', () => {
    const r = fuzzyMatch([f('1', 'Almonds', null, 'usda')], 'usda');
    expect(r).to.deep.equal([]);
  });

  it('keeps an exact name match at tier EXACT even though the search text is longer', () => {
    const [m] = fuzzyMatch([f('1', 'Almonds', null, 'costco')], 'almonds');
    expect(m!.tier).to.equal(0);
  });

  it('matches a punctuated brand label by its unpunctuated spelling, highlighting the verbatim label', () => {
    const [m] = fuzzyMatch([f('1', 'Almonds', null, 'sams-club')], 'sams club');
    expect(m).to.not.equal(undefined);
    expect(litOf("Sam's Club", m!.brandIndices)).to.equal('samsclub');
  });
});

describe('byRank', () => {
  const foods: Food[] = [f('1', 'Apple'), f('2', 'Avocado'), f('3', 'Apricot')];

  it('sorts by tier ascending then by the tie-breaker within a tier', () => {
    const matches = [
      { food: foods[1]!, tier: 1, indices: [] as ReadonlyArray<readonly [number, number]>, brandIndices: [] },
      { food: foods[0]!, tier: 1, indices: [], brandIndices: [] },
      { food: foods[2]!, tier: 0, indices: [], brandIndices: [] },
    ];
    matches.sort(byRank((a, b) => a.name.localeCompare(b.name)));
    expect(matches.map((m) => m.food.name)).to.deep.equal(['Apricot', 'Apple', 'Avocado']);
  });
});
