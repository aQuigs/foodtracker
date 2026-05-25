import { expect } from '@esm-bundle/chai';
import { sortFoodsForLog } from '../../src/ui/recent.js';
import type { Entry, Food, State } from '../../src/domain/types.js';

const food = (id: string, name: string, deletedAt: string | null = null): Food => ({
  id, name,
  nutritionFacts: { calories: 100, protein: 0, carbs: 0, fat: 0 },
  primaryUnit: 'g', weightPerUnit: 100,
  createdAt: '2026-01-01T00:00:00Z', deletedAt,
});

const entry = (id: string, foodId: string, loggedAt: string, date = '2026-05-23'): Entry => ({
  id, date, foodId, amount: 100, unit: 'g', grams: 100, loggedAt,
});

describe('sortFoodsForLog', () => {
  const now = new Date('2026-05-23T10:00:00.000Z');

  it('sorts alphabetically when there are no entries', () => {
    const s: State = { version: 2, foods: [food('b', 'Banana'), food('a', 'Apple')], entries: [] };
    const r = sortFoodsForLog(s, now);
    expect(r.map((f) => f.id)).to.deep.equal(['a', 'b']);
  });

  it('places recently-used foods first, by most recent loggedAt', () => {
    const s: State = {
      version: 2,
      foods: [food('apple', 'Apple'), food('banana', 'Banana'), food('chicken', 'Chicken'), food('zebra', 'Zebra')],
      entries: [
        entry('e1', 'banana',  '2026-05-20T10:00:00Z'),
        entry('e2', 'chicken', '2026-05-22T10:00:00Z'),
      ],
    };
    const r = sortFoodsForLog(s, now);
    expect(r.map((f) => f.id)).to.deep.equal(['chicken', 'banana', 'apple', 'zebra']);
  });

  it('ignores entries older than 30 days', () => {
    const s: State = {
      version: 2,
      foods: [food('apple', 'Apple'), food('old', 'Old food')],
      entries: [
        entry('e1', 'old', '2026-03-01T10:00:00Z'),
      ],
    };
    const r = sortFoodsForLog(s, now);
    expect(r.map((f) => f.id)).to.deep.equal(['apple', 'old']);
  });

  it('excludes soft-deleted foods from results entirely', () => {
    const s: State = {
      version: 2,
      foods: [food('apple', 'Apple'), food('banana', 'Banana', '2026-05-22T00:00:00Z')],
      entries: [entry('e1', 'banana', '2026-05-22T10:00:00Z')],
    };
    const r = sortFoodsForLog(s, now);
    expect(r.map((f) => f.id)).to.deep.equal(['apple']);
  });

  it('uses the latest loggedAt for foods with multiple recent entries', () => {
    const s: State = {
      version: 2,
      foods: [food('a', 'A'), food('b', 'B')],
      entries: [
        entry('e1', 'a', '2026-05-22T10:00:00Z'),
        entry('e2', 'b', '2026-05-21T10:00:00Z'),
        entry('e3', 'b', '2026-05-23T09:00:00Z'),
      ],
    };
    const r = sortFoodsForLog(s, now);
    expect(r.map((f) => f.id)).to.deep.equal(['b', 'a']);
  });

  it('ignores entries that reference unknown foodIds', () => {
    const s: State = {
      version: 2,
      foods: [food('apple', 'Apple')],
      entries: [entry('e1', 'ghost', '2026-05-22T10:00:00Z')],
    };
    expect(sortFoodsForLog(s, now).map((f) => f.id)).to.deep.equal(['apple']);
  });
});
