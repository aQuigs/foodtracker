import { expect } from '@esm-bundle/chai';
import { reducer } from '../../src/domain/reducer.js';
import { mealTotals, dailyTotals } from '../../src/domain/calc.js';
import { parseState } from '../../src/domain/validate.js';
import type { Entry, Food, Meal, State } from '../../src/domain/types.js';

const food: Food = {
  id: 'f1', name: 'Banana', kcalPer100g: 89, proteinPer100g: 1.1, carbsPer100g: 22.8, fatPer100g: 0.3,
  primaryUnit: 'g', weightPerUnit: 100, chips: null,
  createdAt: '2026-01-01T00:00:00Z', deletedAt: null,
};

const meal1: Meal = {
  id: 'meal-1', date: '2026-05-23', name: 'Meal 1', createdAt: '2026-05-23T08:00:00Z',
};

const meal2: Meal = {
  id: 'meal-2', date: '2026-05-23', name: 'Meal 2', createdAt: '2026-05-23T12:00:00Z',
};

const entry1: Entry = {
  id: 'e1', date: '2026-05-23', foodId: 'f1', amount: 120, unit: 'g', grams: 120,
  loggedAt: '2026-05-23T08:30:00Z', mealId: 'meal-1',
};

const entry2: Entry = {
  id: 'e2', date: '2026-05-23', foodId: 'f1', amount: 80, unit: 'g', grams: 80,
  loggedAt: '2026-05-23T12:30:00Z', mealId: 'meal-2',
};

const baseState: State = {
  version: 5,
  foods: [food],
  entries: [],
  meals: [meal1],
};

describe('v4 → v5 migration', () => {
  it('migrates entries: each entry gets mealId of date-meal-1', () => {
    const v2 = JSON.stringify({
      version: 2,
      foods: [food],
      entries: [
        { id: 'e1', date: '2026-05-23', foodId: 'f1', amount: 100, unit: 'g', grams: 100, loggedAt: '2026-05-23T08:00:00Z' },
      ],
    });
    const result = parseState(v2);
    expect(result).to.not.equal(null);
    expect(result!.entries[0]!.mealId).to.equal('2026-05-23-meal-1');
  });

  it('migrates: creates one Meal per distinct date that has entries', () => {
    const v2 = JSON.stringify({
      version: 2,
      foods: [food],
      entries: [
        { id: 'e1', date: '2026-05-23', foodId: 'f1', amount: 100, unit: 'g', grams: 100, loggedAt: '2026-05-23T08:00:00Z' },
        { id: 'e2', date: '2026-05-22', foodId: 'f1', amount: 50,  unit: 'g', grams: 50,  loggedAt: '2026-05-22T08:00:00Z' },
      ],
    });
    const result = parseState(v2);
    expect(result).to.not.equal(null);
    expect(result!.meals).to.have.lengthOf(2);
    const dates = result!.meals.map((m) => m.date).sort();
    expect(dates).to.deep.equal(['2026-05-22', '2026-05-23']);
  });

  it('migrates v2 with no entries to v5 with meals: []', () => {
    const v2 = JSON.stringify({ version: 2, foods: [food], entries: [] });
    const result = parseState(v2);
    expect(result).to.not.equal(null);
    expect(result!.version).to.equal(5);
    expect(result!.meals).to.deep.equal([]);
  });

  it('loads a valid v5 blob without modification', () => {
    const v5 = JSON.stringify({
      version: 5,
      foods: [food],
      entries: [{ ...entry1 }],
      meals: [{ ...meal1 }],
    });
    const result = parseState(v5);
    expect(result).to.not.equal(null);
    expect(result!.version).to.equal(5);
    expect(result!.meals).to.have.lengthOf(1);
    expect(result!.entries[0]!.mealId).to.equal('meal-1');
  });

  it('returns null for corrupt blob', () => {
    expect(parseState('not json')).to.equal(null);
  });

  it('returns null for wrong version', () => {
    expect(parseState(JSON.stringify({ version: 999, foods: [], entries: [], meals: [] }))).to.equal(null);
  });
});

describe('reducer — StartNextMeal', () => {
  it('adds a new meal to state', () => {
    const next = reducer(baseState, {
      type: 'StartNextMeal',
      meal: { id: 'meal-2', date: '2026-05-23', name: 'Meal 2', createdAt: '2026-05-23T12:00:00Z' },
    });
    expect(next.meals).to.have.lengthOf(2);
    expect(next.meals[1]!.name).to.equal('Meal 2');
  });

  it('is a no-op when a meal with the same id already exists', () => {
    const next = reducer(baseState, {
      type: 'StartNextMeal',
      meal: { id: 'meal-1', date: '2026-05-23', name: 'Meal 1 dup', createdAt: '2026-05-23T12:00:00Z' },
    });
    expect(next).to.equal(baseState);
  });
});

describe('reducer — LogEntry with mealId', () => {
  it('appends an entry when mealId matches a meal for the entry date', () => {
    const next = reducer(baseState, { type: 'LogEntry', entry: entry1 });
    expect(next.entries).to.have.lengthOf(1);
  });

  it('rejects an entry whose mealId has no matching meal', () => {
    const bad: Entry = { ...entry1, mealId: 'nonexistent-meal' };
    const next = reducer(baseState, { type: 'LogEntry', entry: bad });
    expect(next).to.equal(baseState);
  });

  it('rejects an entry whose mealId belongs to a different date', () => {
    const otherDateMeal: Meal = { id: 'other-meal', date: '2026-05-22', name: 'Meal 1', createdAt: '2026-05-22T08:00:00Z' };
    const s: State = { ...baseState, meals: [meal1, otherDateMeal] };
    const bad: Entry = { ...entry1, mealId: 'other-meal' };
    const next = reducer(s, { type: 'LogEntry', entry: bad });
    expect(next).to.equal(s);
  });
});

describe('calc — mealTotals', () => {
  const state: State = {
    version: 5,
    foods: [food],
    entries: [entry1, entry2],
    meals: [meal1, meal2],
  };

  it('sums kcal/macros for entries in the given meal', () => {
    const t = mealTotals(state, 'meal-1');
    expect(t.kcal).to.be.closeTo(89 * 1.2, 0.0001);
  });

  it('returns zero totals when no entries match the meal', () => {
    const t = mealTotals(state, 'nonexistent');
    expect(t).to.deep.equal({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
  });

  it('dailyTotals still sums all entries for the date across meals', () => {
    const t = dailyTotals(state, '2026-05-23');
    expect(t.kcal).to.be.closeTo(89 * 1.2 + 89 * 0.8, 0.0001);
  });
});
