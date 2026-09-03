import { openDB, type IDBPDatabase } from 'idb';
import type { SourcedFood, FoodSourceManifest, SearchOptions } from '../domain/types.js';
import { isFoodSourceManifest, isSourcedFood } from '../domain/validate.js';
import type { FoodSourceRepository } from './foodSourceRepository.js';
import { nameMatchesTokens, queryTokens } from './foodNameMatch.js';
import { searchKey } from '../domain/searchKey.js';

// Bump when the stored shape or an index key changes. The upgrade drops every
// store: the catalog is a cache, so the next boot simply re-hydrates it.
const SCHEMA_VERSION = 2;
const FOODS_STORE = 'foods';
const MANIFESTS_STORE = 'manifests';
const SOURCE_INDEX = 'by-source';
const NAME_INDEX = 'by-name-key';

type StoredFood = SourcedFood & { name_key: string };

function isStoredFood(v: unknown): v is StoredFood {
  return isSourcedFood(v) && typeof (v as Record<string, unknown>).name_key === 'string';
}

export class IndexedDbFoodSourceRepository implements FoodSourceRepository {
  #dbPromise: Promise<IDBPDatabase> | null = null;

  constructor(private readonly dbName: string = 'foodtracker-foods') {}

  #db(): Promise<IDBPDatabase> {
    if (!this.#dbPromise) {
      // On rejection, clear the cached promise (unless another open has since
      // replaced it) so a transient failure doesn't permanently brick the repo.
      const opening = openDB(this.dbName, SCHEMA_VERSION, {
        upgrade(db) {
          for (const store of Array.from(db.objectStoreNames)) {
            db.deleteObjectStore(store);
          }

          const foods = db.createObjectStore(FOODS_STORE, { keyPath: 'id' });
          foods.createIndex(SOURCE_INDEX, 'source');
          foods.createIndex(NAME_INDEX, 'name_key');
          db.createObjectStore(MANIFESTS_STORE, { keyPath: 'source' });
        },
      }).catch((err) => {
        if (this.#dbPromise === opening) {
          this.#dbPromise = null;
        }

        throw err;
      });
      this.#dbPromise = opening;
    }

    return this.#dbPromise;
  }

  async currentVersion(source: string): Promise<string | null> {
    const db = await this.#db();
    const raw = await db.get(MANIFESTS_STORE, source);
    return isFoodSourceManifest(raw) ? raw.version : null;
  }

  async hydrate(source: string, items: SourcedFood[], manifest: FoodSourceManifest): Promise<void> {
    if (manifest.source !== source) {
      throw new Error(`hydrate(): manifest.source=${manifest.source} does not match source=${source}`);
    }

    const mistagged = items.find((it) => it.source !== source);
    if (mistagged) {
      throw new Error(`hydrate(): item ${mistagged.id} has source=${mistagged.source}, expected ${source}`);
    }

    const db = await this.#db();
    const tx = db.transaction([FOODS_STORE, MANIFESTS_STORE], 'readwrite');
    const foodsStore = tx.objectStore(FOODS_STORE);
    const writes: Promise<unknown>[] = [];

    let cursor = await foodsStore.index(SOURCE_INDEX).openKeyCursor(IDBKeyRange.only(source));
    while (cursor) {
      writes.push(foodsStore.delete(cursor.primaryKey));
      cursor = await cursor.continue();
    }

    for (const item of items) {
      const stored: StoredFood = { ...item, name_key: searchKey(item.name) };
      writes.push(foodsStore.put(stored));
    }

    writes.push(tx.objectStore(MANIFESTS_STORE).put(manifest));
    await Promise.all([...writes, tx.done]);
  }

  async search(query: string, opts: SearchOptions): Promise<SourcedFood[]> {
    const tokens = queryTokens(query);

    if (tokens.length === 0) {
      return [];
    }

    const sourcesFilter = opts.sources;

    if (sourcesFilter?.length === 0) {
      return [];
    }

    const db = await this.#db();
    const out: SourcedFood[] = [];
    const nameIdx = db.transaction(FOODS_STORE).store.index(NAME_INDEX);

    let cursor = await nameIdx.openCursor();
    while (cursor && (opts.limit === undefined || out.length < opts.limit)) {
      const food = cursor.value;

      if (isStoredFood(food)
          && nameMatchesTokens(food.name_key, tokens)
          && (!sourcesFilter || sourcesFilter.includes(food.source))) {
        const { name_key, ...rest } = food;
        out.push(rest);
      }

      cursor = await cursor.continue();
    }

    return out;
  }

  async close(): Promise<void> {
    const pending = this.#dbPromise;
    this.#dbPromise = null;

    if (pending) {
      const db = await pending.catch(() => null);
      db?.close();
    }
  }
}
