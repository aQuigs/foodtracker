import { expect } from '@esm-bundle/chai';
import { migrateCountEntries } from '../../src/domain/migrateCount.js';
import { BAR, seedTestState } from '../_helpers.js';
import type { Entry, Recipe, State } from '../../src/domain/types.js';

function stateWith(entries: Entry[] = [], recipes: Recipe[] = []): State {
  const seeded = seedTestState();
  return {
    ...seeded,
    foods: [...seeded.foods, BAR],
    meals: [{ id: 'm1', date: '2026-05-23', position: 0 }],
    entries, recipes,
  };
}

const legacyEntry: Entry = {
  id: 'e1', date: '2026-05-23', foodId: BAR.id, amount: 2, unit: 'count', mealId: 'm1', loggedAt: '2026-05-23T10:00:00Z',
};

describe('migrateCountEntries', () => {
  it('converts a legacy count entry for a pieces food to its physical grams, tagging shown', () => {
    const next = migrateCountEntries(stateWith([legacyEntry]));
    const entry = next.entries[0]!;
    expect(entry.unit).to.equal('g');
    expect(entry.amount).to.equal(236);
    expect(entry.shown).to.deep.equal({ amount: 2, unit: 'count' });
  });

  it('converts a legacy recipe item the same way', () => {
    const recipe: Recipe = {
      id: 'r1', name: 'Snack', items: [{ foodId: BAR.id, amount: 3, unit: 'count' }],
      createdAt: '2026-01-01T00:00:00Z', deletedAt: null,
    };
    const next = migrateCountEntries(stateWith([], [recipe]));
    const item = next.recipes[0]!.items[0]!;
    expect(item.unit).to.equal('g');
    expect(item.amount).to.equal(354);
    expect(item.shown).to.deep.equal({ amount: 3, unit: 'count' });
  });

  it('is idempotent — running it twice changes nothing further', () => {
    const once = migrateCountEntries(stateWith([legacyEntry]));
    const twice = migrateCountEntries(once);
    expect(twice).to.deep.equal(once);
  });

  it('leaves a counted food\'s (servingUnit count) entry stored as count', () => {
    const entry: Entry = { ...legacyEntry, foodId: 'seed-egg', amount: 2, unit: 'count' };
    const next = migrateCountEntries(stateWith([entry]));
    expect(next.entries[0]!.unit).to.equal('count');
    expect(next.entries[0]!.amount).to.equal(2);
    expect(next.entries[0]!.shown).to.equal(undefined);
  });

  it('leaves an already-physical entry untouched', () => {
    const entry: Entry = { ...legacyEntry, foodId: 'seed-banana', amount: 150, unit: 'g' };
    const next = migrateCountEntries(stateWith([entry]));
    expect(next.entries[0]).to.deep.equal(entry);
  });

  it('leaves an entry referencing an unknown food untouched', () => {
    const entry: Entry = { ...legacyEntry, foodId: 'missing' };
    const next = migrateCountEntries(stateWith([entry]));
    expect(next.entries[0]).to.deep.equal(entry);
  });

  it('returns the same state reference when nothing needs converting', () => {
    const state = stateWith([{ ...legacyEntry, foodId: 'seed-banana', amount: 150, unit: 'g' }]);
    expect(migrateCountEntries(state)).to.equal(state);
  });
});
