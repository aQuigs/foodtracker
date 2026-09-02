import { expect } from '@esm-bundle/chai';
import { openDB, deleteDB } from 'idb';
import { IndexedDbFoodSourceRepository } from '../../src/persistence/indexedDbFoodSource.js';

describe('IndexedDbFoodSourceRepository — read-boundary validation', () => {
  let dbName: string;
  let counter = 0;

  beforeEach(() => {
    dbName = `foodtracker-validation-${Date.now()}-${++counter}`;
  });

  afterEach(async () => {
    await deleteDB(dbName);
  });

  async function seedRaw(record: Record<string, unknown>, store: 'foods' | 'manifests'): Promise<void> {
    const db = await openDB(dbName, 2, {
      upgrade(d) {
        const foods = d.createObjectStore('foods', { keyPath: 'id' });
        foods.createIndex('by-source', 'source');
        foods.createIndex('by-name-key', 'name_key');
        d.createObjectStore('manifests', { keyPath: 'source' });
      },
    });

    await db.put(store, record);
    db.close();
  }

  async function searchBad(): Promise<unknown[]> {
    const repo = new IndexedDbFoodSourceRepository(dbName);
    const results = await repo.search('bad', { limit: 10 });
    await repo.close();
    return results;
  }

  it('search() skips a row missing nutritionFacts', async () => {
    await seedRaw({
      id: 'bad-1',
      name: 'Bad',
      name_key: 'bad',
      source: 'usda',
      sourceId: 'bad-1',
      servingSize: 100,
      servingUnit: 'g',
    }, 'foods');

    expect(await searchBad()).to.deep.equal([]);
  });

  it('search() skips a row with malformed nutritionFacts', async () => {
    await seedRaw({
      id: 'bad-2',
      name: 'Bad',
      name_key: 'bad',
      source: 'usda',
      sourceId: 'bad-2',
      servingSize: 100,
      servingUnit: 'g',
      nutritionFacts: { calories: 'oops', protein: 1, carbs: 1, fat: 1 },
    }, 'foods');

    expect(await searchBad()).to.deep.equal([]);
  });

  it('search() skips a row with bad servingSize', async () => {
    await seedRaw({
      id: 'bad-3',
      name: 'Bad',
      name_key: 'bad',
      source: 'usda',
      sourceId: 'bad-3',
      servingSize: 0,
      servingUnit: 'g',
      nutritionFacts: { calories: 100, protein: 1, carbs: 1, fat: 1 },
    }, 'foods');

    expect(await searchBad()).to.deep.equal([]);
  });

  it('currentVersion() treats a corrupted manifest row as absent', async () => {
    await seedRaw({
      source: 'usda',
      version: 'v1',
      itemCount: NaN,
      sha256: 'a'.repeat(64),
      generatedAt: '2026-05-28T00:00:00.000Z',
    }, 'manifests');

    const repo = new IndexedDbFoodSourceRepository(dbName);
    expect(await repo.currentVersion('usda')).to.equal(null);
    await repo.close();
  });

  it('currentVersion() reads a valid manifest written directly', async () => {
    await seedRaw({
      source: 'usda',
      version: 'v1',
      itemCount: 5,
      sha256: 'a'.repeat(64),
      generatedAt: '2026-05-28T00:00:00.000Z',
    }, 'manifests');

    const repo = new IndexedDbFoodSourceRepository(dbName);
    expect(await repo.currentVersion('usda')).to.equal('v1');
    await repo.close();
  });
});
