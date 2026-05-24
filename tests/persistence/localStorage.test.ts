import { expect } from '@esm-bundle/chai';
import { LocalStorageRepository, STORAGE_KEY } from '../../src/persistence/localStorage.js';
import { freshState } from '../../src/domain/seed.js';
import type { State } from '../../src/domain/types.js';

const validPer100g = { calories: 1, protein: 1, carbs: 1, fat: 1 };

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
    const base = { per100g: validPer100g, createdAt: 'x', deletedAt: null };
    for (const f of [{ ...base, id: '', name: 'ok' }, { ...base, id: 'ok', name: '' }]) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, foods: [f], entries: [] }));
      expect(new LocalStorageRepository().load()).to.deep.equal(freshState());
    }
  });

  it('rejects food with any negative nutrient value', () => {
    for (const bad of [
      { ...validPer100g, calories: -1 },
      { ...validPer100g, protein: -1 },
      { ...validPer100g, carbs: -1 },
      { ...validPer100g, fat: -1 },
    ]) {
      const f = { id: 'f', name: 'n', per100g: bad, createdAt: 'x', deletedAt: null };
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, foods: [f], entries: [] }));
      expect(new LocalStorageRepository().load()).to.deep.equal(freshState());
    }
  });

  it('rejects food with missing nutrient fields', () => {
    const incomplete = { calories: 1, protein: 1, carbs: 1 };
    const f = { id: 'f', name: 'n', per100g: incomplete, createdAt: 'x', deletedAt: null };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, foods: [f], entries: [] }));
    expect(new LocalStorageRepository().load()).to.deep.equal(freshState());
  });

  it('rejects entry with grams that is non-positive or non-numeric in stored JSON', () => {
    const f = { id: 'f', name: 'n', per100g: validPer100g, createdAt: 'x', deletedAt: null };
    const baseEntry = { id: 'e', date: '2026-05-23', foodId: 'f', loggedAt: 'x' };
    for (const grams of [0, -1, null, 'abc', true]) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, foods: [f], entries: [{ ...baseEntry, grams }] }));
      expect(new LocalStorageRepository().load()).to.deep.equal(freshState());
    }
  });

  it('rejects entry with empty foodId', () => {
    const f = { id: 'f', name: 'n', per100g: validPer100g, createdAt: 'x', deletedAt: null };
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
