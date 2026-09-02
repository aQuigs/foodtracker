import { expect } from '@esm-bundle/chai';
import { deleteDB, openDB } from 'idb';
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

describe('IndexedDbFoodSourceRepository — open failure recovery', () => {
  // Opening at the repository's schema version when the database already
  // exists at a higher one is a real, deterministic VersionError — no mocking
  // of indexedDB needed.
  async function makeUnopenableDb(): Promise<string> {
    const dbName = `foodtracker-test-fail-${Date.now()}-${++dbCounter}`;
    const pre = await openDB(dbName, 99, {
      upgrade(db) {
        db.createObjectStore('placeholder');
      },
    });
    pre.close();
    return dbName;
  }

  it('a failed open is not cached: the same instance works once the cause is gone', async () => {
    const dbName = await makeUnopenableDb();
    const repo = new IndexedDbFoodSourceRepository(dbName);

    await rejectionOf(repo.currentVersion('usda'));

    await deleteDB(dbName);

    expect(await repo.currentVersion('usda')).to.equal(null);
    await repo.close();
    await deleteDB(dbName);
  });

  it('close() after a failed open resolves and leaves the instance reusable', async () => {
    const dbName = await makeUnopenableDb();
    const repo = new IndexedDbFoodSourceRepository(dbName);

    await rejectionOf(repo.currentVersion('usda'));
    await repo.close();

    await deleteDB(dbName);
    expect(await repo.currentVersion('usda')).to.equal(null);
    await repo.close();
    await deleteDB(dbName);
  });
});
