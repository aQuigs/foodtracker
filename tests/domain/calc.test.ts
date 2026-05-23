import { expect } from '@esm-bundle/chai';
import { entryKcal, dailyTotals } from '../../src/domain/calc.js';
import type { Food, Entry, State } from '../../src/domain/types.js';

const banana: Food = {
  id: 'f1', name: 'Banana', kcalPer100g: 89, proteinPer100g: 1.1, carbsPer100g: 22.8, fatPer100g: 0.3,
  primaryUnit: 'g', weightPerUnit: 100,
  createdAt: '2026-01-01T00:00:00Z', deletedAt: null,
};
const oats: Food = {
  id: 'f2', name: 'Oats', kcalPer100g: 379, proteinPer100g: 13.2, carbsPer100g: 67.7, fatPer100g: 6.5,
  primaryUnit: 'g', weightPerUnit: 100,
  createdAt: '2026-01-01T00:00:00Z', deletedAt: null,
};

const e = (id: string, date: string, foodId: string, grams: number, loggedAt: string): Entry => ({
  id, date, foodId, amount: grams, unit: 'g', grams, loggedAt,
});

describe('entryKcal', () => {
  it('computes kcal as (kcalPer100g * grams) / 100', () => {
    expect(entryKcal(e('e1', '2026-05-23', 'f1', 120, '2026-05-23T10:00:00Z'), banana)).to.be.closeTo(106.8, 0.0001);
  });

  it('returns 0 for 0 grams', () => {
    expect(entryKcal(e('e1', '2026-05-23', 'f1', 0, '2026-05-23T10:00:00Z'), banana)).to.equal(0);
  });
});

describe('dailyTotals', () => {
  const state: State = {
    version: 2,
    foods: [banana, oats],
    entries: [
      e('e1', '2026-05-23', 'f1', 100, '2026-05-23T08:00:00Z'),
      e('e2', '2026-05-23', 'f2', 50,  '2026-05-23T09:00:00Z'),
      e('e3', '2026-05-22', 'f1', 200, '2026-05-22T08:00:00Z'),
    ],
  };

  it('sums kcal and macros for the given date only', () => {
    const t = dailyTotals(state, '2026-05-23');
    expect(t.kcal).to.be.closeTo(89 + 379 * 0.5, 0.0001);
    expect(t.protein).to.be.closeTo(1.1 + 13.2 * 0.5, 0.0001);
    expect(t.carbs).to.be.closeTo(22.8 + 67.7 * 0.5, 0.0001);
    expect(t.fat).to.be.closeTo(0.3 + 6.5 * 0.5, 0.0001);
  });

  it('returns zero totals when no entries match', () => {
    const t = dailyTotals(state, '2026-05-21');
    expect(t).to.deep.equal({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
  });

  it('ignores entries whose food is missing', () => {
    const orphan: State = {
      version: 2, foods: [],
      entries: [e('e1', '2026-05-23', 'missing', 100, '2026-05-23T08:00:00Z')],
    };
    expect(dailyTotals(orphan, '2026-05-23')).to.deep.equal({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
  });

  it('still counts entries against soft-deleted foods (historical render contract)', () => {
    const deleted: Food = { ...banana, deletedAt: '2026-05-23T12:00:00Z' };
    const s: State = {
      version: 2, foods: [deleted],
      entries: [e('e1', '2026-05-23', 'f1', 100, '2026-05-23T08:00:00Z')],
    };
    expect(dailyTotals(s, '2026-05-23').kcal).to.be.closeTo(89, 0.0001);
  });
});
