import { expect } from '@esm-bundle/chai';
import { InMemoryRepository } from '../../src/persistence/inMemory.js';
import { freshState } from '../../src/domain/seed.js';
import type { State } from '../../src/domain/types.js';

describe('InMemoryRepository', () => {
  it('load() returns freshState() when nothing has been saved', () => {
    const repo = new InMemoryRepository();
    expect(repo.load()).to.deep.equal(freshState());
  });

  it('save() then load() round-trips state', () => {
    const repo = new InMemoryRepository();
    const state: State = { ...freshState(), entries: [
      { id: 'e1', date: '2026-05-23', foodId: 'seed-banana', amount: 120, unit: 'g', grams: 120, loggedAt: '2026-05-23T10:00:00Z' },
    ]};
    repo.save(state);
    expect(repo.load()).to.deep.equal(state);
  });

  it('load() returns a deep clone (independent reference)', () => {
    const repo = new InMemoryRepository();
    const a = repo.load();
    const b = repo.load();
    expect(a).to.not.equal(b);
    expect(a.entries).to.not.equal(b.entries);
  });

  it('mutating loaded state does not affect repo contents', () => {
    const repo = new InMemoryRepository();
    const loaded = repo.load();
    loaded.entries.push({ id: 'e1', date: '2026-05-23', foodId: 'seed-banana', amount: 1, unit: 'g', grams: 1, loggedAt: '2026-05-23T10:00:00Z' });
    expect(repo.load().entries).to.have.lengthOf(0);
  });
});
