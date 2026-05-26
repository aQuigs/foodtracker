import { expect } from '@esm-bundle/chai';
import { reducer } from '../../src/domain/reducer.js';
import type { Action, Entry, EntryDraft, Food, State } from '../../src/domain/types.js';

const food: Food = {
  id: 'f1', name: 'Banana',
  nutritionFacts: { calories: 89, protein: 1.1, carbs: 22.8, fat: 0.3 },
  servingSize: 100, servingUnit: 'g',
  createdAt: '2026-01-01T00:00:00Z', deletedAt: null,
};

const emptyState: State = { version: 2, foods: [food], meals: [], entries: [] };

const validEntry: EntryDraft = {
  id: 'e1', date: '2026-05-23', foodId: 'f1', amount: 120, unit: 'g', loggedAt: '2026-05-23T10:00:00Z',
};

const LOG_ACTION = (entry: EntryDraft) => ({ type: 'LogEntry' as const, entry, makeId: () => 'meal-new' });

describe('reducer', () => {
  describe('LogEntry', () => {
    it('appends a valid entry with mealId resolved from latest meal', () => {
      const next = reducer(emptyState, LOG_ACTION(validEntry));
      expect(next.entries).to.have.lengthOf(1);
      expect(next.entries[0]!.mealId).to.equal('meal-new');
      expect(next.entries[0]!.id).to.equal(validEntry.id);
    });

    it('does not mutate the input state', () => {
      reducer(emptyState, LOG_ACTION(validEntry));
      expect(emptyState.entries).to.have.lengthOf(0);
    });

    it('rejects entry with foodId not in foods', () => {
      const bad: EntryDraft = { ...validEntry, foodId: 'missing' };
      const next = reducer(emptyState, LOG_ACTION(bad));
      expect(next).to.equal(emptyState);
    });

    it('rejects empty foodId', () => {
      const bad: EntryDraft = { ...validEntry, foodId: '' };
      const next = reducer(emptyState, LOG_ACTION(bad));
      expect(next).to.equal(emptyState);
    });

    it('rejects zero amount', () => {
      const bad: EntryDraft = { ...validEntry, amount: 0 };
      const next = reducer(emptyState, LOG_ACTION(bad));
      expect(next).to.equal(emptyState);
    });

    it('rejects negative amount', () => {
      const bad: EntryDraft = { ...validEntry, amount: -5 };
      const next = reducer(emptyState, LOG_ACTION(bad));
      expect(next).to.equal(emptyState);
    });

    it('rejects NaN amount', () => {
      const bad: EntryDraft = { ...validEntry, amount: NaN };
      const next = reducer(emptyState, LOG_ACTION(bad));
      expect(next).to.equal(emptyState);
    });

    it('rejects Infinity amount', () => {
      const bad: EntryDraft = { ...validEntry, amount: Infinity };
      const next = reducer(emptyState, LOG_ACTION(bad));
      expect(next).to.equal(emptyState);
    });
  });

  describe('DeleteEntry', () => {
    const meal = { id: 'm1', date: '2026-05-23', position: 0 };
    const seededEntry: Entry = { ...validEntry, mealId: 'm1' };
    const seeded: State = { ...emptyState, meals: [meal], entries: [seededEntry] };

    it('removes the entry by id', () => {
      const next = reducer(seeded, { type: 'DeleteEntry', entryId: 'e1' });
      expect(next.entries).to.have.lengthOf(0);
    });

    it('returns same state when id is not found', () => {
      const next = reducer(seeded, { type: 'DeleteEntry', entryId: 'nope' });
      expect(next).to.equal(seeded);
    });

    it('does not mutate input state', () => {
      reducer(seeded, { type: 'DeleteEntry', entryId: 'e1' });
      expect(seeded.entries).to.have.lengthOf(1);
    });
  });

  it('returns same state for unknown action', () => {
    const next = reducer(emptyState, { type: 'Bogus' } as unknown as Action);
    expect(next).to.equal(emptyState);
  });

  it('allows logging against a soft-deleted food (deferred to M3)', () => {
    const deletedFood: Food = { ...food, deletedAt: '2026-05-23T12:00:00Z' };
    const s: State = { ...emptyState, foods: [deletedFood] };
    const next = reducer(s, LOG_ACTION(validEntry));
    expect(next.entries).to.have.lengthOf(1);
    expect(next.entries[0]!.mealId).to.equal('meal-new');
  });
});
