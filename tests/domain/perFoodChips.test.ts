import { expect } from '@esm-bundle/chai';
import { reducer } from '../../src/domain/reducer.js';
import { freshState } from '../../src/domain/seed.js';
import type { Food, State } from '../../src/domain/types.js';

const baseFood = (id = 'custom-1'): Food => ({
  id, name: 'Custom food',
  kcalPer100g: 200, proteinPer100g: 5, carbsPer100g: 30, fatPer100g: 8,
  primaryUnit: 'g', weightPerUnit: 100,
  chips: null,
  createdAt: '2026-05-23T10:00:00Z', deletedAt: null,
});

describe('reducer — AddFood with chips field', () => {
  let before: State;
  beforeEach(() => { before = freshState(); });

  it('AddFood with chips: null succeeds', () => {
    const food = baseFood('new-1');
    const after = reducer(before, { type: 'AddFood', food });
    expect(after.foods.find((f) => f.id === 'new-1')).to.exist;
  });

  it('AddFood with chips: [80, 160, 240, 320] succeeds', () => {
    const food = { ...baseFood('new-2'), chips: [80, 160, 240, 320] };
    const after = reducer(before, { type: 'AddFood', food });
    const added = after.foods.find((f) => f.id === 'new-2');
    expect(added).to.exist;
    expect(added!.chips).to.deep.equal([80, 160, 240, 320]);
  });

  it('AddFood with chips: [] is rejected', () => {
    const food = { ...baseFood('new-3'), chips: [] };
    const after = reducer(before, { type: 'AddFood', food });
    expect(after).to.equal(before);
  });

  it('AddFood with chips array of length != 4 is rejected', () => {
    for (const chips of [[1, 2, 3], [1, 2, 3, 4, 5]]) {
      const food = { ...baseFood(`new-len-${chips.length}`), chips };
      const after = reducer(before, { type: 'AddFood', food });
      expect(after, `chips=${JSON.stringify(chips)}`).to.equal(before);
    }
  });

  it('AddFood with chips containing a negative value is rejected', () => {
    const food = { ...baseFood('new-4'), chips: [80, -1, 240, 320] };
    const after = reducer(before, { type: 'AddFood', food });
    expect(after).to.equal(before);
  });

  it('AddFood with chips containing NaN is rejected', () => {
    const food = { ...baseFood('new-5'), chips: [80, NaN, 240, 320] };
    const after = reducer(before, { type: 'AddFood', food });
    expect(after).to.equal(before);
  });
});

describe('reducer — EditFood with chips field', () => {
  let state: State;
  beforeEach(() => {
    state = {
      version: 4 as const,
      foods: [baseFood('f1')],
      entries: [],
    };
  });

  it('EditFood with chips: [90, 130, 170, 210] updates chips', () => {
    const after = reducer(state, { type: 'EditFood', foodId: 'f1', updates: { chips: [90, 130, 170, 210] } });
    expect(after.foods.find((f) => f.id === 'f1')!.chips).to.deep.equal([90, 130, 170, 210]);
  });

  it('EditFood with chips: null clears the override', () => {
    const withChips: State = { ...state, foods: [{ ...baseFood('f1'), chips: [90, 130, 170, 210] }] };
    const after = reducer(withChips, { type: 'EditFood', foodId: 'f1', updates: { chips: null } });
    expect(after.foods.find((f) => f.id === 'f1')!.chips).to.equal(null);
  });

  it('EditFood with chips array of length != 4 is rejected', () => {
    for (const chips of [[1, 2, 3], [1, 2, 3, 4, 5]]) {
      const after = reducer(state, { type: 'EditFood', foodId: 'f1', updates: { chips } });
      expect(after, `chips=${JSON.stringify(chips)}`).to.equal(state);
    }
  });
});
