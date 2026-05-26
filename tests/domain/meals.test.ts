import { expect } from '@esm-bundle/chai';
import { reducer } from '../../src/domain/reducer.js';
import { mealTotals, mealsForDate, mealLabel } from '../../src/domain/meals.js';
import type { Entry, Food, Meal, State } from '../../src/domain/types.js';

const food: Food = {
  id: 'f1', name: 'Banana',
  nutritionFacts: { calories: 89, protein: 1.1, carbs: 22.8, fat: 0.3 },
  servingSize: 100, servingUnit: 'g',
  createdAt: '2026-01-01T00:00:00Z', deletedAt: null,
};

const oats: Food = {
  id: 'f2', name: 'Oats',
  nutritionFacts: { calories: 379, protein: 13.2, carbs: 67.7, fat: 6.5 },
  servingSize: 100, servingUnit: 'g',
  createdAt: '2026-01-01T00:00:00Z', deletedAt: null,
};

const empty: State = { version: 2, foods: [food, oats], meals: [], entries: [] };

const entry = (overrides: Partial<Entry> = {}): Entry => ({
  id: 'e1', date: '2026-05-23', foodId: 'f1', amount: 100, unit: 'g',
  mealId: 'm1', loggedAt: '2026-05-23T10:00:00Z',
  ...overrides,
});

describe('reducer — LogEntry with meals', () => {
  it('creates Meal at position 0 when none exist for the date, and assigns the entry to it', () => {
    const e = entry({ mealId: '' });
    const next = reducer(empty, { type: 'LogEntry', entry: e, newMealId: 'm-new' });
    expect(next.meals).to.have.lengthOf(1);
    expect(next.meals[0]).to.deep.equal({ id: 'm-new', date: '2026-05-23', position: 0 });
    expect(next.entries).to.have.lengthOf(1);
    expect(next.entries[0]!.mealId).to.equal('m-new');
  });

  it('assigns to the latest existing meal on that date (highest position) when one exists', () => {
    const meals: Meal[] = [
      { id: 'm1', date: '2026-05-23', position: 0 },
      { id: 'm2', date: '2026-05-23', position: 1 },
    ];
    const s: State = { ...empty, meals };
    const e = entry({ mealId: '' });
    const next = reducer(s, { type: 'LogEntry', entry: e, newMealId: 'unused' });
    expect(next.meals).to.have.lengthOf(2);
    expect(next.entries[0]!.mealId).to.equal('m2');
  });

  it('rejects entry when newMealId would clash with an existing meal id on a different date', () => {
    const meals: Meal[] = [{ id: 'm1', date: '2026-05-22', position: 0 }];
    const s: State = { ...empty, meals };
    const e = entry({ date: '2026-05-23', mealId: '' });
    const next = reducer(s, { type: 'LogEntry', entry: e, newMealId: 'm1' });
    expect(next).to.equal(s);
  });

  it('does not create a meal if the entry itself is invalid', () => {
    const e = entry({ foodId: 'missing', mealId: '' });
    const next = reducer(empty, { type: 'LogEntry', entry: e, newMealId: 'm-new' });
    expect(next).to.equal(empty);
  });

  it('isolates meals per date — logging on a new date creates a fresh Meal at position 0', () => {
    const meals: Meal[] = [{ id: 'm1', date: '2026-05-22', position: 0 }];
    const s: State = { ...empty, meals };
    const e = entry({ date: '2026-05-23', mealId: '' });
    const next = reducer(s, { type: 'LogEntry', entry: e, newMealId: 'm-new' });
    expect(next.meals.filter((m) => m.date === '2026-05-23')).to.have.lengthOf(1);
    expect(next.meals.find((m) => m.date === '2026-05-23')!.position).to.equal(0);
  });
});

describe('reducer — NewMeal', () => {
  it('appends a Meal at position 0 when no meals exist on that date', () => {
    const next = reducer(empty, { type: 'NewMeal', mealId: 'm-new', date: '2026-05-23' });
    expect(next.meals).to.have.lengthOf(1);
    expect(next.meals[0]).to.deep.equal({ id: 'm-new', date: '2026-05-23', position: 0 });
  });

  it('appends a Meal at max(position)+1 on a date with existing meals', () => {
    const meals: Meal[] = [
      { id: 'm1', date: '2026-05-23', position: 0 },
      { id: 'm2', date: '2026-05-23', position: 1 },
    ];
    const s: State = { ...empty, meals };
    const next = reducer(s, { type: 'NewMeal', mealId: 'm3', date: '2026-05-23' });
    const created = next.meals.find((m) => m.id === 'm3');
    expect(created!.position).to.equal(2);
  });

  it('does not affect other dates', () => {
    const meals: Meal[] = [{ id: 'm1', date: '2026-05-22', position: 0 }];
    const s: State = { ...empty, meals };
    const next = reducer(s, { type: 'NewMeal', mealId: 'm-new', date: '2026-05-23' });
    expect(next.meals.find((m) => m.date === '2026-05-23')!.position).to.equal(0);
    expect(next.meals.find((m) => m.date === '2026-05-22')!.position).to.equal(0);
  });

  it('rejects when mealId clashes with an existing id', () => {
    const meals: Meal[] = [{ id: 'm1', date: '2026-05-23', position: 0 }];
    const s: State = { ...empty, meals };
    const next = reducer(s, { type: 'NewMeal', mealId: 'm1', date: '2026-05-23' });
    expect(next).to.equal(s);
  });
});

describe('reducer — DeleteEntry garbage-collects empty non-latest meals', () => {
  it('keeps the latest meal even if it becomes empty', () => {
    const meals: Meal[] = [{ id: 'm1', date: '2026-05-23', position: 0 }];
    const s: State = { ...empty, meals, entries: [entry({ mealId: 'm1' })] };
    const next = reducer(s, { type: 'DeleteEntry', entryId: 'e1' });
    expect(next.entries).to.have.lengthOf(0);
    expect(next.meals).to.deep.equal(meals);
  });

  it('deletes the meal when a non-latest meal becomes empty', () => {
    const meals: Meal[] = [
      { id: 'm1', date: '2026-05-23', position: 0 },
      { id: 'm2', date: '2026-05-23', position: 1 },
    ];
    const s: State = {
      ...empty, meals,
      entries: [
        entry({ id: 'e1', mealId: 'm1' }),
        entry({ id: 'e2', mealId: 'm2', foodId: 'f2' }),
      ],
    };
    const next = reducer(s, { type: 'DeleteEntry', entryId: 'e1' });
    expect(next.meals.map((m) => m.id)).to.deep.equal(['m2']);
  });

  it('renumbers remaining meals to contiguous positions starting at 0 after deletion', () => {
    const meals: Meal[] = [
      { id: 'm1', date: '2026-05-23', position: 0 },
      { id: 'm2', date: '2026-05-23', position: 1 },
      { id: 'm3', date: '2026-05-23', position: 2 },
    ];
    const s: State = {
      ...empty, meals,
      entries: [
        entry({ id: 'e1', mealId: 'm1' }),
        entry({ id: 'e2', mealId: 'm2', foodId: 'f2' }),
        entry({ id: 'e3', mealId: 'm3' }),
      ],
    };
    const next = reducer(s, { type: 'DeleteEntry', entryId: 'e2' });
    const remaining = next.meals.filter((m) => m.date === '2026-05-23').sort((a, b) => a.position - b.position);
    expect(remaining.map((m) => m.id)).to.deep.equal(['m1', 'm3']);
    expect(remaining.map((m) => m.position)).to.deep.equal([0, 1]);
  });

  it('does not delete a non-latest meal if it still has other entries', () => {
    const meals: Meal[] = [
      { id: 'm1', date: '2026-05-23', position: 0 },
      { id: 'm2', date: '2026-05-23', position: 1 },
    ];
    const s: State = {
      ...empty, meals,
      entries: [
        entry({ id: 'e1', mealId: 'm1' }),
        entry({ id: 'e1b', mealId: 'm1', foodId: 'f2' }),
        entry({ id: 'e2', mealId: 'm2' }),
      ],
    };
    const next = reducer(s, { type: 'DeleteEntry', entryId: 'e1' });
    expect(next.meals).to.deep.equal(meals);
  });
});

describe('mealsForDate', () => {
  it('returns meals for the date sorted by position ascending', () => {
    const meals: Meal[] = [
      { id: 'm2', date: '2026-05-23', position: 1 },
      { id: 'm1', date: '2026-05-23', position: 0 },
      { id: 'mX', date: '2026-05-22', position: 0 },
    ];
    const s: State = { ...empty, meals };
    const got = mealsForDate(s, '2026-05-23');
    expect(got.map((m) => m.id)).to.deep.equal(['m1', 'm2']);
  });

  it('returns [] when no meals exist for the date', () => {
    expect(mealsForDate(empty, '2026-05-23')).to.deep.equal([]);
  });
});

describe('mealLabel', () => {
  it('formats as "Meal {1-based index}"', () => {
    const meals: Meal[] = [
      { id: 'm1', date: '2026-05-23', position: 0 },
      { id: 'm2', date: '2026-05-23', position: 5 }, // non-contiguous gap should still label 2
    ];
    const s: State = { ...empty, meals };
    expect(mealLabel(s, 'm1')).to.equal('Meal 1');
    expect(mealLabel(s, 'm2')).to.equal('Meal 2');
  });

  it('returns empty string for an unknown id', () => {
    expect(mealLabel(empty, 'no-such')).to.equal('');
  });
});

describe('mealTotals', () => {
  const meals: Meal[] = [
    { id: 'm1', date: '2026-05-23', position: 0 },
    { id: 'm2', date: '2026-05-23', position: 1 },
  ];
  const state: State = {
    ...empty, meals,
    entries: [
      entry({ id: 'e1', mealId: 'm1', amount: 100 }),         // banana 100g → 89 cal
      entry({ id: 'e2', mealId: 'm1', foodId: 'f2', amount: 50 }), // oats 50g → 189.5 cal
      entry({ id: 'e3', mealId: 'm2', amount: 200 }),         // banana 200g → 178 cal
    ],
  };

  it('sums every nutrient over entries in the given meal only', () => {
    const t = mealTotals(state, 'm1');
    expect(t.calories).to.be.closeTo(89 + 379 * 0.5, 0.0001);
    expect(t.protein).to.be.closeTo(1.1 + 13.2 * 0.5, 0.0001);
  });

  it('returns zeros for an empty meal', () => {
    const t = mealTotals({ ...state, entries: [] }, 'm1');
    expect(t).to.deep.equal({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  });

  it('returns zeros for an unknown mealId', () => {
    expect(mealTotals(state, 'no-such')).to.deep.equal({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  });
});
