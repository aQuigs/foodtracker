import { openDB, type IDBPDatabase } from 'idb';
import type {
  SourcedFood,
  SourcedFoodId,
  FoodSourceManifest,
  SearchOptions,
} from '../domain/types.js';
import { asRecord, isNonEmptyString, isNutritionFacts, isPosFinite } from '../domain/validate.js';
import { isUnit } from '../domain/units.js';
import type { FoodSourceRepository } from './foodSourceRepository.js';

const FOODS_STORE = 'foods';
const MANIFESTS_STORE = 'manifests';
const SOURCE_INDEX = 'by-source';
const NAME_INDEX = 'by-name-lower';

type StoredFood = SourcedFood & { name_lower: string };

function isStoredFood(v: unknown): v is StoredFood {
  const o = asRecord(v);

  if (o === null) {
    return false;
  }

  if (!isNonEmptyString(o.id) || !isNonEmptyString(o.name)) {
    return false;
  }

  if (typeof o.name_lower !== 'string') {
    return false;
  }

  if (!isNonEmptyString(o.source) || !isNonEmptyString(o.sourceId)) {
    return false;
  }

  if (!isNutritionFacts(o.nutritionFacts)) {
    return false;
  }

  if (!isPosFinite(o.servingSize) || !isUnit(o.servingUnit)) {
    return false;
  }

  if (o.tags !== undefined
      && !(Array.isArray(o.tags) && o.tags.every((t) => typeof t === 'string'))) {
    return false;
  }

  return true;
}

function isManifest(v: unknown): v is FoodSourceManifest {
  const o = asRecord(v);
  return o !== null
      && isNonEmptyString(o.source)
      && isNonEmptyString(o.version)
      && typeof o.itemCount === 'number' && Number.isFinite(o.itemCount) && o.itemCount >= 0
      && typeof o.sha256 === 'string'
      && typeof o.generatedAt === 'string';
}

export class IndexedDbFoodSourceRepository implements FoodSourceRepository {
  #dbPromise: Promise<IDBPDatabase> | null = null;

  constructor(private readonly dbName: string = 'foodtracker-foods') {}

  #db(): Promise<IDBPDatabase> {
    if (!this.#dbPromise) {
      this.#dbPromise = openDB(this.dbName, 1, {
        upgrade(db) {
          const foods = db.createObjectStore(FOODS_STORE, { keyPath: 'id' });
          foods.createIndex(SOURCE_INDEX, 'source');
          foods.createIndex(NAME_INDEX, 'name_lower');
          db.createObjectStore(MANIFESTS_STORE, { keyPath: 'source' });
        },
      });
    }
    return this.#dbPromise;
  }

  async isHydrated(source: string): Promise<boolean> {
    const db = await this.#db();
    const raw = await db.get(MANIFESTS_STORE, source);
    return isManifest(raw);
  }

  async currentVersion(source: string): Promise<string | null> {
    const db = await this.#db();
    const raw = await db.get(MANIFESTS_STORE, source);
    return isManifest(raw) ? raw.version : null;
  }

  async hydrate(source: string, items: SourcedFood[], manifest: FoodSourceManifest): Promise<void> {
    if (manifest.source !== source) {
      throw new Error(`hydrate(): manifest.source=${manifest.source} does not match source=${source}`);
    }

    const db = await this.#db();
    const tx = db.transaction([FOODS_STORE, MANIFESTS_STORE], 'readwrite');
    const foodsStore = tx.objectStore(FOODS_STORE);

    let cursor = await foodsStore.index(SOURCE_INDEX).openKeyCursor(IDBKeyRange.only(source));
    while (cursor) {
      foodsStore.delete(cursor.primaryKey);
      cursor = await cursor.continue();
    }

    for (const item of items) {
      const stored: StoredFood = { ...item, name_lower: item.name.toLowerCase() };
      foodsStore.put(stored);
    }

    tx.objectStore(MANIFESTS_STORE).put(manifest);
    await tx.done;
  }

  async clear(source: string): Promise<void> {
    const db = await this.#db();
    const tx = db.transaction([FOODS_STORE, MANIFESTS_STORE], 'readwrite');
    const foodsStore = tx.objectStore(FOODS_STORE);

    let cursor = await foodsStore.index(SOURCE_INDEX).openKeyCursor(IDBKeyRange.only(source));
    while (cursor) {
      foodsStore.delete(cursor.primaryKey);
      cursor = await cursor.continue();
    }

    tx.objectStore(MANIFESTS_STORE).delete(source);
    await tx.done;
  }

  async search(query: string, opts: SearchOptions): Promise<SourcedFood[]> {
    const q = query.trim().toLowerCase();

    if (!q) {
      return [];
    }

    const sourcesFilter = opts.sources;

    if (sourcesFilter && sourcesFilter.length === 0) {
      return [];
    }

    const db = await this.#db();
    const out: SourcedFood[] = [];
    const nameIdx = db.transaction(FOODS_STORE).store.index(NAME_INDEX);

    let cursor = await nameIdx.openCursor();
    while (cursor && out.length < opts.limit) {
      const food = cursor.value;

      if (isStoredFood(food)
          && food.name_lower.includes(q)
          && (!sourcesFilter || sourcesFilter.includes(food.source))) {
        const { name_lower, ...rest } = food;
        out.push(rest);
      }

      cursor = await cursor.continue();
    }

    return out;
  }

  async getById(id: SourcedFoodId): Promise<SourcedFood | null> {
    const db = await this.#db();
    const raw = await db.get(FOODS_STORE, id);

    if (!isStoredFood(raw)) {
      return null;
    }

    const { name_lower, ...rest } = raw;
    return rest;
  }

  async count(source?: string): Promise<number> {
    const db = await this.#db();

    if (source !== undefined) {
      return db.countFromIndex(FOODS_STORE, SOURCE_INDEX, IDBKeyRange.only(source));
    }

    return db.count(FOODS_STORE);
  }

  async close(): Promise<void> {
    if (this.#dbPromise) {
      const db = await this.#dbPromise;
      db.close();
      this.#dbPromise = null;
    }
  }
}
