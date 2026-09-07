import { expect } from '@esm-bundle/chai';
import { compareForLog } from '../../src/ui/recent.js';
import type { Named } from '../../src/ui/search.js';
import { defaultEnabledSources } from '../../src/domain/foodSources.js';
import type { Entry, Food, Recipe, RecipeLog, State } from '../../src/domain/types.js';

const food = (id: string, name: string, deletedAt: string | null = null): Food => ({
  id, name,
  nutritionFacts: { calories: 100, protein: 0, carbs: 0, fat: 0 },
  servingUnit: 'g', servingSize: 100,
  createdAt: '2026-01-01T00:00:00Z', deletedAt,
});

const recipe = (id: string, name: string, deletedAt: string | null = null): Recipe => ({
  id, name,
  items: [{ foodId: 'egg', amount: 1, unit: 'count' }],
  createdAt: '2026-01-01T00:00:00Z', deletedAt,
});

const entry = (id: string, foodId: string, loggedAt: string, overrides: Partial<Entry> = {}): Entry => ({
  id, date: '2026-05-23', foodId, amount: 100, unit: 'g', mealId: 'm1', loggedAt, ...overrides,
});

function stateWith(
  foods: Food[], entries: Entry[] = [], recipes: Recipe[] = [], recipeLogs: RecipeLog[] = [],
): State {
  return { version: 2, enabledSources: defaultEnabledSources(), foods, meals: [], entries, recipes, recipeLogs };
}

function sortIds<T extends { id: string; name: string }>(state: State, now: Date, items: T[]): string[] {
  return [...items].sort(compareForLog(state, now)).map((i) => i.id);
}

describe('compareForLog — foods', () => {
  const now = new Date('2026-05-23T10:00:00.000Z');

  it('sorts alphabetically when there are no entries', () => {
    const s = stateWith([food('b', 'Banana'), food('a', 'Apple')]);
    expect(sortIds(s, now, s.foods)).to.deep.equal(['a', 'b']);
  });

  it('places recently-used foods first, by most recent loggedAt', () => {
    const s = stateWith(
      [food('apple', 'Apple'), food('banana', 'Banana'), food('chicken', 'Chicken'), food('zebra', 'Zebra')],
      [
        entry('e1', 'banana', '2026-05-20T10:00:00Z'),
        entry('e2', 'chicken', '2026-05-22T10:00:00Z'),
      ],
    );
    expect(sortIds(s, now, s.foods)).to.deep.equal(['chicken', 'banana', 'apple', 'zebra']);
  });

  it('ignores entries older than 30 days', () => {
    const s = stateWith(
      [food('apple', 'Apple'), food('old', 'Old food')],
      [entry('e1', 'old', '2026-03-01T10:00:00Z')],
    );
    expect(sortIds(s, now, s.foods)).to.deep.equal(['apple', 'old']);
  });

  it('does not treat a soft-deleted food as recently used, even given its own entry', () => {
    const s = stateWith(
      [food('apple', 'Apple'), food('banana', 'Banana', '2026-05-22T00:00:00Z')],
      [entry('e1', 'banana', '2026-05-22T10:00:00Z')],
    );
    expect(sortIds(s, now, s.foods)).to.deep.equal(['apple', 'banana']);
  });

  it('uses the latest loggedAt for foods with multiple recent entries', () => {
    const s = stateWith(
      [food('a', 'A'), food('b', 'B')],
      [
        entry('e1', 'a', '2026-05-22T10:00:00Z'),
        entry('e2', 'b', '2026-05-21T10:00:00Z'),
        entry('e3', 'b', '2026-05-23T09:00:00Z'),
      ],
    );
    expect(sortIds(s, now, s.foods)).to.deep.equal(['b', 'a']);
  });

  it('ignores entries that reference unknown foodIds', () => {
    const s = stateWith([food('apple', 'Apple')], [entry('e1', 'ghost', '2026-05-22T10:00:00Z')]);
    expect(sortIds(s, now, s.foods)).to.deep.equal(['apple']);
  });
});

describe('compareForLog — recipes', () => {
  const now = new Date('2026-05-23T10:00:00.000Z');

  it('ranks a recipe by the most recent entry that carries its recipeLogId', () => {
    const omelette = recipe('r1', 'Omelette');
    const s = stateWith(
      [food('apple', 'Apple')],
      [entry('e1', 'egg', '2026-05-23T09:00:00Z', { recipeLogId: 'rl1' })],
      [omelette],
      [{ id: 'rl1', recipeId: 'r1', servings: 1 }],
    );
    const items: Named[] = [...s.foods, ...s.recipes];
    expect(sortIds(s, now, items)).to.deep.equal(['r1', 'apple']);
  });

  it('a recipe logged today outranks a food never logged', () => {
    const omelette = recipe('r1', 'Omelette');
    const s = stateWith(
      [food('zebra', 'Zebra')],
      [entry('e1', 'egg', '2026-05-23T09:00:00Z', { recipeLogId: 'rl1' })],
      [omelette],
      [{ id: 'rl1', recipeId: 'r1', servings: 1 }],
    );
    const items: Named[] = [...s.foods, ...s.recipes];
    expect(sortIds(s, now, items)).to.deep.equal(['r1', 'zebra']);
  });

  it('falls back to name when a food and a recipe are equally recent', () => {
    const omelette = recipe('r1', 'Aardvark');
    const s = stateWith(
      [food('apple', 'Zucchini')],
      [
        entry('e1', 'apple', '2026-05-23T09:00:00Z'),
        entry('e2', 'egg', '2026-05-23T09:00:00Z', { recipeLogId: 'rl1' }),
      ],
      [omelette],
      [{ id: 'rl1', recipeId: 'r1', servings: 1 }],
    );
    const items: Named[] = [...s.foods, ...s.recipes];
    expect(sortIds(s, now, items)).to.deep.equal(['r1', 'apple']);
  });

  it('does not treat a soft-deleted recipe as recently used', () => {
    const deleted = recipe('r1', 'Omelette', '2026-02-01T00:00:00Z');
    const s = stateWith(
      [food('apple', 'Apple')],
      [entry('e1', 'egg', '2026-05-23T09:00:00Z', { recipeLogId: 'rl1' })],
      [deleted],
      [{ id: 'rl1', recipeId: 'r1', servings: 1 }],
    );
    const items: Named[] = [...s.foods, ...s.recipes];
    expect(sortIds(s, now, items)).to.deep.equal(['apple', 'r1']);
  });

  it('falls back to bumping the ingredient food once its recipe is no longer live', () => {
    const deleted = recipe('r1', 'Omelette', '2026-02-01T00:00:00Z');
    const s = stateWith(
      [food('egg', 'Egg'), food('apple', 'Apple')],
      [entry('e1', 'egg', '2026-05-23T09:00:00Z', { recipeLogId: 'rl1' })],
      [deleted],
      [{ id: 'rl1', recipeId: 'r1', servings: 1 }],
    );
    expect(sortIds(s, now, s.foods)).to.deep.equal(['egg', 'apple']);
  });
});
