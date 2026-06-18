import type {
  SourcedFood,
  SourcedFoodId,
  FoodSourceManifest,
  SearchOptions,
} from '../domain/types.js';
import type { FoodSourceRepository } from './foodSourceRepository.js';
import { nameMatchesTokens, queryTokens } from './foodNameMatch.js';

export class InMemoryFoodSourceRepository implements FoodSourceRepository {
  #partitions = new Map<string, SourcedFood[]>();
  #manifests = new Map<string, FoodSourceManifest>();

  async isHydrated(source: string): Promise<boolean> {
    return this.#manifests.has(source);
  }

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

  async clear(source: string): Promise<void> {
    this.#partitions.delete(source);
    this.#manifests.delete(source);
  }

  async search(query: string, opts: SearchOptions): Promise<SourcedFood[]> {
    const tokens = queryTokens(query);

    if (tokens.length === 0) {
      return [];
    }

    const sourcesFilter = opts.sources;

    if (sourcesFilter && sourcesFilter.length === 0) {
      return [];
    }

    const matches: SourcedFood[] = [];
    for (const [source, items] of this.#partitions) {
      if (sourcesFilter && !sourcesFilter.includes(source)) {
        continue;
      }

      for (const item of items) {
        if (nameMatchesTokens(item.name.toLowerCase(), tokens)) {
          matches.push(item);
        }
      }
    }

    // Mirror IndexedDB exactly: the by-name-lower index walks in UTF-16
    // code-unit order with primary-key (id) tie-breaks, and the limit gate
    // is `out.length < limit` checked before each take.
    matches.sort((a, b) => {
      const an = a.name.toLowerCase();
      const bn = b.name.toLowerCase();

      if (an !== bn) {
        return an < bn ? -1 : 1;
      }

      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });

    const out: SourcedFood[] = [];
    for (const item of matches) {
      if (!(out.length < opts.limit)) {
        break;
      }

      out.push(structuredClone(item));
    }

    return out;
  }

  async getById(id: SourcedFoodId): Promise<SourcedFood | null> {
    for (const items of this.#partitions.values()) {
      const found = items.find((it) => it.id === id);

      if (found) {
        return structuredClone(found);
      }
    }

    return null;
  }

  async count(source?: string): Promise<number> {
    if (source !== undefined) {
      return this.#partitions.get(source)?.length ?? 0;
    }

    let total = 0;
    for (const items of this.#partitions.values()) {
      total += items.length;
    }
    return total;
  }
}
