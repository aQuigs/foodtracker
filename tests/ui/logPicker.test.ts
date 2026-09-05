import { expect } from '@esm-bundle/chai';
import { pickerItems, searchPicker } from '../../src/ui/logPicker.js';
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

const now = new Date('2026-05-23T10:00:00.000Z');

describe('pickerItems', () => {
  it('lists live foods then live recipes', () => {
    const apple = food('apple', 'Apple');
    const deletedFood = food('dead-food', 'Dead food', '2026-02-01T00:00:00Z');
    const omelette = recipe('r1', 'Omelette');
    const deletedRecipe = recipe('r2', 'Dead recipe', '2026-02-01T00:00:00Z');
    const items = pickerItems(stateWith([apple, deletedFood], [], [omelette, deletedRecipe]));
    expect(items.map((i) => i.id)).to.deep.equal(['apple', 'r1']);
    expect(items.map((i) => i.kind)).to.deep.equal(['food', 'recipe']);
  });
});

describe('searchPicker', () => {
  it('finds a recipe by a fuzzy match on its name', () => {
    const omelette = recipe('r1', 'Omelette');
    const s = stateWith([food('apple', 'Apple')], [], [omelette]);
    const hits = searchPicker(s, 'omel', now);
    expect(hits.map((h) => h.food.id)).to.include('r1');
    const hit = hits.find((h) => h.food.id === 'r1')!;
    expect(hit.food.kind).to.equal('recipe');
  });

  it('ranks a recipe logged today above a food never logged, at equal match tier', () => {
    const omelette = recipe('r1', 'Omelette');
    const s = stateWith(
      [food('zebra', 'Zebra')],
      [entry('e1', 'egg', '2026-05-23T09:00:00Z', { recipeLogId: 'rl1' })],
      [omelette],
      [{ id: 'rl1', recipeId: 'r1', servings: 1 }],
    );
    const hits = searchPicker(s, '', now);
    expect(hits.map((h) => h.food.id)).to.deep.equal(['r1', 'zebra']);
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
    const hits = searchPicker(s, '', now);
    expect(hits.map((h) => h.food.id)).to.deep.equal(['r1', 'apple']);
  });

  it('excludes a soft-deleted recipe and a soft-deleted food from results', () => {
    const deletedRecipe = recipe('r1', 'Omelette', '2026-02-01T00:00:00Z');
    const deletedFood = food('dead', 'Dead food', '2026-02-01T00:00:00Z');
    const s = stateWith([food('apple', 'Apple'), deletedFood], [], [deletedRecipe]);
    const hits = searchPicker(s, '', now);
    expect(hits.map((h) => h.food.id)).to.deep.equal(['apple']);
  });

  it('ranks by match tier before recency: an exact-name food beats a merely-prefixed, recently-logged recipe', () => {
    const deluxe = recipe('r1', 'Omelette deluxe');
    const s = stateWith(
      [food('omelette-food', 'Omelette')],
      [entry('e1', 'egg', '2026-05-23T09:00:00Z', { recipeLogId: 'rl1' })],
      [deluxe],
      [{ id: 'rl1', recipeId: 'r1', servings: 1 }],
    );
    const hits = searchPicker(s, 'omelette', now);
    expect(hits[0]!.food.id).to.equal('omelette-food');
  });

  it('at equal match tier, the recipe logged today outranks the never-logged food', () => {
    const deluxe = recipe('r1', 'Omelette deluxe');
    const s = stateWith(
      [food('omelette-food', 'Omelette')],
      [entry('e1', 'egg', '2026-05-23T09:00:00Z', { recipeLogId: 'rl1' })],
      [deluxe],
      [{ id: 'rl1', recipeId: 'r1', servings: 1 }],
    );
    const hits = searchPicker(s, 'omel', now);
    expect(hits[0]!.food.id).to.equal('r1');
  });
});
