import { expect } from '@esm-bundle/chai';
import { reducer } from '../../src/domain/reducer.js';
import { freshState } from '../../src/domain/seed.js';
import type { Food, State } from '../../src/domain/types.js';

const validFood = (id = 'custom-1'): Food => ({
  id, name: 'Custom food',
  kcalPer100g: 200, proteinPer100g: 5, carbsPer100g: 30, fatPer100g: 8,
  primaryUnit: 'g', weightPerUnit: 100,
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
    const before = freshState();
    const dup = { ...validFood('seed-banana') };
    const after = reducer(before, { type: 'AddFood', food: dup });
    expect(after).to.equal(before);
  });

  it('rejects negative nutrition values', () => {
    const before = freshState();
    for (const bad of [
      { ...validFood(), kcalPer100g: -1 },
      { ...validFood(), proteinPer100g: -1 },
      { ...validFood(), carbsPer100g: -1 },
      { ...validFood(), fatPer100g: -1 },
    ]) {
      const after = reducer(before, { type: 'AddFood', food: bad });
      expect(after).to.equal(before);
    }
  });

  it('rejects NaN/Infinity nutrition values', () => {
    const before = freshState();
    for (const bad of [
      { ...validFood(), kcalPer100g: NaN },
      { ...validFood(), proteinPer100g: Infinity },
      { ...validFood(), carbsPer100g: -Infinity },
      { ...validFood(), fatPer100g: NaN },
    ]) {
      const after = reducer(before, { type: 'AddFood', food: bad });
      expect(after).to.equal(before);
    }
  });

  it('rejects an id that matches a soft-deleted food (locked behavior)', () => {
    const deleted: State = {
      version: 2,
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
      updates: { name: 'Renamed', kcalPer100g: 250 },
    });
    const f = after.foods.find((x) => x.id === 'f1')!;
    expect(f.name).to.equal('Renamed');
    expect(f.kcalPer100g).to.equal(250);
    expect(f.proteinPer100g).to.equal(5);
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
    for (const updates of [
      { kcalPer100g: -1 },
      { proteinPer100g: NaN },
      { carbsPer100g: Infinity },
      { fatPer100g: -Infinity },
    ]) {
      const after = reducer(state, { type: 'EditFood', foodId: 'f1', updates });
      expect(after, JSON.stringify(updates)).to.equal(state);
    }
  });

  it('rejects empty name update', () => {
    const after = reducer(state, { type: 'EditFood', foodId: 'f1', updates: { name: '' } });
    expect(after).to.equal(state);
  });

  it('preserves createdAt and deletedAt on edits', () => {
    const after = reducer(state, { type: 'EditFood', foodId: 'f1', updates: { name: 'Renamed' } });
    const f = after.foods.find((x) => x.id === 'f1')!;
    expect(f.createdAt).to.equal(state.foods[0]!.createdAt);
    expect(f.deletedAt).to.equal(null);
  });
});

describe('reducer — SoftDeleteFood', () => {
  it('sets deletedAt on a live food', () => {
    const before = freshState();
    const ts = '2026-05-23T10:00:00Z';
    const after = reducer(before, { type: 'SoftDeleteFood', foodId: 'seed-banana', deletedAt: ts });
    expect(after.foods.find((f) => f.id === 'seed-banana')!.deletedAt).to.equal(ts);
  });

  it('is a no-op on unknown id', () => {
    const before = freshState();
    const after = reducer(before, { type: 'SoftDeleteFood', foodId: 'no-such', deletedAt: '2026-05-23T10:00:00Z' });
    expect(after).to.equal(before);
  });

  it('is a no-op when food is already soft-deleted', () => {
    const before: State = {
      version: 2,
      foods: [{ ...validFood('d1'), deletedAt: '2026-05-22T00:00:00Z' }],
      entries: [],
    };
    const after = reducer(before, { type: 'SoftDeleteFood', foodId: 'd1', deletedAt: '2026-05-23T10:00:00Z' });
    expect(after).to.equal(before);
  });

  it('leaves entries that reference the food intact', () => {
    const before: State = {
      version: 2,
      foods: [validFood('f1')],
      entries: [{ id: 'e1', date: '2026-05-23', foodId: 'f1', amount: 100, unit: 'g', grams: 100, loggedAt: '2026-05-23T10:00:00Z' }],
    };
    const after = reducer(before, { type: 'SoftDeleteFood', foodId: 'f1', deletedAt: '2026-05-23T10:00:00Z' });
    expect(after.entries).to.deep.equal(before.entries);
  });
});

describe('reducer — ReplaceState', () => {
  it('swaps the entire state', () => {
    const next: State = {
      version: 2,
      foods: [validFood('only')],
      entries: [{ id: 'e1', date: '2026-05-23', foodId: 'only', amount: 100, unit: 'g', grams: 100, loggedAt: '2026-05-23T10:00:00Z' }],
    };
    const after = reducer(freshState(), { type: 'ReplaceState', state: next });
    expect(after).to.equal(next);
  });
});
