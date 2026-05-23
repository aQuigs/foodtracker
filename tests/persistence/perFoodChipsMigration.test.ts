import { expect } from '@esm-bundle/chai';
import { LocalStorageRepository, STORAGE_KEY } from '../../src/persistence/localStorage.js';
import { freshState } from '../../src/domain/seed.js';

describe('v2 → v4 migration (chips field)', () => {
  beforeEach(() => localStorage.removeItem(STORAGE_KEY));
  afterEach(() => localStorage.removeItem(STORAGE_KEY));

  it('reads a v2 blob and adds chips: null to each food', () => {
    const v2Food = {
      id: 'f1', name: 'Banana', kcalPer100g: 89, proteinPer100g: 1.1, carbsPer100g: 22.8, fatPer100g: 0.3,
      primaryUnit: 'g', weightPerUnit: 100, createdAt: '2026-01-01T00:00:00Z', deletedAt: null,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, foods: [v2Food], entries: [] }));
    const loaded = new LocalStorageRepository().load();
    expect(loaded.version).to.equal(4);
    expect(loaded.foods[0]!.chips).to.equal(null);
  });

  it('v4 blob loads without migration', () => {
    const v4Food = {
      id: 'f1', name: 'Banana', kcalPer100g: 89, proteinPer100g: 1.1, carbsPer100g: 22.8, fatPer100g: 0.3,
      primaryUnit: 'g', weightPerUnit: 100, createdAt: '2026-01-01T00:00:00Z', deletedAt: null,
      chips: null,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 4, foods: [v4Food], entries: [] }));
    const loaded = new LocalStorageRepository().load();
    expect(loaded.version).to.equal(4);
    expect(loaded.foods[0]!.chips).to.equal(null);
  });

  it('v4 blob with chips: [80, 160, 240, 320] loads correctly', () => {
    const v4Food = {
      id: 'f1', name: 'Tuna', kcalPer100g: 130, proteinPer100g: 29, carbsPer100g: 0, fatPer100g: 1,
      primaryUnit: 'g', weightPerUnit: 100, createdAt: '2026-01-01T00:00:00Z', deletedAt: null,
      chips: [80, 160, 240, 320],
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 4, foods: [v4Food], entries: [] }));
    const loaded = new LocalStorageRepository().load();
    expect(loaded.foods[0]!.chips).to.deep.equal([80, 160, 240, 320]);
  });

  it('v4 blob with empty chips array is rejected (falls back to freshState)', () => {
    const v4Food = {
      id: 'f1', name: 'Bad', kcalPer100g: 89, proteinPer100g: 1, carbsPer100g: 1, fatPer100g: 1,
      primaryUnit: 'g', weightPerUnit: 100, createdAt: '2026-01-01T00:00:00Z', deletedAt: null,
      chips: [],
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 4, foods: [v4Food], entries: [] }));
    expect(new LocalStorageRepository().load()).to.deep.equal(freshState());
  });
});
