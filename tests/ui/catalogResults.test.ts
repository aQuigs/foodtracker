import { expect } from '@esm-bundle/chai';
import { compareCatalogRank } from '../../src/ui/catalogResults.js';
import type { FoodMatch } from '../../src/ui/search.js';
import type { SourcedFood } from '../../src/domain/types.js';

function food(id: string, name: string, source: string): SourcedFood {
  return {
    id, name, source, sourceId: id,
    nutritionFacts: { calories: 100, protein: 5, carbs: 10, fat: 2 },
    servingSize: 100, servingUnit: 'g',
  };
}

function match(item: SourcedFood, tier = 0): FoodMatch<SourcedFood> {
  return { food: item, tier, indices: [], brandIndices: [] };
}

describe('compareCatalogRank', () => {
  it('ranks a stronger match ahead of a weaker one, whichever source it came from', () => {
    const rows = [
      match(food('usda:1', 'Deviled egg', 'usda'), 2),
      match(food('usda-full:1', 'Egg', 'usda-full'), 0),
    ];
    rows.sort(compareCatalogRank);
    expect(rows.map((r) => r.food.id)).to.deep.equal(['usda-full:1', 'usda:1']);
  });

  it('on a tied rank, puts the curated source ahead of a deep or brand source', () => {
    const rows = [
      match(food('usda-full:1', 'Egg', 'usda-full')),
      match(food('brand:chobani:1', 'Egg', 'brand:chobani')),
      match(food('usda:1', 'Egg', 'usda')),
    ];
    rows.sort(compareCatalogRank);
    expect(rows.map((r) => r.food.id)).to.deep.equal(['usda:1', 'usda-full:1', 'brand:chobani:1']);
  });

  it('breaks a same-tier tie by shorter name first', () => {
    const rows = [
      match(food('usda-full:1', 'Eggplant', 'usda-full')),
      match(food('usda-full:2', 'Egg', 'usda-full')),
      match(food('usda-full:3', 'Egg noodles', 'usda-full')),
    ];
    rows.sort(compareCatalogRank);
    expect(rows.map((r) => r.food.id)).to.deep.equal(['usda-full:2', 'usda-full:1', 'usda-full:3']);
  });

  it('breaks a same-length tie alphabetically', () => {
    const rows = [
      match(food('usda-full:1', 'Ham', 'usda-full')),
      match(food('usda-full:2', 'Egg', 'usda-full')),
    ];
    rows.sort(compareCatalogRank);
    expect(rows.map((r) => r.food.id)).to.deep.equal(['usda-full:2', 'usda-full:1']);
  });
});
