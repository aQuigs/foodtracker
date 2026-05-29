import type {
  SourcedFood,
  SourcedFoodId,
  FoodSourceManifest,
  SearchOptions,
} from '../domain/types.js';

export interface FoodSourceRepository {
  isHydrated(source: string): Promise<boolean>;
  currentVersion(source: string): Promise<string | null>;
  hydrate(source: string, items: SourcedFood[], manifest: FoodSourceManifest): Promise<void>;
  clear(source: string): Promise<void>;
  search(query: string, opts: SearchOptions): Promise<SourcedFood[]>;
  getById(id: SourcedFoodId): Promise<SourcedFood | null>;
  count(source?: string): Promise<number>;
}
