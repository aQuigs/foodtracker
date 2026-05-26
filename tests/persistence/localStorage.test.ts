import { expect } from '@esm-bundle/chai';
import { LocalStorageRepository, STORAGE_KEY } from '../../src/persistence/localStorage.js';
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
  beforeEach(() => { localStorage.removeItem(STORAGE_KEY); });
  afterEach(() => { localStorage.removeItem(STORAGE_KEY); });

  it('load() returns freshState() when key is missing', () => {
    expect(new LocalStorageRepository().load()).to.deep.equal(freshState());
  });

  it('load() returns freshState() when blob is malformed JSON', () => {
    localStorage.setItem(STORAGE_KEY, 'not json {{{');
    expect(new LocalStorageRepository().load()).to.deep.equal(freshState());
  });

  it('load() returns freshState() when shape is invalid', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, foods: 'nope', entries: [] }));
    expect(new LocalStorageRepository().load()).to.deep.equal(freshState());
  });

  it('load() returns freshState() when blob is null/wrong root type', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(null));
    expect(new LocalStorageRepository().load()).to.deep.equal(freshState());
  });

  it('save() then load() round-trips state', () => {
    const repo = new LocalStorageRepository();
    const meal = { id: 'm1', date: '2026-05-23', position: 0 };
    const state: State = {
      ...freshState(),
      meals: [meal],
      entries: [entry({ mealId: 'm1' })],
    };
    repo.save(state);
    expect(new LocalStorageRepository().load()).to.deep.equal(state);
  });

  it('migrates a v1 blob to v2 by creating one synthetic meal per date', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 1,
      foods: freshState().foods,
      entries: [
        { id: 'e1', date: '2026-05-23', foodId: 'seed-banana', amount: 100, unit: 'g', loggedAt: '2026-05-23T08:00:00Z' },
        { id: 'e2', date: '2026-05-23', foodId: 'seed-oats',   amount: 50,  unit: 'g', loggedAt: '2026-05-23T09:00:00Z' },
        { id: 'e3', date: '2026-05-22', foodId: 'seed-banana', amount: 80,  unit: 'g', loggedAt: '2026-05-22T08:00:00Z' },
      ],
    }));
    const makeId = (() => { let i = 0; return () => `mig-${++i}`; })();
    const loaded = new LocalStorageRepository(makeId).load();
    expect(loaded.version).to.equal(2);
    expect(loaded.meals).to.have.lengthOf(2);
    const byDate = new Map(loaded.meals.map((m) => [m.date, m]));
    expect(byDate.get('2026-05-23')!.position).to.equal(0);
    expect(byDate.get('2026-05-22')!.position).to.equal(0);
    expect(loaded.entries.filter((e) => e.date === '2026-05-23').every((e) => e.mealId === byDate.get('2026-05-23')!.id)).to.equal(true);
    expect(loaded.entries.filter((e) => e.date === '2026-05-22').every((e) => e.mealId === byDate.get('2026-05-22')!.id)).to.equal(true);
  });

  it('returns freshState when a stored v2 blob has an entry with mealId not in meals', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 2,
      foods: freshState().foods,
      meals: [{ id: 'm1', date: '2026-05-23', position: 0 }],
      entries: [{ id: 'e1', date: '2026-05-23', foodId: 'seed-banana', amount: 100, unit: 'g', mealId: 'nonexistent', loggedAt: '2026-05-23T08:00:00Z' }],
    }));
    expect(new LocalStorageRepository().load()).to.deep.equal(freshState());
  });

  it('save() writes under the documented storage key', () => {
    new LocalStorageRepository().save(freshState());
    expect(localStorage.getItem(STORAGE_KEY)).to.be.a('string');
  });

  it('rejects food entries with missing required fields', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 1, foods: [{ id: 'bad', name: 'missing fields' }], entries: [],
    }));
    expect(new LocalStorageRepository().load()).to.deep.equal(freshState());
  });

  it('rejects entries with missing required fields', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 1, foods: [], entries: [{ id: 'bad' }],
    }));
    expect(new LocalStorageRepository().load()).to.deep.equal(freshState());
  });

  it('rejects food with empty id or name', () => {
    for (const f of [{ ...foodBase, id: '', name: 'ok' }, { ...foodBase, id: 'ok', name: '' }]) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, foods: [f], entries: [] }));
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, foods: [f], entries: [] }));
      expect(new LocalStorageRepository().load()).to.deep.equal(freshState());
    }
  });

  it('rejects food with missing nutrient fields', () => {
    const f = { ...foodBase, id: 'f', name: 'n', nutritionFacts: { calories: 1, protein: 1, carbs: 1 } };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, foods: [f], entries: [] }));
    expect(new LocalStorageRepository().load()).to.deep.equal(freshState());
  });

  it('rejects food with invalid servingUnit', () => {
    const f = { ...foodBase, id: 'f', name: 'n', servingUnit: 'tsp' };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, foods: [f], entries: [] }));
    expect(new LocalStorageRepository().load()).to.deep.equal(freshState());
  });

  it('rejects food with non-positive servingSize', () => {
    for (const s of [0, -1, NaN]) {
      const f = { ...foodBase, id: 'f', name: 'n', servingSize: s };
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, foods: [f], entries: [] }));
      expect(new LocalStorageRepository().load()).to.deep.equal(freshState());
    }
  });

  it('rejects entry with amount that is non-positive or non-numeric in stored JSON', () => {
    const f = { ...foodBase, id: 'f', name: 'n' };
    for (const amount of [0, -1, null, 'abc', true]) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, foods: [f], entries: [entry({ foodId: 'f', amount })] }));
      expect(new LocalStorageRepository().load()).to.deep.equal(freshState());
    }
  });

  it('rejects entry with empty foodId', () => {
    const f = { ...foodBase, id: 'f', name: 'n' };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, foods: [f], entries: [entry({ foodId: '' })] }));
    expect(new LocalStorageRepository().load()).to.deep.equal(freshState());
  });

  it('rejects entry with invalid unit', () => {
    const f = { ...foodBase, id: 'f', name: 'n' };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, foods: [f], entries: [entry({ foodId: 'f', unit: 'tsp' })] }));
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
      expect(() => new LocalStorageRepository().save(freshState())).to.not.throw();
    } finally {
      localStorage.setItem = original;
    }
  });
});
