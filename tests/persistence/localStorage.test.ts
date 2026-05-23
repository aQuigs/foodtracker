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
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, foods: 'nope', entries: [] }));
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
      { id: 'e1', date: '2026-05-23', foodId: 'seed-banana', grams: 120, loggedAt: '2026-05-23T10:00:00Z' },
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
      version: 1,
      foods: [{ id: 'bad', name: 'missing fields' }],
      entries: [],
    }));
    expect(new LocalStorageRepository().load()).to.deep.equal(freshState());
  });

  it('rejects entries with missing required fields', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 1,
      foods: [],
      entries: [{ id: 'bad' }],
    }));
    expect(new LocalStorageRepository().load()).to.deep.equal(freshState());
  });

  it('rejects food with empty id or name', () => {
    const base = { kcalPer100g: 1, proteinPer100g: 1, carbsPer100g: 1, fatPer100g: 1, createdAt: 'x', deletedAt: null };
    for (const f of [{ ...base, id: '', name: 'ok' }, { ...base, id: 'ok', name: '' }]) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, foods: [f], entries: [] }));
      expect(new LocalStorageRepository().load()).to.deep.equal(freshState());
    }
  });

  it('rejects food with negative nutritional values', () => {
    const f = { id: 'f', name: 'n', kcalPer100g: -1, proteinPer100g: 0, carbsPer100g: 0, fatPer100g: 0, createdAt: 'x', deletedAt: null };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, foods: [f], entries: [] }));
    expect(new LocalStorageRepository().load()).to.deep.equal(freshState());
  });

  it('rejects entry with grams that is non-positive, missing, or non-numeric in stored JSON', () => {
    // JSON.stringify({x: NaN}) and ({x: Infinity}) both emit `null`, so testing
    // those JS values here would actually be testing `null` rejection. The realistic
    // stored-JSON cases for a corrupted grams field are: null, string, bool, 0, negative.
    const f = { id: 'f', name: 'n', kcalPer100g: 1, proteinPer100g: 0, carbsPer100g: 0, fatPer100g: 0, createdAt: 'x', deletedAt: null };
    const baseEntry = { id: 'e', date: '2026-05-23', foodId: 'f', loggedAt: 'x' };
    for (const grams of [0, -1, null, 'abc', true]) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, foods: [f], entries: [{ ...baseEntry, grams }] }));
      expect(new LocalStorageRepository().load()).to.deep.equal(freshState());
    }
  });

  it('rejects entry with empty foodId', () => {
    const f = { id: 'f', name: 'n', kcalPer100g: 1, proteinPer100g: 0, carbsPer100g: 0, fatPer100g: 0, createdAt: 'x', deletedAt: null };
    const entry = { id: 'e', date: '2026-05-23', foodId: '', grams: 10, loggedAt: 'x' };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, foods: [f], entries: [entry] }));
    expect(new LocalStorageRepository().load()).to.deep.equal(freshState());
  });

  it('round-trips a food with non-null deletedAt', () => {
    const repo = new LocalStorageRepository();
    const state = freshState();
    state.foods = state.foods.map((f, i) => i === 0 ? { ...f, deletedAt: '2026-05-23T12:00:00Z' } : f);
    repo.save(state);
    expect(new LocalStorageRepository().load()).to.deep.equal(state);
  });

  it('save() does not throw when localStorage.setItem throws (quota exceeded / private browsing)', () => {
    const original = localStorage.setItem;
    localStorage.setItem = () => { throw new DOMException('QuotaExceededError'); };
    try {
      const repo = new LocalStorageRepository();
      expect(() => repo.save(freshState())).to.not.throw();
    } finally {
      localStorage.setItem = original;
    }
  });
});
