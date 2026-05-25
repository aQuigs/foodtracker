import { expect } from '@esm-bundle/chai';
import { LocalStorageRepository, STORAGE_KEY, STORAGE_KEY_V1 } from '../../src/persistence/localStorage.js';
import { freshState } from '../../src/domain/seed.js';
import type { State } from '../../src/domain/types.js';

const validNutritionFacts = { calories: 1, protein: 1, carbs: 1, fat: 1 };
const foodBase = {
  nutritionFacts: validNutritionFacts, primaryUnit: 'g', weightPerUnit: 100,
  createdAt: 'x', deletedAt: null,
};
const entry = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'e1', date: '2026-05-23', foodId: 'seed-banana',
  amount: 120, unit: 'g', grams: 120, loggedAt: '2026-05-23T10:00:00Z',
  ...overrides,
});

describe('LocalStorageRepository', () => {
  beforeEach(() => { localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(STORAGE_KEY_V1); });
  afterEach(() => { localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(STORAGE_KEY_V1); });

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
    const state: State = { ...freshState(), entries: [entry()] };
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
    for (const f of [{ ...foodBase, id: '', name: 'ok' }, { ...foodBase, id: 'ok', name: '' }]) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, foods: [f], entries: [] }));
      expect(new LocalStorageRepository().load()).to.deep.equal(freshState());
    }
  });

  it('rejects food with any negative nutrient value', () => {
    for (const bad of [
      { ...validNutritionFacts, calories: -1 },
      { ...validNutritionFacts, protein: -1 },
      { ...validNutritionFacts, carbs: -1 },
      { ...validNutritionFacts, fat: -1 },
    ]) {
      const f = { ...foodBase, id: 'f', name: 'n', nutritionFacts: bad };
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, foods: [f], entries: [] }));
      expect(new LocalStorageRepository().load()).to.deep.equal(freshState());
    }
  });

  it('rejects food with missing nutrient fields', () => {
    const incomplete = { calories: 1, protein: 1, carbs: 1 };
    const f = { ...foodBase, id: 'f', name: 'n', nutritionFacts: incomplete };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, foods: [f], entries: [] }));
    expect(new LocalStorageRepository().load()).to.deep.equal(freshState());
  });

  it('rejects food with invalid primaryUnit', () => {
    const f = { ...foodBase, id: 'f', name: 'n', primaryUnit: 'tsp' };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, foods: [f], entries: [] }));
    expect(new LocalStorageRepository().load()).to.deep.equal(freshState());
  });

  it('rejects food with non-positive weightPerUnit', () => {
    for (const w of [0, -1, NaN]) {
      const f = { ...foodBase, id: 'f', name: 'n', weightPerUnit: w };
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, foods: [f], entries: [] }));
      expect(new LocalStorageRepository().load()).to.deep.equal(freshState());
    }
  });

  it('rejects entry with grams that is non-positive or non-numeric in stored JSON', () => {
    const f = { ...foodBase, id: 'f', name: 'n' };
    for (const grams of [0, -1, null, 'abc', true]) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, foods: [f], entries: [entry({ foodId: 'f', grams })] }));
      expect(new LocalStorageRepository().load()).to.deep.equal(freshState());
    }
  });

  it('rejects entry with empty foodId', () => {
    const f = { ...foodBase, id: 'f', name: 'n' };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, foods: [f], entries: [entry({ foodId: '' })] }));
    expect(new LocalStorageRepository().load()).to.deep.equal(freshState());
  });

  it('rejects entry with invalid unit', () => {
    const f = { ...foodBase, id: 'f', name: 'n' };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, foods: [f], entries: [entry({ foodId: 'f', unit: 'tsp' })] }));
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

  describe('v1 → v2 migration', () => {
    const v1Food = {
      id: 'f1', name: 'Banana',
      nutritionFacts: validNutritionFacts,
      createdAt: '2026-01-01T00:00:00Z', deletedAt: null,
    };
    const v1Entry = { id: 'e1', date: '2026-05-23', foodId: 'f1', amount: 120, unit: 'g', grams: 120, loggedAt: '2026-05-23T10:00:00Z' };

    it('reads a v1 blob, migrates it, and returns v2 shape', () => {
      localStorage.setItem(STORAGE_KEY_V1, JSON.stringify({ version: 1, foods: [v1Food], entries: [v1Entry] }));
      const loaded = new LocalStorageRepository().load();
      expect(loaded.version).to.equal(2);
      expect(loaded.foods[0]).to.deep.include({ primaryUnit: 'g', weightPerUnit: 100 });
      expect(loaded.entries[0]).to.deep.include({ amount: 120, unit: 'g', grams: 120 });
    });

    it('writes back as v2 after migrating', () => {
      localStorage.setItem(STORAGE_KEY_V1, JSON.stringify({ version: 1, foods: [v1Food], entries: [v1Entry] }));
      new LocalStorageRepository().load();
      const v2Raw = localStorage.getItem(STORAGE_KEY)!;
      expect(JSON.parse(v2Raw).version).to.equal(2);
    });

    it('prefers v2 over v1 when both keys exist', () => {
      localStorage.setItem(STORAGE_KEY_V1, JSON.stringify({ version: 1, foods: [v1Food], entries: [v1Entry] }));
      const repo = new LocalStorageRepository();
      const v2State: State = { ...freshState(), entries: [entry()] };
      repo.save(v2State);
      expect(new LocalStorageRepository().load()).to.deep.equal(v2State);
    });

    it('returns freshState when v1 blob is corrupt', () => {
      localStorage.setItem(STORAGE_KEY_V1, 'not json');
      expect(new LocalStorageRepository().load()).to.deep.equal(freshState());
    });
  });
});
