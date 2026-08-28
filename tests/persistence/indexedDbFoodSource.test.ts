import { expect } from '@esm-bundle/chai';
import { deleteDB, openDB } from 'idb';
import { IndexedDbFoodSourceRepository } from '../../src/persistence/indexedDbFoodSource.js';
import { describeFoodSourceRepositoryContract } from './foodSourceRepositoryContract.js';
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

describe('IndexedDbFoodSourceRepository — open failure recovery', () => {
  // Opening at version 1 when the database already exists at version 2 is a
  // real, deterministic VersionError — no mocking of indexedDB needed.
  async function makeUnopenableDb(): Promise<string> {
    const dbName = `foodtracker-test-fail-${Date.now()}-${++dbCounter}`;
    const pre = await openDB(dbName, 2, {
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
