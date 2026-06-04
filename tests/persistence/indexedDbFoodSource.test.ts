import { expect } from '@esm-bundle/chai';
import { deleteDB, openDB } from 'idb';
import { IndexedDbFoodSourceRepository } from '../../src/persistence/indexedDbFoodSource.js';
import { describeFoodSourceRepositoryContract } from './foodSourceRepositoryContract.js';

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

    let failed = false;
    try {
      await repo.count();
    } catch {
      failed = true;
    }
    expect(failed, 'first call should reject with VersionError').to.equal(true);

    await deleteDB(dbName);

    expect(await repo.count()).to.equal(0);
    await repo.close();
    await deleteDB(dbName);
  });

  it('close() after a failed open resolves and leaves the instance reusable', async () => {
    const dbName = await makeUnopenableDb();
    const repo = new IndexedDbFoodSourceRepository(dbName);

    try {
      await repo.count();
    } catch {
      // expected: open fails
    }

    await repo.close();

    await deleteDB(dbName);
    expect(await repo.count()).to.equal(0);
    await repo.close();
    await deleteDB(dbName);
  });
});
