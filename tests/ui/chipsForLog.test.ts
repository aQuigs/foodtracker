import { expect } from '@esm-bundle/chai';
import { getChipsForUnit, getChipsForLog } from '../../src/ui/chips.js';
import type { Food } from '../../src/domain/types.js';

const baseFood = (overrides: Partial<Food> = {}): Food => ({
  id: 'f1', name: 'Banana',
  kcalPer100g: 89, proteinPer100g: 1.1, carbsPer100g: 22.8, fatPer100g: 0.3,
  primaryUnit: 'g', weightPerUnit: 100,
  chips: null,
  createdAt: '2026-01-01T00:00:00Z', deletedAt: null,
  ...overrides,
});

describe('getChipsForLog', () => {
  it('returns food.chips when chips is set and logUnit matches primaryUnit', () => {
    const food = baseFood({ chips: [80, 160, 240, 320], primaryUnit: 'g' });
    expect(getChipsForLog(food, 'g')).to.deep.equal([80, 160, 240, 320]);
  });

  it('returns unit defaults when chips is set but logUnit differs from primaryUnit', () => {
    const food = baseFood({ chips: [80, 160, 240, 320], primaryUnit: 'g' });
    expect(getChipsForLog(food, 'oz')).to.deep.equal(getChipsForUnit('oz'));
  });

  it('returns unit defaults when chips is null', () => {
    const food = baseFood({ chips: null, primaryUnit: 'g' });
    expect(getChipsForLog(food, 'g')).to.deep.equal(getChipsForUnit('g'));
  });

  it('returns unit defaults when chips is null and logUnit is different', () => {
    const food = baseFood({ chips: null, primaryUnit: 'g' });
    expect(getChipsForLog(food, 'lb')).to.deep.equal(getChipsForUnit('lb'));
  });
});
