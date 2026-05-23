import { expect } from '@esm-bundle/chai';
import { reducer } from '../../src/domain/reducer.js';
import type { Action, Entry, Food, State } from '../../src/domain/types.js';

const food: Food = {
  id: 'f1', name: 'Banana', kcalPer100g: 89, proteinPer100g: 1.1, carbsPer100g: 22.8, fatPer100g: 0.3,
  createdAt: '2026-01-01T00:00:00Z', deletedAt: null,
};

const emptyState: State = { version: 1, foods: [food], entries: [] };

const validEntry: Entry = {
  id: 'e1', date: '2026-05-23', foodId: 'f1', grams: 120, loggedAt: '2026-05-23T10:00:00Z',
};

describe('reducer', () => {
  describe('LogEntry', () => {
    it('appends a valid entry', () => {
      const next = reducer(emptyState, { type: 'LogEntry', entry: validEntry });
      expect(next.entries).to.have.lengthOf(1);
      expect(next.entries[0]).to.deep.equal(validEntry);
    });

    it('does not mutate the input state', () => {
      reducer(emptyState, { type: 'LogEntry', entry: validEntry });
      expect(emptyState.entries).to.have.lengthOf(0);
    });

    it('rejects entry with foodId not in foods', () => {
      const bad: Entry = { ...validEntry, foodId: 'missing' };
      const next = reducer(emptyState, { type: 'LogEntry', entry: bad });
      expect(next).to.equal(emptyState);
    });

    it('rejects empty foodId', () => {
      const bad: Entry = { ...validEntry, foodId: '' };
      const next = reducer(emptyState, { type: 'LogEntry', entry: bad });
      expect(next).to.equal(emptyState);
    });

    it('rejects zero grams', () => {
      const bad: Entry = { ...validEntry, grams: 0 };
      const next = reducer(emptyState, { type: 'LogEntry', entry: bad });
      expect(next).to.equal(emptyState);
    });

    it('rejects negative grams', () => {
      const bad: Entry = { ...validEntry, grams: -5 };
      const next = reducer(emptyState, { type: 'LogEntry', entry: bad });
      expect(next).to.equal(emptyState);
    });

    it('rejects NaN grams', () => {
      const bad: Entry = { ...validEntry, grams: NaN };
      const next = reducer(emptyState, { type: 'LogEntry', entry: bad });
      expect(next).to.equal(emptyState);
    });

    it('rejects Infinity grams', () => {
      const bad: Entry = { ...validEntry, grams: Infinity };
      const next = reducer(emptyState, { type: 'LogEntry', entry: bad });
      expect(next).to.equal(emptyState);
    });
  });

  describe('DeleteEntry', () => {
    const seeded: State = { ...emptyState, entries: [validEntry] };

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
    const next = reducer(s, { type: 'LogEntry', entry: validEntry });
    expect(next.entries).to.have.lengthOf(1);
  });
});
