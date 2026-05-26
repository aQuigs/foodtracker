import { expect } from '@esm-bundle/chai';
import { LocalStorageRepository, STORAGE_KEY, STORAGE_KEY_V1, STORAGE_KEY_V2 } from '../../src/persistence/localStorage.js';
import { freshState } from '../../src/domain/seed.js';
import type { State } from '../../src/domain/types.js';

const validNutritionFacts = { calories: 1, protein: 1, carbs: 1, fat: 1 };
const foodBase = {
  nutritionFacts: validNutritionFacts, servingSize: 100, servingUnit: 'g',
  createdAt: 'x', deletedAt: null,
};
const entry = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'e1', date: '2026-05-23', foodId: 'seed-banana',
  amount: 120, unit: 'g', loggedAt: '2026-05-23T10:00:00Z',
  ...overrides,
});

describe('LocalStorageRepository', () => {
  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY_V2);
    localStorage.removeItem(STORAGE_KEY_V1);
  });
  afterEach(() => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY_V2);
    localStorage.removeItem(STORAGE_KEY_V1);
  });

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
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 3, foods: 'nope', entries: [] }));
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
      version: 3,
      foods: [{ id: 'bad', name: 'missing fields' }],
      entries: [],
    }));
    expect(new LocalStorageRepository().load()).to.deep.equal(freshState());
  });

  it('rejects entries with missing required fields', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 3,
      foods: [],
      entries: [{ id: 'bad' }],
    }));
    expect(new LocalStorageRepository().load()).to.deep.equal(freshState());
  });

  it('rejects food with empty id or name', () => {
    for (const f of [{ ...foodBase, id: '', name: 'ok' }, { ...foodBase, id: 'ok', name: '' }]) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 3, foods: [f], entries: [] }));
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 3, foods: [f], entries: [] }));
      expect(new LocalStorageRepository().load()).to.deep.equal(freshState());
    }
  });

  it('rejects food with missing nutrient fields', () => {
    const incomplete = { calories: 1, protein: 1, carbs: 1 };
    const f = { ...foodBase, id: 'f', name: 'n', nutritionFacts: incomplete };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 3, foods: [f], entries: [] }));
    expect(new LocalStorageRepository().load()).to.deep.equal(freshState());
  });

  it('rejects food with invalid servingUnit', () => {
    const f = { ...foodBase, id: 'f', name: 'n', servingUnit: 'tsp' };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 3, foods: [f], entries: [] }));
    expect(new LocalStorageRepository().load()).to.deep.equal(freshState());
  });

  it('rejects food with non-positive servingSize', () => {
    for (const s of [0, -1, NaN]) {
      const f = { ...foodBase, id: 'f', name: 'n', servingSize: s };
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 3, foods: [f], entries: [] }));
      expect(new LocalStorageRepository().load()).to.deep.equal(freshState());
    }
  });

  it('rejects entry with amount that is non-positive or non-numeric in stored JSON', () => {
    const f = { ...foodBase, id: 'f', name: 'n' };
    for (const amount of [0, -1, null, 'abc', true]) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 3, foods: [f], entries: [entry({ foodId: 'f', amount })] }));
      expect(new LocalStorageRepository().load()).to.deep.equal(freshState());
    }
  });

  it('rejects entry with empty foodId', () => {
    const f = { ...foodBase, id: 'f', name: 'n' };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 3, foods: [f], entries: [entry({ foodId: '' })] }));
    expect(new LocalStorageRepository().load()).to.deep.equal(freshState());
  });

  it('rejects entry with invalid unit', () => {
    const f = { ...foodBase, id: 'f', name: 'n' };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 3, foods: [f], entries: [entry({ foodId: 'f', unit: 'tsp' })] }));
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

  describe('v1 → v3 migration', () => {
    const v1Food = {
      id: 'f1', name: 'Banana',
      nutritionFacts: validNutritionFacts,
      createdAt: '2026-01-01T00:00:00Z', deletedAt: null,
    };
    const v1Entry = { id: 'e1', date: '2026-05-23', foodId: 'f1', grams: 120, loggedAt: '2026-05-23T10:00:00Z' };

    it('reads a v1 blob and returns v3 shape with servingSize=100, servingUnit=g', () => {
      localStorage.setItem(STORAGE_KEY_V1, JSON.stringify({ version: 1, foods: [v1Food], entries: [v1Entry] }));
      const loaded = new LocalStorageRepository().load();
      expect(loaded.version).to.equal(3);
      expect(loaded.foods[0]).to.deep.include({ servingSize: 100, servingUnit: 'g' });
      expect(loaded.entries[0]).to.deep.include({ amount: 120, unit: 'g' });
    });

    it('writes back as v3 after migrating', () => {
      localStorage.setItem(STORAGE_KEY_V1, JSON.stringify({ version: 1, foods: [v1Food], entries: [v1Entry] }));
      new LocalStorageRepository().load();
      const raw = localStorage.getItem(STORAGE_KEY)!;
      expect(JSON.parse(raw).version).to.equal(3);
    });

    it('prefers v3 over v1 when both keys exist', () => {
      localStorage.setItem(STORAGE_KEY_V1, JSON.stringify({ version: 1, foods: [v1Food], entries: [v1Entry] }));
      const repo = new LocalStorageRepository();
      const v3State: State = { ...freshState(), entries: [entry()] };
      repo.save(v3State);
      expect(new LocalStorageRepository().load()).to.deep.equal(v3State);
    });

    it('returns freshState when v1 blob is corrupt', () => {
      localStorage.setItem(STORAGE_KEY_V1, 'not json');
      expect(new LocalStorageRepository().load()).to.deep.equal(freshState());
    });
  });

  describe('v2 → v3 migration', () => {
    const v2GramFood = {
      id: 'f1', name: 'Banana',
      nutritionFacts: { calories: 89, protein: 1.1, carbs: 22.8, fat: 0.3 },
      primaryUnit: 'g', weightPerUnit: 100,
      createdAt: '2026-01-01T00:00:00Z', deletedAt: null,
    };
    const v2CountFood = {
      id: 'egg', name: 'Egg',
      nutritionFacts: { calories: 155, protein: 13, carbs: 1.1, fat: 11 },
      primaryUnit: 'count', weightPerUnit: 50,
      createdAt: '2026-01-01T00:00:00Z', deletedAt: null,
    };

    it('migrates a v2 g-food to servingSize=100, servingUnit=g, nutrition unchanged', () => {
      localStorage.setItem(STORAGE_KEY_V2, JSON.stringify({ version: 2, foods: [v2GramFood], entries: [] }));
      const loaded = new LocalStorageRepository().load();
      expect(loaded.version).to.equal(3);
      expect(loaded.foods[0]).to.deep.include({ servingSize: 100, servingUnit: 'g' });
      expect(loaded.foods[0]!.nutritionFacts.calories).to.equal(89);
    });

    it('migrates a v2 count-food to servingSize=1, servingUnit=count, nutrition scaled', () => {
      localStorage.setItem(STORAGE_KEY_V2, JSON.stringify({ version: 2, foods: [v2CountFood], entries: [] }));
      const loaded = new LocalStorageRepository().load();
      expect(loaded.foods[0]!.servingSize).to.equal(1);
      expect(loaded.foods[0]!.servingUnit).to.equal('count');
      expect(loaded.foods[0]!.nutritionFacts.calories).to.be.closeTo(77.5, 1e-6);
    });

    it('writes back as v3 after migrating v2', () => {
      localStorage.setItem(STORAGE_KEY_V2, JSON.stringify({ version: 2, foods: [v2GramFood], entries: [] }));
      new LocalStorageRepository().load();
      const raw = localStorage.getItem(STORAGE_KEY)!;
      expect(JSON.parse(raw).version).to.equal(3);
    });
  });
});
