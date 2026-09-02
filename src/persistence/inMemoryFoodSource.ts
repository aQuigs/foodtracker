import type { SourcedFood, FoodSourceManifest, SearchOptions } from '../domain/types.js';
import type { FoodSourceRepository } from './foodSourceRepository.js';
import { nameMatchesTokens, queryTokens } from './foodNameMatch.js';
import { searchKey } from '../domain/searchKey.js';

// Keyed at write time like the IndexedDB adapter's name_key, so both
// adapters search the same precomputed value.
type Row = { key: string; item: SourcedFood };

export class InMemoryFoodSourceRepository implements FoodSourceRepository {
  #partitions = new Map<string, Row[]>();
  #manifests = new Map<string, FoodSourceManifest>();

  async currentVersion(source: string): Promise<string | null> {
    return this.#manifests.get(source)?.version ?? null;
  }

  async hydrate(source: string, items: SourcedFood[], manifest: FoodSourceManifest): Promise<void> {
    if (manifest.source !== source) {
      throw new Error(`hydrate(): manifest.source=${manifest.source} does not match source=${source}`);
    }

    const mistagged = items.find((it) => it.source !== source);
    if (mistagged) {
      throw new Error(`hydrate(): item ${mistagged.id} has source=${mistagged.source}, expected ${source}`);
    }

    this.#partitions.set(source, items.map((it) => ({ key: searchKey(it.name), item: structuredClone(it) })));
    this.#manifests.set(source, structuredClone(manifest));
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

    const matches: Row[] = [];
    for (const [source, rows] of this.#partitions) {
      if (sourcesFilter && !sourcesFilter.includes(source)) {
        continue;
      }

      for (const row of rows) {
        if (nameMatchesTokens(row.key, tokens)) {
          matches.push(row);
        }
      }
    }

    // Mirror IndexedDB exactly: the by-name-key index walks in UTF-16
    // code-unit order with primary-key (id) tie-breaks.
    matches.sort((a, b) => {
      if (a.key !== b.key) {
        return a.key < b.key ? -1 : 1;
      }

      return a.item.id < b.item.id ? -1 : a.item.id > b.item.id ? 1 : 0;
    });

    const taken = opts.limit === undefined ? matches : matches.slice(0, opts.limit);
    return taken.map((row) => structuredClone(row.item));
  }
}
