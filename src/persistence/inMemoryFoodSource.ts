import type {
  SourcedFood,
  SourcedFoodId,
  FoodSourceManifest,
  SearchOptions,
} from '../domain/types.js';
import type { FoodSourceRepository } from './foodSourceRepository.js';

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

    this.#partitions.set(source, items.map((it) => structuredClone(it)));
    this.#manifests.set(source, structuredClone(manifest));
  }

  async clear(source: string): Promise<void> {
    this.#partitions.delete(source);
    this.#manifests.delete(source);
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

    const out: SourcedFood[] = [];
    for (const [source, items] of this.#partitions) {
      if (sourcesFilter && !sourcesFilter.includes(source)) {
        continue;
      }

      for (const item of items) {
        if (item.name.toLowerCase().includes(q)) {
          out.push(structuredClone(item));

          if (out.length >= opts.limit) {
            return out;
          }
        }
      }
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
