import type { SourcedFood, FoodSourceManifest, SearchOptions } from '../domain/types.js';
import type { FoodSourceRepository } from './foodSourceRepository.js';
import { nameMatchesTokens, queryTokens } from './foodNameMatch.js';
import { searchKey } from '../domain/searchKey.js';

export class InMemoryFoodSourceRepository implements FoodSourceRepository {
  #partitions = new Map<string, SourcedFood[]>();
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

    this.#partitions.set(source, items.map((it) => structuredClone(it)));
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

    const matches: SourcedFood[] = [];
    for (const [source, items] of this.#partitions) {
      if (sourcesFilter && !sourcesFilter.includes(source)) {
        continue;
      }

      for (const item of items) {
        if (nameMatchesTokens(searchKey(item.name), tokens)) {
          matches.push(item);
        }
      }
    }

    // Mirror IndexedDB exactly: the by-name-key index walks in UTF-16
    // code-unit order with primary-key (id) tie-breaks.
    matches.sort((a, b) => {
      const an = searchKey(a.name);
      const bn = searchKey(b.name);

      if (an !== bn) {
        return an < bn ? -1 : 1;
      }

      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });

    const taken = opts.limit === undefined ? matches : matches.slice(0, opts.limit);
    return taken.map((item) => structuredClone(item));
  }
}
