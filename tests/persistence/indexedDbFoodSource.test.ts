import { expect } from '@esm-bundle/chai';
import { deleteDB, openDB, type IDBPDatabase } from 'idb';
import { IndexedDbFoodSourceRepository } from '../../src/persistence/indexedDbFoodSource.js';
import { describeFoodSourceRepositoryContract, usdaManifest } from './foodSourceRepositoryContract.js';
import { rejectionOf } from '../_helpers.js';

let dbCounter = 0;

describeFoodSourceRepositoryContract(
  'IndexedDbFoodSourceRepository',
  async () => {
    const dbName = `foodtracker-test-${Date.now()}-${++dbCounter}`;
    const repo = new IndexedDbFoodSourceRepository(dbName);
    return {
      repo,
      cleanup: async () => {
        await repo.close();
        await deleteDB(dbName);
      },
    };
  },
);

describe('IndexedDbFoodSourceRepository — schema upgrade', () => {
  it('rebuilds a database left by the previous schema, so stale rows never survive', async () => {
    const dbName = `foodtracker-test-upgrade-${Date.now()}-${++dbCounter}`;
    const old = await openDB(dbName, 1, {
      upgrade(db) {
        const foods = db.createObjectStore('foods', { keyPath: 'id' });
        foods.createIndex('by-source', 'source');
        foods.createIndex('by-name-lower', 'name_lower');
        db.createObjectStore('manifests', { keyPath: 'source' });
      },
    });
    await old.put('manifests', usdaManifest('5'));
    old.close();

    const repo = new IndexedDbFoodSourceRepository(dbName);
    expect(await repo.currentVersion('usda')).to.equal(null);
    expect(await repo.search('a', {})).to.deep.equal([]);
    await repo.close();
    await deleteDB(dbName);
  });
});

describe('IndexedDbFoodSourceRepository — index usage', () => {
  it('a search restricted to sources opens only the by-source index; an unrestricted search opens by-name-key', async () => {
    const dbName = `foodtracker-test-index-${Date.now()}-${++dbCounter}`;
    const repo = new IndexedDbFoodSourceRepository(dbName);

    await repo.hydrate('listed', [
      { id: 'listed:a', name: 'Apple', nutritionFacts: { calories: 1, protein: 1, carbs: 1, fat: 1 }, servingSize: 100, servingUnit: 'g', source: 'listed', sourceId: 'a' },
    ], { ...usdaManifest('v1', 1), source: 'listed' });
    await repo.hydrate('decoy', [
      { id: 'decoy:a', name: 'Apricot', nutritionFacts: { calories: 1, protein: 1, carbs: 1, fat: 1 }, servingSize: 100, servingUnit: 'g', source: 'decoy', sourceId: 'a' },
    ], { ...usdaManifest('v1', 1), source: 'decoy' });

    const openedIndexes: string[] = [];
    const originalOpenCursor = IDBIndex.prototype.openCursor;
    IDBIndex.prototype.openCursor = function (this: IDBIndex, ...args: Parameters<IDBIndex['openCursor']>) {
      openedIndexes.push(this.name);
      return originalOpenCursor.apply(this, args);
    };

    try {
      await repo.search('a', { sources: ['listed'] });
      expect(openedIndexes).to.deep.equal(['by-source']);

      openedIndexes.length = 0;
      await repo.search('a', {});
      expect(openedIndexes).to.deep.equal(['by-name-key']);
    } finally {
      IDBIndex.prototype.openCursor = originalOpenCursor;
    }

    await repo.close();
    await deleteDB(dbName);
  });
});

describe('IndexedDbFoodSourceRepository — a database a newer build left', () => {
  // Opening at the repository's schema version when the database already
  // exists at a higher one is a real, deterministic VersionError — no mocking
  // of indexedDB needed.
  async function newerDb(): Promise<{ dbName: string; holder: IDBPDatabase }> {
    const dbName = `foodtracker-test-newer-${Date.now()}-${++dbCounter}`;
    const holder = await openDB(dbName, 99, {
      upgrade(db) {
        db.createObjectStore('placeholder');
      },
    });
    return { dbName, holder };
  }

  it('is dropped and rebuilt at this schema, and the catalog works again', async () => {
    const { dbName, holder } = await newerDb();
    holder.close();
    const repo = new IndexedDbFoodSourceRepository(dbName);

    expect(await repo.currentVersion('usda')).to.equal(null);
    await repo.hydrate('usda', [
      { id: 'usda:a', name: 'Apple', nutritionFacts: { calories: 1, protein: 1, carbs: 1, fat: 1 }, servingSize: 100, servingUnit: 'g', source: 'usda', sourceId: 'a' },
    ], usdaManifest('v1', 1));
    expect((await repo.search('apple', {})).map((f) => f.id)).to.deep.equal(['usda:a']);
    await repo.close();

    const rebuilt = await openDB(dbName);
    expect([...rebuilt.objectStoreNames].sort()).to.deep.equal(['foods', 'manifests', 'meta']);
    rebuilt.close();
    await deleteDB(dbName);
  });

  // Another tab still holding the newer database open blocks the delete;
  // the open fails like any other rather than waiting on that tab.
  it('fails the open while another connection holds it, is not cached, and heals once that connection closes', async () => {
    const { dbName, holder } = await newerDb();
    const repo = new IndexedDbFoodSourceRepository(dbName);

    await rejectionOf(repo.currentVersion('usda'));

    holder.close();

    expect(await repo.currentVersion('usda')).to.equal(null);
    await repo.close();
    await deleteDB(dbName);
  });

  it('close() after a failed open resolves and leaves the instance reusable', async () => {
    const { dbName, holder } = await newerDb();
    const repo = new IndexedDbFoodSourceRepository(dbName);

    await rejectionOf(repo.currentVersion('usda'));
    await repo.close();

    holder.close();
    expect(await repo.currentVersion('usda')).to.equal(null);
    await repo.close();
    await deleteDB(dbName);
  });
});
