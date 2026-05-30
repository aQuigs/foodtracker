import { expect } from '@esm-bundle/chai';
import { reducer } from '../../src/domain/reducer.js';
import { freshState } from '../../src/domain/seed.js';
import type { Food, State } from '../../src/domain/types.js';

const validFood = (id = 'custom-1'): Food => ({
  id, name: 'Custom food',
  nutritionFacts: { calories: 200, protein: 5, carbs: 30, fat: 8 },
  servingSize: 100, servingUnit: 'g',
  createdAt: '2026-05-23T10:00:00Z', deletedAt: null,
});

describe('reducer — AddFood', () => {
  it('appends a new food with a unique id', () => {
    const before = freshState();
    const food = validFood('new-1');
    const after = reducer(before, { type: 'AddFood', food });
    expect(after.foods).to.have.lengthOf(before.foods.length + 1);
    expect(after.foods.find((f) => f.id === 'new-1')).to.deep.equal(food);
  });

  it('is a no-op on duplicate id', () => {
    const existing = validFood('existing-1');
    const before: State = { version: 2, foods: [existing], meals: [], entries: [] };
    const dup = { ...validFood('existing-1') };
    const after = reducer(before, { type: 'AddFood', food: dup });
    expect(after).to.equal(before);
  });

  it('rejects negative nutrition values', () => {
    const before = freshState();
    for (const k of ['calories', 'protein', 'carbs', 'fat'] as const) {
      const bad = validFood();
      bad.nutritionFacts = { ...bad.nutritionFacts, [k]: -1 };
      const after = reducer(before, { type: 'AddFood', food: bad });
      expect(after, k).to.equal(before);
    }
  });

  it('rejects NaN/Infinity nutrition values', () => {
    const before = freshState();
    for (const bad of [NaN, Infinity, -Infinity]) {
      for (const k of ['calories', 'protein', 'carbs', 'fat'] as const) {
        const food = validFood();
        food.nutritionFacts = { ...food.nutritionFacts, [k]: bad };
        const after = reducer(before, { type: 'AddFood', food });
        expect(after).to.equal(before);
      }
    }
  });

  it('rejects an id that matches a soft-deleted food (locked behavior)', () => {
    const deleted: State = {
      version: 1,
      foods: [{ ...validFood('shared-id'), deletedAt: '2026-05-22T00:00:00Z' }],
      entries: [],
    };
    const after = reducer(deleted, { type: 'AddFood', food: validFood('shared-id') });
    expect(after).to.equal(deleted);
  });

  it('rejects empty name or empty id', () => {
    const before = freshState();
    for (const bad of [
      { ...validFood(), name: '' },
      { ...validFood(), id: '' },
    ]) {
      const after = reducer(before, { type: 'AddFood', food: bad });
      expect(after).to.equal(before);
    }
  });
});

describe('reducer — EditFood', () => {
  const state: State = {
    version: 1,
    foods: [validFood('f1'), { ...validFood('deleted-1'), deletedAt: '2026-05-22T00:00:00Z' }],
    entries: [],
  };

  it('updates name and nutrition fields', () => {
    const after = reducer(state, {
      type: 'EditFood',
      foodId: 'f1',
      updates: { name: 'Renamed', nutritionFacts: { calories: 250, protein: 5, carbs: 30, fat: 8 } },
    });
    const f = after.foods.find((x) => x.id === 'f1')!;
    expect(f.name).to.equal('Renamed');
    expect(f.nutritionFacts.calories).to.equal(250);
    expect(f.nutritionFacts.protein).to.equal(5);
  });

  it('is a no-op on unknown id', () => {
    const after = reducer(state, { type: 'EditFood', foodId: 'no-such', updates: { name: 'X' } });
    expect(after).to.equal(state);
  });

  it('is a no-op on a soft-deleted food', () => {
    const after = reducer(state, { type: 'EditFood', foodId: 'deleted-1', updates: { name: 'X' } });
    expect(after).to.equal(state);
  });

  it('rejects invalid nutrition updates (negative, NaN, Infinity)', () => {
    for (const bad of [-1, NaN, Infinity, -Infinity]) {
      for (const k of ['calories', 'protein', 'carbs', 'fat'] as const) {
        const updates = { nutritionFacts: { calories: 1, protein: 1, carbs: 1, fat: 1, [k]: bad } };
        const after = reducer(state, { type: 'EditFood', foodId: 'f1', updates });
        expect(after).to.equal(state);
      }
    }
  });

  it('rejects empty name update', () => {
    const after = reducer(state, { type: 'EditFood', foodId: 'f1', updates: { name: '' } });
    expect(after).to.equal(state);
  });

  it('rejects empty updates ({})', () => {
    const after = reducer(state, { type: 'EditFood', foodId: 'f1', updates: {} });
    expect(after).to.equal(state);
  });

  it('preserves createdAt and deletedAt on edits', () => {
    const after = reducer(state, { type: 'EditFood', foodId: 'f1', updates: { name: 'Renamed' } });
    const f = after.foods.find((x) => x.id === 'f1')!;
    expect(f.createdAt).to.equal(state.foods[0]!.createdAt);
    expect(f.deletedAt).to.equal(null);
  });

  it('rejects servingUnit change across the count/weight axis when entries reference the food', () => {
    const stateWithCountFood: State = {
      version: 1,
      foods: [{ ...validFood('egg'), servingSize: 1, servingUnit: 'count' }],
      entries: [{ id: 'e1', date: '2026-05-23', foodId: 'egg', amount: 3, unit: 'count', loggedAt: '2026-05-23T10:00:00Z' }],
    };
    const after = reducer(stateWithCountFood, {
      type: 'EditFood', foodId: 'egg',
      updates: { servingUnit: 'g', servingSize: 100 },
    });
    expect(after).to.equal(stateWithCountFood);
  });

  it('allows servingUnit change across the axis when no entries reference the food', () => {
    const stateNoEntries: State = {
      version: 1,
      foods: [{ ...validFood('egg'), servingSize: 1, servingUnit: 'count' }],
      entries: [],
    };
    const after = reducer(stateNoEntries, {
      type: 'EditFood', foodId: 'egg',
      updates: { servingUnit: 'g', servingSize: 100 },
    });
    const f = after.foods.find((x) => x.id === 'egg')!;
    expect(f.servingUnit).to.equal('g');
    expect(f.servingSize).to.equal(100);
  });

  it('allows servingUnit change within the weight axis (g↔oz↔lb)', () => {
    const s: State = {
      version: 1,
      foods: [validFood('f1')],
      entries: [{ id: 'e1', date: '2026-05-23', foodId: 'f1', amount: 100, unit: 'g', loggedAt: '2026-05-23T10:00:00Z' }],
    };
    const after = reducer(s, { type: 'EditFood', foodId: 'f1', updates: { servingUnit: 'oz', servingSize: 1 } });
    const f = after.foods.find((x) => x.id === 'f1')!;
    expect(f.servingUnit).to.equal('oz');
  });
});

describe('reducer — SoftDeleteFood', () => {
  it('sets deletedAt on a live food', () => {
    const before: State = { version: 2, foods: [validFood('f-live')], meals: [], entries: [] };
    const ts = '2026-05-23T10:00:00Z';
    const after = reducer(before, { type: 'SoftDeleteFood', foodId: 'f-live', deletedAt: ts });
    expect(after.foods.find((f) => f.id === 'f-live')!.deletedAt).to.equal(ts);
  });

  it('is a no-op on unknown id', () => {
    const before = freshState();
    const after = reducer(before, { type: 'SoftDeleteFood', foodId: 'no-such', deletedAt: '2026-05-23T10:00:00Z' });
    expect(after).to.equal(before);
  });

  it('is a no-op when food is already soft-deleted', () => {
    const before: State = {
      version: 1,
      foods: [{ ...validFood('d1'), deletedAt: '2026-05-22T00:00:00Z' }],
      entries: [],
    };
    const after = reducer(before, { type: 'SoftDeleteFood', foodId: 'd1', deletedAt: '2026-05-23T10:00:00Z' });
    expect(after).to.equal(before);
  });

  it('leaves entries that reference the food intact', () => {
    const before: State = {
      version: 1,
      foods: [validFood('f1')],
      entries: [{ id: 'e1', date: '2026-05-23', foodId: 'f1', amount: 100, unit: 'g' as const, loggedAt: '2026-05-23T10:00:00Z' }],
    };
    const after = reducer(before, { type: 'SoftDeleteFood', foodId: 'f1', deletedAt: '2026-05-23T10:00:00Z' });
    expect(after.entries).to.deep.equal(before.entries);
  });
});

describe('reducer — ReviveFood', () => {
  it('clears deletedAt on a soft-deleted food', () => {
    const before: State = {
      version: 1,
      foods: [{ ...validFood('d1'), deletedAt: '2026-05-22T00:00:00Z' }],
      entries: [],
    };
    const after = reducer(before, { type: 'ReviveFood', foodId: 'd1' });
    expect(after.foods.find((f) => f.id === 'd1')!.deletedAt).to.equal(null);
  });

  it('is a no-op on unknown id', () => {
    const before = freshState();
    const after = reducer(before, { type: 'ReviveFood', foodId: 'no-such' });
    expect(after).to.equal(before);
  });

  it('is a no-op when food is already live', () => {
    const before: State = { version: 2, foods: [validFood('f-live')], meals: [], entries: [] };
    const after = reducer(before, { type: 'ReviveFood', foodId: 'f-live' });
    expect(after).to.equal(before);
  });
});

describe('reducer — ReplaceState', () => {
  it('swaps the entire state', () => {
    const next: State = {
      version: 1,
      foods: [validFood('only')],
      entries: [{ id: 'e1', date: '2026-05-23', foodId: 'only', amount: 100, unit: 'g' as const, loggedAt: '2026-05-23T10:00:00Z' }],
    };
    const after = reducer(freshState(), { type: 'ReplaceState', state: next });
    expect(after).to.equal(next);
  });
});
