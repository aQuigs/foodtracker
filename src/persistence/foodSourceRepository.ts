import type { SourcedFood, FoodSourceManifest, SearchOptions } from '../domain/types.js';

export interface FoodSourceRepository {
  currentVersion(source: string): Promise<string | null>;
  // Replaces the source's partition and records its manifest. Ids must be
  // globally unique across sources (foods are keyed by id, not by
  // [source, id]); providers guarantee this via the `${source}:${sourceId}`
  // convention. Rejects items whose `source` field doesn't match `source`.
  hydrate(source: string, items: SourcedFood[], manifest: FoodSourceManifest): Promise<void>;
  // Matches on and orders by brandedSearchKey(item.name, item.brand) (UTF-16
  // code units), ties by id.
  // With `sources`, only those partitions are walked, so `limit` caps the
  // result after that (smaller) walk completes, not the walk itself.
  search(query: string, opts: SearchOptions): Promise<SourcedFood[]>;
  // Catalog-wide values that are not rows of any partition (the offline
  // copies of the manifest and the brand list). Callers validate what they
  // read back; the cache stores whatever structured-clonable value it was
  // handed.
  getMeta(key: string): Promise<unknown>;
  setMeta(key: string, value: unknown): Promise<void>;
}
