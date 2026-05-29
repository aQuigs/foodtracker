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

  async function seedRaw(record: Record<string, unknown> | undefined, store: 'foods' | 'manifests', key?: string) {
    const db = await openDB(dbName, 1, {
      upgrade(d) {
        const foods = d.createObjectStore('foods', { keyPath: 'id' });
        foods.createIndex('by-source', 'source');
        foods.createIndex('by-name-lower', 'name_lower');
        d.createObjectStore('manifests', { keyPath: 'source' });
      },
    });

    if (record !== undefined) {
      if (key !== undefined) {
        await db.put(store, record, key);
      } else {
        await db.put(store, record);
      }
    }

    db.close();
  }

  it('getById() returns null for a row missing nutritionFacts', async () => {
    await seedRaw({
      id: 'bad-1',
      name: 'Bad',
      name_lower: 'bad',
      source: 'usda',
      sourceId: 'bad-1',
      servingSize: 100,
      servingUnit: 'g',
    }, 'foods');

    const repo = new IndexedDbFoodSourceRepository(dbName);
    expect(await repo.getById('bad-1')).to.equal(null);
    await repo.close();
  });

  it('getById() returns null for a row with malformed nutritionFacts', async () => {
    await seedRaw({
      id: 'bad-2',
      name: 'Bad',
      name_lower: 'bad',
      source: 'usda',
      sourceId: 'bad-2',
      servingSize: 100,
      servingUnit: 'g',
      nutritionFacts: { calories: 'oops', protein: 1, carbs: 1, fat: 1 },
    }, 'foods');

    const repo = new IndexedDbFoodSourceRepository(dbName);
    expect(await repo.getById('bad-2')).to.equal(null);
    await repo.close();
  });

  it('getById() returns null for a row with bad servingSize', async () => {
    await seedRaw({
      id: 'bad-3',
      name: 'Bad',
      name_lower: 'bad',
      source: 'usda',
      sourceId: 'bad-3',
      servingSize: 0,
      servingUnit: 'g',
      nutritionFacts: { calories: 100, protein: 1, carbs: 1, fat: 1 },
    }, 'foods');

    const repo = new IndexedDbFoodSourceRepository(dbName);
    expect(await repo.getById('bad-3')).to.equal(null);
    await repo.close();
  });

  it('isHydrated() and currentVersion() agree on a corrupted manifest row', async () => {
    await seedRaw({
      source: 'usda',
      version: 'v1',
      itemCount: NaN,
      sha256: 'a'.repeat(64),
      generatedAt: '2026-05-28T00:00:00.000Z',
    }, 'manifests');

    const repo = new IndexedDbFoodSourceRepository(dbName);
    expect(await repo.isHydrated('usda')).to.equal(false);
    expect(await repo.currentVersion('usda')).to.equal(null);
    await repo.close();
  });

  it('isManifest accepts a valid manifest written directly', async () => {
    await seedRaw({
      source: 'usda',
      version: 'v1',
      itemCount: 5,
      sha256: 'a'.repeat(64),
      generatedAt: '2026-05-28T00:00:00.000Z',
    }, 'manifests');

    const repo = new IndexedDbFoodSourceRepository(dbName);
    expect(await repo.isHydrated('usda')).to.equal(true);
    expect(await repo.currentVersion('usda')).to.equal('v1');
    await repo.close();
  });
});
