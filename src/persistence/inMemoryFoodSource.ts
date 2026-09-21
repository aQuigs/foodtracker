import type { SourcedFood, SearchOptions } from '../domain/types.js';
import type { FoodSourceRepository } from './foodSourceRepository.js';
import { compareSearchHits } from './foodNameMatch.js';
import { nameMatchesTokens, queryTokens } from '../domain/searchKey.js';
import { brandedSearchKey } from '../domain/foodSources.js';

// Keyed at write time like the IndexedDB adapter's name_key, so both
// adapters search the same precomputed value.
type Row = { key: string; item: SourcedFood };

export class InMemoryFoodSourceRepository implements FoodSourceRepository {
  #partitions = new Map<string, Row[]>();
  #versions = new Map<string, string>();
  #meta = new Map<string, unknown>();

  async currentVersion(source: string): Promise<string | null> {
    return this.#versions.get(source) ?? null;
  }

  async hydrate(source: string, items: SourcedFood[], version: string): Promise<void> {
    const mistagged = items.find((it) => it.source !== source);
    if (mistagged) {
      throw new Error(`hydrate(): item ${mistagged.id} has source=${mistagged.source}, expected ${source}`);
    }

    this.#partitions.set(source, items.map((it) => ({ key: brandedSearchKey(it.name, it.brand), item: structuredClone(it) })));
    this.#versions.set(source, version);
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

    matches.sort((a, b) => compareSearchHits(a.key, a.item.id, b.key, b.item.id));

    const taken = opts.limit === undefined ? matches : matches.slice(0, opts.limit);
    return taken.map((row) => structuredClone(row.item));
  }

  async getMeta(key: string): Promise<unknown> {
    return structuredClone(this.#meta.get(key));
  }

  async setMeta(key: string, value: unknown): Promise<void> {
    this.#meta.set(key, structuredClone(value));
  }
}
