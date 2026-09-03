import type { SourcedFood, FoodSourceManifest, SearchOptions } from '../domain/types.js';

export interface FoodSourceRepository {
  currentVersion(source: string): Promise<string | null>;
  // Replaces the source's partition and records its manifest. Ids must be
  // globally unique across sources (foods are keyed by id, not by
  // [source, id]); providers guarantee this via the `${source}:${sourceId}`
  // convention. Rejects items whose `source` field doesn't match `source`.
  hydrate(source: string, items: SourcedFood[], manifest: FoodSourceManifest): Promise<void>;
  // Matches on and orders by searchKey(name) (UTF-16 code units), ties by id.
  // With `sources`, only those partitions are walked, so `limit` caps the
  // result after that (smaller) walk completes, not the walk itself.
  search(query: string, opts: SearchOptions): Promise<SourcedFood[]>;
}
