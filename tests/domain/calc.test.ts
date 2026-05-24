import { expect } from '@esm-bundle/chai';
import { entryCalories, dailyTotals } from '../../src/domain/calc.js';
import type { Food, Entry, State } from '../../src/domain/types.js';

const banana: Food = {
  id: 'f1', name: 'Banana',
  nutritionFacts: { calories: 89, protein: 1.1, carbs: 22.8, fat: 0.3 },
  createdAt: '2026-01-01T00:00:00Z', deletedAt: null,
};
const oats: Food = {
  id: 'f2', name: 'Oats',
  nutritionFacts: { calories: 379, protein: 13.2, carbs: 67.7, fat: 6.5 },
  createdAt: '2026-01-01T00:00:00Z', deletedAt: null,
};

describe('entryCalories', () => {
  it('computes calories as (nutritionFacts.calories * grams) / 100', () => {
    const e: Entry = { id: 'e1', date: '2026-05-23', foodId: 'f1', grams: 120, loggedAt: '2026-05-23T10:00:00Z' };
    expect(entryCalories(e, banana)).to.be.closeTo(106.8, 0.0001);
  });

  it('returns 0 for 0 grams', () => {
    const e: Entry = { id: 'e1', date: '2026-05-23', foodId: 'f1', grams: 0, loggedAt: '2026-05-23T10:00:00Z' };
    expect(entryCalories(e, banana)).to.equal(0);
  });
});

describe('dailyTotals', () => {
  const state: State = {
    version: 1,
    foods: [banana, oats],
    entries: [
      { id: 'e1', date: '2026-05-23', foodId: 'f1', grams: 100, loggedAt: '2026-05-23T08:00:00Z' },
      { id: 'e2', date: '2026-05-23', foodId: 'f2', grams: 50,  loggedAt: '2026-05-23T09:00:00Z' },
      { id: 'e3', date: '2026-05-22', foodId: 'f1', grams: 200, loggedAt: '2026-05-22T08:00:00Z' },
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
      entries: [{ id: 'e1', date: '2026-05-23', foodId: 'missing', grams: 100, loggedAt: '2026-05-23T08:00:00Z' }],
    };
    expect(dailyTotals(orphan, '2026-05-23')).to.deep.equal({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  });

  it('still counts entries against soft-deleted foods (historical render contract)', () => {
    const deleted: Food = { ...banana, deletedAt: '2026-05-23T12:00:00Z' };
    const s: State = {
      version: 1, foods: [deleted],
      entries: [{ id: 'e1', date: '2026-05-23', foodId: 'f1', grams: 100, loggedAt: '2026-05-23T08:00:00Z' }],
    };
    expect(dailyTotals(s, '2026-05-23').calories).to.be.closeTo(89, 0.0001);
  });
});
