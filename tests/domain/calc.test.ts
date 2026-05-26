import { expect } from '@esm-bundle/chai';
import { entryCalories, dailyTotals } from '../../src/domain/calc.js';
import type { Food, Entry, State } from '../../src/domain/types.js';

const banana: Food = {
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
const egg: Food = {
  id: 'f3', name: 'Egg',
  nutritionFacts: { calories: 78, protein: 6.5, carbs: 0.6, fat: 5.5 },
  servingSize: 1, servingUnit: 'count',
  createdAt: '2026-01-01T00:00:00Z', deletedAt: null,
};

describe('entryCalories', () => {
  it('computes calories as nutrition * (amount/servingSize) when units match', () => {
    const e: Entry = { id: 'e1', date: '2026-05-23', foodId: 'f1', amount: 120, unit: 'g', loggedAt: '2026-05-23T10:00:00Z' };
    expect(entryCalories(e, banana)).to.be.closeTo(106.8, 0.0001);
  });

  it('handles count foods (per-serving)', () => {
    const e: Entry = { id: 'e1', date: '2026-05-23', foodId: 'f3', amount: 2, unit: 'count', loggedAt: '2026-05-23T10:00:00Z' };
    expect(entryCalories(e, egg)).to.equal(156);
  });

  it('converts oz on a g-food via grams bridge', () => {
    const e: Entry = { id: 'e1', date: '2026-05-23', foodId: 'f1', amount: 1, unit: 'oz', loggedAt: '2026-05-23T10:00:00Z' };
    expect(entryCalories(e, banana)).to.be.closeTo(89 * 28.3495 / 100, 1e-3);
  });
});

describe('dailyTotals', () => {
  const state: State = {
    version: 1,
    foods: [banana, oats],
    entries: [
      { id: 'e1', date: '2026-05-23', foodId: 'f1', amount: 100, unit: 'g', loggedAt: '2026-05-23T08:00:00Z' },
      { id: 'e2', date: '2026-05-23', foodId: 'f2', amount: 50, unit: 'g',  loggedAt: '2026-05-23T09:00:00Z' },
      { id: 'e3', date: '2026-05-22', foodId: 'f1', amount: 200, unit: 'g', loggedAt: '2026-05-22T08:00:00Z' },
    ],
  };

  it('sums every nutrient for the given date only', () => {
    const t = dailyTotals(state, '2026-05-23');
    expect(t.calories).to.be.closeTo(89 + 379 * 0.5, 0.0001);
    expect(t.protein).to.be.closeTo(1.1 + 13.2 * 0.5, 0.0001);
    expect(t.carbs).to.be.closeTo(22.8 + 67.7 * 0.5, 0.0001);
    expect(t.fat).to.be.closeTo(0.3 + 6.5 * 0.5, 0.0001);
  });

  it('returns zero totals when no entries match', () => {
    const t = dailyTotals(state, '2026-05-21');
    expect(t).to.deep.equal({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  });

  it('ignores entries whose food is missing', () => {
    const orphan: State = {
      version: 1, foods: [],
      entries: [{ id: 'e1', date: '2026-05-23', foodId: 'missing', amount: 100, unit: 'g', loggedAt: '2026-05-23T08:00:00Z' }],
    };
    expect(dailyTotals(orphan, '2026-05-23')).to.deep.equal({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  });

  it('still counts entries against soft-deleted foods (historical render contract)', () => {
    const deleted: Food = { ...banana, deletedAt: '2026-05-23T12:00:00Z' };
    const s: State = {
      version: 1, foods: [deleted],
      entries: [{ id: 'e1', date: '2026-05-23', foodId: 'f1', amount: 100, unit: 'g', loggedAt: '2026-05-23T08:00:00Z' }],
    };
    expect(dailyTotals(s, '2026-05-23').calories).to.be.closeTo(89, 0.0001);
  });
});
