import { expect } from '@esm-bundle/chai';
import { LocalStorageRepository, STORAGE_KEY } from '../../src/persistence/localStorage.js';
import { freshState } from '../../src/domain/seed.js';

const baseV4Food = (chips: unknown) => ({
  id: 'f1', name: 'Test', kcalPer100g: 89, proteinPer100g: 1, carbsPer100g: 1, fatPer100g: 1,
  primaryUnit: 'g', weightPerUnit: 100, createdAt: '2026-01-01T00:00:00Z', deletedAt: null,
  chips,
});

describe('chips field migration (v2 → v4 → v5)', () => {
  beforeEach(() => localStorage.removeItem(STORAGE_KEY));
  afterEach(() => localStorage.removeItem(STORAGE_KEY));

  it('reads a v2 blob and adds chips: null to each food', () => {
    const v2Food = {
      id: 'f1', name: 'Banana', kcalPer100g: 89, proteinPer100g: 1.1, carbsPer100g: 22.8, fatPer100g: 0.3,
      primaryUnit: 'g', weightPerUnit: 100, createdAt: '2026-01-01T00:00:00Z', deletedAt: null,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, foods: [v2Food], entries: [] }));
    const loaded = new LocalStorageRepository().load();
    expect(loaded.version).to.equal(5);
    expect(loaded.foods[0]!.chips).to.equal(null);
  });

  it('v4 blob with chips: null migrates up to v5 without losing chips', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 4, foods: [baseV4Food(null)], entries: [] }));
    const loaded = new LocalStorageRepository().load();
    expect(loaded.version).to.equal(5);
    expect(loaded.foods[0]!.chips).to.equal(null);
  });

  it('v4 blob with custom chips loads correctly', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 4, foods: [baseV4Food([80, 160, 240, 320])], entries: [] }));
    const loaded = new LocalStorageRepository().load();
    expect(loaded.foods[0]!.chips).to.deep.equal([80, 160, 240, 320]);
  });

  it('v4 blob with invalid chips array length rejects', () => {
    for (const chips of [[], [1, 2, 3], [1, 2, 3, 4, 5]]) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 4, foods: [baseV4Food(chips)], entries: [] }));
      expect(new LocalStorageRepository().load(), `chips=${JSON.stringify(chips)}`).to.deep.equal(freshState());
    }
  });

  it('round-trips a v5 food with custom chips through save() and load()', () => {
    const repo = new LocalStorageRepository();
    const state = freshState();
    state.foods[0] = { ...state.foods[0]!, chips: [80, 160, 240, 320] };
    repo.save(state);
    expect(new LocalStorageRepository().load()).to.deep.equal(state);
  });
});
