import { expect } from '@esm-bundle/chai';
import { LocalStorageRepository, STORAGE_KEY } from '../../src/persistence/localStorage.js';
import { freshState } from '../../src/domain/seed.js';
import type { State } from '../../src/domain/types.js';

describe('LocalStorageRepository', () => {
  beforeEach(() => localStorage.removeItem(STORAGE_KEY));
  afterEach(() => localStorage.removeItem(STORAGE_KEY));

  it('load() returns freshState() when key is missing', () => {
    const repo = new LocalStorageRepository();
    expect(repo.load()).to.deep.equal(freshState());
  });

  it('load() returns freshState() when blob is malformed JSON', () => {
    localStorage.setItem(STORAGE_KEY, 'not json {{{');
    const repo = new LocalStorageRepository();
    expect(repo.load()).to.deep.equal(freshState());
  });

  it('load() returns freshState() when version is wrong', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 999, foods: [], entries: [] }));
    const repo = new LocalStorageRepository();
    expect(repo.load()).to.deep.equal(freshState());
  });

  it('load() returns freshState() when shape is invalid', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, foods: 'nope', entries: [] }));
    const repo = new LocalStorageRepository();
    expect(repo.load()).to.deep.equal(freshState());
  });

  it('load() returns freshState() when blob is null/wrong root type', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(null));
    const repo = new LocalStorageRepository();
    expect(repo.load()).to.deep.equal(freshState());
  });

  it('save() then load() round-trips state', () => {
    const repo = new LocalStorageRepository();
    const state: State = { ...freshState(), entries: [
      { id: 'e1', date: '2026-05-23', foodId: 'seed-banana', amount: 120, unit: 'g', grams: 120, loggedAt: '2026-05-23T10:00:00Z' },
    ]};
    repo.save(state);
    expect(new LocalStorageRepository().load()).to.deep.equal(state);
  });

  it('save() writes under the documented storage key', () => {
    const repo = new LocalStorageRepository();
    repo.save(freshState());
    expect(localStorage.getItem(STORAGE_KEY)).to.be.a('string');
  });

  it('rejects food entries with missing required fields', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 2,
      foods: [{ id: 'bad', name: 'missing fields' }],
      entries: [],
    }));
    expect(new LocalStorageRepository().load()).to.deep.equal(freshState());
  });

  it('rejects entries with missing required fields', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 2,
      foods: [],
      entries: [{ id: 'bad' }],
    }));
    expect(new LocalStorageRepository().load()).to.deep.equal(freshState());
  });

  it('rejects food with empty id or name', () => {
    const base = { kcalPer100g: 1, proteinPer100g: 1, carbsPer100g: 1, fatPer100g: 1, primaryUnit: 'g', weightPerUnit: 100, createdAt: 'x', deletedAt: null };
    for (const f of [{ ...base, id: '', name: 'ok' }, { ...base, id: 'ok', name: '' }]) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, foods: [f], entries: [] }));
      expect(new LocalStorageRepository().load()).to.deep.equal(freshState());
    }
  });

  it('rejects food with negative nutritional values', () => {
    const f = { id: 'f', name: 'n', kcalPer100g: -1, proteinPer100g: 0, carbsPer100g: 0, fatPer100g: 0, primaryUnit: 'g', weightPerUnit: 100, createdAt: 'x', deletedAt: null };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, foods: [f], entries: [] }));
    expect(new LocalStorageRepository().load()).to.deep.equal(freshState());
  });

  it('rejects food with invalid primaryUnit or non-positive weightPerUnit', () => {
    const base = { id: 'f', name: 'n', kcalPer100g: 1, proteinPer100g: 0, carbsPer100g: 0, fatPer100g: 0, createdAt: 'x', deletedAt: null };
    for (const f of [
      { ...base, primaryUnit: 'cups', weightPerUnit: 100 },
      { ...base, primaryUnit: 'g', weightPerUnit: 0 },
      { ...base, primaryUnit: 'g', weightPerUnit: -5 },
      { ...base, primaryUnit: 'g', weightPerUnit: NaN },
    ]) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, foods: [f], entries: [] }));
      expect(new LocalStorageRepository().load()).to.deep.equal(freshState());
    }
  });

  it('rejects entry with grams that is <= 0 or not finite', () => {
    const f = { id: 'f', name: 'n', kcalPer100g: 1, proteinPer100g: 0, carbsPer100g: 0, fatPer100g: 0, primaryUnit: 'g', weightPerUnit: 100, createdAt: 'x', deletedAt: null };
    const baseEntry = { id: 'e', date: '2026-05-23', foodId: 'f', amount: 100, unit: 'g', loggedAt: 'x' };
    for (const grams of [0, -1, NaN, Infinity]) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, foods: [f], entries: [{ ...baseEntry, grams }] }));
      expect(new LocalStorageRepository().load()).to.deep.equal(freshState());
    }
  });

  it('rejects entry with empty foodId', () => {
    const f = { id: 'f', name: 'n', kcalPer100g: 1, proteinPer100g: 0, carbsPer100g: 0, fatPer100g: 0, primaryUnit: 'g', weightPerUnit: 100, createdAt: 'x', deletedAt: null };
    const entry = { id: 'e', date: '2026-05-23', foodId: '', amount: 10, unit: 'g', grams: 10, loggedAt: 'x' };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, foods: [f], entries: [entry] }));
    expect(new LocalStorageRepository().load()).to.deep.equal(freshState());
  });

  it('rejects entry with invalid unit', () => {
    const f = { id: 'f', name: 'n', kcalPer100g: 1, proteinPer100g: 0, carbsPer100g: 0, fatPer100g: 0, primaryUnit: 'g', weightPerUnit: 100, createdAt: 'x', deletedAt: null };
    const entry = { id: 'e', date: '2026-05-23', foodId: 'f', amount: 10, unit: 'gallons', grams: 10, loggedAt: 'x' };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, foods: [f], entries: [entry] }));
    expect(new LocalStorageRepository().load()).to.deep.equal(freshState());
  });

  describe('v1 → v2 migration', () => {
    it('reads a v1 blob and presents it as v2 (foods default to grams)', () => {
      const v1Food = { id: 'old', name: 'Old food', kcalPer100g: 100, proteinPer100g: 1, carbsPer100g: 2, fatPer100g: 3, createdAt: 'x', deletedAt: null };
      const v1Entry = { id: 'e1', date: '2026-05-23', foodId: 'old', grams: 80, loggedAt: 'y' };
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, foods: [v1Food], entries: [v1Entry] }));
      const loaded = new LocalStorageRepository().load();
      expect(loaded.version).to.equal(2);
      expect(loaded.foods[0]).to.include({ id: 'old', primaryUnit: 'g', weightPerUnit: 100 });
      expect(loaded.entries[0]).to.include({ id: 'e1', amount: 80, unit: 'g', grams: 80 });
    });

    it('a v1 blob round-trips to a v2 blob after save()', () => {
      const v1Food = { id: 'old', name: 'Old', kcalPer100g: 100, proteinPer100g: 1, carbsPer100g: 2, fatPer100g: 3, createdAt: 'x', deletedAt: null };
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, foods: [v1Food], entries: [] }));
      const repo = new LocalStorageRepository();
      const state = repo.load();
      repo.save(state);
      const reloaded = new LocalStorageRepository().load();
      expect(reloaded).to.deep.equal(state);
      const raw = localStorage.getItem(STORAGE_KEY)!;
      expect(JSON.parse(raw).version).to.equal(2);
    });
  });

  it('round-trips a food with non-null deletedAt', () => {
    const repo = new LocalStorageRepository();
    const state = freshState();
    state.foods = state.foods.map((f, i) => i === 0 ? { ...f, deletedAt: '2026-05-23T12:00:00Z' } : f);
    repo.save(state);
    expect(new LocalStorageRepository().load()).to.deep.equal(state);
  });
});
