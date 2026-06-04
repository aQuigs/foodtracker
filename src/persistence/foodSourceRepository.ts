import type {
  SourcedFood,
  SourcedFoodId,
  FoodSourceManifest,
  SearchOptions,
} from '../domain/types.js';

export interface FoodSourceRepository {
  isHydrated(source: string): Promise<boolean>;
  currentVersion(source: string): Promise<string | null>;
  // Ids must be globally unique across sources (foods are keyed by id, not
  // by [source, id]); providers guarantee this via the `${source}:${sourceId}`
  // convention. Rejects items whose `source` field doesn't match `source`.
  hydrate(source: string, items: SourcedFood[], manifest: FoodSourceManifest): Promise<void>;
  clear(source: string): Promise<void>;
  // Results ordered by lowercased name (UTF-16 code units), ties by id.
  search(query: string, opts: SearchOptions): Promise<SourcedFood[]>;
  getById(id: SourcedFoodId): Promise<SourcedFood | null>;
  // Raw stored-row count; rows failing validation on read still count, so
  // this can exceed what search()/getById() will return.
  count(source?: string): Promise<number>;
}
