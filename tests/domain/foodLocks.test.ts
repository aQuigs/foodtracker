import { expect } from '@esm-bundle/chai';
import { axisLock } from '../../src/domain/foodLocks.js';
import { defaultEnabledSources } from '../../src/domain/foodSources.js';
import type { Entry, Food, Recipe, State } from '../../src/domain/types.js';

const egg: Food = {
  id: 'egg', name: 'Egg',
  nutritionFacts: { calories: 78, protein: 6.5, carbs: 0.6, fat: 5.5 },
  servingSize: 1, servingUnit: 'count',
  createdAt: '2026-01-01T00:00:00Z', deletedAt: null,
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

const entryFor = (foodId: string): Entry =>
  ({ id: 'e1', date: '2026-05-23', foodId, amount: 1, unit: 'count', mealId: 'm1', loggedAt: '2026-05-23T10:00:00Z' });

describe('axisLock', () => {
  it('is null when no entry or live recipe references the food', () => {
    expect(axisLock(baseState, 'egg')).to.equal(null);
  });

  it('returns { kind: "entries" } when an entry references the food', () => {
    const s: State = { ...baseState, entries: [entryFor('egg')] };
    expect(axisLock(s, 'egg')).to.deep.equal({ kind: 'entries' });
  });

  it('returns { kind: "recipe", recipe } when a live recipe has a portion of the food', () => {
    const s: State = { ...baseState, recipes: [omelette] };
    expect(axisLock(s, 'egg')).to.deep.equal({ kind: 'recipe', recipe: omelette });
  });

  it('prefers entries over a recipe when both reference the food', () => {
    const s: State = { ...baseState, entries: [entryFor('egg')], recipes: [omelette] };
    expect(axisLock(s, 'egg')).to.deep.equal({ kind: 'entries' });
  });

  it('is null when only a soft-deleted recipe references the food', () => {
    const deleted: Recipe = { ...omelette, deletedAt: '2026-02-01T00:00:00Z' };
    const s: State = { ...baseState, recipes: [deleted] };
    expect(axisLock(s, 'egg')).to.equal(null);
  });

  it('is null for a food no entry or recipe references', () => {
    const s: State = { ...baseState, recipes: [omelette] };
    expect(axisLock(s, 'salmon')).to.equal(null);
  });
});
