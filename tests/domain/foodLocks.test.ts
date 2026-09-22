import { expect } from '@esm-bundle/chai';
import { unitLock } from '../../src/domain/foodLocks.js';
import { defaultEnabledSources } from '../../src/domain/foodSources.js';
import type { Entry, Food, Recipe, State } from '../../src/domain/types.js';

const egg: Food = {
  id: 'egg', name: 'Egg',
  nutritionFacts: { calories: 78, protein: 6.5, carbs: 0.6, fat: 5.5 },
  servingSize: 1, servingUnit: 'count',
  createdAt: '2026-01-01T00:00:00Z', deletedAt: null,
};

const drink: Food = {
  id: 'drink', name: 'Mixed berry vanilla drink',
  nutritionFacts: { calories: 169, protein: 8, carbs: 25, fat: 3 },
  servingSize: 296, servingUnit: 'ml',
  createdAt: '2026-01-01T00:00:00Z', deletedAt: null,
  pieces: { perServing: 1, noun: 'bottle' },
};

const baseState: State = {
  version: 2, enabledSources: defaultEnabledSources(),
  foods: [egg], meals: [], entries: [], recipes: [], recipeLogs: [],
};

const omelette: Recipe = {
  id: 'r1', name: 'Omelette',
  items: [{ foodId: 'egg', amount: 3, unit: 'count' }],
  createdAt: '2026-01-01T00:00:00Z', deletedAt: null,
};

const entryFor = (foodId: string, unit: Entry['unit'] = 'count'): Entry =>
  ({ id: 'e1', date: '2026-05-23', foodId, amount: 1, unit, mealId: 'm1', loggedAt: '2026-05-23T10:00:00Z' });

function withoutPieces(food: Food): Food {
  const { pieces: _pieces, ...rest } = food;
  return rest;
}

describe('unitLock', () => {
  it('is null when no entry or live recipe references the food', () => {
    expect(unitLock(baseState, egg, egg)).to.equal(null);
  });

  it('returns an entries lock, naming the stranded unit, when an edit takes it out of the food\'s compatible units', () => {
    const s: State = { ...baseState, entries: [entryFor('egg')] };
    const next: Food = { ...egg, servingSize: 100, servingUnit: 'g' };
    expect(unitLock(s, egg, next)).to.deep.equal({ kind: 'entries', unit: 'count' });
  });

  it('is null when the entry\'s unit is still compatible with the next food', () => {
    const s: State = { ...baseState, entries: [entryFor('egg')] };
    const next: Food = { ...egg, nutritionFacts: { ...egg.nutritionFacts, calories: 80 } };
    expect(unitLock(s, egg, next)).to.equal(null);
  });

  it('returns a recipe lock, naming the stranded unit, when a live recipe has a portion the edit would strand', () => {
    const s: State = { ...baseState, recipes: [omelette] };
    const next: Food = { ...egg, servingSize: 100, servingUnit: 'g' };
    expect(unitLock(s, egg, next)).to.deep.equal({ kind: 'recipe', unit: 'count', recipe: omelette });
  });

  it('prefers entries over a recipe when both reference the food', () => {
    const s: State = { ...baseState, entries: [entryFor('egg')], recipes: [omelette] };
    const next: Food = { ...egg, servingSize: 100, servingUnit: 'g' };
    expect(unitLock(s, egg, next)).to.deep.equal({ kind: 'entries', unit: 'count' });
  });

  it('is null when only a soft-deleted recipe references the food', () => {
    const deleted: Recipe = { ...omelette, deletedAt: '2026-02-01T00:00:00Z' };
    const s: State = { ...baseState, recipes: [deleted] };
    const next: Food = { ...egg, servingSize: 100, servingUnit: 'g' };
    expect(unitLock(s, egg, next)).to.equal(null);
  });

  it('is null for a food no entry or recipe references', () => {
    const salmon: Food = { ...egg, id: 'salmon', name: 'Salmon' };
    const s: State = { ...baseState, recipes: [omelette] };
    expect(unitLock(s, salmon, salmon)).to.equal(null);
  });

  it('checks every live recipe using the food, not just the first one that does', () => {
    const cookie: Food = {
      id: 'cookie', name: 'Cookie',
      nutritionFacts: { calories: 160, protein: 2, carbs: 20, fat: 8 },
      servingSize: 30, servingUnit: 'g', pieces: { perServing: 8 },
      createdAt: '2026-01-01T00:00:00Z', deletedAt: null,
    };
    // rA's portion (g) stays compatible without pieces; only rB's (count) is
    // stranded — a lock that stopped at the first recipe using the food
    // would miss it.
    const rA: Recipe = { id: 'rA', name: 'A', items: [{ foodId: 'cookie', amount: 30, unit: 'g' }], createdAt: 't', deletedAt: null };
    const rB: Recipe = { id: 'rB', name: 'B', items: [{ foodId: 'cookie', amount: 2, unit: 'count' }], createdAt: 't', deletedAt: null };
    const s: State = { ...baseState, foods: [cookie], recipes: [rA, rB] };
    expect(unitLock(s, cookie, withoutPieces(cookie))).to.deep.equal({ kind: 'recipe', unit: 'count', recipe: rB });
  });

  it('ignores a unit already stranded before this edit — e.g. an ml entry left on a count food by an import — and locks only on one newly stranded', () => {
    const s: State = { ...baseState, entries: [entryFor('egg', 'ml')] };
    const next: Food = { ...egg, nutritionFacts: { ...egg.nutritionFacts, calories: 80 } };
    expect(unitLock(s, egg, next)).to.equal(null);
  });

  it('is null when adding pieces, since that only grows the compatible set', () => {
    const s: State = { ...baseState, foods: [drink], entries: [entryFor('drink', 'ml')] };
    expect(unitLock(s, withoutPieces(drink), drink)).to.equal(null);
  });

  it('returns an entries lock, naming count, when removing pieces strands a count entry', () => {
    const s: State = { ...baseState, foods: [drink], entries: [entryFor('drink', 'count')] };
    const next: Food = withoutPieces(drink);
    expect(unitLock(s, drink, next)).to.deep.equal({ kind: 'entries', unit: 'count' });
  });

  it('is null when editing perServing while count entries exist (retroactive correction)', () => {
    const s: State = { ...baseState, foods: [drink], entries: [entryFor('drink', 'count')] };
    const next: Food = { ...drink, pieces: { perServing: 2, noun: 'bottle' } };
    expect(unitLock(s, drink, next)).to.equal(null);
  });

  it('returns a recipe lock, naming count, when removing pieces strands a recipe portion logged by count', () => {
    const recipe: Recipe = { id: 'r2', name: 'Smoothie', items: [{ foodId: 'drink', amount: 1, unit: 'count' }], createdAt: '2026-01-01T00:00:00Z', deletedAt: null };
    const s: State = { ...baseState, foods: [drink], recipes: [recipe] };
    const next: Food = withoutPieces(drink);
    expect(unitLock(s, drink, next)).to.deep.equal({ kind: 'recipe', unit: 'count', recipe });
  });
});
