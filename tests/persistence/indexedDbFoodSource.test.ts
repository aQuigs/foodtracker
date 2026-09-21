import { expect } from '@esm-bundle/chai';
import { deleteDB, openDB, type IDBPDatabase } from 'idb';
import { IndexedDbFoodSourceRepository, dropRetiredCatalogCache } from '../../src/persistence/indexedDbFoodSource.js';
import type { SourcedFood } from '../../src/domain/types.js';
import { describeFoodSourceRepositoryContract } from './foodSourceRepositoryContract.js';
import { rejectionOf, until } from '../_helpers.js';

let dbCounter = 0;

function testDbName(kind: string): string {
  return `foodtracker-test-${kind}-${Date.now()}-${++dbCounter}`;
}

function food(source: string, sourceId: string, name: string): SourcedFood {
  return {
    id: `${source}:${sourceId}`, name, nutritionFacts: { calories: 1, protein: 1, carbs: 1, fat: 1 },
    servingSize: 100, servingUnit: 'g', source, sourceId,
  };
}

const APPLE = food('usda', 'a', 'Apple');

async function databaseVersion(name: string): Promise<number | undefined> {
  return (await indexedDB.databases()).find((d) => d.name === name)?.version;
}

// A call that failed because another tab held the database fails until the
// request that tab held up has run; this waits that out.
async function answersAgain(repo: IndexedDbFoodSourceRepository): Promise<void> {
  await until(() => repo.currentVersion('usda').then(() => true, () => false), 'the repository answers again');
}

// Resolves whether or not anything still holds the database open: the flag
// says whether the delete had to wait.
async function deleteReportingBlocked(name: string): Promise<boolean> {
  let blocked = false;
  await deleteDB(name, { blocked: () => { blocked = true; } });
  return blocked;
}

describeFoodSourceRepositoryContract(
  'IndexedDbFoodSourceRepository',
  async () => {
    const dbName = testDbName('contract');
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

describe('IndexedDbFoodSourceRepository — where it keeps the catalog', () => {
  it('opens the database foodtracker-catalog, at schema 1, by default', async () => {
    const repo = new IndexedDbFoodSourceRepository();
    await repo.currentVersion('usda');

    expect(await databaseVersion('foodtracker-catalog')).to.equal(1);
    await repo.close();
    await deleteDB('foodtracker-catalog');
  });
});

describe('dropRetiredCatalogCache()', () => {
  it('deletes foodtracker-foods, where builds before this one cached the catalog', async () => {
    const old = await openDB('foodtracker-foods', 4, { upgrade(db) { db.createObjectStore('foods'); } });
    old.close();

    dropRetiredCatalogCache();

    await until(async () => (await databaseVersion('foodtracker-foods')) === undefined, 'the retired database is gone');
  });

  it('returns at once while another tab holds the retired database open, and the delete runs once that tab lets go', async () => {
    const holder = await openDB('foodtracker-foods', 3, { upgrade(db) { db.createObjectStore('foods'); } });

    expect(() => dropRetiredCatalogCache()).to.not.throw();
    expect(await databaseVersion('foodtracker-foods')).to.equal(3);

    holder.close();
    await until(async () => (await databaseVersion('foodtracker-foods')) === undefined, 'the retired database is gone');
  });
});

describe('IndexedDbFoodSourceRepository — schema upgrade', () => {
  it('rebuilds a database an earlier schema left, so stale rows never survive', async () => {
    const dbName = testDbName('upgrade');
    const earlier = new IndexedDbFoodSourceRepository(dbName, 1);
    await earlier.hydrate('usda', [APPLE], 'v1');
    await earlier.close();

    const repo = new IndexedDbFoodSourceRepository(dbName, 2);
    expect(await repo.currentVersion('usda')).to.equal(null);
    expect(await repo.search('apple', {})).to.deep.equal([]);
    await repo.close();
    await deleteDB(dbName);
  });
});

describe('IndexedDbFoodSourceRepository — index usage', () => {
  it('a search restricted to sources opens only the by-source index; an unrestricted search opens by-name-key', async () => {
    const dbName = testDbName('index');
    const repo = new IndexedDbFoodSourceRepository(dbName);

    await repo.hydrate('listed', [food('listed', 'a', 'Apple')], 'v1');
    await repo.hydrate('decoy', [food('decoy', 'a', 'Apricot')], 'v1');

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

describe('IndexedDbFoodSourceRepository — another tab', () => {
  it('lets another tab delete the database: closes its connection, and reopens on its next call', async () => {
    const dbName = testDbName('deleted');
    const repo = new IndexedDbFoodSourceRepository(dbName);
    await repo.hydrate('usda', [APPLE], 'v1');

    expect(await deleteReportingBlocked(dbName)).to.equal(false);

    expect(await repo.currentVersion('usda')).to.equal(null);
    await repo.close();
    await deleteDB(dbName);
  });

  it('lets a newer build upgrade it, then rebuilds it at its own schema on its next call, neither waiting on the other', async () => {
    const dbName = testDbName('two-builds');
    const older = new IndexedDbFoodSourceRepository(dbName, 1);
    const newer = new IndexedDbFoodSourceRepository(dbName, 2);
    await older.hydrate('usda', [APPLE], 'v1');

    expect(await newer.currentVersion('usda')).to.equal(null);
    await newer.hydrate('usda', [APPLE], 'v2');

    expect(await older.currentVersion('usda')).to.equal(null);
    expect(await databaseVersion(dbName)).to.equal(1);
    expect(await newer.currentVersion('usda')).to.equal(null);
    expect(await databaseVersion(dbName)).to.equal(2);

    await older.close();
    await newer.close();
    await deleteDB(dbName);
  });

  it('fails an upgrade another tab holds up, fails every call after it at once until that tab lets go, then opens', async () => {
    const dbName = testDbName('held-open');
    const holder = await openDB(dbName, 1, { upgrade(db) { db.createObjectStore('placeholder'); } });
    const repo = new IndexedDbFoodSourceRepository(dbName, 2);

    expect((await rejectionOf(repo.currentVersion('usda'))).message).to.match(/another tab/);
    expect((await rejectionOf(repo.currentVersion('usda'))).message).to.match(/another tab/);

    holder.close();
    await answersAgain(repo);
    expect(await repo.currentVersion('usda')).to.equal(null);
    await repo.close();

    expect(await deleteReportingBlocked(dbName), 'no connection is left open behind the held-up upgrade').to.equal(false);
  });
});

describe('IndexedDbFoodSourceRepository — a database a newer build left', () => {
  // Opening at the repository's schema version when the database already
  // exists at a higher one is a real, deterministic VersionError — no mocking
  // of indexedDB needed. The holder ignores versionchange, as a tab that
  // never lets go would.
  async function newerDb(): Promise<{ dbName: string; holder: IDBPDatabase }> {
    const dbName = testDbName('newer');
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
    await repo.hydrate('usda', [APPLE], 'v1');
    expect((await repo.search('apple', {})).map((f) => f.id)).to.deep.equal(['usda:a']);
    await repo.close();

    const rebuilt = await openDB(dbName);
    expect([...rebuilt.objectStoreNames].sort()).to.deep.equal(['foods', 'meta', 'versions']);
    rebuilt.close();
    await deleteDB(dbName);
  });

  it('fails the rebuild while another tab holds the newer database, fails every call after it at once, and heals once that tab lets go', async () => {
    const { dbName, holder } = await newerDb();
    const repo = new IndexedDbFoodSourceRepository(dbName);

    expect((await rejectionOf(repo.currentVersion('usda'))).message).to.match(/another tab/);
    expect((await rejectionOf(repo.currentVersion('usda'))).message).to.match(/another tab/);

    holder.close();
    await answersAgain(repo);
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
    await answersAgain(repo);
    expect(await repo.currentVersion('usda')).to.equal(null);
    await repo.close();
    await deleteDB(dbName);
  });
});
