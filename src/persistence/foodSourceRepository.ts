import type { SourcedFood, FoodSourceManifest, SearchOptions } from '../domain/types.js';

export interface FoodSourceRepository {
  currentVersion(source: string): Promise<string | null>;
  // Replaces the source's partition and records its manifest. Ids must be
  // globally unique across sources (foods are keyed by id, not by
  // [source, id]); providers guarantee this via the `${source}:${sourceId}`
  // convention. Rejects items whose `source` field doesn't match `source`.
  hydrate(source: string, items: SourcedFood[], manifest: FoodSourceManifest): Promise<void>;
  // Results ordered by lowercased name (UTF-16 code units), ties by id.
  search(query: string, opts: SearchOptions): Promise<SourcedFood[]>;
}
