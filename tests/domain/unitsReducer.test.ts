import { expect } from '@esm-bundle/chai';
import { reducer } from '../../src/domain/reducer.js';
import type { Food, Meal, State } from '../../src/domain/types.js';

const eggFood = (): Food => ({
  id: 'f-egg', name: 'Egg',
  kcalPer100g: 155, proteinPer100g: 13, carbsPer100g: 1.1, fatPer100g: 11,
  primaryUnit: 'count', weightPerUnit: 50,
  chips: null,
  createdAt: '2026-01-01T00:00:00Z', deletedAt: null,
});

const banana = (): Food => ({
  id: 'f-banana', name: 'Banana',
  kcalPer100g: 89, proteinPer100g: 1.1, carbsPer100g: 22.8, fatPer100g: 0.3,
  primaryUnit: 'g', weightPerUnit: 100,
  chips: null,
  createdAt: '2026-01-01T00:00:00Z', deletedAt: null,
});

const meal: Meal = {
  id: 'meal-1', date: '2026-05-23', name: 'Meal 1', createdAt: '2026-05-23T09:00:00Z',
};

describe('reducer with units', () => {
  it('AddFood accepts a valid count-based food', () => {
    const before: State = { version: 5, foods: [], entries: [], meals: [] };
    const after = reducer(before, { type: 'AddFood', food: eggFood() });
    expect(after.foods).to.have.lengthOf(1);
  });

  it('AddFood rejects weightPerUnit <= 0', () => {
    const before: State = { version: 5, foods: [], entries: [], meals: [] };
    for (const wpu of [0, -1, NaN, Infinity, -Infinity]) {
      const bad: Food = { ...eggFood(), weightPerUnit: wpu };
      const after = reducer(before, { type: 'AddFood', food: bad });
      expect(after, `wpu=${wpu}`).to.equal(before);
    }
  });

  it('EditFood updates primaryUnit and weightPerUnit', () => {
    const before: State = { version: 5, foods: [eggFood()], entries: [], meals: [] };
    const after = reducer(before, {
      type: 'EditFood', foodId: 'f-egg',
      updates: { primaryUnit: 'g', weightPerUnit: 100 },
    });
    const f = after.foods[0]!;
    expect(f.primaryUnit).to.equal('g');
    expect(f.weightPerUnit).to.equal(100);
  });

  it('EditFood rejects invalid weightPerUnit', () => {
    const before: State = { version: 5, foods: [eggFood()], entries: [], meals: [] };
    for (const wpu of [0, -5, NaN, Infinity]) {
      const after = reducer(before, {
        type: 'EditFood', foodId: 'f-egg',
        updates: { weightPerUnit: wpu },
      });
      expect(after, `wpu=${wpu}`).to.equal(before);
    }
  });

  it('LogEntry accepts entry with unit/amount/grams (all resolved by caller)', () => {
    const before: State = { version: 5, foods: [banana()], entries: [], meals: [meal] };
    const after = reducer(before, {
      type: 'LogEntry',
      entry: {
        id: 'e1', date: '2026-05-23', foodId: 'f-banana',
        amount: 120, unit: 'g', grams: 120, loggedAt: '2026-05-23T10:00Z',
        mealId: 'meal-1',
      },
    });
    expect(after.entries).to.have.lengthOf(1);
    expect(after.entries[0]!.unit).to.equal('g');
    expect(after.entries[0]!.amount).to.equal(120);
    expect(after.entries[0]!.grams).to.equal(120);
  });

  it('LogEntry accepts count-unit entry with resolved grams', () => {
    const before: State = { version: 5, foods: [eggFood()], entries: [], meals: [meal] };
    const after = reducer(before, {
      type: 'LogEntry',
      entry: {
        id: 'e1', date: '2026-05-23', foodId: 'f-egg',
        amount: 2, unit: 'count', grams: 100, loggedAt: '2026-05-23T10:00Z',
        mealId: 'meal-1',
      },
    });
    expect(after.entries).to.have.lengthOf(1);
  });

  it('LogEntry rejects entry with invalid amount (negative/NaN)', () => {
    const before: State = { version: 5, foods: [banana()], entries: [], meals: [meal] };
    for (const amount of [-1, NaN, Infinity]) {
      const after = reducer(before, {
        type: 'LogEntry',
        entry: { id: 'e1', date: '2026-05-23', foodId: 'f-banana', amount, unit: 'g', grams: 100, loggedAt: '2026-05-23T10:00Z', mealId: 'meal-1' },
      });
      expect(after, `amount=${amount}`).to.equal(before);
    }
  });
});
