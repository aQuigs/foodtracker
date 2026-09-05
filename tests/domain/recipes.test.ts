import { expect } from '@esm-bundle/chai';
import { liveRecipes, liveRecipeUsing, recipeNutrition } from '../../src/domain/recipes.js';
import { reducer } from '../../src/domain/reducer.js';
import { defaultEnabledSources } from '../../src/domain/foodSources.js';
import type { Entry, EntryDraft, Food, Recipe, RecipeLog, State } from '../../src/domain/types.js';

const egg: Food = {
  id: 'egg', name: 'Egg',
  nutritionFacts: { calories: 78, protein: 6.5, carbs: 0.6, fat: 5.5 },
  servingSize: 1, servingUnit: 'count',
  createdAt: '2026-01-01T00:00:00Z', deletedAt: null,
};

const ham: Food = {
  id: 'ham', name: 'Ham',
  nutritionFacts: { calories: 46, protein: 5.5, carbs: 1.5, fat: 1.4 },
  servingSize: 28, servingUnit: 'g',
  createdAt: '2026-01-01T00:00:00Z', deletedAt: null,
};

const foodsById = new Map<string, Food>([['egg', egg], ['ham', ham]]);

const omelette: Recipe = {
  id: 'r1', name: 'Omelette',
  items: [
    { foodId: 'egg', amount: 3, unit: 'count' },
    { foodId: 'ham', amount: 56, unit: 'g' },
  ],
  createdAt: '2026-01-01T00:00:00Z', deletedAt: null,
};

describe('liveRecipes', () => {
  it('keeps only recipes with a null deletedAt', () => {
    const deleted: Recipe = { ...omelette, id: 'r2', deletedAt: '2026-02-01T00:00:00Z' };
    expect(liveRecipes([omelette, deleted])).to.deep.equal([omelette]);
  });

  it('returns [] for an empty list', () => {
    expect(liveRecipes([])).to.deep.equal([]);
  });
});

describe('recipeNutrition', () => {
  it('sums scaled nutrition across every item', () => {
    const n = recipeNutrition(omelette, foodsById);
    expect(n.calories).to.be.closeTo(78 * 3 + 46 * 2, 0.0001);
    expect(n.protein).to.be.closeTo(6.5 * 3 + 5.5 * 2, 0.0001);
    expect(n.carbs).to.be.closeTo(0.6 * 3 + 1.5 * 2, 0.0001);
    expect(n.fat).to.be.closeTo(5.5 * 3 + 1.4 * 2, 0.0001);
  });

  it('contributes nothing for an item whose food is missing from the map', () => {
    const recipe: Recipe = { ...omelette, items: [{ foodId: 'missing', amount: 1, unit: 'count' }] };
    expect(recipeNutrition(recipe, foodsById)).to.deep.equal({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  });

  it('contributes nothing for an item whose servings cannot be computed', () => {
    const zeroServing: Food = { ...ham, id: 'ham0', servingSize: 0 };
    const map = new Map(foodsById).set('ham0', zeroServing);
    const recipe: Recipe = { ...omelette, items: [{ foodId: 'ham0', amount: 10, unit: 'g' }] };
    expect(recipeNutrition(recipe, map)).to.deep.equal({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  });

  it('contributes nothing for an item whose food is soft-deleted', () => {
    const deadHam: Food = { ...ham, deletedAt: '2026-02-01T00:00:00Z' };
    const map = new Map(foodsById).set('ham', deadHam);
    const n = recipeNutrition(omelette, map);
    expect(n.calories).to.be.closeTo(78 * 3, 0.0001);
    expect(n.protein).to.be.closeTo(6.5 * 3, 0.0001);
  });
});

describe('liveRecipeUsing', () => {
  it('returns the first live recipe with an item for the food', () => {
    const other: Recipe = { id: 'r2', name: 'Scramble', items: [{ foodId: 'egg', amount: 2, unit: 'count' }], createdAt: '2026-01-01T00:00:00Z', deletedAt: null };
    expect(liveRecipeUsing([omelette, other], 'egg')).to.deep.equal(omelette);
  });

  it('ignores a deleted recipe that uses the food', () => {
    const deleted: Recipe = { ...omelette, id: 'r2', deletedAt: '2026-02-01T00:00:00Z' };
    expect(liveRecipeUsing([deleted], 'egg')).to.equal(null);
  });

  it('returns null when no live recipe uses the food', () => {
    expect(liveRecipeUsing([omelette], 'salmon')).to.equal(null);
  });
});

const SEED_AT = '2026-01-01T00:00:00Z';

const reducerCheddar: Food = {
  id: 'cheddar', name: 'Cheddar',
  nutritionFacts: { calories: 113, protein: 7, carbs: 0.4, fat: 9.3 },
  servingSize: 28, servingUnit: 'g',
  createdAt: SEED_AT, deletedAt: null,
};

const baseState: State = {
  version: 2, enabledSources: defaultEnabledSources(),
  foods: [egg, ham, reducerCheddar],
  meals: [], entries: [], recipes: [], recipeLogs: [],
};

describe('reducer — AddRecipe', () => {
  it('adds a valid recipe', () => {
    const next = reducer(baseState, { type: 'AddRecipe', recipe: omelette });
    expect(next.recipes).to.deep.equal([omelette]);
  });

  it('does not mutate the input state', () => {
    reducer(baseState, { type: 'AddRecipe', recipe: omelette });
    expect(baseState.recipes).to.deep.equal([]);
  });

  it('refuses an empty name', () => {
    const bad = { ...omelette, name: '' };
    expect(reducer(baseState, { type: 'AddRecipe', recipe: bad })).to.equal(baseState);
  });

  it('refuses an empty id', () => {
    const bad = { ...omelette, id: '' };
    expect(reducer(baseState, { type: 'AddRecipe', recipe: bad })).to.equal(baseState);
  });

  it('refuses a name a live recipe already uses, case-insensitively', () => {
    const withOmelette: State = { ...baseState, recipes: [omelette] };
    const dup: Recipe = { ...omelette, id: 'r2', name: 'OMELETTE' };
    expect(reducer(withOmelette, { type: 'AddRecipe', recipe: dup })).to.equal(withOmelette);
  });

  it('allows a name only a soft-deleted recipe used', () => {
    const deleted: Recipe = { ...omelette, deletedAt: SEED_AT };
    const withDeleted: State = { ...baseState, recipes: [deleted] };
    const fresh: Recipe = { ...omelette, id: 'r2' };
    const next = reducer(withDeleted, { type: 'AddRecipe', recipe: fresh });
    expect(next.recipes.map((r) => r.id)).to.deep.equal(['r1', 'r2']);
  });

  it('refuses zero items', () => {
    const bad: Recipe = { ...omelette, items: [] };
    expect(reducer(baseState, { type: 'AddRecipe', recipe: bad })).to.equal(baseState);
  });

  it('refuses a duplicate food across items', () => {
    const bad: Recipe = { ...omelette, items: [...omelette.items, { foodId: 'egg', amount: 1, unit: 'count' }] };
    expect(reducer(baseState, { type: 'AddRecipe', recipe: bad })).to.equal(baseState);
  });

  it('refuses an item referencing a soft-deleted food', () => {
    const deletedHam: Food = { ...ham, deletedAt: SEED_AT };
    const s: State = { ...baseState, foods: [egg, deletedHam, reducerCheddar] };
    expect(reducer(s, { type: 'AddRecipe', recipe: omelette })).to.equal(s);
  });

  it('refuses an item referencing a missing food', () => {
    const bad: Recipe = { ...omelette, items: [{ foodId: 'missing', amount: 1, unit: 'g' }] };
    expect(reducer(baseState, { type: 'AddRecipe', recipe: bad })).to.equal(baseState);
  });

  it('refuses a non-positive or non-finite amount', () => {
    for (const amount of [0, -1, NaN, Infinity]) {
      const bad: Recipe = { ...omelette, items: [{ foodId: 'egg', amount, unit: 'count' }] };
      expect(reducer(baseState, { type: 'AddRecipe', recipe: bad }), String(amount)).to.equal(baseState);
    }
  });

  it('refuses an incompatible unit', () => {
    const bad: Recipe = { ...omelette, items: [{ foodId: 'egg', amount: 3, unit: 'g' }] };
    expect(reducer(baseState, { type: 'AddRecipe', recipe: bad })).to.equal(baseState);
  });

  it('is a no-op on a duplicate live recipe id', () => {
    const s: State = { ...baseState, recipes: [omelette] };
    const dup: Recipe = { ...omelette, name: 'Something else' };
    expect(reducer(s, { type: 'AddRecipe', recipe: dup })).to.equal(s);
  });

  it('refuses an id matching a soft-deleted recipe (locked behavior, as for foods)', () => {
    const deleted: Recipe = { ...omelette, deletedAt: SEED_AT };
    const s: State = { ...baseState, recipes: [deleted] };
    const dup: Recipe = { ...omelette, name: 'Different name' };
    expect(reducer(s, { type: 'AddRecipe', recipe: dup })).to.equal(s);
  });
});

describe('reducer — EditRecipe', () => {
  const withOmelette: State = { ...baseState, recipes: [omelette] };

  it('renames the recipe', () => {
    const next = reducer(withOmelette, { type: 'EditRecipe', recipeId: 'r1', updates: { name: 'Frittata' } });
    expect(next.recipes[0]!.name).to.equal('Frittata');
  });

  it('allows keeping its own name while changing items', () => {
    const next = reducer(withOmelette, {
      type: 'EditRecipe', recipeId: 'r1',
      updates: { name: 'Omelette', items: [{ foodId: 'egg', amount: 4, unit: 'count' }] },
    });
    expect(next.recipes[0]!.items).to.deep.equal([{ foodId: 'egg', amount: 4, unit: 'count' }]);
  });

  it('refuses renaming onto another live recipe\'s name, case-insensitively', () => {
    const scramble: Recipe = { id: 'r2', name: 'Scramble', items: [{ foodId: 'egg', amount: 2, unit: 'count' }], createdAt: SEED_AT, deletedAt: null };
    const s: State = { ...baseState, recipes: [omelette, scramble] };
    const next = reducer(s, { type: 'EditRecipe', recipeId: 'r2', updates: { name: 'OMELETTE' } });
    expect(next).to.equal(s);
  });

  it('replaces items under the same validity rules', () => {
    const next = reducer(withOmelette, {
      type: 'EditRecipe', recipeId: 'r1',
      updates: { items: [{ foodId: 'cheddar', amount: 28, unit: 'g' }] },
    });
    expect(next.recipes[0]!.items).to.deep.equal([{ foodId: 'cheddar', amount: 28, unit: 'g' }]);
  });

  it('refuses items referencing a soft-deleted food', () => {
    const deadCheddar: Food = { ...reducerCheddar, deletedAt: SEED_AT };
    const s: State = { ...baseState, foods: [egg, ham, deadCheddar], recipes: [omelette] };
    const next = reducer(s, {
      type: 'EditRecipe', recipeId: 'r1',
      updates: { items: [{ foodId: 'cheddar', amount: 10, unit: 'g' }] },
    });
    expect(next).to.equal(s);
  });

  it('refuses an edit that leaves zero items', () => {
    const next = reducer(withOmelette, { type: 'EditRecipe', recipeId: 'r1', updates: { items: [] } });
    expect(next).to.equal(withOmelette);
  });

  it('refuses empty updates ({})', () => {
    const next = reducer(withOmelette, { type: 'EditRecipe', recipeId: 'r1', updates: {} });
    expect(next).to.equal(withOmelette);
  });

  it('refuses editing a soft-deleted recipe', () => {
    const deleted: Recipe = { ...omelette, deletedAt: SEED_AT };
    const s: State = { ...baseState, recipes: [deleted] };
    const next = reducer(s, { type: 'EditRecipe', recipeId: 'r1', updates: { name: 'Frittata' } });
    expect(next).to.equal(s);
  });

  it('refuses an unknown id', () => {
    const next = reducer(withOmelette, { type: 'EditRecipe', recipeId: 'nope', updates: { name: 'x' } });
    expect(next).to.equal(withOmelette);
  });

  it('renaming a recipe frees its old name for a new recipe', () => {
    const renamed = reducer(withOmelette, { type: 'EditRecipe', recipeId: 'r1', updates: { name: 'Frittata' } });
    const reAdded = reducer(renamed, { type: 'AddRecipe', recipe: { ...omelette, id: 'r2' } });
    expect(reAdded.recipes.map((r) => r.name)).to.deep.equal(['Frittata', 'Omelette']);
  });
});

describe('reducer — SoftDeleteRecipe', () => {
  it('sets deletedAt on a live recipe', () => {
    const s: State = { ...baseState, recipes: [omelette] };
    const next = reducer(s, { type: 'SoftDeleteRecipe', recipeId: 'r1', deletedAt: SEED_AT });
    expect(next.recipes[0]!.deletedAt).to.equal(SEED_AT);
  });

  it('is a no-op on an unknown id', () => {
    const s: State = { ...baseState, recipes: [omelette] };
    expect(reducer(s, { type: 'SoftDeleteRecipe', recipeId: 'nope', deletedAt: SEED_AT })).to.equal(s);
  });

  it('is a no-op when already deleted', () => {
    const deleted: Recipe = { ...omelette, deletedAt: SEED_AT };
    const s: State = { ...baseState, recipes: [deleted] };
    expect(reducer(s, { type: 'SoftDeleteRecipe', recipeId: 'r1', deletedAt: '2026-02-01T00:00:00Z' })).to.equal(s);
  });
});

describe('reducer — LogRecipe', () => {
  const withOmelette: State = { ...baseState, recipes: [omelette] };

  const draftEntries = (date = '2026-05-23'): EntryDraft[] => [
    { id: 'e1', date, foodId: 'egg', amount: 6, unit: 'count', loggedAt: `${date}T10:00:00Z` },
    { id: 'e2', date, foodId: 'ham', amount: 112, unit: 'g', loggedAt: `${date}T10:00:00Z` },
  ];

  const LOG_RECIPE = (overrides: Partial<{ recipeLog: RecipeLog; entries: EntryDraft[]; newMealId: string }> = {}) => ({
    type: 'LogRecipe' as const,
    recipeLog: { id: 'rl1', recipeId: 'r1', servings: 2 },
    entries: draftEntries(),
    newMealId: 'm-new',
    ...overrides,
  });

  it('writes one entry per draft with recipeLogId and the latest meal id, creating Meal 1 on a fresh day', () => {
    const next = reducer(withOmelette, LOG_RECIPE());
    expect(next.meals).to.deep.equal([{ id: 'm-new', date: '2026-05-23', position: 0 }]);
    expect(next.entries).to.have.lengthOf(2);
    expect(next.entries.every((e) => e.mealId === 'm-new' && e.recipeLogId === 'rl1')).to.equal(true);
    expect(next.recipeLogs).to.deep.equal([{ id: 'rl1', recipeId: 'r1', servings: 2 }]);
  });

  it('appends to the existing latest meal on a day that already has one', () => {
    const meal = { id: 'm1', date: '2026-05-23', position: 0 };
    const priorEntry: Entry = { id: 'e0', date: '2026-05-23', foodId: 'cheddar', amount: 10, unit: 'g', mealId: 'm1', loggedAt: '2026-05-23T09:00:00Z' };
    const s: State = { ...withOmelette, meals: [meal], entries: [priorEntry] };
    const next = reducer(s, LOG_RECIPE());
    expect(next.meals).to.deep.equal([meal]);
    expect(next.entries.filter((e) => e.recipeLogId === 'rl1').every((e) => e.mealId === 'm1')).to.equal(true);
  });

  it('lands in the later of two existing meals on the same day', () => {
    const meal1 = { id: 'm1', date: '2026-05-23', position: 0 };
    const meal2 = { id: 'm2', date: '2026-05-23', position: 1 };
    const s: State = { ...withOmelette, meals: [meal1, meal2] };
    const next = reducer(s, LOG_RECIPE());
    expect(next.meals).to.deep.equal([meal1, meal2]);
    expect(next.entries.every((e) => e.mealId === 'm2')).to.equal(true);
  });

  it('refuses when the recipe is missing', () => {
    expect(reducer(baseState, LOG_RECIPE())).to.equal(baseState);
  });

  it('refuses when the recipe is soft-deleted', () => {
    const deleted: Recipe = { ...omelette, deletedAt: SEED_AT };
    const s: State = { ...baseState, recipes: [deleted] };
    expect(reducer(s, LOG_RECIPE())).to.equal(s);
  });

  it('refuses a used recipeLog id', () => {
    const s: State = { ...withOmelette, recipeLogs: [{ id: 'rl1', recipeId: 'r1', servings: 1 }] };
    expect(reducer(s, LOG_RECIPE())).to.equal(s);
  });

  it('refuses an empty recipeLog id', () => {
    const next = reducer(withOmelette, LOG_RECIPE({ recipeLog: { id: '', recipeId: 'r1', servings: 2 } }));
    expect(next).to.equal(withOmelette);
  });

  it('refuses non-positive or non-finite servings', () => {
    for (const servings of [0, -1, NaN, Infinity]) {
      const next = reducer(withOmelette, LOG_RECIPE({ recipeLog: { id: 'rl1', recipeId: 'r1', servings } }));
      expect(next, String(servings)).to.equal(withOmelette);
    }
  });

  it('refuses zero entries', () => {
    expect(reducer(withOmelette, LOG_RECIPE({ entries: [] }))).to.equal(withOmelette);
  });

  it('refuses when an entry id collides with an existing entry', () => {
    const existing: Entry = { id: 'e1', date: '2026-05-23', foodId: 'cheddar', amount: 1, unit: 'g', mealId: 'm1', loggedAt: '2026-05-23T09:00:00Z' };
    const s: State = { ...withOmelette, meals: [{ id: 'm1', date: '2026-05-23', position: 0 }], entries: [existing] };
    expect(reducer(s, LOG_RECIPE())).to.equal(s);
  });

  it('refuses when two draft entries share an id', () => {
    const entries = [draftEntries()[0]!, { ...draftEntries()[1]!, id: 'e1' }];
    expect(reducer(withOmelette, LOG_RECIPE({ entries }))).to.equal(withOmelette);
  });

  it('refuses an entry referencing a non-live food', () => {
    const deletedHam: Food = { ...ham, deletedAt: SEED_AT };
    const s: State = { ...withOmelette, foods: [egg, deletedHam, reducerCheddar] };
    expect(reducer(s, LOG_RECIPE())).to.equal(s);
  });

  it('refuses entries with mismatched dates', () => {
    const entries = [draftEntries('2026-05-23')[0]!, draftEntries('2026-05-24')[1]!];
    expect(reducer(withOmelette, LOG_RECIPE({ entries }))).to.equal(withOmelette);
  });

  it('refuses when the auto-created mealId collides with an existing meal id on another date', () => {
    const s: State = { ...withOmelette, meals: [{ id: 'm-new', date: '2026-05-22', position: 0 }] };
    expect(reducer(s, LOG_RECIPE())).to.equal(s);
  });

  it('refuses a non-positive entry amount', () => {
    const entries = [{ ...draftEntries()[0]!, amount: 0 }, draftEntries()[1]!];
    expect(reducer(withOmelette, LOG_RECIPE({ entries }))).to.equal(withOmelette);
  });

  it('refuses an entry for a food the recipe does not contain', () => {
    const entries = [draftEntries()[0]!, { id: 'e3', date: '2026-05-23', foodId: 'cheddar', amount: 28, unit: 'g' as const, loggedAt: '2026-05-23T10:00:00Z' }];
    expect(reducer(withOmelette, LOG_RECIPE({ entries }))).to.equal(withOmelette);
  });

  it('does not mutate the input state', () => {
    reducer(withOmelette, LOG_RECIPE());
    expect(withOmelette.entries).to.deep.equal([]);
    expect(withOmelette.recipeLogs).to.deep.equal([]);
  });
});

describe('reducer — DeleteRecipeLog', () => {
  const withOmelette: State = { ...baseState, recipes: [omelette] };
  const LOG_RECIPE = {
    type: 'LogRecipe' as const,
    recipeLog: { id: 'rl1', recipeId: 'r1', servings: 2 },
    entries: [
      { id: 'e1', date: '2026-05-23', foodId: 'egg', amount: 6, unit: 'count' as const, loggedAt: '2026-05-23T10:00:00Z' },
      { id: 'e2', date: '2026-05-23', foodId: 'ham', amount: 112, unit: 'g' as const, loggedAt: '2026-05-23T10:00:00Z' },
    ],
    newMealId: 'm-new',
  };

  const loggedOmeletteState = (): State => reducer(withOmelette, LOG_RECIPE);

  it('removes the record and every entry carrying it', () => {
    const logged = loggedOmeletteState();
    const next = reducer(logged, { type: 'DeleteRecipeLog', recipeLogId: 'rl1' });
    expect(next.entries).to.have.lengthOf(0);
    expect(next.recipeLogs).to.have.lengthOf(0);
  });

  it('leaves an empty latest meal', () => {
    const logged = loggedOmeletteState();
    const next = reducer(logged, { type: 'DeleteRecipeLog', recipeLogId: 'rl1' });
    expect(next.meals).to.deep.equal(logged.meals);
  });

  it('GCs an empty non-latest meal and renumbers', () => {
    const logged = loggedOmeletteState();
    const meal2 = { id: 'm2', date: '2026-05-23', position: 1 };
    const other: Entry = { id: 'e-other', date: '2026-05-23', foodId: 'cheddar', amount: 1, unit: 'g', mealId: 'm2', loggedAt: '2026-05-23T11:00:00Z' };
    const s: State = { ...logged, meals: [...logged.meals, meal2], entries: [...logged.entries, other] };
    const next = reducer(s, { type: 'DeleteRecipeLog', recipeLogId: 'rl1' });
    expect(next.meals.map((m) => m.id)).to.deep.equal(['m2']);
    expect(next.meals[0]!.position).to.equal(0);
  });

  it('does not disturb a sibling entry in the same meal outside the group', () => {
    const logged = loggedOmeletteState();
    const other: Entry = { id: 'e-other', date: '2026-05-23', foodId: 'cheddar', amount: 1, unit: 'g', mealId: 'm-new', loggedAt: '2026-05-23T11:00:00Z' };
    const s: State = { ...logged, entries: [...logged.entries, other] };
    const next = reducer(s, { type: 'DeleteRecipeLog', recipeLogId: 'rl1' });
    expect(next.entries).to.deep.equal([other]);
    expect(next.meals).to.deep.equal(logged.meals);
  });

  it('is a no-op on an unknown id', () => {
    const logged = loggedOmeletteState();
    expect(reducer(logged, { type: 'DeleteRecipeLog', recipeLogId: 'nope' })).to.equal(logged);
  });
});

describe('reducer — DeleteEntry with a recipeLogId', () => {
  const withOmelette: State = { ...baseState, recipes: [omelette] };
  const LOG_RECIPE = {
    type: 'LogRecipe' as const,
    recipeLog: { id: 'rl1', recipeId: 'r1', servings: 2 },
    entries: [
      { id: 'e1', date: '2026-05-23', foodId: 'egg', amount: 6, unit: 'count' as const, loggedAt: '2026-05-23T10:00:00Z' },
      { id: 'e2', date: '2026-05-23', foodId: 'ham', amount: 112, unit: 'g' as const, loggedAt: '2026-05-23T10:00:00Z' },
    ],
    newMealId: 'm-new',
  };

  const loggedOmeletteState = (): State => reducer(withOmelette, LOG_RECIPE);

  it('keeps the recipeLog while a sibling entry remains', () => {
    const logged = loggedOmeletteState();
    const next = reducer(logged, { type: 'DeleteEntry', entryId: 'e1' });
    expect(next.recipeLogs).to.deep.equal(logged.recipeLogs);
    expect(next.entries).to.have.lengthOf(1);
  });

  it('drops the recipeLog after the last entry in the group goes', () => {
    const logged = loggedOmeletteState();
    const afterFirst = reducer(logged, { type: 'DeleteEntry', entryId: 'e1' });
    const afterSecond = reducer(afterFirst, { type: 'DeleteEntry', entryId: 'e2' });
    expect(afterSecond.recipeLogs).to.have.lengthOf(0);
  });

  it('does not touch recipeLogs when the deleted entry carried none', () => {
    const meal = { id: 'm1', date: '2026-05-23', position: 0 };
    const plain: Entry = { id: 'e-plain', date: '2026-05-23', foodId: 'cheddar', amount: 1, unit: 'g', mealId: 'm1', loggedAt: '2026-05-23T09:00:00Z' };
    const s: State = { ...baseState, meals: [meal], entries: [plain] };
    const next = reducer(s, { type: 'DeleteEntry', entryId: 'e-plain' });
    expect(next.recipeLogs).to.deep.equal([]);
  });
});

describe('reducer — SoftDeleteFood with live recipes', () => {
  it('refuses deleting a food a live recipe uses', () => {
    const s: State = { ...baseState, recipes: [omelette] };
    const next = reducer(s, { type: 'SoftDeleteFood', foodId: 'egg', deletedAt: SEED_AT });
    expect(next).to.equal(s);
  });

  it('allows deleting a food only a soft-deleted recipe used', () => {
    const deleted: Recipe = { ...omelette, deletedAt: SEED_AT };
    const s: State = { ...baseState, recipes: [deleted] };
    const next = reducer(s, { type: 'SoftDeleteFood', foodId: 'egg', deletedAt: '2026-02-01T00:00:00Z' });
    expect(next.foods.find((f) => f.id === 'egg')!.deletedAt).to.equal('2026-02-01T00:00:00Z');
  });
});

describe('reducer — EditFood axis guard with live recipes', () => {
  it('refuses an axis change while a live recipe item uses the food', () => {
    const s: State = { ...baseState, recipes: [omelette] };
    const next = reducer(s, { type: 'EditFood', foodId: 'egg', updates: { servingUnit: 'g', servingSize: 50 } });
    expect(next).to.equal(s);
  });

  it('allows an axis change once only a soft-deleted recipe used the food', () => {
    const deleted: Recipe = { ...omelette, deletedAt: SEED_AT };
    const s: State = { ...baseState, recipes: [deleted] };
    const next = reducer(s, { type: 'EditFood', foodId: 'egg', updates: { servingUnit: 'g', servingSize: 50 } });
    expect(next.foods.find((f) => f.id === 'egg')!.servingUnit).to.equal('g');
  });
});

describe('reducer — ReviveFood axis guard with live recipes', () => {
  it('refuses an axis-changing revive when a live recipe item uses the food', () => {
    const deadEgg: Food = { ...egg, deletedAt: SEED_AT };
    const s: State = { ...baseState, foods: [deadEgg, ham, reducerCheddar], recipes: [omelette] };
    const revived: Food = { ...egg, servingUnit: 'g', servingSize: 50 };
    expect(reducer(s, { type: 'ReviveFood', food: revived })).to.equal(s);
  });

  it('allows a same-axis revive when a live recipe item uses the food', () => {
    const deadEgg: Food = { ...egg, deletedAt: SEED_AT };
    const s: State = { ...baseState, foods: [deadEgg, ham, reducerCheddar], recipes: [omelette] };
    const revived: Food = { ...egg, servingSize: 2 };
    const next = reducer(s, { type: 'ReviveFood', food: revived });
    expect(next.foods.find((f) => f.id === 'egg')!.servingSize).to.equal(2);
  });
});
