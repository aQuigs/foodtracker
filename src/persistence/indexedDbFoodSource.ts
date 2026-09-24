import { deleteDB, openDB, type IDBPDatabase } from 'idb';
import type { SourcedFood, SearchOptions } from '../domain/types.js';
import { isSourcedFood } from '../domain/validate.js';
import { sharedLoad } from '../domain/sharedLoad.js';
import type { FoodSourceRepository } from './foodSourceRepository.js';
import { compareSearchHits } from './foodNameMatch.js';
import { nameMatchesTokens, queryTokens } from '../domain/searchKey.js';
import { brandedSearchKey } from '../domain/foodSources.js';

// Not foodtracker-foods: builds before this one keep the catalog there, and
// the live site, whose origin every PR preview shares, may be one of them.
// It cannot open that database at a schema above its own, and a delete from
// here would queue behind its open tab, so this build never touches it.
const CATALOG_DB = 'foodtracker-catalog';

// Bump when the stored shape, an index key, or how rows are decoded changes:
// decoded rows are cached per data version, so a decoder change reaches a
// cache already at that version only through a bump. The upgrade drops every
// store: the catalog is a cache, so the next boot simply re-hydrates it.
const SCHEMA_VERSION = 1;
const FOODS_STORE = 'foods';
const VERSIONS_STORE = 'versions';
const META_STORE = 'meta';
const SOURCE_INDEX = 'by-source';
const NAME_INDEX = 'by-name-key';

type VersionRow = { source: string; version: string };

type MetaRow = { key: string; value: unknown };

type StoredFood = SourcedFood & { name_key: string };

function isStoredFood(v: unknown): v is StoredFood {
  return isSourcedFood(v) && typeof (v as Record<string, unknown>).name_key === 'string';
}

function versionOf(row: unknown): string | null {
  const version = (row as Partial<VersionRow> | undefined)?.version;
  return typeof version === 'string' && version !== '' ? version : null;
}

export class IndexedDbFoodSourceRepository implements FoodSourceRepository {
  readonly #connection = sharedLoad(() => this.#openOrRebuild());
  // Set while an open or delete of ours waits on another tab. The request
  // stays queued until that tab lets go, and anything asked of the database
  // meanwhile would queue behind it, so every call fails at once instead.
  #heldUp = false;

  // `schema` is this build's SCHEMA_VERSION; tests pass another to play an
  // earlier or later build against this one.
  constructor(private readonly dbName: string = CATALOG_DB, private readonly schema: number = SCHEMA_VERSION) {}

  #db(): Promise<IDBPDatabase> {
    if (this.#heldUp) {
      return Promise.reject(this.#heldError());
    }

    return this.#connection.get();
  }

  #heldError(): Error {
    return new Error(`${this.dbName}: another tab holds the catalog cache open`);
  }

  // A database a newer build left sits at a schema above this one's and
  // cannot be opened at it — a PR preview and the live site share an origin.
  // The catalog is a cache, so it is dropped and rebuilt at this schema.
  async #openOrRebuild(): Promise<IDBPDatabase> {
    try {
      return await this.#openAtSchema();
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'VersionError')) {
        throw err;
      }

      await this.#failIfHeldUp((blocked) => deleteDB(this.dbName, { blocked }), () => {});
      return this.#openAtSchema();
    }
  }

  #openAtSchema(): Promise<IDBPDatabase> {
    // An open that outlived its caller is nobody's connection; closing it
    // lets the next call open cleanly.
    return this.#failIfHeldUp((blocked) => openDB(this.dbName, this.schema, {
      upgrade(db) {
        for (const store of Array.from(db.objectStoreNames)) {
          db.deleteObjectStore(store);
        }

        const foods = db.createObjectStore(FOODS_STORE, { keyPath: 'id' });
        foods.createIndex(SOURCE_INDEX, 'source');
        foods.createIndex(NAME_INDEX, 'name_key');
        db.createObjectStore(VERSIONS_STORE, { keyPath: 'source' });
        db.createObjectStore(META_STORE, { keyPath: 'key' });
      },
      blocked,
      // Another tab needs the database at another schema, or gone. Letting go
      // at once is what keeps its request from waiting on this tab; the next
      // call here opens again.
      blocking: (_current, _next, event) => {
        (event.target as IDBDatabase).close();
        this.#connection.reset();
      },
    }), (db) => db.close());
  }

  // An open or delete waits for every other connection to close, and a tab
  // that ignores the request never does. Rejects as soon as the request is
  // held up rather than wait on that tab; `late` gets what the still-queued
  // request finally yields.
  #failIfHeldUp<T>(run: (blocked: () => void) => Promise<T>, late: (value: T) => void): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      let heldUp = false;

      const request = run(() => {
        heldUp = true;
        this.#heldUp = true;
        request.then(late, () => {}).finally(() => {
          this.#heldUp = false;
        });
        reject(this.#heldError());
      });

      request.then((value) => {
        if (!heldUp) {
          resolve(value);
        }
      }, (err: unknown) => {
        if (!heldUp) {
          reject(err);
        }
      });
    });
  }

  async currentVersion(source: string): Promise<string | null> {
    const db = await this.#db();
    return versionOf(await db.get(VERSIONS_STORE, source));
  }

  async hydrate(source: string, items: SourcedFood[], version: string): Promise<void> {
    const mistagged = items.find((it) => it.source !== source);
    if (mistagged) {
      throw new Error(`hydrate(): item ${mistagged.id} has source=${mistagged.source}, expected ${source}`);
    }

    const db = await this.#db();
    const tx = db.transaction([FOODS_STORE, VERSIONS_STORE], 'readwrite');
    const foodsStore = tx.objectStore(FOODS_STORE);
    const writes: Promise<unknown>[] = [];

    let cursor = await foodsStore.index(SOURCE_INDEX).openKeyCursor(IDBKeyRange.only(source));
    while (cursor) {
      writes.push(foodsStore.delete(cursor.primaryKey));
      cursor = await cursor.continue();
    }

    for (const item of items) {
      const stored: StoredFood = { ...item, name_key: brandedSearchKey(item.name, item.brand) };
      writes.push(foodsStore.put(stored));
    }

    const row: VersionRow = { source, version };
    writes.push(tx.objectStore(VERSIONS_STORE).put(row));
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

    if (sourcesFilter) {
      return this.#searchPartitions(db, sourcesFilter, tokens, opts.limit);
    }

    return this.#searchAll(db, tokens, opts.limit);
  }

  async #searchAll(db: IDBPDatabase, tokens: string[], limit: number | undefined): Promise<SourcedFood[]> {
    const out: SourcedFood[] = [];
    const nameIdx = db.transaction(FOODS_STORE).store.index(NAME_INDEX);

    let cursor = await nameIdx.openCursor();
    while (cursor && (limit === undefined || out.length < limit)) {
      const food = cursor.value;

      if (isStoredFood(food) && nameMatchesTokens(food.name_key, tokens)) {
        const { name_key, ...rest } = food;
        out.push(rest);
      }

      cursor = await cursor.continue();
    }

    return out;
  }

  // Walks the by-source index once per listed source rather than the whole
  // name index, so a source that is off costs nothing per keystroke. The
  // per-partition cursors come back in source order, not search-key order,
  // so results are collected and sorted before the limit is applied.
  async #searchPartitions(
    db: IDBPDatabase, sources: string[], tokens: string[], limit: number | undefined,
  ): Promise<SourcedFood[]> {
    const sourceIdx = db.transaction(FOODS_STORE).store.index(SOURCE_INDEX);
    const matches: StoredFood[] = [];

    for (const source of new Set(sources)) {
      let cursor = await sourceIdx.openCursor(IDBKeyRange.only(source));
      while (cursor) {
        const food = cursor.value;

        if (isStoredFood(food) && nameMatchesTokens(food.name_key, tokens)) {
          matches.push(food);
        }

        cursor = await cursor.continue();
      }
    }

    matches.sort((a, b) => compareSearchHits(a.name_key, a.id, b.name_key, b.id));

    const taken = limit === undefined ? matches : matches.slice(0, limit);
    return taken.map(({ name_key, ...rest }) => rest);
  }

  async getMeta(key: string): Promise<unknown> {
    const db = await this.#db();
    const row = await db.get(META_STORE, key) as MetaRow | undefined;
    return row?.value;
  }

  async setMeta(key: string, value: unknown): Promise<void> {
    const db = await this.#db();
    const row: MetaRow = { key, value };
    await db.put(META_STORE, row);
  }

  async close(): Promise<void> {
    const db = await this.#connection.reset()?.catch(() => null);
    db?.close();
  }
}
